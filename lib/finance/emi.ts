/**
 * Loan mathematics.
 *
 * Everything here is a pure function so it can be unit-tested and reused from
 * both the browser (EMI calculator widget) and the server (schedules, reports).
 *
 * INTEREST METHOD: reducing balance (EMI). Flat-rate interest is a legacy
 * practice and is not permitted for retail loans under RBI norms — see
 * `interest_method` on the `loans` table.
 *
 * These functions mirror `calculate_emi()` in 0001_core_schema.sql exactly.
 */

export interface AmortizationInput {
  principal: number;
  annualRate: number; // percent, e.g. 11.5
  months: number;
  /** First instalment due date. Defaults to one month after disbursement. */
  startDate?: Date;
}

export interface AmortizationRow {
  installmentNo: number;
  dueDate: string; // YYYY-MM-DD
  principalPart: number;
  interestPart: number;
  amountDue: number;
  openingBalance: number;
  closingBalance: number;
}

/** Round to 2 decimal places, avoiding float drift (0.145 → 0.15, not 0.14). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Standard reducing-balance EMI.
 *
 *   E = P × r × (1+r)^n / ((1+r)^n − 1)
 *
 * @param principal  loan amount
 * @param annualRate annual interest rate in percent
 * @param months     tenure in months
 */
export function calculateEmi(
  principal: number,
  annualRate: number,
  months: number,
): number {
  if (!Number.isFinite(principal) || principal <= 0) return 0;
  if (!Number.isFinite(months) || months <= 0) return 0;

  const r = annualRate / 1200; // percent per year → decimal per month

  // 0% interest is a special case the formula divides by zero on
  if (r === 0) return round2(principal / months);

  const growth = Math.pow(1 + r, months);
  return round2((principal * r * growth) / (growth - 1));
}

/** Total interest payable over the full tenure. */
export function totalInterest(principal: number, annualRate: number, months: number): number {
  return round2(calculateEmi(principal, annualRate, months) * months - principal);
}

/** Total amount the borrower will hand over (principal + interest). */
export function totalPayable(principal: number, annualRate: number, months: number): number {
  return round2(principal + totalInterest(principal, annualRate, months));
}

/**
 * Build the month-by-month amortisation schedule.
 *
 * The final instalment absorbs accumulated rounding drift so that the sum of
 * all `principalPart` values equals the original principal exactly.
 */
export function buildAmortization({
  principal,
  annualRate,
  months,
  startDate,
}: AmortizationInput): AmortizationRow[] {
  if (principal <= 0 || months <= 0) return [];

  const emi = calculateEmi(principal, annualRate, months);
  const r = annualRate / 1200;

  const firstDue = startDate
    ? addMonths(startDate, 1)
    : addMonths(new Date(), 1);

  const rows: AmortizationRow[] = [];
  let balance = principal;
  let cumulativePrincipal = 0;

  for (let i = 1; i <= months; i++) {
    const openingBalance = balance;
    let interestPart = round2(openingBalance * r);
    let principalPart = round2(emi - interestPart);

    const isLast = i === months;

    // Final instalment: pay off whatever balance remains
    if (isLast) {
      principalPart = round2(openingBalance);
      interestPart = round2(emi - principalPart);
      if (principalPart + interestPart < 0) interestPart = 0;
    }

    // Never let a row go negative on tiny loans / very long tenures
    if (principalPart > openingBalance) principalPart = openingBalance;

    balance = round2(openingBalance - principalPart);
    cumulativePrincipal = round2(cumulativePrincipal + principalPart);

    rows.push({
      installmentNo: i,
      dueDate: toISODate(firstDue, i - 1),
      principalPart,
      interestPart,
      amountDue: round2(principalPart + interestPart),
      openingBalance,
      closingBalance: balance,
    });
  }

  // Drift correction: nudge the final principal slice by the rounding residue
  const residue = round2(principal - cumulativePrincipal);
  if (residue !== 0 && rows.length > 0) {
    const last = rows[rows.length - 1];
    last.principalPart = round2(last.principalPart + residue);
    last.amountDue = round2(last.principalPart + last.interestPart);
    last.closingBalance = round2(last.closingBalance - residue);
  }

  return rows;
}

/**
 * Late-payment charge. Industry standard is the HIGHER of a flat fee or a
 * percentage of the overdue amount — whichever hurts less to the lender is
 * the flat one, so we charge the higher. Both come from `loan_products`.
 */
