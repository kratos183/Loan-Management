import {
  ArrowRight,
  Banknote,
  FileText,
  Landmark,
  Package,
  TriangleAlert,
  Users,
} from "lucide-react";
import { Portal, loadPortal } from "@/lib/portal";
import { getPlatformStats } from "@/lib/queries/staff";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Alert, DataList, EmptyState, ProgressBar, SectionTitle, StatCard } from "@/components/ui/primitives";
import { TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { formatDate, money, moneyCompact, number, percent, relativeTime } from "@/lib/format";

export const metadata = { title: "Admin Dashboard" };

export default async function AdminDashboardPage() {
  await loadPortal("admin");
  const stats = await getPlatformStats();

  const approvalRate = stats.applicationCount
    ? ((stats.applicationsByStatus.APPROVED ?? 0) / stats.applicationCount) * 100
    : 0;
  const rejectionRate = stats.applicationCount
    ? ((stats.applicationsByStatus.REJECTED ?? 0) / stats.applicationCount) * 100
    : 0;

  const activeLoans = stats.loans.filter((l) => l.status === "ACTIVE");

  return (
    <Portal
      which="admin"
      title="Platform overview"
      description="Volumes, portfolio health and everything waiting on the operations team."
    >
      {/* Alerts */}
      <div className="space-y-3">
        {stats.overdueCount > 0 && (
          <Alert
            tone="danger"
            title={`${stats.overdueCount} overdue instalment${stats.overdueCount > 1 ? "s" : ""}`}
            icon={<TriangleAlert />}
            action={
              <LinkButton href="/admin/reports" size="sm" variant="outline">
                Investigate
              </LinkButton>
            }
          >
            {money(stats.overdueAmount)} is past its grace period across the portfolio.
          </Alert>
        )}
        {stats.pendingNoc > 0 && (
          <Alert tone="warning" title={`${stats.pendingNoc} NOC request awaiting approval`}>
            These borrowers have fully repaid and are waiting on their closure document.
          </Alert>
        )}
      </div>

      {/* Headline metrics */}
      <div className="stagger mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Disbursed"
          value={moneyCompact(stats.totalDisbursed)}
          sublabel={`${stats.loanCount} loans originated`}
          icon={<Banknote className="size-4" />}
          tone="brand"
          href="/admin/reports"
        />
        <StatCard
          label="Outstanding"
          value={moneyCompact(stats.totalOutstanding)}
          sublabel={`${activeLoans.length} active loans`}
          icon={<Landmark className="size-4" />}
          tone="info"
          href="/admin/reports"
        />
        <StatCard
          label="Applications"
          value={number(stats.applicationCount)}
          sublabel={`${percent(approvalRate, 0)} approval rate`}
          icon={<FileText className="size-4" />}
          tone="warning"
          href="/admin/reports"
        />
        <StatCard
          label="Users"
          value={number(stats.userCount)}
          sublabel="across all roles"
          icon={<Users className="size-4" />}
          tone="positive"
          href="/admin/users"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Funnel */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Application pipeline"
            description="Where every application currently sits"
            icon={<FileText className="size-4" />}
          />
          <CardBody className="space-y-3">
            {(
              [
                ["SUBMITTED", "Submitted", "bg-info-500"],
                ["UNDER_REVIEW", "Under review", "bg-info-500"],
                ["RESUBMISSION_REQUESTED", "Awaiting applicant", "bg-warning-500"],
                ["APPROVED", "Approved", "bg-positive-500"],
                ["REJECTED", "Rejected", "bg-danger-500"],
                ["DRAFT", "Draft", "bg-ink-300"],
              ] as const
            ).map(([key, label, colour]) => {
              const count = stats.applicationsByStatus[key] ?? 0;
              const pct = stats.applicationCount
                ? (count / stats.applicationCount) * 100
                : 0;
              if (count === 0) return null;
              return (
                <div key={key}>
                  <div className="mb-1 flex items-center justify-between text-[13px]">
                    <span className="text-ink-700">{label}</span>
                    <span className="tabular-nums font-semibold text-ink-900">{count}</span>
                  </div>
                  <ProgressBar value={pct} size="sm" />
                </div>
              );
            })}

            <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-4 text-[13px]">
              <span className="text-ink-500">Approval rate</span>
              <span className="tabular-nums font-semibold text-positive-700">
                {percent(approvalRate, 1)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ink-500">Rejection rate</span>
              <span className="tabular-nums font-semibold text-danger-700">
                {percent(rejectionRate, 1)}
              </span>
            </div>
          </CardBody>
        </Card>

        {/* Quick links */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Administration" />
            <CardBody className="space-y-2">
              {[
                { href: "/admin/users", label: "User management", icon: Users, sub: "Roles, status, access" },
                { href: "/admin/products", label: "Product config", icon: Package, sub: "Rates, tenures, checklists" },
                { href: "/admin/staff", label: "Staff & authority", icon: Landmark, sub: "Sanctioning limits" },
                { href: "/admin/reports", label: "Reports", icon: FileText, sub: "Portfolio and performance" },
              ].map(({ href, label, icon: Icon, sub }) => (
                <a
                  key={href}
                  href={href}
                  className="group flex items-center gap-3 rounded-lg border border-ink-200 px-3 py-2.5 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500 transition-colors group-hover:bg-brand-100 group-hover:text-brand-700">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink-800">{label}</p>
                    <p className="text-[11px] text-ink-400">{sub}</p>
                  </div>
                  <ArrowRight className="size-3.5 shrink-0 text-ink-300 group-hover:text-brand-600" />
                </a>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Portfolio health" />
            <CardBody>
              <DataList
                columns={1}
                items={[
                  {
                    label: "Overdue instalments",
                    value: String(stats.overdueCount),
                  },
                  {
                    label: "Overdue amount",
                    value: money(stats.overdueAmount),
                  },
                  { label: "Open tickets", value: String(stats.openTickets) },
                  { label: "Pending NOCs", value: String(stats.pendingNoc) },
                  {
                    label: "Avg loan size",
                    value: stats.loanCount
                      ? moneyCompact(stats.totalDisbursed / stats.loanCount)
                      : "—",
                  },
                ]}
              />
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Recent activity */}
      <div className="mt-8">
        <SectionTitle
          action={
            <LinkButton href="/admin/audit" size="sm" variant="ghost">
              Full audit log <ArrowRight className="size-3.5" />
            </LinkButton>
          }
        >
          Recent decisions
        </SectionTitle>
        <Card>
          {stats.loanCount === 0 ? (
            <EmptyState title="No loans originated yet" />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Account</Th>
                  <Th align="right">Principal</Th>
                  <Th align="right">Outstanding</Th>
                  <Th>Status</Th>
                  <Th align="right">Disbursed</Th>
                </tr>
              </thead>
              <tbody>
                {stats.loans.slice(0, 8).map((loan) => (
                  <Tr key={loan.id}>
                    <Td mono className="text-ink-600">
                      {loan.account_number}
                    </Td>
                    <Td align="right" mono>
                      {money(loan.principal)}
                    </Td>
                    <Td align="right" mono className="font-semibold">
                      {money(loan.outstanding_principal)}
                    </Td>
                    <Td>
                      <StatusBadge status={loan.status} />
                    </Td>
                    <Td align="right" className="text-xs text-ink-400">
                      {formatDate(loan.disbursed_at)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
      </div>
    </Portal>
  );
}