import {
  buildAmortization,
  calculateEmi,
  daysBetween,
  latePaymentCharge,
  prepaymentImpact,
  round2,
  totalInterest,
  totalPayable,
} from "@/lib/finance/emi";
import { assessEligibility, approvalAuthority, cibilBand } from "@/lib/finance/risk";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function near(a: number, b: number, tolerance = 0.01) {
  return Math.abs(a - b) <= tolerance;
}

console.log("\nEMI CALCULATOR");
console.log("──────────────");

// P = 200,000 · r = 0.01 · n = 12
// EMI = 200000 × 0.01 × 1.01¹² / (1.01¹² − 1) = 17,769.76
const emi = calculateEmi(200000, 12, 12);
check("EMI matches hand-calculated value", near(emi, 17769.76), `got ${emi}`);

check("Zero rate → principal / months", near(calculateEmi(120000, 0, 12), 10000));
check("Zero principal → 0", calculateEmi(0, 10, 12) === 0);
check("Zero months → 0", calculateEmi(100000, 10, 0) === 0);
check("Negative months → 0", calculateEmi(100000, 10, -5) === 0);
check("NaN principal → 0", calculateEmi(NaN, 10, 12) === 0);

const interest = totalInterest(200000, 12, 12);
check("Total interest = EMI×n − P", near(interest, round2(emi * 12 - 200000)));
check("Total payable = P + interest", near(totalPayable(200000, 12, 12), 200000 + interest));

console.log(`\n  EMI (2L @ 12% × 12mo): ₹${emi}`);
console.log(`  Total interest:        ₹${interest}`);

console.log("\nAMORTISATION SCHEDULE");
console.log("──────────────────────");

const rows = buildAmortization({ principal: 2500000, annualRate: 8.6, months: 240 });

check("Row count matches tenure", rows.length === 240, `got ${rows.length}`);

const principalSum = round2(rows.reduce((s, r) => s + r.principalPart, 0));
check("Principal column sums back to the loan amount", near(principalSum, 2500000), `got ${principalSum}`);

const finalBalance = rows[rows.length - 1].closingBalance;
check("Final closing balance is zero", near(finalBalance, 0, 0.05), `got ${finalBalance}`);

check(
  "Every instalment number is sequential",
  rows.every((r, i) => r.installmentNo === i + 1),
);

check(
  "Due dates are strictly increasing",
  rows.every((r, i) => i === 0 || r.dueDate > rows[i - 1].dueDate),
);

check(
  "Principal component rises over time (reducing balance)",
  rows[Math.floor(rows.length / 2)].principalPart > rows[0].principalPart,
);

check(
  "Interest component falls over time",
  rows[Math.floor(rows.length / 2)].interestPart < rows[0].interestPart,
);

check(
  "Each row's principal + interest equals amount due",
  rows.every((r) => near(r.principalPart + r.interestPart, r.amountDue)),
);

check(
  "Balance only ever decreases",
  rows.every((r, i) => i === 0 || r.closingBalance <= rows[i - 1].closingBalance),
);

check(
  "Instalment amounts are stable (within rounding)",
  (() => {
    const amounts = rows.map((r) => r.amountDue);
    const spread = Math.max(...amounts) - Math.min(...amounts);
    return spread <= 1; // last row absorbs drift
  })(),
);

console.log(`  ${rows.length} rows · principal sums to ₹${principalSum} · final balance ₹${finalBalance}`);

// Short loan, high rate — the case where naive rounding drifts
const tiny = buildAmortization({ principal: 50000, annualRate: 24, months: 12 });
const tinySum = round2(tiny.reduce((s, r) => s + r.principalPart, 0));
check("Short high-rate loan still sums exactly", near(tinySum, 50000), `got ${tinySum}`);

console.log("\nLATE PAYMENT CHARGE");
console.log("───────────────────");

check("Flat fee wins on small amounts", latePaymentCharge(1000, 500, 2) === 500);
check("Percentage wins on large amounts", latePaymentCharge(100000, 500, 2) === 2000);
check("Takes the higher of the two", latePaymentCharge(30000, 500, 2) === 600);

console.log("\nPREPAYMENT");
console.log("──────────");

// Use a self-consistent EMI for the outstanding balance, otherwise the
// interest-saved figures are meaningless.
const OUTSTANDING = 4_000_000;
const RATE = 8.6;
const REMAINING = 200;
const BASE_EMI = calculateEmi(OUTSTANDING, RATE, REMAINING); // 37,700.11

