import type { ReactNode } from "react";
import { loadPortal } from "@/lib/portal";

/** Session-dependent route — see the note in app/user/layout.tsx. */
export const instant = false;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await loadPortal("admin");
  return <>{children}</>;
}