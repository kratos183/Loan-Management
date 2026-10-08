import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Download,
  FileText,
  Landmark,
  Receipt,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Portal, loadPortal } from "@/lib/portal";
import {
  getLoanForUser,
  getNocForLoan,
  listEmis,
  listPayments,
  summariseLoan,
} from "@/lib/queries/loans";
import { createClient } from "@/lib/supabase/server";
import { requestNoc, markEmiPaid, makePrepayment } from "@/lib/actions/chat";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  Alert,
  DataList,
  EmptyState,
  ProgressBar,
  SectionTitle,
  StatCard,
} from "@/components/ui/primitives";
import { TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { LoanActions } from "@/components/loan/loan-actions";
import { formatDate, formatDateTime, money, moneyCompact, percent, tenure } from "@/lib/format";

export const metadata = { title: "Loan Details" };

export default async function LoanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await loadPortal("user");
  const supabase = await createClient();

  const loan = await getLoanForUser(id, ctx.session.user.id);
  if (!loan) notFound();

  const [emis, payments, noc, bills] = await Promise.all([
    listEmis(id),
    listPayments(ctx.session.user.id, id),
    getNocForLoan(id),
    supabase
      .from("ebills")
      .select("*")
      .eq("loan_id", id)
      .order("generated_at", { ascending: false })
      .limit(10),
  ]);

  const s = summariseLoan(loan, emis);
  const lastPaid = payments.filter((p) => p.status === "SUCCESS")[0];

  return (
    <Portal
      which="user"
      maxWidth="max-w-[1400px]"
      breadcrumb={
        <Link
          href="/user/loans"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-500 hover:text-brand-700"
        >
          <ArrowLeft className="size-3.5" />
          All loans
        </Link>
      }
      title={
        <span className="flex items-center gap-3">
          <span>{loan.product?.thumbnail_emoji}</span>
          {loan.product?.name}
        </span>
      }
      description={
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono">{loan.account_number}</span>
          <StatusBadge status={loan.status} />
          <span>· sanctioned {formatDate(loan.disbursed_at)}</span>
        </span>
      }
    >
      {/* Overdue banner */}
      {s.overdueCount > 0 && (
        <Alert
          tone="danger"
          title={`${money(s.overdueAmount)} overdue`}
          icon={<AlertTriangle />}
          action={
            <LoanActions type="pay" loanId={loan.id} emiId={s.nextEmi?.id ?? null} />
          }
        >
          {s.overdueCount} instalment{s.overdueCount > 1 ? "s" : ""} past due. Clear this to
          stop the late fee from accruing.
        </Alert>
      )}

      {/* Metrics */}
      <div className="stagger mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Outstanding"
          value={money(loan.outstanding_principal)}
          sublabel={`of ${money(loan.principal)}`}
          icon={<Wallet className="size-4" />}
          tone="brand"
        />
        <StatCard
          label="Monthly EMI"
          value={money(loan.emi_amount)}
          sublabel={`${tenure(loan.tenure_months)} at ${percent(loan.annual_rate)}`}
          icon={<Landmark className="size-4" />}
          tone="info"
        />
        <StatCard
          label="Repaid"
          value={moneyCompact(loan.total_paid)}
          sublabel={`${s.instalmentsPaid} of ${s.instalmentsTotal} instalments`}
          icon={<BadgeCheck className="size-4" />}
          tone="positive"
        />
        <StatCard
          label="Interest payable"
          value={moneyCompact(loan.total_interest)}
          sublabel={`total ${moneyCompact(loan.total_payable)}`}
          icon={<Receipt className="size-4" />}
          tone="warning"
        />
      </div>

      {/* Progress */}
      <Card className="mt-4">
        <CardBody>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center justify-between text-[13px]">
                <span className="text-ink-600">Repayment progress</span>
                <span className="tabular-nums font-semibold text-ink-900">
                  {s.progressPercent.toFixed(1)}%
                </span>
              </div>
              <ProgressBar
                value={s.progressPercent}
                tone={s.overdueCount ? "danger" : "positive"}
              />
              <p className="mt-2 text-[13px] text-ink-500">
                {s.instalmentsPaid} of {s.instalmentsTotal} instalments paid
                {loan.end_date && ` · closes ${formatDate(loan.end_date)}`}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* ─── Schedule ─── */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Repayment schedule"
              description="Every instalment with its principal, interest and status"
              action={
                <LoanActions
                  type="ebill"
                  loanId={loan.id}
                  hasUpcoming={emis.some((e) => e.status === "UPCOMING" || e.status === "OVERDUE")}
                />
              }
            />
            <div className="max-h-[560px] overflow-y-auto">
              <TableWrap>
                <thead>
                  <tr>
                    {/* The schedule is 8 columns wide and will not fit a
                        phone. Due date, Total, Status and the Pay button are
                        what a borrower acts on and must stay. Penalty folds
                        into Total (`amount_due + penalty`) so it can go; the
                        instalment number is desktop reference only. */}
                    <Th priority="hidden">#</Th>
                    <Th priority="primary">Due date</Th>
                    <Th align="right" priority="normal">Principal</Th>
                    <Th align="right" priority="hidden">Interest</Th>
                    <Th align="right" priority="hidden">Penalty</Th>
                    <Th align="right" priority="primary">Total</Th>
                    <Th priority="primary">Status</Th>
                    <Th align="right" priority="primary" />
                  </tr>
                </thead>
                <tbody>
                  {emis.map((emi) => (
                    <Tr
                      key={emi.id}
                      className={emi.status === "OVERDUE" ? "bg-danger-50/40" : undefined}
                    >
                      <Td mono className="text-ink-400" priority="hidden">
                        {emi.installment_no}
                      </Td>
                      <Td className="whitespace-nowrap" priority="primary">{formatDate(emi.due_date)}</Td>
                      <Td align="right" mono priority="normal">
                        {money(emi.principal_part)}
                      </Td>
                      <Td align="right" mono className="text-warning-700" priority="hidden">
                        {money(emi.interest_part)}
                      </Td>
                      <Td align="right" mono className="text-danger-700" priority="hidden">
                        {Number(emi.penalty_amount) > 0 ? money(emi.penalty_amount) : "—"}
                      </Td>
                      <Td align="right" mono className="font-semibold text-ink-900" priority="primary">
                        {money(Number(emi.amount_due) + Number(emi.penalty_amount))}
                      </Td>
                      <Td priority="primary">
                        <StatusBadge status={emi.status} />
                        {emi.days_past_due > 0 && (
                          <span className="mt-1 block text-[10px] text-danger-600">
                            {emi.days_past_due} days late
                          </span>
                        )}
                      </Td>
                      <Td align="right" priority="primary">
                        {(emi.status === "UPCOMING" || emi.status === "OVERDUE") && (
                          <LoanActions type="pay" loanId={loan.id} emiId={emi.id} compact />
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </TableWrap>
            </div>
          </Card>

          {/* Payment history */}
          <Card>
            <CardHeader
              title="Payment history"
              description="Receipts for this loan"
              action={
                <LinkButton href="/user/payments" size="xs" variant="ghost">
                  See all
                </LinkButton>
              }
            />
            {payments.length === 0 ? (
              <EmptyState
                icon={<Receipt className="size-6" />}
                title="No payments recorded yet"
                description="Your first payment will appear here with a receipt."
              />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <Th priority="primary">Receipt</Th>
                    <Th priority="primary">Date</Th>
                    <Th align="right" priority="primary">Amount</Th>
                    <Th priority="normal">Mode</Th>
                    <Th priority="primary">Status</Th>
                    <Th priority="hidden">Transaction</Th>
                  </tr>
                </thead>
                <tbody>
                  {payments.slice(0, 10).map((p) => (
                    <Tr key={p.id}>
                      <Td mono className="text-ink-600" priority="primary">
                        {p.receipt_no}
                      </Td>
                      <Td className="whitespace-nowrap" priority="primary">{formatDate(p.txn_date)}</Td>
                      <Td align="right" mono className="font-semibold" priority="primary">
                        {money(p.amount)}
                      </Td>
                      <Td className="text-[13px] text-ink-600" priority="normal">{p.mode}</Td>
                      <Td priority="primary">
                        <StatusBadge status={p.status} />
                      </Td>
                      <Td mono className="text-[11px] text-ink-400" priority="hidden">
                        {p.txn_id}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Card>
        </div>

        {/* ─── Side rail ─── */}
        <div className="space-y-4">
          {/* Next payment */}
          {s.nextEmi && (
            <Card>
              <CardHeader title="Next payment" icon={<Wallet className="size-4" />} />
              <CardBody>
                <p className="tabular-nums text-3xl font-semibold tracking-tight text-ink-900">
                  {money(Number(s.nextEmi.amount_due) + Number(s.nextEmi.penalty_amount))}
                </p>
                <p className="mt-1 text-[13px] text-ink-500">
                  Due {formatDate(s.nextEmi.due_date)}
                  {s.nextEmi.status === "OVERDUE" && (
                    <span className="ml-1 font-medium text-danger-700">
                      ({s.nextEmi.days_past_due} days late)
                    </span>
                  )}
                </p>
                <div className="mt-3 space-y-1.5 border-t border-ink-100 pt-3">
                  <Row label="Principal" value={money(s.nextEmi.principal_part)} />
                  <Row label="Interest" value={money(s.nextEmi.interest_part)} />
                  {Number(s.nextEmi.penalty_amount) > 0 && (
                    <Row label="Late fee" value={money(s.nextEmi.penalty_amount)} danger />
                  )}
                </div>
                <LoanActions
                  type="pay"
                  loanId={loan.id}
                  emiId={s.nextEmi.id}
                  fullWidth
                  className="mt-4"
                />
              </CardBody>
            </Card>
          )}

          {/* Last payment */}
          {lastPaid && (
            <Card>
              <CardHeader title="Last payment" icon={<Receipt className="size-4" />} />
              <CardBody>
                <p className="tabular-nums text-2xl font-semibold text-ink-900">
                  {money(lastPaid.amount)}
                </p>
                <p className="mt-1 text-[13px] text-ink-500">
                  {formatDate(lastPaid.txn_date)} · {lastPaid.mode}
                </p>
                <p className="mt-2 font-mono text-[11px] text-ink-400">
                  {lastPaid.receipt_no}
                </p>
              </CardBody>
            </Card>
          )}

          {/* Prepayment */}
          {!s.isClosed && (
            <Card>
              <CardHeader
                title="Prepay your loan"
                description="Pay extra to close it faster"
                icon={<Sparkles className="size-4" />}
              />
              <CardBody>
                <p className="text-[13px] leading-relaxed text-ink-500">
                  Paying above your EMI reduces the outstanding principal. You choose whether to
                  shorten the tenure or lower the monthly instalment.
                </p>
                <LoanActions
                  type="prepay"
                  loanId={loan.id}
                  className="mt-3"
                  fullWidth
                  outstanding={Number(loan.outstanding_principal)}
                  annualRate={Number(loan.annual_rate)}
                  currentEmi={Number(loan.emi_amount)}
                  monthsRemaining={Math.max(0, loan.tenure_months - s.instalmentsPaid)}
                />
              </CardBody>
            </Card>
          )}

          {/* NOC */}
          <Card>
            <CardHeader title="No Objection Certificate" icon={<BadgeCheck className="size-4" />} />
            <CardBody>
              {loan.status === "NOC_ISSUED" ? (
                <div className="space-y-3">
                  <Alert tone="success" title="Certificate issued">
                    All instalments cleared. Your NOC is available to download.
                  </Alert>
                  <Button fullWidth variant="success" icon={<Download className="size-4" />}>
                    Download NOC
                  </Button>
                  <p className="text-center text-[11px] text-ink-400">
                    Issued {formatDate(loan.noc_issued_at)}
                  </p>
                </div>
              ) : s.instalmentsPaid >= s.instalmentsTotal ? (
                <div className="space-y-3">
                  <Alert tone="success" title="Eligible to claim">
                    All instalments are cleared. Claim your NOC to close the account officially.
                  </Alert>
                  <NocClaim loanId={loan.id} />
                </div>
              ) : noc ? (
                <div className="space-y-2">
                  <StatusBadge status={noc.status} />
                  <p className="text-[13px] text-ink-500">
                    Requested {relative(noc.requested_at)}. An officer will approve it, and the
                    download will unlock here.
                  </p>
                </div>
              ) : (
                <p className="text-[13px] leading-relaxed text-ink-500">
                  Your NOC unlocks once every instalment is paid.{" "}
                  <span className="tabular-nums font-medium text-ink-700">
                    {s.instalmentsTotal - s.instalmentsPaid} remaining.
                  </span>
                </p>
              )}
            </CardBody>
          </Card>

          {/* Loan facts */}
          <Card>
            <CardHeader title="Loan details" />
            <CardBody>
              <DataList
                columns={1}
                items={[
                  { label: "Account number", value: loan.account_number },
                  { label: "Principal", value: money(loan.principal) },
                  { label: "Interest rate", value: `${percent(loan.annual_rate)} p.a.` },
                  { label: "Tenure", value: tenure(loan.tenure_months) },
                  { label: "Total interest", value: money(loan.total_interest) },
                  { label: "Total payable", value: money(loan.total_payable) },
                  {
                    label: "Method",
                    value: "Reducing balance",
                  },
                  { label: "Start date", value: formatDate(loan.start_date) },
                  { label: "End date", value: formatDate(loan.end_date) },
                  { label: "Disbursed", value: formatDate(loan.disbursed_at) },
                  {
                    label: "Txn reference",
                    value: loan.disbursement_txn_id ?? "—",
                  },
                ]}
              />
            </CardBody>
          </Card>

          {/* e-Bills */}
          {bills.data && bills.data.length > 0 && (
            <Card>
              <CardHeader title="e-Bills" icon={<FileText className="size-4" />} />
              <CardBody className="space-y-2">
                {bills.data.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-[12px] font-medium text-ink-800">
                        {b.bill_no}
                      </p>
                      <p className="text-[11px] text-ink-400">
                        {formatDate(b.generated_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="tabular-nums text-[13px] font-semibold">
                        {money(b.amount)}
                      </span>
                      <Button size="xs" variant="ghost" icon={<Download className="size-3" />}>
                        PDF
                      </Button>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </Portal>
  );
}

function NocClaim({ loanId }: { loanId: string }) {
  return <LoanActions type="noc" loanId={loanId} fullWidth />;
}

function Row({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-ink-500">{label}</span>
      <span className={danger ? "tabular-nums font-medium text-danger-700" : "tabular-nums font-medium text-ink-900"}>
        {value}
      </span>
    </div>
  );
}

function relative(d: string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hours ago`;
  return `${Math.floor(hours / 24)} days ago`;
}