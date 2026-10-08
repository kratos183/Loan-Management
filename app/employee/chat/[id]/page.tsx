import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageSquare, Ticket as TicketIcon } from "lucide-react";
import { Portal, loadPortal } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";
import { ChatPanel } from "@/components/chat/chat-panel";
import { Card, CardBody } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { DataList } from "@/components/ui/primitives";
import { formatDate, relativeTime } from "@/lib/format";
import type { ChatConversation, ChatMessage } from "@/lib/db/types";

export const metadata = { title: "Conversation" };

interface Row extends ChatConversation {
  messages: ChatMessage[];
  customer: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    monthly_income: number | null;
  } | null;
  application: { id: string; reference_no: string; product: { name: string } | null } | null;
  loan: { id: string; account_number: string; outstanding_principal: number } | null;
  ticket: { id: string; ticket_no: string; subject: string; status: string } | null;
}

export default async function StaffChatThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await loadPortal("employee");
  const supabase = await createClient();

  const { data } = await supabase
    .from("chat_conversations")
    .select(`
      *,
      messages:chat_messages (*),
      customer:profiles!chat_conversations_user_id_fkey (
        id, full_name, email, phone, monthly_income
      ),
      application:applications (id, reference_no, product:loan_products (name)),
      loan:loans (id, account_number, outstanding_principal),
      ticket:tickets (id, ticket_no, subject, status)
    `)
    .eq("id", id)
    .limit(1)
    .overrideTypes<Row[]>();

  const conversation = data?.[0];
  if (!conversation) notFound();

  return (
    <Portal
      which="employee"
      maxWidth="max-w-[1200px]"
      breadcrumb={
        <Link
          href="/employee/chat"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-500 hover:text-brand-700"
        >
          <ArrowLeft className="size-3.5" />
          All conversations
        </Link>
      }
      title={conversation.customer?.full_name ?? "Customer"}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono">{conversation.reference_no}</span>
          {conversation.application && (
            <Link
              href={`/employee/applications/${conversation.application.id}`}
              className="inline-flex items-center gap-1 text-brand-600 hover:underline"
            >
              <MessageSquare className="size-3" />
              {conversation.application.reference_no}
            </Link>
          )}
          {conversation.ticket && (
            <Link
              href="/employee/tickets"
              className="inline-flex items-center gap-1 text-brand-600 hover:underline"
            >
              <TicketIcon className="size-3" />
              {conversation.ticket.ticket_no}
            </Link>
          )}
        </span>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        {/*
          `dvh`, not `vh`. On mobile, `100vh` resolves to the viewport with the
          URL bar hidden, so a panel sized against it overflows by the height of
          the browser chrome and pushes the composer off-screen. The offsets
          differ per breakpoint because the header stack is taller on a phone.
        */}
        <Card className="h-[calc(100dvh-13rem)] min-h-[360px] lg:h-[calc(100dvh-15rem)] lg:min-h-[480px] overflow-hidden">
          <ChatPanel
            conversationId={conversation.id}
            initialMessages={conversation.messages ?? []}
            currentUserId={ctx.session.user.id}
            currentRole={ctx.session.role}
            counterpartName={conversation.customer?.full_name ?? "Customer"}
            counterpartRole="Customer"
            disabled={conversation.status === "CLOSED"}
          />
        </Card>

        <div className="space-y-4">
          <Card>
            <CardBody>
              <h3 className="mb-3 text-[13px] font-semibold text-ink-900">Customer</h3>
              <DataList
                columns={1}
                items={[
                  { label: "Name", value: conversation.customer?.full_name ?? "—" },
                  { label: "Email", value: conversation.customer?.email ?? "—" },
                  { label: "Phone", value: conversation.customer?.phone ?? "—" },
                  {
                    label: "Monthly income",
                    value: conversation.customer?.monthly_income
                      ? `₹${Number(conversation.customer.monthly_income).toLocaleString("en-IN")}`
                      : "—",
                  },
                ]}
              />

              {conversation.application && (
                <LinkButton
                  href={`/employee/applications/${conversation.application.id}`}
                  size="sm"
                  variant="outline"
                  fullWidth
                  className="mt-4"
                >
                  Open application
                </LinkButton>
              )}
              {conversation.loan && (
                <LinkButton
                  href="/employee/loans"
                  size="sm"
                  variant="outline"
                  fullWidth
                  className="mt-2"
                >
                  View loan servicing
                </LinkButton>
              )}
            </CardBody>
          </Card>

          {conversation.ticket && (
            <Card>
              <CardBody>
                <h3 className="mb-2 text-[13px] font-semibold text-ink-900">Linked ticket</h3>
                <p className="font-mono text-[11px] text-ink-400">
                  {conversation.ticket.ticket_no}
                </p>
                <p className="mt-1 text-[13px] font-medium text-ink-800">
                  {conversation.ticket.subject}
                </p>
                <p className="mt-1 text-[11px] text-ink-400">
                  Status: {conversation.ticket.status.toLowerCase().replace("_", " ")}
                </p>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardBody>
              <h3 className="mb-2 text-[13px] font-semibold text-ink-900">Thread</h3>
              <DataList
                columns={1}
                items={[
                  { label: "Status", value: conversation.status.replace(/_/g, " ").toLowerCase() },
                  { label: "Started", value: formatDate(conversation.created_at) },
                  { label: "Last message", value: relativeTime(conversation.last_message_at) },
                ]}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </Portal>
  );
}