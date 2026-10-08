"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PORTAL_HOME } from "@/lib/auth";
import type { UserRole } from "@/lib/db/types";

export interface AuthState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "That email and password combination doesn't match an account.";
  if (m.includes("email not confirmed"))
    return "Please confirm your email address before signing in.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("failed to fetch"))
    return "Could not reach the authentication service. Check your .env values.";
  return message;
}

/** Where should this user land after signing in? */
async function resolvePortal(userId: string): Promise<{ path: string; blocked: boolean }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", userId)
    .single<{ role: UserRole; status: string }>();

  if (!data) return { path: "/login?error=profile_missing", blocked: false };
  if (data.status === "BLOCKED" || data.status === "CLOSED") {
    return { path: "/login?error=account_blocked", blocked: true };
  }
  return { path: PORTAL_HOME[data.role] ?? "/user/dashboard", blocked: false };
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const fieldErrors: Record<string, string> = {};
  if (!email) fieldErrors.email = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fieldErrors.email = "Enter a valid email address.";
  if (!password) fieldErrors.password = "Password is required.";

  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: friendly(error?.message ?? "Sign in failed.") };
  }

  const { path, blocked } = await resolvePortal(data.user.id);
  if (blocked) return { error: friendly("account_blocked") };

  revalidatePath("/", "layout");
  redirect(path);
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  const fieldErrors: Record<string, string> = {};
  if (!fullName) fieldErrors.full_name = "Full name is required.";
  if (!email) fieldErrors.email = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fieldErrors.email = "Enter a valid email address.";
  if (!/^\d{10}$/.test(phone.replace(/\D/g, "")))
    fieldErrors.phone = "Enter a 10-digit mobile number.";
  if (password.length < 8) fieldErrors.password = "Use at least 8 characters.";
  if (password !== confirm) fieldErrors.confirm_password = "Passwords do not match.";

  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, phone },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/confirm`,
    },
  });

  if (error) return { error: friendly(error.message) };

  if (!data.session) {
    // Email confirmation is on in Supabase by default
    return {
      error: "Account created. Check your inbox to confirm the email, then sign in.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/user/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

/**
 * Change a user's role / status. Admin only — enforced by RLS on
 * `profiles`, which only allows self-updates for non-admins.
 */
export async function updateUserAccess(formData: FormData) {
  const userId = String(formData.get("user_id"));
  const role = String(formData.get("role")) as UserRole;
  const status = String(formData.get("status"));
  const employeeRole = formData.get("employee_role");
  const approvalLimit = formData.get("approval_limit");

  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) redirect("/login");

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", caller.id)
    .single<{ role: UserRole }>();

  if (callerProfile?.role !== "ADMIN") {
    return { error: "Only an admin can change user access." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role, status })
    .eq("id", userId);

  if (error) return { error: error.message };

  // Keep the employee record in sync
  if (role === "EMPLOYEE" || role === "ADMIN") {
    await supabase.from("employees").upsert(
      {
        user_id: userId,
        employee_role: employeeRole === "MANAGER" ? "MANAGER" : "OFFICER",
        approval_limit: Number(approvalLimit) || 500000,
      },
      { onConflict: "user_id" },
    );
  } else if (role === "USER") {
    await supabase.from("employees").delete().eq("user_id", userId);
  }

  await createAdminClient().from("audit_logs").insert({
    actor_id: caller.id,
    actor_role: "ADMIN",
    action: "UPDATE",
    entity_type: "profiles",
    entity_id: userId,
    summary: `Set role=${role}, status=${status}`,
  });

  revalidatePath("/admin/users");
  return { success: true };
}