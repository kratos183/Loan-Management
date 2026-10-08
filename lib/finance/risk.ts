/**
 * Underwriting rules.
 *
 * These encode what a credit committee would check. Every rule returns a
 * `PASS` / `WARN` / `FAIL` so the UI can show a scorecard rather than a
 * single opaque rejection.
 */

import type { Liability, LoanProduct, Profile } from "@/lib/db/types";
import { calculateEmi, round2 } from "./emi";

export type Verdict = "PASS" | "WARN" | "FAIL";

export interface RuleResult {
  code: string;
  label: string;
  verdict: Verdict;
  message: string;
  actual?: string;
  required?: string;
}

export interface EligibilityInput {
  profile: Pick<Profile, "monthly_income" | "pan"> | null;
  product: LoanProduct;
  requestedAmount: number;
  tenureMonths: number;
  liabilities: Pick<Liability, "monthly_amount" | "is_active" | "lender">[];
  /** Highest live CIBIL score, or null if never checked. */
  cibilScore?: number | null;
}

export interface EligibilityResult {
  verdict: Verdict;
  rules: RuleResult[];
  emi: number;
  /** Fixed Obligations / Income Ratio, as a percentage of net income. */
  foir: number;
  existingEmiBurden: number;
  disposableIncome: number;
  blockers: string[];
}

const fmtMoney = (n: number) =>
  `₹${Math.round(n).toLocaleString("en-IN")}`;

/**
 * Run the full eligibility check for a loan request.
 *
 * FOIR (Fixed Obligations to Income Ratio) is the primary debt-burden test:
 *   FOIR = (proposed EMI + all existing EMIs) / net monthly income × 100
 * Lenders typically cap this at 50–55%.
 */
