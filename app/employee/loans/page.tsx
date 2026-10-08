import Link from "next/link";
import { AlertTriangle, Landmark } from "lucide-react";
import { Portal, loadPortal } from "@/lib/portal";
import { listAllLoans } from "@/lib/queries/loans";
import { listOverdueAcrossBook } from "@/lib/queries/staff";
import { Card } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Avatar, EmptyState, ProgressBar, StatCard } from "@/components/ui/primitives";
import { TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { FlagOverdueButton } from "./FlagOverdueButton";
import { formatDate, money, moneyCompact, number, percent, tenure } from "@/lib/format";

export const metadata = { title: "Loans & EMIs" };

export default async function StaffLoansPage() {
  await loadPortal("employee");

  await loadPortal("employee");

  const [loans, overdue] = await Promise.all([
    listAllLoans(["ACTIVE"]),
    listOverdueAcrossBook(),
  ]);

  const totalOutstanding = loans.reduce((s, l) => s + Number(l.outstanding_principal), 0);
  const totalDisbursed = loans.reduce((s, l) => s + Number(l.principal), 0);

  return (
    <Portal
      which="employee"
      title="Loan servicing"
      description="Active loans across the book, with overdue instalments and the flagging controls that trigger customer notifications."
      maxWidth="max-w-[1500px]"
    >
      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active loans"
          value={number(loans.length)}
          sublabel={`${moneyCompact(totalDisbursed)} disbursed`}
          icon={<Landmark className="size-4" />}
          tone="brand"
        />
        <StatCard
          label="Outstanding"
          value={moneyCompact(totalOutstanding)}
          sublabel={`${percent((totalOutstanding / (totalDisbursed || 1)) * 100, 1)} of book`}
          tone="info"
        />
        <StatCard
          label="Overdue instalments"
          value={number(overdue.length)}
          sublabel={moneyCompact(
            overdue.reduce((s, e) => s + Number(e.amount_due) + Number(e.penalty_amount), 0),
          )}
          icon={<AlertTriangle className="size-4" />}
          tone={overdue.length ? "danger" : "positive"}
        />
        <StatCard
          label="Accounts affected"
          value={number(new Set(overdue.map((e) => (e.loan as never as { id: string }).id)).size)}
          sublabel="with a missed payment"
          tone={overdue.length ? "warning" : "positive"}
        />
      </div>

      {/* Overdue queue */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-ink-900">Overdue queue</h2>
        <Card>
          {overdue.length === 0 ? (
            <EmptyState
              icon={<Landmark className="size-6" />}
              title="Nothing overdue"
              description="Every instalment in the book is within its grace period or fully paid."
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  {/* Borrower, Amount and the overdue-flag action are the
                      working set. Account, instalment number and due date are
                      reference detail from `sm`. */}
                  <Th priority="primary">Borrower</Th>
                  <Th priority="normal">Account</Th>
                  <Th align="right" priority="hidden">Instalment</Th>
                  <Th align="right" priority="normal">Due</Th>
                  <Th align="right" priority="normal">Days late</Th>
                  <Th align="right" priority="primary">Amount</Th>
                  <Th align="right" priority="normal">Penalty</Th>
                  <Th align="right" priority="primary">Action</Th>
                </tr>
              </thead>
              <tbody>
                {overdue.map((e) => {
                  const loan = e.loan as unknown as {
                    account_number: string;
                    product: { name: string } | null;
                    borrower: { id: string; full_name: string; phone: string } | null;
                  } | null;

                  return (
                    <Tr key={e.id}>
                      <Td priority="primary">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={loan?.borrower?.full_name} size="sm" />
                          <div>
                            <p className="font-medium text-ink-900">
                              {loan?.borrower?.full_name}
                            </p>
                            <p className="text-[11px] text-ink-400">
                              {loan?.borrower?.phone}
                            </p>
                          </div>
                        </div>
                      </Td>
                      <Td priority="normal">
                        <p className="text-ink-700">{loan?.product?.name}</p>
                        <p className="font-mono text-[11px] text-ink-400">
                          {loan?.account_number}
                        </p>
                      </Td>
                      <Td align="right" mono priority="hidden">
                        #{e.installment_no}
                      </Td>
                      <Td align="right" className="whitespace-nowrap" priority="normal">
                        {formatDate(e.due_date)}
                      </Td>
                      <Td align="right" priority="normal">
                        <Badge tone={e.days_past_due > 30 ? "danger" : "warning"}>
                          {e.days_past_due}d
                        </Badge>
                      </Td>
                      <Td align="right" mono className="font-semibold" priority="primary">
                        {money(e.amount_due)}
                      </Td>
                      <Td align="right" mono className="text-danger-700" priority="normal">
                        {Number(e.penalty_amount) > 0 ? money(e.penalty_amount) : "—"}
                      </Td>
                      <Td align="right" priority="primary">
                        <FlagOverdueButton emiId={e.id} />
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </TableWrap>
          )}
        </Card>
      </div>

      {/* Active book */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-ink-900">Active loans</h2>
        <Card>
          {loans.length === 0 ? (
            <EmptyState title="No active loans" />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th priority="normal">Account</Th>
                  <Th priority="primary">Borrower</Th>
                  <Th priority="primary">Product</Th>
                  <Th align="right" priority="hidden">Principal</Th>
                  <Th align="right" priority="primary">Outstanding</Th>
                  <Th priority="primary">Status</Th>
                  <Th align="right" priority="normal">Repaid</Th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => {
                  const repaid =
                    ((Number(loan.principal) - Number(loan.outstanding_principal)) /
                      Number(loan.principal)) *
                    100;

                  return (
                    <Tr key={loan.id}>
                      <Td mono className="text-ink-600" priority="normal">
                        {loan.account_number}
                      </Td>
                      <Td className="font-medium text-ink-900" priority="primary">
                        {loan.borrower?.full_name}
                      </Td>
                      <Td priority="primary">
                        <span className="flex items-center gap-1.5">
                          <span>{loan.product?.thumbnail_emoji}</span>
                          <span className="text-ink-700">{loan.product?.name}</span>
                        </span>
                      </Td>
                      <Td align="right" mono priority="hidden">
                        {money(loan.principal)}
                      </Td>
                      <Td align="right" mono className="font-semibold" priority="primary">
                        {money(loan.outstanding_principal)}
                      </Td>
                      <Td priority="primary">
                        <StatusBadge status={loan.status} />
                      </Td>
                      <Td align="right" className="w-32" priority="normal">
                        <ProgressBar value={repaid} size="sm" tone="positive" />
                        <span className="tabular-nums mt-1 block text-[10px] text-ink-400">
                          {repaid.toFixed(0)}% · {tenure(loan.tenure_months)}
                        </span>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </TableWrap>
          )}
        </Card>
      </div>
    </Portal>
  );
}