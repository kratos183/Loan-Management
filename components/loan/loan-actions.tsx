"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CheckCircle2,
  Download,
  FileText,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Alert } from "@/components/ui/primitives";
import {
  generateEbill,
  makePrepayment,
  markEmiPaid,
  requestNoc,
} from "@/lib/actions/chat";
import { prepaymentImpact } from "@/lib/finance/emi";
import { money } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Client actions on a loan: pay an instalment, prepay, generate an e-Bill,
 * claim an NOC.
 *
 * Each one posts to a Server Action. Without a real gateway the payment action
 * records a mock transaction, but the state transitions are the same ones a
 * Razorpay integration would drive.
 */
export function LoanActions({
  type,
  loanId,
  emiId,
  fullWidth,
  compact,
  className,
  hasUpcoming,
  outstanding,
  annualRate,
  currentEmi,
  monthsRemaining,
}: {
  type: "pay" | "prepay" | "ebill" | "noc";
  loanId: string;
  emiId?: string | null;
  fullWidth?: boolean;
  compact?: boolean;
  className?: string;
  hasUpcoming?: boolean;
  outstanding?: number;
  annualRate?: number;
  currentEmi?: number;
  monthsRemaining?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const [mode, setMode] = useState<"UPI" | "NEFT" | "CARD" | "MANUAL">("UPI");
  const [amount, setAmount] = useState(0);

  function run(fn: () => Promise<{ success?: boolean; error?: string }>, message: string) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result?.error) {
        setError(result.error);
        return;
      }
      setDone(message);
      setOpen(false);
      router.refresh();
    });
  }

  /* ── Pay an instalment ─────────────────────────────────────────────────── */
  if (type === "pay") {
    return (
      <div className={className}>
        <Button
          size={compact ? "xs" : "md"}
          variant={pending ? "secondary" : "primary"}
          loading={pending}
          fullWidth={fullWidth}
          onClick={() =>
            run(
              () => markEmiPaid(emiId!, mode),
              "Payment recorded. Your receipt is ready.",
            )
          }
          icon={!pending && <Wallet className="size-4" />}
        >
          {compact ? "Pay" : "Pay this instalment"}
        </Button>
      </div>
    );
  }

  /* ── Generate e-Bill ───────────────────────────────────────────────────── */
  if (type === "ebill") {
    return (
      <div className={className}>
        <Button
          size="sm"
          variant="outline"
          fullWidth={fullWidth}
          disabled={!hasUpcoming}
          loading={pending}
          onClick={() =>
            run(() => generateEbill(loanId), "e-Bill generated and added to your list.")
          }
          icon={!pending && <FileText className="size-3.5" />}
        >
          Generate e-Bill
        </Button>
      </div>
    );
  }

  /* ── Claim NOC ─────────────────────────────────────────────────────────── */
  if (type === "noc") {
    return (
      <div className={className}>
        {done ? (
          <Alert tone="success" icon={<CheckCircle2 className="size-4" />}>
            {done}
          </Alert>
        ) : (
          <>
            <Button
              fullWidth={fullWidth}
              loading={pending}
              onClick={() =>
                run(
                  () => requestNoc(loanId),
                  "NOC requested. Your officer will approve it shortly.",
                )
              }
              icon={!pending && <BadgeCheck className="size-4" />}
            >
              Claim my NOC
            </Button>
            {error && (
              <p className="mt-2 text-xs font-medium text-danger-600">{error}</p>
            )}
          </>
        )}
      </div>
    );
  }

  /* ── Prepayment calculator ─────────────────────────────────────────────── */
  return (
    <div className={className}>
      {!open ? (
        <Button
          fullWidth={fullWidth}
          variant="outline"
          onClick={() => setOpen(true)}
          icon={<Sparkles className="size-4" />}
        >
          Prepay now
        </Button>
      ) : (
        <div className="space-y-3 rounded-lg border border-brand-200 bg-brand-50/40 p-3.5">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-ink-700">Amount to prepay</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              prefix="₹"
              step={1000}
              className="tabular-nums"
              placeholder="e.g. 50000"
            />
          </div>

          {outstanding && annualRate && currentEmi && monthsRemaining && amount > 0 && (
            <PrepaymentImpact
              outstanding={outstanding}
              annualRate={annualRate}
              currentEmi={currentEmi}
              monthsRemaining={monthsRemaining}
              amount={amount}
            />
          )}

          {error && <p className="text-xs font-medium text-danger-600">{error}</p>}

          <div className="flex gap-2">
            <Button
              size="sm"
              fullWidth
              loading={pending}
              disabled={amount <= 0}
              onClick={() =>
                run(
                  () => makePrepayment(loanId, amount),
                  "Prepayment received. Your officer will re-issue the schedule.",
                )
              }
            >
              Confirm prepayment
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Shows both prepayment options side by side. */
function PrepaymentImpact({
  outstanding,
  annualRate,
  currentEmi,
  monthsRemaining,
  amount,
}: {
  outstanding: number;
  annualRate: number;
  currentEmi: number;
  monthsRemaining: number;
  amount: number;
}) {
  const reduceTenure = prepaymentImpact({
    outstanding,
    annualRate,
    currentEmi,
    monthsRemaining,
    prepayAmount: amount,
    mode: "REDUCE_TENURE",
  });

  const reduceEmi = prepaymentImpact({
    outstanding,
    annualRate,
    currentEmi,
    monthsRemaining,
    prepayAmount: amount,
    mode: "REDUCE_EMI",
  });

  if (!reduceTenure || !reduceEmi) return null;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Option
        label="Reduce tenure"
        headline={`${reduceTenure.monthsSaved} months earlier`}
        detail={`EMI stays ${money(reduceTenure.newEmi)}`}
        saving={reduceTenure.interestSaved}
      />
      <Option
        label="Reduce EMI"
        headline={`${money(reduceEmi.newEmi)}/month`}
        detail={`Tenure stays ${reduceEmi.newTenureMonths} months`}
        saving={reduceEmi.interestSaved}
      />
    </div>
  );
}

function Option({
  label,
  headline,
  detail,
  saving,
}: {
  label: string;
  headline: string;
  detail: string;
  saving: number;
}) {
  return (
    <div className="rounded-lg border border-brand-200 bg-white p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-700">
        {label}
      </p>
      <p className="tabular-nums mt-1 text-[13px] font-semibold text-ink-900">{headline}</p>
      <p className="tabular-nums text-[11px] text-ink-500">{detail}</p>
      <p className="tabular-nums mt-1.5 text-[11px] font-medium text-positive-700">
        Saves {money(saving)}
      </p>
    </div>
  );
}