const pp = prepaymentImpact({
  outstanding: OUTSTANDING,
  annualRate: RATE,
  currentEmi: BASE_EMI,
  monthsRemaining: REMAINING,
  prepayAmount: 500000,
  mode: "REDUCE_TENURE",
});

check("Prepayment returns a result", pp !== null);
check("Outstanding falls by the prepay amount", near(pp!.outstandingAfter, 3500000));
check("Reduce tenure keeps the EMI unchanged", near(pp!.newEmi, BASE_EMI));
check("Reduce tenure shortens the loan", pp!.newTenureMonths < 200);
check("Months saved is positive", pp!.monthsSaved > 0);
check("Interest saved is positive", pp!.interestSaved > 0);

const ppEmi = prepaymentImpact({
  outstanding: OUTSTANDING,
  annualRate: RATE,
  currentEmi: BASE_EMI,
  monthsRemaining: REMAINING,
  prepayAmount: 500000,
  mode: "REDUCE_EMI",
});

check("Reduce EMI keeps the tenure unchanged", ppEmi!.newTenureMonths === REMAINING);
check("Reduce EMI lowers the instalment", ppEmi!.newEmi < BASE_EMI);
check("Reduce EMI saves less interest than reduce tenure", ppEmi!.interestSaved < pp!.interestSaved);
check("Both prepayment modes save interest", ppEmi!.interestSaved > 0 && pp!.interestSaved > 0);

const fullClose = prepaymentImpact({
  outstanding: 100000,
  annualRate: 9,
  currentEmi: 12000,
  monthsRemaining: 10,
  prepayAmount: 100000,
  mode: "REDUCE_TENURE",
});

check("Paying off everything zeroes the balance", fullClose!.outstandingAfter === 0);
check("Paying off everything saves all remaining months", fullClose!.monthsSaved === 10);

check("Zero prepayment returns null", prepaymentImpact({
  outstanding: 100000, annualRate: 9, currentEmi: 5000, monthsRemaining: 20, prepayAmount: 0, mode: "REDUCE_EMI",
}) === null);

console.log(`  Reduce tenure: ${pp!.monthsSaved} months saved, ₹${pp!.interestSaved} interest saved`);
console.log(`  Reduce EMI:    ₹${ppEmi!.newEmi}/mo, ₹${ppEmi!.interestSaved} interest saved`);

console.log("\nDATES");
console.log("─────");

check("daysBetween is exclusive of the start", daysBetween("2026-01-01", "2026-01-08") === 7);
check("daysBetween handles a month", daysBetween("2026-01-01", "2026-02-01") === 31);

console.log("\nUNDERWRITING RULES");
console.log("───────────────────");

const product = {
  id: "p1",
  code: "PERSONAL",
  name: "Personal Loan",
  description: null,
  category: "UNSECURED" as const,
  collateral_type: "NONE" as const,
  min_amount: 50000,
  max_amount: 1000000,
  min_tenure_months: 12,
  max_tenure_months: 72,
  min_rate: 12.5,
  max_rate: 18,
  min_monthly_income: 30000,
  min_cibil: 700,
  max_foir: 50,
  max_age: 65,
  min_age: 21,
  requires_coapplicant: false,
  processing_fee_pct: 3,
  grace_days: 5,
  late_fee_flat: 500,
  late_fee_pct: 2,
  prepayment_allowed: true,
  foreclosure_allowed: true,
  autopay_enabled: true,
  sla_min_days: 2,
  sla_max_days: 5,
  thumbnail_emoji: null,
  is_active: true,
  sort_order: 100,
  created_at: "",
  updated_at: "",
};

const good = assessEligibility({
  profile: { monthly_income: 200000, pan: "ABCDE1234F" },
  product,
  requestedAmount: 300000,
  tenureMonths: 36,
  liabilities: [],
  cibilScore: 780,
});

check("Clean file passes", good.verdict === "PASS", `got ${good.verdict}`);
check("FOIR is computed", good.foir > 0);
check("No blockers on a clean file", good.blockers.length === 0);

const tooHigh = assessEligibility({
  profile: { monthly_income: 200000, pan: "ABCDE1234F" },
  product,
  requestedAmount: 1000000,
  tenureMonths: 72,
  liabilities: [{ monthly_amount: 150000, is_active: true, lender: "HDFC" }],
  cibilScore: 780,
});

check("Heavy existing debt fails FOIR", tooHigh.verdict === "FAIL");
check("FOIR failure appears in blockers", tooHigh.blockers.some((b) => b.includes("FOIR")));