export function assessEligibility(input: EligibilityInput): EligibilityResult {
  const { profile, product, requestedAmount, tenureMonths, liabilities } = input;
  const rules: RuleResult[] = [];

  const income = profile?.monthly_income ?? 0;
  const activeLiabilities = liabilities.filter((l) => l.is_active);
  const existingBurden = round2(
    activeLiabilities.reduce((sum, l) => sum + Number(l.monthly_amount), 0),
  );

  // Midpoint of the product's rate band is what a system-pricing prototype uses
  const rate = (Number(product.min_rate) + Number(product.max_rate)) / 2;
  const emi = calculateEmi(requestedAmount, rate, tenureMonths);

  // ── Income ────────────────────────────────────────────────────────────────
  if (!income || income <= 0) {
    rules.push({
      code: "INCOME",
      label: "Monthly income declared",
      verdict: "FAIL",
      message: "No monthly income on record. The applicant must declare income first.",
      actual: "—",
      required: fmtMoney(product.min_monthly_income ?? 0),
    });
  } else if (product.min_monthly_income && income < product.min_monthly_income) {
    rules.push({
      code: "INCOME",
      label: "Monthly income",
      verdict: "FAIL",
      message: "Declared income is below the product minimum.",
      actual: fmtMoney(income),
      required: fmtMoney(product.min_monthly_income),
    });
  } else {
    rules.push({
      code: "INCOME",
      label: "Monthly income",
      verdict: "PASS",
      message: "Income meets the product requirement.",
      actual: fmtMoney(income),
      required: product.min_monthly_income ? fmtMoney(product.min_monthly_income) : "—",
    });
  }

  // ── Amount ───────────────────────────────────────────────────────────────
  if (requestedAmount < product.min_amount || requestedAmount > product.max_amount) {
    rules.push({
      code: "AMOUNT",
      label: "Requested amount",
      verdict: "FAIL",
      message: "Requested amount is outside the sanctioned range for this product.",
      actual: fmtMoney(requestedAmount),
      required: `${fmtMoney(product.min_amount)} – ${fmtMoney(product.max_amount)}`,
    });
  } else {
    rules.push({
      code: "AMOUNT",
      label: "Requested amount",
      verdict: "PASS",
      message: "Amount is within the sanctioned range.",
      actual: fmtMoney(requestedAmount),
      required: `${fmtMoney(product.min_amount)} – ${fmtMoney(product.max_amount)}`,
    });
  }

  // ── Tenure ───────────────────────────────────────────────────────────────
  if (tenureMonths < product.min_tenure_months || tenureMonths > product.max_tenure_months) {
    rules.push({
      code: "TENURE",
      label: "Tenure",
      verdict: "FAIL",
      message: "Tenure is outside the permitted range for this product.",
      actual: `${tenureMonths} months`,
      required: `${product.min_tenure_months} – ${product.max_tenure_months} months`,
    });
  } else {
    rules.push({
      code: "TENURE",
      label: "Tenure",
      verdict: "PASS",
      message: "Tenure is within the permitted range.",
      actual: `${tenureMonths} months`,
      required: `${product.min_tenure_months} – ${product.max_tenure_months} months`,
    });
  }

  // ── FOIR / debt burden ───────────────────────────────────────────────────
  const totalBurden = round2(existingBurden + emi);
  const foir = income > 0 ? round2((totalBurden / income) * 100) : 0;
  const disposableIncome = round2(income - totalBurden);

  if (income <= 0) {
    rules.push({
      code: "FOIR",
      label: "Debt burden (FOIR)",
      verdict: "FAIL",
      message: "Cannot compute FOIR without declared income.",
      actual: "—",
      required: `≤ ${product.max_foir}%`,
    });
  } else if (foir > product.max_foir) {
    rules.push({
      code: "FOIR",
      label: "Debt burden (FOIR)",
      verdict: "FAIL",
      message: `FOIR of ${foir}% exceeds the ${product.max_foir}% ceiling for this product. Total obligations leave no headroom. Consider a lower amount or a longer tenure.`,
      actual: `${foir}%`,
      required: `≤ ${product.max_foir}%`,
    });
  } else if (foir > product.max_foir * 0.85) {
    rules.push({
      code: "FOIR",
      label: "Debt burden (FOIR)",
      verdict: "WARN",
      message: "Debt burden is close to the limit — needs manual verification.",
      actual: `${foir}%`,
      required: `≤ ${product.max_foir}%`,
    });
  } else {
    rules.push({
      code: "FOIR",
      label: "Debt burden (FOIR)",
      verdict: "PASS",
      message: "Debt burden is comfortably within the limit.",
      actual: `${foir}%`,
      required: `≤ ${product.max_foir}%`,
    });
  }

  // ── Disposable income / headroom ─────────────────────────────────────────
  // A percentage-of-income surplus test is redundant with FOIR: if FOIR is
  // under the cap, surplus is already large. What actually matters is
  // whether the applicant could absorb ONE missed instalment, which is a
  // genuine risk signal that FOIR alone doesn't capture.
  const monthsCovered = emi > 0 ? disposableIncome / emi : Infinity;

  if (income > 0 && disposableIncome <= 0) {
    rules.push({
      code: "HEADROOM",
      label: "Headroom after EMIs",
      verdict: "FAIL",
      message: "No income left after servicing existing and proposed obligations.",
      actual: fmtMoney(disposableIncome),
      required: "Positive",
    });
  } else if (income > 0 && monthsCovered < 1) {
    rules.push({
      code: "HEADROOM",
      label: "Headroom after EMIs",
      verdict: "WARN",
      message:
        "Monthly surplus does not cover a single missed instalment. The borrower would slip into arrears on any income shock.",
      actual: `${fmtMoney(disposableIncome)} (${monthsCovered.toFixed(1)}× EMI)`,
      required: "≥ 1.5× EMI",
    });
  } else if (income > 0 && monthsCovered < 1.5) {
    rules.push({
      code: "HEADROOM",
      label: "Headroom after EMIs",
      verdict: "WARN",
      message: "Headroom is thin — one missed instalment would put the account in arrears.",
      actual: `${fmtMoney(disposableIncome)} (${monthsCovered.toFixed(1)}× EMI)`,
      required: "≥ 1.5× EMI",
    });
  } else if (income > 0) {
    rules.push({
      code: "HEADROOM",
      label: "Headroom after EMIs",
      verdict: "PASS",
      message: `Surplus covers ${monthsCovered.toFixed(1)} instalments, so a missed payment is absorbable.`,
      actual: fmtMoney(disposableIncome),
      required: "≥ 1.5× EMI",
    });
  }

  // ── Credit score ─────────────────────────────────────────────────────────
  const minCibil = product.min_cibil ?? 700;
  if (input.cibilScore == null) {
    rules.push({
      code: "CIBIL",
      label: "Credit score",
      verdict: "WARN",
      message: "No credit score on file — pull one before deciding.",
      actual: "Not checked",
      required: `≥ ${minCibil}`,
    });
  } else if (input.cibilScore < minCibil - 100) {
    rules.push({
      code: "CIBIL",
      label: "Credit score",
      verdict: "FAIL",
      message: "Credit score is significantly below the product requirement.",
      actual: String(input.cibilScore),
      required: `≥ ${minCibil}`,
    });
  } else if (input.cibilScore < minCibil) {
    rules.push({
      code: "CIBIL",
      label: "Credit score",
      verdict: "WARN",
      message: "Credit score is below the ideal threshold — refer for manual review.",
      actual: String(input.cibilScore),
      required: `≥ ${minCibil}`,
    });
  } else {
    rules.push({
      code: "CIBIL",
      label: "Credit score",
      verdict: "PASS",
      message: "Credit score clears the product threshold.",
      actual: String(input.cibilScore),
      required: `≥ ${minCibil}`,
    });
  }

  // ── Collateral cover (secured loans only) ────────────────────────────────
  if (product.collateral_type !== "NONE") {
    rules.push({
      code: "COLLATERAL",
      label: "Collateral cover",
      verdict: "PASS",
      message: `Collateral required: ${product.collateral_type.toLowerCase()}. Valuation happens at verification.`,
      actual: product.collateral_type,
      required: "Valued ≥ 1.5× principal",
    });
  }

  // ── PAN on file ──────────────────────────────────────────────────────────
  if (!profile?.pan) {
    rules.push({
      code: "PAN",
      label: "PAN on record",
      verdict: "WARN",
      message: "PAN is missing — required for bureau check and disbursement.",
      actual: "Missing",
      required: "On record",
    });
  }

  const blockers = rules.filter((r) => r.verdict === "FAIL").map((r) => r.message);
  const verdict: Verdict = blockers.length
    ? "FAIL"
    : rules.some((r) => r.verdict === "WARN")
      ? "WARN"
      : "PASS";

  return {
    verdict,
    rules,
    emi,
    foir,
    existingEmiBurden: existingBurden,
    disposableIncome,
    blockers,
  };
}

