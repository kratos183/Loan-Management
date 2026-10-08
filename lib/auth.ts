import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Employee, Profile, UserRole } from "@/lib/db/types";

export interface Session {
  user: Profile;
  employee: Employee | null;
  role: UserRole;
  portal: "user" | "employee" | "admin";
}

/** Portal path for each role. */
export const PORTAL_HOME: Record<UserRole, string> = {
  USER: "/user/dashboard",
  EMPLOYEE: "/employee/dashboard",
  ADMIN: "/admin/dashboard",
};

/**
 * Read the current session from Supabase Auth + the `profiles` table.
 * Returns null when there is no valid session.
 */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) return null;

  let employee: Employee | null = null;
  if (profile.role === "EMPLOYEE" || profile.role === "ADMIN") {
    const { data } = await supabase
      .from("employees")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle<Employee>();
    employee = data ?? null;
  }

  return {
    user: profile,
    employee,
    role: profile.role,
    portal:
      profile.role === "ADMIN" ? "admin" : profile.role === "EMPLOYEE" ? "employee" : "user",
  };
}

/**
 * Require a signed-in user. Redirects to /login when there is no session.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * Require a specific role (or one of several). Redirects otherwise.
 * Use in portal layouts so a page body never has to re-check.
 */
export async function requireRole(...allowed: UserRole[]): Promise<Session> {
  const session = await requireSession();
  if (!allowed.includes(session.role)) {
    redirect(PORTAL_HOME[session.role]);
  }
  return session;
}

/**
 * Resolve the employee profile for the logged-in user, creating one with
 * sensible defaults if an admin promoted them but the row is missing.
 */
export async function getEmployee(userId: string): Promise<Employee | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("employees")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<Employee>();
  return data ?? null;
}