export function latePaymentCharge(
  overdueAmount: number,
  flatFee: number,
  percentageFee: number,
): number {
  return round2(Math.max(flatFee, (overdueAmount * percentageFee) / 100));
}

export type PrepaymentMode = "REDUCE_TENURE" | "REDUCE_EMI";

export interface PrepaymentResult {
  outstandingBefore: number;
  outstandingAfter: number;
  prepayAmount: number;
  mode: PrepaymentMode;
  /** Resulting monthly instalment. */
  newEmi: number;
  /** Resulting remaining tenure in months. */
  newTenureMonths: number;
  /** Instalments the borrower saves by this prepayment. */
  monthsSaved: number;
  /** Total interest saved over the remaining life of the loan. */
  interestSaved: number;
}

/**
 * What happens if the borrower pays extra up front.
 *
 * `REDUCE_TENURE` — EMI stays the same, the loan closes sooner (default
 *                   behaviour at Indian lenders; maximises interest saved).
 * `REDUCE_EMI`    — tenure stays the same, the monthly outgo falls.
 */
export function prepaymentImpact(input: {
  outstanding: number;
  annualRate: number;
  currentEmi: number;
  monthsRemaining: number;
  prepayAmount: number;
  mode: PrepaymentMode;
}): PrepaymentResult | null {
  const { outstanding, annualRate, currentEmi, monthsRemaining, prepayAmount, mode } = input;

  if (outstanding <= 0 || monthsRemaining <= 0 || prepayAmount <= 0) return null;
  if (prepayAmount >= outstanding) {
    // Full foreclosure — nothing left after this
    return {
      outstandingBefore: round2(outstanding),
      outstandingAfter: 0,
      prepayAmount: round2(outstanding),
      mode,
      newEmi: 0,
      newTenureMonths: 0,
      monthsSaved: monthsRemaining,
      interestSaved: futureInterest(outstanding, annualRate, currentEmi, monthsRemaining),
    };
  }

  const outstandingAfter = round2(outstanding - prepayAmount);
  const r = annualRate / 1200;

  let newEmi: number;
  let newTenureMonths: number;

  if (mode === "REDUCE_TENURE") {
    newEmi = currentEmi;
    if (r === 0) {
      newTenureMonths = Math.max(0, Math.ceil(outstandingAfter / currentEmi));
    } else {
      // Solve n from  P·r·(1+r)^n / ((1+r)^n − 1) = E   →   n = −ln(1 − P·r/E) / ln(1+r)
      const ratio = 1 - (outstandingAfter * r) / currentEmi;
      newTenureMonths =
        ratio <= 0
          ? monthsRemaining // EMI no longer covers interest; keep tenure as-is
          : Math.max(1, Math.ceil(-Math.log(ratio) / Math.log(1 + r)));
    }
    // Never let the new tenure exceed what was left
    newTenureMonths = Math.min(newTenureMonths, monthsRemaining);
  } else {
    newTenureMonths = monthsRemaining;
    newEmi = calculateEmi(outstandingAfter, annualRate, monthsRemaining);
  }

  const interestSaved = round2(
    futureInterest(outstanding, annualRate, currentEmi, monthsRemaining) -
      futureInterest(outstandingAfter, annualRate, newEmi, newTenureMonths),
  );

  return {
    outstandingBefore: round2(outstanding),
    outstandingAfter,
    prepayAmount: round2(prepayAmount),
    mode,
    newEmi: round2(newEmi),
    newTenureMonths,
    monthsSaved: Math.max(0, monthsRemaining - newTenureMonths),
    interestSaved: Math.max(0, interestSaved),
  };
}

/** Interest still to be paid over `months` instalments of `emi`. */
function futureInterest(
  outstanding: number,
  annualRate: number,
  emi: number,
  months: number,
): number {
  if (months <= 0 || outstanding <= 0 || emi <= 0) return 0;
  return round2(emi * months - outstanding);
}

// ─── Date helpers ───────────────────────────────────────────────────────────

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const targetDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  // Clamp to the last valid day (e.g. 31 Jan + 1 month → 28/29 Feb)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(targetDay, lastDay));
  return d;
}

export function toISODate(date: Date, monthOffset = 0): string {
  const d = monthOffset === 0 ? date : addMonths(date, monthOffset);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: Date | string, to: Date | string): number {
  const a = typeof from === "string" ? new Date(from) : from;
  const b = typeof to === "string" ? new Date(to) : to;
  const ms = b.setHours(12, 0, 0, 0) - a.setHours(12, 0, 0, 0);
  return Math.floor(ms / 86_400_000);
}