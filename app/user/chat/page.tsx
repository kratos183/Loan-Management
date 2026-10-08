import Link from "next/link";
import { MessageCircleQuestion, MessagesSquare, Plus } from "lucide-react";
import { Portal, loadPortal } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button, LinkButton } from "@/components/ui/button";
import { Avatar, EmptyState, StatCard } from "@/components/ui/primitives";
import { relativeTime } from "@/lib/format";
import type { ChatConversation, ChatMessage } from "@/lib/db/types";

export const metadata = { title: "Chat Support" };

interface ConversationRow extends ChatConversation {
  messages: ChatMessage[];
  officer: { id: string; full_name: string } | null;
  application: { reference_no: string; product: { name: string } | null } | null;
}

export default async function UserChatPage({
  searchParams,
}: {
  searchParams: Promise<{ application?: string; conversation?: string }>;
}) {
  const ctx = await loadPortal("user");
  const params = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("chat_conversations")
    .select(`
      *,
      messages:chat_messages (*),
      officer:profiles!chat_conversations_assigned_officer_id_fkey (id, full_name),
      application:applications (
        reference_no,
        product:loan_products (name)
      )
    `)
    .eq("user_id", ctx.session.user.id)
    .order("last_message_at", { ascending: false })
    .overrideTypes<ConversationRow[]>();

  const conversations = data ?? [];
  const openCount = conversations.filter((c) => c.status !== "CLOSED").length;
  const awaitingOfficer = conversations.filter((c) => c.status === "PENDING_OFFICER").length;

  return (
    <Portal
      which="user"
      title="Chat support"
      description="Talk to your assigned officer. Messages arrive live — no need to refresh."
      maxWidth="max-w-[1100px]"
      actions={
        <LinkButton href="/user/tickets" size="sm" variant="outline" icon={<Plus className="size-4" />}>
          Raise a ticket
        </LinkButton>
      }
    >
      <div className="stagger mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Conversations"
          value={String(conversations.length)}
          sublabel={`${openCount} open`}
          icon={<MessagesSquare className="size-4" />}
          tone="brand"
        />
        <StatCard
          label="Awaiting officer"
          value={String(awaitingOfficer)}
          sublabel={awaitingOfficer ? "you'll be notified on reply" : "all answered"}
          tone={awaitingOfficer ? "warning" : "positive"}
        />
        <StatCard
          label="Typical response"
          value="2 hrs"
          sublabel="during working hours"
          tone="info"
        />
      </div>

      {params.application && !params.conversation && (
        <Card className="mb-4 p-4">
          <p className="text-[13px] text-ink-600">
            Opening a chat about{" "}
            <Link
              href={`/user/applications/${params.application}`}
              className="font-medium text-brand-700 hover:underline"
            >
              this application
            </Link>
            .
          </p>
        </Card>
      )}

      <Card>
        {conversations.length === 0 ? (
          <EmptyState
            icon={<MessageCircleQuestion className="size-6" />}
            title="No conversations yet"
            description="Start a chat from any application page to reach your assigned officer, or raise a ticket for a general issue."
            action={<LinkButton href="/user/applications">View my applications</LinkButton>}
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {conversations.map((c) => {
              const last = c.messages?.[c.messages.length - 1];
              const mine = last?.sender_id === ctx.session.user.id;

              return (
                <li key={c.id}>
                  <Link
                    href={`/user/chat/${c.id}`}
                    className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-ink-50"
                  >
                    <Avatar name={c.officer?.full_name ?? "Loan Officer"} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <p className="text-[14px] font-semibold text-ink-900">
                          {c.officer?.full_name ?? "Loan Officer"}
                        </p>
                        <span className="font-mono text-[11px] text-ink-400">
                          {c.reference_no}
                        </span>
                        {c.status === "PENDING_OFFICER" && (
                          <span className="rounded-full bg-warning-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning-700">
                            Awaiting reply
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[13px] text-ink-500">
                        <span className="text-ink-400">{mine ? "You: " : ""}</span>
                        {last?.body ?? "No messages yet"}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] text-ink-400">
                        {c.application && <span>{c.application.product?.name}</span>}
                        <span>{relativeTime(c.last_message_at)}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </Portal>
  );
}