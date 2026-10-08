import { Receipt } from "lucide-react";
import { Portal, loadPortal } from "@/lib/portal";
import { listPayments } from "@/lib/queries/loans";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, StatCard } from "@/components/ui/primitives";
import { TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { formatDate, money, moneyCompact } from "@/lib/format";

export const metadata = { title: "Payment History" };

export default async function PaymentsPage() {
  const ctx = await loadPortal("user");
  const payments = await listPayments(ctx.session.user.id);

  const succeeded = payments.filter((p) => p.status === "SUCCESS");
  const bounced = payments.filter((p) => p.status === "BOUNCED" || p.status === "FAILED");

  const totalPaid = succeeded.reduce((s, p) => s + Number(p.amount), 0);
  const totalBounceCharges = bounced.reduce((s, p) => s + Number(p.bounce_charge), 0);
  const totalPenalties = payments.reduce((s, p) => s + Number(p.penalty_amount), 0);

  return (
    <Portal
      which="user"
      title="Payment history"
      description="Every payment you've made, with receipts and any charges that applied."
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={undefined}
          className="pointer-events-none opacity-60"
          title="Coming with the e-Bill generator"
        >
          Download statement
        </Button>
      }
    >
      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total paid"
          value={moneyCompact(totalPaid)}
          sublabel={`${succeeded.length} successful payments`}
          tone="positive"
        />
        <StatCard
          label="Bounced payments"
          value={String(bounced.length)}
          sublabel={bounced.length ? "charges applied" : "none — clean record"}
          tone={bounced.length ? "danger" : "positive"}
        />
        <StatCard
          label="Bounce charges"
          value={money(totalBounceCharges)}
          sublabel="levied on failed debits"
          tone={totalBounceCharges ? "danger" : "positive"}
        />
        <StatCard
          label="Late fees"
          value={money(totalPenalties)}
          sublabel="on overdue instalments"
          tone={totalPenalties ? "warning" : "positive"}
        />
      </div>

      <Card className="mt-6">
        {payments.length === 0 ? (
          <EmptyState
            icon={<Receipt className="size-6" />}
            title="No payments yet"
            description="Once your first instalment is paid, it will appear here with a downloadable receipt."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                  {/* Receipt, Date, Amount and Status are what a borrower
                      checks. Loan, charges, mode and the gateway transaction id
                      are reference detail from `sm` up. */}
                  <Th priority="primary">Receipt</Th>
                  <Th priority="primary">Date</Th>
                  <Th priority="normal">Loan</Th>
                  <Th align="right" priority="primary">Amount</Th>
                  <Th align="right" priority="normal">Charges</Th>
                  <Th priority="normal">Mode</Th>
                  <Th priority="primary">Status</Th>
                  <Th priority="hidden">Transaction</Th>
                </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const loan = p.loan;

                return (
                  <Tr key={p.id}>
                    <Td mono className="text-ink-600" priority="primary">
                      {p.receipt_no}
                    </Td>
                    <Td className="whitespace-nowrap" priority="primary">{formatDate(p.txn_date)}</Td>
                    <Td priority="normal">
                      <span className="block text-ink-900">{loan?.product?.name ?? "—"}</span>
                      <span className="tabular-nums font-mono text-[11px] text-ink-400">
                        {loan?.account_number}
                      </span>
                    </Td>
                    <Td align="right" mono className="font-semibold text-ink-900" priority="primary">
                      {money(p.amount)}
                    </Td>
                    <Td align="right" mono className={p.bounce_charge > 0 ? "text-danger-700" : "text-ink-400"} priority="normal">
                      {Number(p.bounce_charge) > 0 || Number(p.penalty_amount) > 0
                        ? money(Number(p.bounce_charge) + Number(p.penalty_amount))
                        : "—"}
                    </Td>
                    <Td priority="normal">
                      <span className="text-[13px] text-ink-600">{p.mode}</span>
                    </Td>
                    <Td priority="primary">
                      <StatusBadge status={p.status} />
                      {p.failure_reason && (
                        <p className="mt-1 max-w-40 text-[11px] leading-snug text-ink-400">
                          {p.failure_reason}
                        </p>
                      )}
                    </Td>
                    <Td mono className="text-[11px] text-ink-400" priority="hidden">
                      {p.txn_id ?? p.gateway_ref ?? "—"}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Card>

      {bounced.length > 0 && (
        <Card className="mt-4 p-4">
          <h3 className="text-sm font-semibold text-ink-900">About bounced payments</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">
            When a payment fails because of insufficient funds or an incorrect bank account, a
            charge is levied and the instalment stays outstanding. Once the grace period lapses
            the instalment is marked overdue and a late fee applies. Paying the outstanding
            amount clears both. If you believe a charge is wrong, raise a ticket from the
            Support menu.
          </p>
        </Card>
      )}
    </Portal>
  );
}