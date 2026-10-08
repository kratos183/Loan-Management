import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl } from "./config";

/**
 * Browser-side Supabase client.
 *
 * Uses the anon key. Row Level Security is what protects the data — never
 * put the service_role key anywhere reachable from the client.
 */
export function createClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
}