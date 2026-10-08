"use client";

import { NotificationBell } from "./notification-bell";
import { MobileSidebar, Brand } from "./sidebar";
import { PageHeader } from "@/components/ui/primitives";
import type { Notification, Profile } from "@/lib/db/types";
import { NAV_BY_PORTAL, PORTAL_LABEL } from "@/lib/navigation";

/**
 * Shared chrome for all three portals: fixed sidebar, topbar, content column.
 *
 * This is a Client Component because the sidebar needs `usePathname()` for
 * active-link state, and because the nav config holds Lucide icon component
 * references. Those cannot be passed down from a Server Component — functions
 * are not serialisable across the RSC boundary — so the config is imported
 * here on the client instead of arriving as a prop.
 *
 * Everything crossing the boundary from the server (`profile`,
 * `notifications`, `badges`, `children`) is plain data or ReactNode.
 *
 * `title` renders a PageHeader for the page. Omit it for pages that supply
 * their own header.
 */
export function PortalShell({
  portal,
  profile,
  notifications,
  badges,
  title,
  description,
  actions,
  breadcrumb,
  children,
  maxWidth = "max-w-[1400px]",
}: {
  portal: keyof typeof PORTAL_LABEL;
  profile: Profile;
  notifications: Notification[];
  badges?: Record<string, number>;
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  const sections = NAV_BY_PORTAL[portal];
  return (
    <div className="flex min-h-screen bg-ink-50">
      {/* ─── Desktop sidebar ─── */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-ink-200 lg:block">
        <SidebarInner
          sections={sections}
          profile={profile}
          roleLabel={PORTAL_LABEL[portal]}
          badges={badges}
        />
      </aside>

      {/* ─── Main column ─── */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-ink-200 bg-white/85 px-4 backdrop-blur-md sm:px-6">
          <MobileSidebar
            sections={sections}
            profile={profile}
            roleLabel={PORTAL_LABEL[portal]}
            badges={badges}
          />

          {/* Show the brand on mobile where the sidebar is hidden */}
          <div className="lg:hidden">
            <Brand />
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <NotificationBell initial={notifications} userId={profile.id} />
          </div>
        </header>

        {/* Content */}
        <main className={cnMain(maxWidth)}>
          {title && (
            <PageHeader
              title={title}
              description={description}
              actions={actions}
              breadcrumb={breadcrumb}
            />
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

function cnMain(maxWidth: string) {
  return `mx-auto w-full ${maxWidth} flex-1 px-4 py-6 sm:px-6 sm:py-8`;
}

// Imported at the bottom so the shell file reads top-down
import { Sidebar as SidebarInner } from "./sidebar";