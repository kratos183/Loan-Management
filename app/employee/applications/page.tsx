import Link from "next/link";
import { AlertTriangle, CheckCircle2, Inbox } from "lucide-react";
import { Portal, loadPortal } from "@/lib/portal";
import { listStaffQueue } from "@/lib/queries/staff";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, EmptyState, StatCard } from "@/components/ui/primitives";
import { TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { formatDate, money, moneyCompact, number, relativeTime, tenure } from "@/lib/format";

export const metadata = { title: "Work Queue" };

export default async function StaffApplicationsPage() {
  const ctx = await loadPortal("employee");
  const queue = await listStaffQueue(ctx.session.user.id);

  const fresh = queue.filter((a) => a.status === "SUBMITTED");
  const inReview = queue.filter((a) => a.status === "UNDER_REVIEW");
  const waiting = queue.filter((a) => a.status === "RESUBMISSION_REQUESTED");

  const breached = queue.filter(
    (a) => a.sla_due_at && new Date(a.sla_due_at) < new Date(),
  );

  const totalValue = queue.reduce((s, a) => s + Number(a.requested_amount), 0);

  return (
    <Portal
      which="employee"
      title="Application queue"
      description="Everything assigned to you, oldest submission first."
    >
      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total in queue"
          value={number(queue.length)}
          sublabel={moneyCompact(totalValue)}
          icon={<Inbox className="size-4" />}
          tone="brand"
        />
        <StatCard
          label="New submissions"
          value={number(fresh.length)}
          sublabel="not yet started"
          tone={fresh.length ? "warning" : "positive"}
        />
        <StatCard
          label="SLA breached"
          value={number(breached.length)}
          sublabel={breached.length ? "past due date" : "all within SLA"}
          tone={breached.length ? "danger" : "positive"}
        />
        <StatCard
          label="Awaiting customer"
          value={number(waiting.length)}
          sublabel="resubmissions"
          tone="info"
        />
      </div>

      <Card className="mt-6">
        {queue.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="size-6" />}
            title="Nothing in your queue"
            description="Every application assigned to you has been decided."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th priority="primary">Applicant</Th>
                <Th priority="primary">Product</Th>
                <Th align="right" priority="primary">Amount</Th>
                <Th priority="primary">Status</Th>
                <Th align="right" priority="normal">Submitted</Th>
                <Th align="right" priority="normal">SLA due</Th>
                <Th align="right" priority="primary" />
              </tr>
            </thead>
            <tbody>
              {queue.map((app) => {
                const overdue =
                  app.sla_due_at && new Date(app.sla_due_at) < new Date();
                const income = app.applicant?.monthly_income;

                return (
                  <Tr key={app.id}>
                    <Td priority="primary">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={app.applicant?.full_name} size="sm" />
                        <div className="min-w-0">
                          <Link
                            href={`/employee/applications/${app.id}`}
                            className="block font-medium text-ink-900 hover:text-brand-700 hover:underline"
                          >
                            {app.applicant?.full_name}
                          </Link>
                          <span className="block font-mono text-[11px] text-ink-400">
                            {app.reference_no}
                          </span>
                        </div>
                      </div>
                    </Td>
                    <Td priority="primary">
                      <span className="block text-ink-800">{app.product?.name}</span>
                      <span className="block text-[11px] text-ink-400">
                        {tenure(app.tenure_months)}
                        {app.product?.collateral_type !== "NONE" &&
                          ` · ${app.product?.collateral_type.toLowerCase()}`}
                      </span>
                    </Td>
                    <Td align="right" priority="primary">
                      <span className="tabular-nums block font-semibold">
                        {money(app.requested_amount)}
                      </span>
                      {income && (
                        <span className="tabular-nums block text-[11px] text-ink-400">
                          inc {moneyCompact(income)}/mo
                        </span>
                      )}
                    </Td>
                    <Td priority="primary">
                      <StatusBadge status={app.status} />
                    </Td>
                    <Td align="right" className="text-xs text-ink-400" priority="normal">
                      {relativeTime(app.submitted_at)}
                    </Td>
                    <Td align="right" priority="normal">
                      {overdue ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-danger-700">
                          <AlertTriangle className="size-3" />
                          {formatDate(app.sla_due_at)}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-500">{formatDate(app.sla_due_at)}</span>
                      )}
                    </Td>
                    <Td align="right" priority="primary">
                      <LinkButton
                        href={`/employee/applications/${app.id}`}
                        size="xs"
                        variant={app.status === "SUBMITTED" ? "primary" : "outline"}
                      >
                        Review
                      </LinkButton>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </Portal>
  );
}