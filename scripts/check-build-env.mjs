/**
 * Build-time environment guard. Runs automatically via `npm run prebuild`.
 *
 * Why this exists
 * ---------------
 * `NEXT_PUBLIC_*` values are inlined into the client bundle at build time, not
 * read at request time. So on Vercel a missing variable does not fail the
 * deploy -- it produces a bundle that throws on first page load, which is far
 * harder to diagnose. Worse, if the app *is* built locally where `.env` exists
 * and then deployed to a preview branch without those variables, the preview is
 * broken while production works, and nothing says why.
 *
 * This turns both cases into a clear build-time error.
 *
 * Build-time required  -- inlined into the client bundle, must exist now.
 * Runtime required     -- only read when a request hits the server, so a
 *                         missing value shows up as a 500 on the affected page.
 */

const isVercel = !!process.env.VERCEL;
const isCi = !!process.env.CI;

/** Read from process.env, falling back to .env files for local builds. */
const env = { ...process.env };

if (!isVercel) {
  const { readFileSync, existsSync } = await import("node:fs");
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m || env[m[1]]) continue;
      env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  }
}

const problems = [];
const warnings = [];

// ── Build-time required ──────────────────────────────────────────────────────
// Referenced through getSupabaseUrl() / getSupabaseAnonKey() in
// lib/supabase/config.ts, both of which throw when the value is absent.
for (const [key, how] of [
  ["NEXT_PUBLIC_SUPABASE_URL", "Supabase -> Project Settings -> Data API -> Project URL"],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "Supabase -> Project Settings -> API Keys -> anon public"],
]) {
  if (!env[key]) problems.push({ key, how });
}

// ── Runtime required ─────────────────────────────────────────────────────────
// lib/supabase/admin.ts throws on these; only reached by server actions, so a
// missing value does not break the build.
for (const [key, how] of [
  ["SUPABASE_SERVICE_ROLE_KEY", "Supabase -> Project Settings -> API Keys -> service_role"],
]) {
  if (!env[key]) warnings.push({ key, how });
}

// ── Shape checks: a plausible-looking but wrong value is worse than none ─────
const url = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
if (url) {
  if (!/^https?:\/\//i.test(url)) {
    problems.push({
      key: "NEXT_PUBLIC_SUPABASE_URL",
      detail: `starts with "${url.slice(0, 12)}" rather than http:// or https://`,
    });
  } else if (/\/rest\/v1\/?$/.test(url)) {
    // config.ts strips this, so it works -- but it means the value was copied
    // from the wrong dashboard field and will confuse the next person.
    warnings.push({
      key: "NEXT_PUBLIC_SUPABASE_URL",
      detail:
        "ends in /rest/v1. It works (config.ts strips the suffix) but the " +
        "bare project URL is what belongs here.",
    });
  }
}

const anon = (env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
const service = (env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
if (anon && service && anon === service) {
  problems.push({
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    detail:
      "is identical to SUPABASE_SERVICE_ROLE_KEY. The service_role key must " +
      "never reach the browser -- it bypasses RLS. Rotate it in the dashboard.",
  });
}

if (anon && !anon.startsWith("eyJ")) {
  warnings.push({
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    detail: "does not look like a Supabase JWT (expected it to start with 'eyJ').",
  });
}

// ── Report ───────────────────────────────────────────────────────────────────
if (warnings.length) {
  console.log("\n  Environment warnings\n");
  for (const w of warnings) {
    console.log(`    ! ${w.key}${w.detail ? ` — ${w.detail}` : ""}`);
    if (w.how) console.log(`      set it at: ${w.how}`);
  }
  console.log("");
}

if (problems.length) {
  console.error("\n  Build blocked: required environment variables are missing.\n");
  for (const p of problems) {
    console.error(`    x ${p.key}${p.detail ? ` — ${p.detail}` : ""}`);
    if (p.how) console.error(`      set it at: ${p.how}`);
  }

  console.error("");
  if (isVercel) {
    console.error("  On Vercel: Project -> Settings -> Environment Variables.");
    console.error("  Add them for BOTH Production and Preview — NEXT_PUBLIC_* values");
    console.error("  are baked in at build time, so a preview built without them is");
    console.error("  permanently broken even after the variable is added.");
    console.error("");
    console.error("  After changing env vars, redeploy. A rebuild is required; the");
    console.error("  existing deployment keeps the values it was built with.");
  } else {
    console.error("  Locally: add them to .env.local — copy .env.example to start.");
  }
  console.error("");
  process.exit(1);
}

console.log(
  `  Environment OK${isVercel ? ` (${process.env.VERCEL_ENV})` : isCi ? " (CI)" : ""}\n`,
);