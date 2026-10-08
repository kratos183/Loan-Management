import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { Portal, loadPortal } from "@/lib/portal";
import { listStaffConversations } from "@/lib/queries/staff";
import { Card } from "@/components/ui/card";
import { Avatar, EmptyState, StatCard } from "@/components/ui/primitives";
import { relativeTime } from "@/lib/format";

export const metadata = { title: "Chats" };

export default async function StaffChatPage() {
  const ctx = await loadPortal("employee");
  const conversations = await listStaffConversations(ctx.session.user.id);

  const unread = conversations.filter((c) =>
    c.messages?.some((m) => m.sender_id === c.user_id && !m.read_at),
  ).length;
  const waitingOnYou = conversations.filter((c) => c.status === "PENDING_OFFICER").length;

  return (
    <Portal
      which="employee"
      title="Customer chats"
      description="Every conversation assigned to you. Replies land in the customer's portal instantly."
    >
      <div className="stagger mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Conversations"
          value={String(conversations.length)}
          sublabel="assigned to you"
          icon={<MessagesSquare className="size-4" />}
          tone="brand"
        />
        <StatCard
          label="Unread"
          value={String(unread)}
          sublabel={unread ? "customer is waiting" : "all read"}
          tone={unread ? "warning" : "positive"}
        />
        <StatCard
          label="Your turn"
          value={String(waitingOnYou)}
          sublabel="awaiting your reply"
          tone={waitingOnYou ? "info" : "brand"}
        />
      </div>

      <Card>
        {conversations.length === 0 ? (
          <EmptyState
            icon={<MessagesSquare className="size-6" />}
            title="No conversations"
            description="Customers can reach you from any application page. New chats appear here."
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {conversations.map((c) => {
              const last = c.messages?.[c.messages.length - 1];
              const isUnread = c.messages?.some(
                (m) => m.sender_id === c.user_id && !m.read_at,
              );

              return (
                <li key={c.id}>
                  <Link
                    href={`/employee/chat/${c.id}`}
                    className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-ink-50"
                  >
                    <Avatar name={c.customer?.full_name} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <p className="text-[14px] font-semibold text-ink-900">
                          {c.customer?.full_name}
                        </p>
                        <span className="font-mono text-[11px] text-ink-400">
                          {c.reference_no}
                        </span>
                        {isUnread && (
                          <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                            New
                          </span>
                        )}
                      </div>
                      {c.subject && (
                        <p className="mt-0.5 truncate text-xs text-ink-500">{c.subject}</p>
                      )}
                      <p className="mt-0.5 truncate text-[13px] text-ink-600">
                        <span className="text-ink-400">
                          {last?.sender_id === ctx.session.user.id ? "You: " : ""}
                        </span>
                        {last?.body ?? "No messages yet"}
                      </p>
                      <p className="mt-1 text-[11px] text-ink-400">
                        {relativeTime(c.last_message_at)}
                      </p>
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