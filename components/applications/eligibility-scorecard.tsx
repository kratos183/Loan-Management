"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, ProgressBar } from "@/components/ui/primitives";
import { VerdictBadge } from "@/components/ui/badge";
import { assessEligibility, approvalAuthority } from "@/lib/finance/risk";
import { money, percent, tenure } from "@/lib/format";
import type { Liability, LoanProduct, Profile } from "@/lib/db/types";
import { cn } from "@/lib/cn";

/**
 * Live underwriting scorecard.
 *
 * Recomputes FOIR and the eligibility rules as the officer edits amount and
 * tenure, so the decision is informed before a single button is pressed.
 */
export function EligibilityScorecard({
  product,
  applicant,
  liabilities,
  cibilScore,
  officerLimit,
  initialAmount,
  initialTenure,
}: {
  product: LoanProduct;
  applicant: Partial<Profile> | null;
  liabilities: Pick<Liability, "monthly_amount" | "is_active" | "lender">[];
  cibilScore: number | null;
  officerLimit: number | null;
  initialAmount: number;
  initialTenure: number;
}) {
  const [amount, setAmount] = useState(initialAmount);
  const [tenureMonths, setTenureMonths] = useState(initialTenure);
  const income = Number(applicant?.monthly_income ?? 0);

  const result = useMemo(
    () =>
      assessEligibility({
        profile: { monthly_income: income, pan: applicant?.pan ?? null },
        product,
        requestedAmount: amount,
        tenureMonths,
        liabilities,
        cibilScore,
      }),
    [applicant, product, amount, tenureMonths, liabilities, cibilScore, income],
  );

  const authority = approvalAuthority({ amount, officerLimit });

  return (
    <Card>
      <CardHeader
        title="Underwriting scorecard"
        description="Recalculates as you change the amount or tenure"
        action={<VerdictBadge verdict={result.verdict} />}
      />
      <CardBody className="space-y-5">
        {/* Amount / tenure controls */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-ink-700">Approved amount</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-400">
                ₹
              </span>
              <input
                type="number"
                value={amount}
                step={1000}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                className="tabular-nums h-10 w-full rounded-lg border border-ink-300 pl-7 pr-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 focus:outline-none"
              />
            </div>
            <input
              type="range"
              min={product.min_amount}
              max={product.max_amount}
              step={1000}
              value={Math.min(Math.max(amount, product.min_amount), product.max_amount)}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full accent-brand-600"
            />
            <p className="tabular-nums text-[11px] text-ink-400">
              {money(product.min_amount)} – {money(product.max_amount)}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-ink-700">Tenure</label>
            <div className="relative">
              <input
                type="number"
                value={tenureMonths}
                onChange={(e) => setTenureMonths(Number(e.target.value) || 0)}
                className="tabular-nums h-10 w-full rounded-lg border border-ink-300 px-3 pr-16 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 focus:outline-none"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-400">
                months
              </span>
            </div>
            <input
              type="range"
              min={product.min_tenure_months}
              max={product.max_tenure_months}
              step={1}
              value={Math.min(
                Math.max(tenureMonths, product.min_tenure_months),
                product.max_tenure_months,
              )}
              onChange={(e) => setTenureMonths(Number(e.target.value))}
              className="w-full accent-brand-600"
            />
            <p className="tabular-nums text-[11px] text-ink-400">
              {tenure(product.min_tenure_months)} – {tenure(product.max_tenure_months)}
            </p>
          </div>
        </div>

        {/* Headline numbers */}
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-ink-50 p-4 sm:grid-cols-4">
          <Metric label="EMI" value={money(result.emi)} />
          <Metric
            label="FOIR"
            value={percent(result.foir, 1)}
            tone={
              result.foir > Number(product.max_foir)
                ? "danger"
                : result.foir > Number(product.max_foir) * 0.85
                  ? "warning"
                  : "positive"
            }
            hint={`limit ${percent(product.max_foir, 0)}`}
          />
          <Metric label="Existing EMIs" value={money(result.existingEmiBurden)} />
          <Metric
            label="Surplus"
            value={money(result.disposableIncome)}
            tone={result.disposableIncome <= 0 ? "danger" : undefined}
          />
        </div>

        {/* Authority routing */}
        {officerLimit != null && (
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg border px-4 py-3 text-[13px]",
              authority === "OFFICER"
                ? "border-positive-200 bg-positive-50 text-positive-900"
                : authority === "MANAGER"
                  ? "border-warning-200 bg-warning-50 text-warning-900"
                  : "border-danger-200 bg-danger-50 text-danger-900",
            )}
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">
                {authority === "OFFICER"
                  ? "Within your sanctioning authority"
                  : authority === "MANAGER"
                    ? "Escalates to a manager"
                    : "Escalates to admin"}
              </p>
              <p className="mt-0.5 opacity-80">
                {authority === "OFFICER" ? (
                  <>
                    Your limit is {money(officerLimit)}. You can sanction this yourself.
                  </>
                ) : (
                  <>
                    {money(amount)} exceeds your limit of {money(officerLimit)}. This decision
                    will be routed upward for authorisation.
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Rule breakdown */}
        <div>
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            Checks
          </p>
          <ul className="space-y-1.5">
            {result.rules.map((rule) => (
              <li
                key={rule.code}
                className="flex items-start gap-2.5 rounded-lg border border-ink-200 px-3 py-2.5"
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full",
                    rule.verdict === "PASS" && "bg-positive-100 text-positive-700",
                    rule.verdict === "WARN" && "bg-warning-100 text-warning-700",
                    rule.verdict === "FAIL" && "bg-danger-100 text-danger-700",
                  )}
                >
                  {rule.verdict === "PASS" ? (
                    <Check className="size-2.5" />
                  ) : rule.verdict === "WARN" ? (
                    <AlertTriangle className="size-2.5" />
                  ) : (
                    <X className="size-2.5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-[13px] font-medium text-ink-800">{rule.label}</p>
                    <p className="tabular-nums text-[11px] text-ink-400">
                      {rule.actual} {rule.required !== "—" ? `/ ${rule.required}` : ""}
                    </p>
                  </div>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-ink-500">
                    {rule.message}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </CardBody>
    </Card>
  );
}

function Metric({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "positive" | "warning" | "danger";
  hint?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
        {label}
      </p>
      <p
        className={cn(
          "tabular-nums mt-0.5 text-[15px] font-semibold",
          tone === "positive" && "text-positive-700",
          tone === "warning" && "text-warning-700",
          tone === "danger" && "text-danger-700",
          !tone && "text-ink-900",
        )}
      >
        {value}
      </p>
      {hint && <p className="tabular-nums text-[10px] text-ink-400">{hint}</p>}
    </div>
  );
}