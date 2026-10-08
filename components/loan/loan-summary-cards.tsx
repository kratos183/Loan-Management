import { CreditCard, TrendingUp, Wallet } from "lucide-react";
import { money, moneyCompact, percent } from "@/lib/format";
import { ProgressBar } from "@/components/ui/primitives";
import type { LoanWithRelations, Emi } from "@/lib/db/types";
import { summariseLoan } from "@/lib/queries/loans";

/** Compact loan snapshot. Reused on the dashboard, loans list and detail. */
export function LoanSummaryCards({ loan, emis }: { loan: LoanWithRelations; emis: Emi[] }) {
  const s = summariseLoan(loan, emis);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Outstanding"
          value={money(loan.outstanding_principal)}
          sub={`of ${money(loan.principal)} sanctioned`}
          icon={<Wallet className="size-4" />}
          tone="brand"
        />
        <Tile
          label="Monthly EMI"
          value={money(loan.emi_amount)}
          sub={`${loan.tenure_months} months at ${percent(loan.annual_rate)}`}
          icon={<TrendingUp className="size-4" />}
          tone="info"
        />
        <Tile
          label={s.nextEmi ? "Next payment" : "Last payment"}
          value={money(
            s.nextEmi ? Number(s.nextEmi.amount_due) + Number(s.nextEmi.penalty_amount) : 0,
          )}
          sub={
            s.nextEmi
              ? `due ${new Date(s.nextEmi.due_date).toLocaleDateString("en-IN")}`
              : "nothing outstanding"
          }
          icon={<CreditCard className="size-4" />}
          tone={s.overdueCount ? "danger" : "positive"}
        />
        <Tile
          label="Repaid"
          value={moneyCompact(s.paidAmount)}
          sub={`${s.instalmentsPaid} of ${s.instalmentsTotal} instalments`}
          progress={s.progressPercent}
          tone="positive"
        />
      </div>

      {s.overdueCount > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3">
          <div>
            <p className="text-[13px] font-semibold text-danger-800">
              {s.overdueCount} overdue instalment{s.overdueCount > 1 ? "s" : ""}
            </p>
            <p className="tabular-nums text-[13px] text-danger-700">
              {money(s.overdueAmount)} outstanding including late fees
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function Tile({
  label,
  value,
  sub,
  icon,
  tone,
  progress,
}: {
  label: string;
  value: string;
  sub: string;
  icon?: React.ReactNode;
  tone: "brand" | "positive" | "warning" | "danger" | "info";
  progress?: number;
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    positive: "bg-positive-50 text-positive-700",
    warning: "bg-warning-50 text-warning-700",
    danger: "bg-danger-50 text-danger-700",
    info: "bg-info-50 text-info-700",
  };

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
          {label}
        </p>
        {icon && (
          <span className={cn2(tones[tone], "flex size-8 shrink-0 items-center justify-center rounded-lg")}>
            {icon}
          </span>
        )}
      </div>
      <p className="tabular-nums mt-2 text-2xl font-semibold tracking-tight text-ink-900">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-ink-500">{sub}</p>
      {progress != null && (
        <div className="mt-2.5">
          <ProgressBar value={progress} tone="positive" size="sm" showLabel />
        </div>
      )}
    </div>
  );
}

function cn2(...parts: string[]) {
  return parts.join(" ");
}