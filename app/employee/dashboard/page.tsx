import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Inbox,
  MessagesSquare,
  Ticket,
} from "lucide-react";
import { Portal, loadPortal } from "@/lib/portal";
import {
  getOfficerAuthority,
  listNocQueue,
  listOverdueAcrossBook,
  listStaffConversations,
  listStaffQueue,
  listStaffTickets,
  listUnassignedTickets,
} from "@/lib/queries/staff";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  Alert,
  Avatar,
  DataList,
  EmptyState,
  SectionTitle,
  StatCard,
} from "@/components/ui/primitives";
import { TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { formatDate, money, moneyCompact, number, percent, relativeTime, tenure } from "@/lib/format";

export const metadata = { title: "Employee Dashboard" };

export default async function EmployeeDashboardPage() {
  const ctx = await loadPortal("employee");
  const me = ctx.session.user.id;

  const [queue, conversations, tickets, unassigned, overdue, noc, authority] =
    await Promise.all([
      listStaffQueue(me),
      listStaffConversations(me),
      listStaffTickets(me),
      listUnassignedTickets(),
      listOverdueAcrossBook(),
      listNocQueue(),
      getOfficerAuthority(me),
    ]);

  const awaitingUser = queue.filter((a) => a.status === "RESUBMISSION_REQUESTED");
  const newSubmissions = queue.filter((a) => a.status === "SUBMITTED");
  const pendingNoc = noc.filter((n) => n.status === "PENDING");

  const unreadMessages = conversations.filter((c) =>
    c.messages?.some((m) => m.sender_id === c.user_id && !m.read_at),
  ).length;

  return (
    <Portal
      which="employee"
      title={`Welcome, ${ctx.session.user.full_name.split(" ")[0]}`}
      description="Your assigned work queue and everything waiting on you today."
    >
      {/* Authority banner — GAP 2 & 7 */}
      {authority && (
        <Alert tone="neutral" title="Your sanctioning authority" icon={<CheckCircle2 />}>
          As a{" "}
          <strong className="capitalize">
            {authority.employee_role === "OFFICER" ? "loan officer" : "manager"}
          </strong>{" "}
          you can approve up to{" "}
          <strong>{moneyCompact(authority.approval_limit)}</strong>
          {authority.territory && <> · {authority.territory} territory</>}. Applications above
          that amount automatically escalate to a manager.
        </Alert>
      )}

      <div className="stagger mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="In your queue"
          value={number(queue.length)}
          sublabel={`${newSubmissions.length} newly submitted`}
          icon={<Inbox className="size-4" />}
          tone="brand"
          href="/employee/applications"
        />
        <StatCard
          label="Awaiting customer"
          value={number(awaitingUser.length)}
          sublabel={awaitingUser.length ? "resubmissions pending" : "none blocked"}
          icon={<Clock className="size-4" />}
          tone={awaitingUser.length ? "warning" : "positive"}
        />
        <StatCard
          label="Unread chats"
          value={number(unreadMessages)}
          sublabel={`${conversations.length} conversations`}
          icon={<MessagesSquare className="size-4" />}
          tone={unreadMessages ? "info" : "brand"}
          href="/employee/chat"
        />
        <StatCard
          label="Overdue EMIs"
          value={number(overdue.length)}
          sublabel={`${moneyCompact(
            overdue.reduce((s, e) => s + Number(e.amount_due) + Number(e.penalty_amount), 0),
          )} outstanding`}
          icon={<AlertTriangle className="size-4" />}
          tone={overdue.length ? "danger" : "positive"}
          href="/employee/loans"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* ─── Work queue ─── */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Applications assigned to you"
            description="Oldest first — SLA clocks are running"
            icon={<Inbox className="size-4" />}
            action={
              <LinkButton href="/employee/applications" size="sm" variant="ghost">
                View all <ArrowRight className="size-3.5" />
              </LinkButton>
            }
          />
          {queue.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="size-6" />}
              title="Queue is clear"
              description="Nothing is waiting on you right now. Unassigned tickets are below."
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Applicant</Th>
                  <Th>Product</Th>
                  <Th align="right">Amount</Th>
                  <Th>Status</Th>
                  <Th align="right">Submitted</Th>
                  <Th align="right">SLA</Th>
                </tr>
              </thead>
              <tbody>
                {queue.map((app) => {
                  const overdueSla =
                    app.sla_due_at && new Date(app.sla_due_at) < new Date() && !["APPROVED", "REJECTED"].includes(app.status);

                  return (
                    <Tr key={app.id}>
                      <Td>
                        <Link
                          href={`/employee/applications/${app.id}`}
                          className="font-medium text-ink-900 hover:text-brand-700 hover:underline"
                        >
                          {app.applicant?.full_name}
                        </Link>
                        <span className="block font-mono text-[11px] text-ink-400">
                          {app.reference_no}
                        </span>
                      </Td>
                      <Td>
                        <span className="block text-ink-800">{app.product?.name}</span>
                        <span className="text-[11px] text-ink-400">
                          {tenure(app.tenure_months)}
                        </span>
                      </Td>
                      <Td align="right" mono className="font-semibold">
                        {money(app.requested_amount)}
                      </Td>
                      <Td>
                        <StatusBadge status={app.status} />
                      </Td>
                      <Td align="right" className="text-xs text-ink-400">
                        {relativeTime(app.submitted_at)}
                      </Td>
                      <Td align="right">
                        {overdueSla ? (
                          <Badge tone="danger">Breached</Badge>
                        ) : app.sla_due_at ? (
                          <span className="text-xs text-ink-500">
                            {formatDate(app.sla_due_at)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </TableWrap>
          )}
        </Card>

        {/* ─── Side rail ─── */}
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Recent chats"
              action={
                <LinkButton href="/employee/chat" size="xs" variant="ghost">
                  Open
                </LinkButton>
              }
            />
            <CardBody className="space-y-3">
              {conversations.length === 0 ? (
                <p className="py-4 text-center text-[13px] text-ink-400">No conversations yet</p>
              ) : (
                conversations.slice(0, 4).map((c) => {
                  const last = c.messages?.[c.messages.length - 1];
                  const unread = c.messages?.some(
                    (m) => m.sender_id === c.user_id && !m.read_at,
                  );
                  return (
                    <Link
                      key={c.id}
                      href={`/employee/chat/${c.id}`}
                      className="flex items-start gap-2.5 rounded-lg p-2 transition-colors hover:bg-ink-50"
                    >
                      <Avatar name={c.customer?.full_name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-[13px] font-semibold text-ink-900">
                            {c.customer?.full_name}
                          </p>
                          {unread && (
                            <span className="size-1.5 shrink-0 rounded-full bg-brand-500" />
                          )}
                        </div>
                        <p className="truncate text-xs text-ink-500">
                          {last?.body ?? "No messages"}
                        </p>
                        <p className="text-[10px] text-ink-400">
                          {relativeTime(c.last_message_at)}
                        </p>
                      </div>
                    </Link>
                  );
                })
              )}
            </CardBody>
          </Card>

          {/* Unassigned work — GAP 5 */}
          {unassigned.length > 0 && (
            <Card>
              <CardHeader
                title="Unassigned tickets"
                description="Not yet allocated to anyone"
                icon={<Ticket className="size-4" />}
              />
              <CardBody className="space-y-2.5">
                {unassigned.slice(0, 5).map((t) => (
                  <div key={t.id} className="rounded-lg border border-ink-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-medium text-ink-900">{t.subject}</p>
                      <StatusBadge status={t.priority} />
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-ink-400">{t.ticket_no}</p>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          {pendingNoc.length > 0 && (
            <Card>
              <CardHeader
                title="NOC requests"
                description="Awaiting your approval"
                action={
                  <LinkButton href="/employee/noc" size="xs" variant="ghost">
                    Review
                  </LinkButton>
                }
              />
              <CardBody className="space-y-2.5">
                {pendingNoc.slice(0, 4).map((n) => {
                  const loan = n.loan as unknown as {
                    account_number: string;
                    product: { name: string } | null;
                    borrower: { full_name: string } | null;
                  } | null;
                  return (
                    <div key={n.id} className="rounded-lg border border-ink-200 p-3">
                      <p className="text-[13px] font-medium text-ink-900">
                        {loan?.borrower?.full_name}
                      </p>
                      <p className="tabular-nums mt-0.5 text-xs text-ink-500">
                        {loan?.product?.name} · {loan?.account_number}
                      </p>
                      <p className="mt-1 text-[11px] text-ink-400">
                        Requested {relativeTime(n.requested_at)}
                      </p>
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {/* ─── Overdue book ─── */}
      <div className="mt-8">
        <SectionTitle
          action={
            <LinkButton href="/employee/loans" size="sm" variant="ghost">
              All loans <ArrowRight className="size-3.5" />
            </LinkButton>
          }
        >
          Overdue instalments across the book
        </SectionTitle>
        <Card>
          {overdue.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="size-6" />}
              title="No overdue instalments"
              description="Every borrower is within their grace period or fully paid up."
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Borrower</Th>
                  <Th>Loan</Th>
                  <Th align="right">Instalment</Th>
                  <Th align="right">Due date</Th>
                  <Th align="right">Days past due</Th>
                  <Th align="right">Amount due</Th>
                  <Th align="right">Penalty</Th>
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
                        <span className="tabular-nums font-mono text-[11px] text-ink-400">
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
    </Portal>
  );
}