import { LifeBuoy, Ticket } from "lucide-react";
import { Portal, loadPortal } from "@/lib/portal";
import { listStaffTickets, listUnassignedTickets } from "@/lib/queries/staff";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar, EmptyState, SectionTitle, StatCard } from "@/components/ui/primitives";
import { TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { TicketActions } from "./TicketActions";
import { relativeTime } from "@/lib/format";

export const metadata = { title: "Tickets" };

interface TicketRow {
  id: string;
  ticket_no: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  customer: { id: string; full_name: string; email: string; phone: string } | null;
}

export default async function StaffTicketsPage() {
  const ctx = await loadPortal("employee");

  const [mine, unassigned] = await Promise.all([
    listStaffTickets(ctx.session.user.id),
    listUnassignedTickets(),
  ]);

  const myTickets = mine as unknown as TicketRow[];
  const openTickets = unassigned as unknown as TicketRow[];

  const highPriority = myTickets.filter(
    (t) => t.priority === "HIGH" && ["OPEN", "IN_PROGRESS"].includes(t.status),
  );

  return (
    <Portal
      which="employee"
      title="Support tickets"
      description="Customer-raised issues assigned to you, plus anything not yet allocated."
      maxWidth="max-w-[1300px]"
    >
      <div className="stagger grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Assigned to you"
          value={String(myTickets.length)}
          sublabel={`${myTickets.filter((t) => ["OPEN", "IN_PROGRESS"].includes(t.status)).length} open`}
          icon={<Ticket className="size-4" />}
          tone="brand"
        />
        <StatCard
          label="High priority"
          value={String(highPriority.length)}
          sublabel={highPriority.length ? "money or blocking issues" : "none urgent"}
          tone={highPriority.length ? "danger" : "positive"}
        />
        <StatCard
          label="Unassigned"
          value={String(openTickets.length)}
          sublabel="waiting for an owner"
          tone={openTickets.length ? "warning" : "positive"}
        />
      </div>

      {openTickets.length > 0 && (
        <div className="mt-8">
          <SectionTitle>Unassigned ({openTickets.length})</SectionTitle>
          <Card>
            <ul className="divide-y divide-ink-100">
              {openTickets.map((t) => (
                <li key={t.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[14px] font-semibold text-ink-900">{t.subject}</p>
                        <StatusBadge status={t.priority} />
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-ink-400">
                        {t.ticket_no} · raised {relativeTime(t.created_at)}
                      </p>
                      <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-500">
                        {t.description}
                      </p>
                    </div>
                  </div>
                  <TicketActions ticketId={t.id} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      <div className="mt-8">
        <SectionTitle>Assigned to you ({myTickets.length})</SectionTitle>
        <Card>
          {myTickets.length === 0 ? (
            <EmptyState
              icon={<LifeBuoy className="size-6" />}
              title="No tickets assigned"
              description="Nothing is waiting on you from the support queue."
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Customer</Th>
                  <Th>Subject</Th>
                  <Th>Category</Th>
                  <Th>Priority</Th>
                  <Th>Status</Th>
                  <Th align="right">Raised</Th>
                  <Th align="right" />
                </tr>
              </thead>
              <tbody>
                {myTickets.map((t) => (
                  <Tr key={t.id}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={t.customer?.full_name} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium text-ink-900">
                            {t.customer?.full_name}
                          </p>
                          <p className="font-mono text-[11px] text-ink-400">
                            {t.ticket_no}
                          </p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <p className="font-medium text-ink-800">{t.subject}</p>
                      <p className="line-clamp-1 text-[11px] text-ink-400">
                        {t.description}
                      </p>
                    </Td>
                    <Td className="text-[13px] text-ink-600">{t.category}</Td>
                    <Td>
                      <StatusBadge status={t.priority} />
                    </Td>
                    <Td>
                      <StatusBadge status={t.status} />
                    </Td>
                    <Td align="right" className="text-xs text-ink-400">
                      {relativeTime(t.created_at)}
                    </Td>
                    <Td align="right">
                      <TicketActions ticketId={t.id} compact />
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