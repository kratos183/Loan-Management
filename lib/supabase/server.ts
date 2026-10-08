import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAnonKey, getSupabaseUrl } from "./config";

/**
 * Server-side Supabase client for Server Components, Server Actions and
 * Route Handlers. It carries the user's session so RLS applies as "that user".
 *
 * Next 16 note: `cookies()` is async.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — the proxy already refreshed the
          // session. Safe to ignore.
        }
      },
    },
  });
}