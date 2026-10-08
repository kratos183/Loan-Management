import { LifeBuoy, Plus } from "lucide-react";
import { Portal, loadPortal } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState, StatCard } from "@/components/ui/primitives";
import { TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { NewTicketForm } from "@/components/chat/new-ticket-form";
import { formatDateTime, money, relativeTime } from "@/lib/format";
import type { Ticket } from "@/lib/db/types";

export const metadata = { title: "Support Tickets" };

/** Source doc line 162: user raises a ticket when any issue arises. */
export default async function TicketsPage() {
  const ctx = await loadPortal("user");
  const supabase = await createClient();

  const { data } = await supabase
    .from("tickets")
    .select("*, loan:loans (account_number, product:loan_products (name))")
    .eq("user_id", ctx.session.user.id)
    .order("created_at", { ascending: false })
    .overrideTypes<Ticket[]>();

  const tickets = data ?? [];
  const open = tickets.filter((t) => ["OPEN", "IN_PROGRESS"].includes(t.status));
  const resolved = tickets.filter((t) => ["RESOLVED", "CLOSED"].includes(t.status));

  return (
    <Portal
      which="user"
      title="Support tickets"
      description="Raise an issue and we'll route it to the right person. Every ticket opens a chat thread so nothing gets lost."
      maxWidth="max-w-[1200px]"
    >
      <div className="stagger grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Open tickets"
          value={String(open.length)}
          sublabel={open.length ? "being worked on" : "nothing pending"}
          tone={open.length ? "warning" : "positive"}
        />
        <StatCard
          label="Resolved"
          value={String(resolved.length)}
          sublabel="all time"
          tone="positive"
        />
        <StatCard
          label="Average response"
          value="4 hrs"
          sublabel="during working hours"
          tone="info"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardBodyWrapper>
            {tickets.length === 0 ? (
              <EmptyState
                icon={<LifeBuoy className="size-6" />}
                title="No tickets raised"
                description="Use the form to raise one. Payment disputes, document problems or anything else that needs attention."
              />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <Th priority="normal">Ticket</Th>
                    <Th priority="primary">Subject</Th>
                    <Th priority="primary">Priority</Th>
                    <Th priority="primary">Status</Th>
                    <Th align="right" priority="normal">Raised</Th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <Tr key={t.id}>
                      <Td mono className="text-ink-500" priority="normal">
                        {t.ticket_no}
                      </Td>
                      <Td priority="primary">
                        <p className="font-medium text-ink-900">{t.subject}</p>
                        <p className="line-clamp-1 text-[11px] text-ink-400">
                          {t.description}
                        </p>
                      </Td>
                      <Td priority="primary">
                        <StatusBadge status={t.priority} />
                      </Td>
                      <Td priority="primary">
                        <StatusBadge status={t.status} />
                      </Td>
                      <Td align="right" className="text-xs text-ink-400" priority="normal">
                        {relativeTime(t.created_at)}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </CardBodyWrapper>
        </Card>

        <NewTicketForm />
      </div>
    </Portal>
  );
}

function CardBodyWrapper({ children }: { children: React.ReactNode }) {
  return <div className="p-1">{children}</div>;
}