/**
 * Approval authority (GAP 2 & 7).
 *
 * An OFFICER may approve up to their personal `approval_limit`. Anything
 * above escalates to a MANAGER, which is how Indian NBFCs structure
 * delegated sanctioning authority.
 */
export function approvalAuthority(input: {
  amount: number;
  officerLimit: number | null;
}): "OFFICER" | "MANAGER" | "ADMIN" {
  const { amount, officerLimit } = input;
  if (officerLimit == null) return "ADMIN";
  if (amount <= officerLimit) return "OFFICER";
  // Twice the officer's limit is the manager's ceiling; beyond that, admin
  return amount <= officerLimit * 4 ? "MANAGER" : "ADMIN";
}

/** CIBIL score → band. Mirrors the `cibil_band` enum. */
export function cibilBand(score: number): "EXCELLENT" | "GOOD" | "AVERAGE" | "POOR" {
  if (score >= 800) return "EXCELLENT";
  if (score >= 750) return "GOOD";
  if (score >= 700) return "AVERAGE";
  return "POOR";
}

/** Human-readable explanation of what moves a score, used on the CIBIL page. */
export function cibilFactorRange(band: string): string {
  switch (band) {
    case "EXCELLENT":
      return "800 – 900";
    case "GOOD":
      return "750 – 799";
    case "AVERAGE":
      return "700 – 749";
    default:
      return "300 – 699";
  }
}