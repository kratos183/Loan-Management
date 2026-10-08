import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PortalShell } from "@/components/layout/portal-shell";
import type { Notification } from "@/lib/db/types";

/**
 * Portal chrome loader. Every portal page calls `loadPortal()` and renders
 * `<Portal>`, so auth checks, badge counts and layout live in one place.
 */
export async function loadPortal(portal: "user" | "employee" | "admin") {
  // These pages are inherently per-user and read the clock (`relativeTime`,
  // SLA countdowns, overdue days), which cannot be baked into a static shell.
  // `connection()` marks the render as request-time so the framework stops
  // trying to prerender it.
  await connection();

  const session = await requireSession();

  // Wrong role → send them to their own dashboard
  if (session.portal !== portal) redirect(`/${session.portal}/dashboard`);

  const supabase = await createClient();

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const badges = await countBadges(supabase, session);

  return {
    session,
    notifications: (notifications ?? []) as Notification[],
    badges,
  };
}

async function countBadges(
  supabase: Awaited<ReturnType<typeof createClient>>,
  session: Awaited<ReturnType<typeof requireSession>>,
) {
  const badges: Record<string, number> = {};

  const { count: unread } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.user.id)
    .is("read_at", null);
  badges.unreadNotifications = unread ?? 0;

  if (session.portal === "user") {
    const [{ count: openTickets }, { data: loans }] = await Promise.all([
      supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("user_id", session.user.id)
        .in("status", ["OPEN", "IN_PROGRESS"]),
      supabase.from("loans").select("id").eq("user_id", session.user.id).eq("status", "ACTIVE"),
    ]);

    badges.openTickets = openTickets ?? 0;

    const loanIds = (loans ?? []).map((l) => l.id);
    if (loanIds.length) {
      const { count: overdue } = await supabase
        .from("emi_schedule")
        .select("id", { count: "exact", head: true })
        .eq("status", "OVERDUE")
        .in("loan_id", loanIds);
      badges.overdueEmis = overdue ?? 0;
    } else {
      badges.overdueEmis = 0;
    }
  } else {
    const [{ count: pending }, { count: tickets }] = await Promise.all([
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("assigned_officer_id", session.user.id)
        .in("status", ["SUBMITTED", "UNDER_REVIEW", "RESUBMISSION_REQUESTED"]),
      supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", session.user.id)
        .in("status", ["OPEN", "IN_PROGRESS"]),
    ]);
    badges.pendingApplications = pending ?? 0;
    badges.openTickets = tickets ?? 0;
  }

  return badges;
}

/** Thin wrapper so pages read as `<Portal>…</Portal>`. */
export async function Portal({
  which,
  title,
  description,
  actions,
  maxWidth,
  breadcrumb,
  children,
}: {
  which: "user" | "employee" | "admin";
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  maxWidth?: string;
  breadcrumb?: ReactNode;
  children: ReactNode;
}) {
  const ctx = await loadPortal(which);

  return (
    <PortalShell
      portal={which}
      profile={ctx.session.user}
      notifications={ctx.notifications}
      badges={ctx.badges}
      title={title}
      description={description}
      actions={actions}
      maxWidth={maxWidth}
      breadcrumb={breadcrumb}
    >
      {children}
    </PortalShell>
  );
}