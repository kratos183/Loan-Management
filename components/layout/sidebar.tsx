"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Landmark, X, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";
import type { NavSection } from "@/lib/navigation";
import type { Profile } from "@/lib/db/types";

export function Brand({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 shadow-sm">
        <Landmark className="size-5 text-white" />
      </span>
      <span className="text-[17px] leading-none font-semibold tracking-tight text-ink-900">
        SafarLoan
      </span>
    </Link>
  );
}

export function Sidebar({
  sections,
  profile,
  roleLabel,
  badges,
  onNavigate,
  className,
}: {
  sections: readonly NavSection[];
  profile: Profile;
  roleLabel: string;
  badges?: Record<string, number>;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <div className={cn("flex h-full flex-col bg-white", className)}>
      {/* Brand */}
      <div className="flex h-16 shrink-0 items-center border-b border-ink-200 px-5">
        <Brand />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href.split("/").length > 2 &&
                    pathname.startsWith(`${item.href}/`));
                const count = item.badgeKey ? badges?.[item.badgeKey] ?? 0 : 0;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                        active
                          ? "bg-brand-50 text-brand-700"
                          : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
                      )}
                    >
                      <item.icon
                        className={cn(
                          "size-[18px] shrink-0 transition-colors",
                          active
                            ? "text-brand-600"
                            : "text-ink-400 group-hover:text-ink-600",
                        )}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {count > 0 && (
                        <span
                          className={cn(
                            "tabular-nums rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                            active
                              ? "bg-brand-600 text-white"
                              : "bg-danger-500 text-white",
                          )}
                        >
                          {count > 99 ? "99+" : count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Account footer */}
      <div className="shrink-0 border-t border-ink-200 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar name={profile.full_name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-ink-900">
              {profile.full_name}
            </p>
            <p className="truncate text-[11px] text-ink-500">{roleLabel}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Sign out"
              title="Sign out"
              className="flex size-8 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/** Slide-over drawer for small screens. */
export function MobileSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
      >
        Menu
        <ChevronRight className="size-4" />
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 animate-slide-in shadow-2xl">
            <button
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
              className="absolute top-4 right-3 z-10 flex size-8 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100"
            >
              <X className="size-4" />
            </button>
            <Sidebar {...props} onNavigate={() => setOpen(false)} className="w-72" />
          </div>
        </div>
      )}
    </>
  );
}