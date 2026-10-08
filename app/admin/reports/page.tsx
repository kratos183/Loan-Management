import { BarChart3, Download, TrendingUp } from "lucide-react";
import { Portal, loadPortal } from "@/lib/portal";
import {
  getPlatformStats,
  listAllApplicationsForAdmin,
  listAllLoansForAdmin,
  listOverdueAcrossBook,
} from "@/lib/queries/staff";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import {
  Alert,
  DataList,
  EmptyState,
  ProgressBar,
  SectionTitle,
  StatCard,
} from "@/components/ui/primitives";
import { TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { formatDate, money, moneyCompact, number, percent } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata = { title: "Reports" };

/** GAP 1: reporting. Portfolio health, funnel conversion and product mix. */
export default async function AdminReportsPage() {
  await loadPortal("admin");

  const [stats, loans, applications, overdue] = await Promise.all([
    getPlatformStats(),
    listAllLoansForAdmin(),
    listAllApplicationsForAdmin(),
    listOverdueAcrossBook(),
  ]);

  // Product mix
  const byProduct = loans.reduce<Record<string, { count: number; disbursed: number; outstanding: number }>>(
    (acc, loan) => {
      const name = loan.product?.name ?? "Other";
      acc[name] ??= { count: 0, disbursed: 0, outstanding: 0 };
      acc[name].count += 1;
      acc[name].disbursed += Number(loan.principal);
      acc[name].outstanding += Number(loan.outstanding_principal);
      return acc;
    },
    {},
  );

  // Secured vs unsecured
  const secured = loans.filter((l) => l.product?.category === "SECURED");
  const unsecured = loans.filter((l) => l.product?.category === "UNSECURED");

  const totalDisbursed = stats.totalDisbursed || 1;
  const avgTicket = stats.loanCount ? stats.totalDisbursed / stats.loanCount : 0;

  const decided = applications.filter((a) =>
    ["APPROVED", "REJECTED"].includes(a.status),
  );
  const approvalRate = decided.length
    ? (applications.filter((a) => a.status === "APPROVED").length / decided.length) * 100
    : 0;

  const avgProcessingDays = (() => {
    const withDates = applications.filter((a) => a.submitted_at && a.decided_at);
    if (!withDates.length) return 0;
    const total = withDates.reduce((sum, a) => {
      const days =
        (new Date(a.decided_at!).getTime() - new Date(a.submitted_at!).getTime()) / 86_400_000;
      return sum + days;
    }, 0);
    return total / withDates.length;
  })();

  return (
    <Portal
      which="admin"
      title="Reports"
      description="Portfolio performance, conversion and servicing health."
      maxWidth="max-w-[1500px]"
      actions={
        <button
          type="button"
          onClick={undefined}
          className="pointer-events-none inline-flex items-center gap-1.5 rounded-lg border border-ink-300 bg-white px-3 py-2 text-[13px] font-medium text-ink-600 opacity-60"
          title="CSV export lands with the PDF generator"
        >
          <Download className="size-3.5" />
          Export
        </button>
      }
    >
      {/* Portfolio */}
      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total disbursed"
          value={moneyCompact(stats.totalDisbursed)}
          sublabel={`${stats.loanCount} accounts`}
          icon={<TrendingUp className="size-4" />}
          tone="brand"
        />
        <StatCard
          label="Outstanding"
          value={moneyCompact(stats.totalOutstanding)}
          sublabel={`${percent((stats.totalOutstanding / totalDisbursed) * 100, 1)} of book`}
          icon={<BarChart3 className="size-4" />}
          tone="info"
        />
        <StatCard
          label="Average ticket"
          value={moneyCompact(avgTicket)}
          sublabel="per loan"
          tone="warning"
        />
        <StatCard
          label="Approval rate"
          value={percent(approvalRate, 1)}
          sublabel={`${decided.length} decided`}
          tone={approvalRate >= 60 ? "positive" : "danger"}
        />
      </div>

      {/* Alerts */}
      {stats.overdueCount > 0 && (
        <Alert tone="danger" className="mt-6" title={`${stats.overdueCount} overdue instalments`}>
          {money(stats.overdueAmount)} outstanding across {overdue.length} accounts. This is
          the figure a collections team works from each morning.
        </Alert>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Product mix */}
        <Card>
          <CardHeader
            title="Product mix"
            description="Disbursed by product"
            icon={<BarChart3 className="size-4" />}
          />
          <CardBody className="space-y-4">
            {Object.entries(byProduct)
              .sort((a, b) => b[1].disbursed - a[1].disbursed)
              .map(([name, data]) => {
                const share = (data.disbursed / totalDisbursed) * 100;
                return (
                  <div key={name}>
                    <div className="mb-1 flex items-baseline justify-between gap-3">
                      <span className="truncate text-[13px] font-medium text-ink-800">
                        {name}
                      </span>
                      <span className="tabular-nums shrink-0 text-[13px] font-semibold text-ink-900">
                        {moneyCompact(data.disbursed)}
                      </span>
                    </div>
                    <ProgressBar value={share} size="sm" />
                    <p className="tabular-nums mt-1 text-[11px] text-ink-400">
                      {data.count} account{data.count > 1 ? "s" : ""} · {share.toFixed(1)}% of
                      book · {moneyCompact(data.outstanding)} outstanding
                    </p>
                  </div>
                );
              })}
            {Object.keys(byProduct).length === 0 && (
              <EmptyState title="No loans originated yet" />
            )}
          </CardBody>
        </Card>

        {/* Risk summary */}
        <Card>
          <CardHeader title="Risk & compliance" description="Portfolio health indicators" />
          <CardBody>
            <DataList
              items={[
                {
                  label: "Secured exposure",
                  value: moneyCompact(
                    secured.reduce((s, l) => s + Number(l.outstanding_principal), 0),
                  ),
                },
                {
                  label: "Unsecured exposure",
                  value: moneyCompact(
                    unsecured.reduce((s, l) => s + Number(l.outstanding_principal), 0),
                  ),
                },
                {
                  label: "Overdue rate",
                  value: stats.loanCount
                    ? percent(
                        (overdue.length /
                          loans.reduce((s, l) => s + l.tenure_months, 0)) *
                          100,
                        2,
                      )
                    : "0%",
                },
                {
                  label: "Overdue amount",
                  value: money(stats.overdueAmount),
                },
                { label: "Open tickets", value: String(stats.openTickets) },
                { label: "Pending NOCs", value: String(stats.pendingNoc) },
                {
                  label: "Avg processing time",
                  value: avgProcessingDays
                    ? `${avgProcessingDays.toFixed(1)} days`
                    : "—",
                },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      {/* Overdue detail */}
      <div className="mt-8">
        <SectionTitle>Overdue detail</SectionTitle>
        <Card>
          {overdue.length === 0 ? (
            <EmptyState
              icon={<TrendingUp className="size-6" />}
              title="Nothing overdue"
              description="Every instalment in the book is within its grace period or fully paid."
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Borrower</Th>
                  <Th>Product</Th>
                  <Th align="right">Instalment</Th>
                  <Th align="right">Due</Th>
                  <Th align="right">Days past due</Th>
                  <Th align="right">Amount</Th>
                  <Th align="right">Penalty</Th>
                </tr>
              </thead>
              <tbody>
                {overdue.map((e) => {
                  const loan = e.loan as unknown as {
                    account_number: string;
                    product: { name: string } | null;
                    borrower: { full_name: string; phone: string } | null;
                  } | null;
                  return (
                    <Tr key={e.id}>
                      <Td>
                        <span className="font-medium text-ink-900">
                          {loan?.borrower?.full_name}
                        </span>
                        <span className="block text-[11px] text-ink-400">
                          {loan?.borrower?.phone}
                        </span>
                      </Td>
                      <Td>
                        <span className="block text-ink-800">{loan?.product?.name}</span>
                        <span className="font-mono text-[11px] text-ink-400">
                          {loan?.account_number}
                        </span>
                      </Td>
                      <Td align="right" mono>
                        #{e.installment_no}
                      </Td>
                      <Td align="right" className="whitespace-nowrap">
                        {formatDate(e.due_date)}
                      </Td>
                      <Td align="right">
                        <Badge tone={e.days_past_due > 30 ? "danger" : "warning"}>
                          {e.days_past_due}d
                        </Badge>
                      </Td>
                      <Td align="right" mono className="font-semibold">
                        {money(e.amount_due)}
                      </Td>
                      <Td align="right" mono className="text-danger-700">
                        {Number(e.penalty_amount) > 0 ? money(e.penalty_amount) : "—"}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </TableWrap>
          )}
        </Card>
      </div>

      {/* Application outcomes */}
      <div className="mt-8">
        <SectionTitle>Recent application outcomes</SectionTitle>
        <Card>
          <TableWrap>
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Applicant</Th>
                <Th>Product</Th>
                <Th align="right">Amount</Th>
                <Th>Outcome</Th>
                <Th align="right">Decided</Th>
              </tr>
            </thead>
            <tbody>
              {applications
                .filter((a) => ["APPROVED", "REJECTED"].includes(a.status))
                .slice(0, 12)
                .map((a) => (
                  <Tr key={a.id}>
                    <Td mono className="text-brand-700">
                      {a.reference_no}
                    </Td>
                    <Td className="font-medium text-ink-900">
                      {a.applicant?.full_name}
                    </Td>
                    <Td className="text-ink-700">{a.product?.name}</Td>
                    <Td align="right" mono>
                      {money(a.requested_amount)}
                    </Td>
                    <Td>
                      <StatusBadge status={a.status} />
                    </Td>
                    <Td align="right" className="text-xs text-ink-400">
                      {formatDate(a.decided_at)}
                    </Td>
                  </Tr>
                ))}
            </tbody>
          </TableWrap>
        </Card>
      </div>
    </Portal>
  );
}