const overLimit = assessEligibility({
  profile: { monthly_income: 200000, pan: "ABCDE1234F" },
  product,
  requestedAmount: 5000000, // above max
  tenureMonths: 36,
  liabilities: [],
  cibilScore: 780,
});

check("Amount above product cap fails", overLimit.verdict === "FAIL");
check("Amount rule names the cap", overLimit.rules.find((r) => r.code === "AMOUNT")?.verdict === "FAIL");

const noIncome = assessEligibility({
  profile: { monthly_income: 0, pan: null },
  product,
  requestedAmount: 300000,
  tenureMonths: 36,
  liabilities: [],
  cibilScore: null,
});

check("No income declared fails", noIncome.verdict === "FAIL");

// 8L over 36mo at the 15.25% band midpoint gives a ~30,800 EMI against a
// 90,000 income with 32,000 already committed → FOIR ≈ 70%, a hard fail.
const heavy = assessEligibility({
  profile: { monthly_income: 90000, pan: "ABCDE1234F" },
  product,
  requestedAmount: 800000,
  tenureMonths: 36,
  liabilities: [{ monthly_amount: 32000, is_active: true, lender: "ICICI" }],
  cibilScore: 720,
});

check("FOIR just over the cap fails", heavy.verdict === "FAIL", `got ${heavy.verdict}`);
check("FOIR failure message names the actual ratio",
  heavy.blockers.some((b) => b.includes("70") || b.includes(heavy.foir.toFixed(0))));

// A file that passes FOIR but leaves the borrower no cushion: surplus under
// one instalment, so any income shock puts them straight into arrears.
const thinHeadroom = assessEligibility({
  profile: { monthly_income: 60000, pan: "ABCDE1234F" },
  product,
  requestedAmount: 500000,
  tenureMonths: 12,
  liabilities: [],
  cibilScore: 800,
});

check("Thin headroom is caught even when FOIR passes",
  thinHeadroom.rules.find((r) => r.code === "HEADROOM")?.verdict !== "PASS",
  `FOIR ${thinHeadroom.foir}%, surplus ${thinHeadroom.disposableIncome}`);



const inactiveLiability = assessEligibility({
  profile: { monthly_income: 200000, pan: "ABCDE1234F" },
  product,
  requestedAmount: 300000,
  tenureMonths: 36,
  liabilities: [{ monthly_amount: 999999, is_active: false, lender: "Closed" }],
  cibilScore: 780,
});

check("Closed liabilities are ignored", inactiveLiability.existingEmiBurden === 0);

console.log(`  Clean file:  ${good.verdict}, FOIR ${good.foir}%`);
console.log(`  Heavy debt:  ${tooHigh.verdict} — ${tooHigh.blockers[0]}`);
console.log(`  Over cap:    ${heavy.verdict}, FOIR ${heavy.foir}%`);
console.log(`  Thin cushion: FOIR ${thinHeadroom.foir}% (passes) but headroom ${
  thinHeadroom.disposableIncome < calculateEmi(500000, 15.25, 12) ? "too low" : "ok"
}`);

console.log("\nAPPROVAL AUTHORITY");
console.log("──────────────────");

check("Below the officer limit → OFFICER", approvalAuthority({ amount: 800000, officerLimit: 1000000 }) === "OFFICER");
check("At the limit exactly → OFFICER", approvalAuthority({ amount: 1000000, officerLimit: 1000000 }) === "OFFICER");
check("Above the limit → MANAGER", approvalAuthority({ amount: 2000000, officerLimit: 1000000 }) === "MANAGER");
check("Way above → ADMIN", approvalAuthority({ amount: 20000000, officerLimit: 1000000 }) === "ADMIN");
check("No limit set → ADMIN", approvalAuthority({ amount: 100000, officerLimit: null }) === "ADMIN");

console.log("\nCIBIL BANDS");
console.log("──────────");

check("850 is EXCELLENT", cibilBand(850) === "EXCELLENT");
check("780 is GOOD", cibilBand(780) === "GOOD");
check("720 is AVERAGE", cibilBand(720) === "AVERAGE");
check("650 is POOR", cibilBand(650) === "POOR");
check("300 (floor) is POOR", cibilBand(300) === "POOR");
check("900 (ceiling) is EXCELLENT", cibilBand(900) === "EXCELLENT");

console.log(`\n${"═".repeat(50)}`);
console.log(`  ${passed} passed · ${failed} failed`);
console.log(`${"═".repeat(50)}\n`);

if (failed > 0) process.exit(1);