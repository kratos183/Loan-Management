import Link from "next/link";
import { Landmark } from "lucide-react";
import { Portal, loadPortal } from "@/lib/portal";
import { listLoansForUser, listEmis } from "@/lib/queries/loans";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, ProgressBar } from "@/components/ui/primitives";
import { TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { money, moneyCompact, percent, tenure } from "@/lib/format";
import { summariseLoan } from "@/lib/queries/loans";

export const metadata = { title: "Current Loan Status" };

export default async function LoansPage() {
  const ctx = await loadPortal("user");
  const loans = await listLoansForUser(ctx.session.user.id);

  // Need the schedule to show progress and next-due dates
  const withEmis = await Promise.all(
    loans.map(async (loan) => ({
      loan,
      emis: await listEmis(loan.id),
    })),
  );

  return (
    <Portal
      which="user"
      title="Current loan status"
      description="Every loan you hold, with the next payment, outstanding balance and repayment progress."
    >
      {withEmis.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Landmark className="size-6" />}
            title="No active loans"
            description="Once an application is approved and disbursed, your loan appears here with the full repayment schedule."
            action={<LinkButton href="/user/new-loan">Apply for a loan</LinkButton>}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {withEmis.map(({ loan, emis }) => {
            const s = summariseLoan(loan, emis);

            return (
              <Card key={loan.id} className="overflow-hidden">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-200 px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{loan.product?.thumbnail_emoji}</span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[15px] font-semibold text-ink-900">
                          {loan.product?.name}
                        </h3>
                        <StatusBadge status={loan.status} />
                      </div>
                      <p className="tabular-nums mt-1 font-mono text-[13px] text-ink-500">
                        {loan.account_number}
                      </p>
                    </div>
                  </div>
                  <LinkButton href={`/user/loans/${loan.id}`} size="sm">
                    Loan details
                  </LinkButton>
                </div>

                {/* Figures */}
                <div className="grid divide-y divide-ink-100 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
                  <Figure
                    label="Outstanding"
                    value={money(loan.outstanding_principal)}
                    sub={`of ${money(loan.principal)}`}
                  />
                  <Figure
                    label="Monthly EMI"
                    value={money(loan.emi_amount)}
                    sub={`${tenure(loan.tenure_months)} · ${percent(loan.annual_rate)}`}
                  />
                  <Figure
                    label={s.nextEmi ? "Next payment" : "Status"}
                    value={
                      s.nextEmi
                        ? money(Number(s.nextEmi.amount_due) + Number(s.nextEmi.penalty_amount))
                        : "Nothing due"
                    }
                    sub={
                      s.nextEmi
                        ? `due ${new Date(s.nextEmi.due_date).toLocaleDateString("en-IN")}`
                        : "all instalments cleared"
                    }
                    tone={s.overdueCount ? "danger" : undefined}
                  />
                  <Figure
                    label="Disbursed"
                    value={loan.disbursed_at ? new Date(loan.disbursed_at).toLocaleDateString("en-IN") : "—"}
                    sub={moneyCompact(loan.principal)}
                  />
                </div>

                {/* Progress */}
                <div className="px-5 py-4">
                  <div className="mb-1.5 flex items-center justify-between text-[13px]">
                    <span className="text-ink-600">
                      {s.instalmentsPaid} of {s.instalmentsTotal} instalments paid
                    </span>
                    <span className="tabular-nums font-semibold text-ink-900">
                      {s.progressPercent.toFixed(0)}% repaid
                    </span>
                  </div>
                  <ProgressBar
                    value={s.progressPercent}
                    tone={s.overdueCount ? "danger" : "positive"}
                  />
                  {s.overdueCount > 0 && (
                    <p className="tabular-nums mt-2 text-[13px] font-medium text-danger-700">
                      {money(s.overdueAmount)} overdue across {s.overdueCount} instalment
                      {s.overdueCount > 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Portal>
  );
}

function Figure({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "danger";
}) {
  return (
    <div className="px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
        {label}
      </p>
      <p
        className={`tabular-nums mt-1 text-lg font-semibold tracking-tight ${
          tone === "danger" ? "text-danger-700" : "text-ink-900"
        }`}
      >
        {value}
      </p>
      <p className="tabular-nums mt-0.5 text-xs text-ink-500">{sub}</p>
    </div>
  );
}