import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "./config";

/**
 * Privileged Supabase client that BYPASSES Row Level Security.
 *
 * Server only. Use it for work a normal user is not allowed to do, e.g.:
 *   - listing all users (admin portal)
 *   - assigning a loan officer to an application
 *   - writing notifications on behalf of another user
 *   - back-office cron jobs (marking EMIs overdue)
 *
 * Every call site must check the caller's role first. This client trusts
 * whoever holds it.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing. Add it to .env.local — see .env.example.",
    );
  }

  return createClient(getSupabaseUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}