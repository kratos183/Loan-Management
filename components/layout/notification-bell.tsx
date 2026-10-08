"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import type { Notification } from "@/lib/db/types";
import { relativeTime } from "@/lib/format";
import { EmptyState } from "@/components/ui/primitives";

/**
 * Live notification bell.
 *
 * Initial rows come from the server (a Server Component already queried them),
 * then Supabase Realtime pushes new rows straight from Postgres. No polling.
 *
 * Source doc requirements this covers:
 *   line 111 — customer chats support → notify officer in EMP portal
 *   line 112 — officer replies          → notify user in USER portal
 *   line 155 — officer marks OD        → notify user
 */
export function NotificationBell({
  initial,
  userId,
}: {
  initial: Notification[];
  userId: string;
}) {
  const [items, setItems] = useState<Notification[]>(initial);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const unread = items.filter((n) => !n.read_at).length;

  // ── Live updates ──────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as Notification;
          setItems((prev) => [row, ...prev.filter((p) => p.id !== row.id)]);

          // Refresh the badge server count in the sidebar
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, router]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-notif-panel]")) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function markAllRead() {
    setLoading(true);
    try {
      const supabase = createClient();
      const unreadIds = items.filter((n) => !n.read_at).map((n) => n.id);
      if (unreadIds.length) {
        await supabase
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .in("id", unreadIds);
      }
      setItems((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })),
      );
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function openItem(n: Notification) {
    setOpen(false);
    if (!n.read_at) {
      const supabase = createClient();
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", n.id);
      setItems((prev) =>
        prev.map((p) => (p.id === n.id ? { ...p, read_at: new Date().toISOString() } : p)),
      );
    }
    if (n.link) router.push(n.link);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        className={cn(
          "relative flex size-9 items-center justify-center rounded-lg transition-colors",
          open ? "bg-ink-100 text-ink-900" : "text-ink-500 hover:bg-ink-100 hover:text-ink-900",
        )}
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            data-notif-panel
            className="absolute right-0 z-50 mt-2 w-96 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-ink-900">Notifications</h3>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={loading}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
                >
                  {loading ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <EmptyState
                  icon={<Bell className="size-6" />}
                  title="You're all caught up"
                  description="Updates on your applications, EMIs and chats will appear here."
                />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {items.map((n) => (
                    <li key={n.id}>
                      <button
                        onClick={() => openItem(n)}
                        className={cn(
                          "w-full px-4 py-3 text-left transition-colors hover:bg-ink-50",
                          !n.read_at && "bg-brand-50/40",
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          {!n.read_at && (
                            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500" />
                          )}
                          <div className={cn("min-w-0", n.read_at && "pl-[18px]")}>
                            <p className="truncate text-[13px] font-semibold text-ink-900">
                              {n.title}
                            </p>
                            {n.body && (
                              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-500">
                                {n.body}
                              </p>
                            )}
                            <p className="mt-1 text-[11px] text-ink-400">
                              {relativeTime(n.created_at)}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-ink-200 bg-ink-50/60 px-4 py-2.5 text-center">
              <button
                onClick={() => {
                  setOpen(false);
                  setItems([]);
                  router.refresh();
                }}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                Mark all as read and clear
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}