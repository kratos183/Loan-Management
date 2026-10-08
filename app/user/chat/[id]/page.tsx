import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Portal, loadPortal } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";
import { ChatPanel } from "@/components/chat/chat-panel";
import { Card } from "@/components/ui/card";
import type { ChatConversation, ChatMessage } from "@/lib/db/types";

export const metadata = { title: "Conversation" };

interface ConversationRow extends ChatConversation {
  messages: ChatMessage[];
  officer: { id: string; full_name: string } | null;
  application: { id: string; reference_no: string; product: { name: string } | null } | null;
}

export default async function UserChatThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await loadPortal("user");
  const supabase = await createClient();

  const { data } = await supabase
    .from("chat_conversations")
    .select(`
      *,
      messages:chat_messages (*),
      officer:profiles!chat_conversations_assigned_officer_id_fkey (id, full_name),
      application:applications (
        id, reference_no,
        product:loan_products (name)
      )
    `)
    .eq("id", id)
    .eq("user_id", ctx.session.user.id)
    .limit(1)
    .overrideTypes<ConversationRow[]>();

  const conversation = data?.[0];
  if (!conversation) notFound();

  return (
    <Portal
      which="user"
      maxWidth="max-w-[900px]"
      breadcrumb={
        <Link
          href="/user/chat"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-500 hover:text-brand-700"
        >
          <ArrowLeft className="size-3.5" />
          All conversations
        </Link>
      }
      title={conversation.application?.product?.name ?? conversation.subject ?? "Support chat"}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono">{conversation.reference_no}</span>
          {conversation.application && (
            <Link
              href={`/user/applications/${conversation.application.id}`}
              className="text-brand-600 hover:underline"
            >
              {conversation.application.reference_no}
            </Link>
          )}
        </span>
      }
    >
      <Card className="h-[calc(100vh-16rem)] min-h-[480px] overflow-hidden">
        <ChatPanel
          conversationId={conversation.id}
          initialMessages={conversation.messages ?? []}
          currentUserId={ctx.session.user.id}
          currentRole={ctx.session.role}
          counterpartName={conversation.officer?.full_name ?? "Loan Officer"}
          counterpartRole="Loan Officer"
          disabled={conversation.status === "CLOSED"}
          disabledReason="This conversation has been closed. Raise a new ticket if you need more help."
        />
      </Card>
    </Portal>
  );
}