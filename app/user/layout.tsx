import type { ReactNode } from "react";
import { loadPortal } from "@/lib/portal";

/**
 * Gates the whole user segment; children reuse loadPortal for the shell.
 *
 * `instant = false` opts this segment out of instant navigation. Every page
 * here reads the session cookie, and a request read cannot be prerendered into
 * a static shell. See the Cache Components authentication guide.
 */
export const instant = false;

export default async function UserLayout({ children }: { children: ReactNode }) {
  await loadPortal("user");
  return <>{children}</>;
}