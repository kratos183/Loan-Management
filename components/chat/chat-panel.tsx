"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { sendMessage } from "@/lib/actions/chat";
import { Avatar } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatDateTime, initials } from "@/lib/format";
import type { ChatMessage, UserRole } from "@/lib/db/types";

/**
 * Chat window.
 *
 * Messages live in Postgres (`chat_messages`) — that is the source of truth.
 * Supabase Realtime pushes new rows over a WebSocket, so an officer's reply
 * appears without a refresh (source doc lines 110-112).
 */
export function ChatPanel({
  conversationId,
  initialMessages,
  currentUserId,
  currentRole,
  counterpartName,
  counterpartRole,
  counterpartOnline,
  disabled,
  disabledReason,
}: {
  conversationId: string;
  initialMessages: ChatMessage[];
  currentUserId: string;
  currentRole: UserRole;
  counterpartName: string;
  counterpartRole: string;
  counterpartOnline?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to the newest message
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  // ── Live updates ─────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as ChatMessage;
          setMessages((prev) =>
            prev.some((m) => m.id === row.id) ? prev : [...prev, row],
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // Mark incoming messages as read
  useEffect(() => {
    const unread = messages.filter((m) => !m.read_at && m.sender_id !== currentUserId);
    if (unread.length === 0) return;

    const supabase = createClient();
    void supabase
      .from("chat_messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unread.map((m) => m.id));
  }, [messages, currentUserId]);

  function send() {
    const body = draft.trim();
    if (!body || pending) return;

    setDraft("");
    startTransition(async () => {
      const result = await sendMessage(conversationId, body);
      if (!result.success) {
        setDraft(body); // restore so nothing is lost
        return;
      }
      // Optimistic append; the Realtime subscription will de-duplicate
      const optimistic: ChatMessage = {
        id: `tmp-${Date.now()}`,
        conversation_id: conversationId,
        sender_id: currentUserId,
        sender_role: currentRole,
        body,
        attachment_path: null,
        created_at: new Date().toISOString(),
        read_at: null,
      };
      setMessages((prev) => [...prev, optimistic]);
      inputRef.current?.focus();
    });
  }

  const isMine = (m: ChatMessage) => m.sender_id === currentUserId;

  // Group consecutive messages from the same sender
  const grouped = messages.map((m, i) => {
    const prev = messages[i - 1];
    const sameSender = prev?.sender_id === m.sender_id;
    return { message: m, sameSender, firstOfDay: !sameSender && !isSameDay(prev?.created_at, m.created_at) };
  });

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-ink-200 px-4 py-3">
        <Avatar name={counterpartName} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ink-900">{counterpartName}</p>
          <p className="flex items-center gap-1.5 text-[11px] text-ink-500">
            <span
              className={cn(
                "size-1.5 rounded-full",
                counterpartOnline ? "bg-positive-500" : "bg-ink-300",
              )}
            />
            {isTyping ? "typing…" : counterpartOnline ? "online" : `last seen ${relativeShort(messages[messages.length - 1]?.created_at)}`}
          </p>
        </div>
        <span className="hidden shrink-0 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500 sm:inline">
          {counterpartRole}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-1 overflow-y-auto px-4 py-5">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <div>
              <Avatar name={counterpartName} size="lg" className="mx-auto mb-3" />
              <p className="text-[13px] font-medium text-ink-800">
                Start the conversation
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                Ask about documents, timelines, or anything else on your application.
              </p>
            </div>
          </div>
        ) : (
          grouped.map(({ message, sameSender, firstOfDay }) => (
            <div key={message.id}>
              {firstOfDay && (
                <div className="my-4 flex items-center gap-3">
                  <span className="h-px flex-1 bg-ink-100" />
                  <span className="text-[10px] font-medium uppercase tracking-wide text-ink-400">
                    {formatDateTime(message.created_at)}
                  </span>
                  <span className="h-px flex-1 bg-ink-100" />
                </div>
              )}
              <Bubble message={message} mine={isMine(message)} grouped={sameSender} />
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-ink-200 p-3">
        {disabled ? (
          <p className="rounded-lg bg-ink-50 px-3 py-2.5 text-center text-[13px] text-ink-500">
            {disabledReason ?? "This conversation is closed."}
          </p>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Type a message…"
              className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-ink-300 px-3 py-2.5 text-sm placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 focus:outline-none"
            />
            <button
              onClick={send}
              disabled={!draft.trim() || pending}
              aria-label="Send message"
              className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:bg-ink-200 disabled:text-ink-400"
            >
              <Send className="size-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Bubble({
  message,
  mine,
  grouped,
}: {
  message: ChatMessage;
  mine: boolean;
  grouped: boolean;
}) {
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start", grouped ? "mt-0.5" : "mt-3")}>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed",
          mine
            ? "rounded-br-md bg-brand-600 text-white"
            : "rounded-bl-md border border-ink-200 bg-white text-ink-800",
        )}
      >
        {!mine && !grouped && (
          <p className="mb-1 text-[11px] font-semibold text-brand-600">
            {initials(message.sender_role === "EMPLOYEE" ? "LO" : "AO")}
          </p>
        )}
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <p
          className={cn(
            "mt-1 text-[10px]",
            mine ? "text-brand-200" : "text-ink-400",
          )}
        >
          {new Date(message.created_at).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
          {mine && message.read_at && " · read"}
        </p>
      </div>
    </div>
  );
}

function isSameDay(a?: string, b?: string) {
  if (!a || !b) return false;
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function relativeShort(d?: string) {
  if (!d) return "recently";
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}