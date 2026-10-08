/**
 * Supabase project URL.
 *
 * One place that reads the env var and normalises it, so a pasted
 * `https://<ref>.supabase.co/rest/v1/` from the dashboard still works.
 * The client library appends `/rest/v1` itself, so keeping the suffix
 * would produce `.../rest/v1/rest/v1/...` and every request would 404.
 */
export function getSupabaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is missing. Add it to .env.local — see .env.example.",
    );
  }
  return raw.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. Add it to .env.local — see .env.example.",
    );
  }
  return key;
}