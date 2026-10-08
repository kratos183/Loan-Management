/**
 * Diagnose why demo sign-in fails.
 *
 * Checks, in order:
 *   1. Do the auth.users rows exist?
 *   2. Does the profile row exist for each (the trigger should have made one)?
 *   3. Does a real sign-in with the anon key succeed?
 *
 * Usage:  node scripts/diagnose-login.mjs [email]
 */

import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const file of [".env", ".env.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, "").trim();
    if (!process.env[m[1]]) process.env[m[1]] = value;
  }
}

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim()
  .replace(/\/+$/, "")
  .replace(/\/rest\/v1$/, "");
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("\n  Supabase config");
console.log(`    project URL : ${url || "(missing)"}`);
console.log(`    anon key    : ${anon ? `${anon.slice(0, 12)}…` : "(missing)"}`);
console.log(`    service key : ${service ? `${service.slice(0, 12)}…` : "(missing)"}`);

if (!url || !anon || !service) {
  console.error("\n  Missing Supabase credentials in .env\n");
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anonClient = createClient(url, anon, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── 1. Auth users ───────────────────────────────────────────────────────────
console.log("\n  1. auth.users");
const { data: listed, error: listError } = await admin.auth.admin.listUsers({
  perPage: 1000,
});

if (listError) {
  console.log(`    ✗ cannot list: ${listError.message}`);
  process.exit(1);
}

const users = listed.users ?? [];
console.log(`    ${users.length} user(s) found`);

if (users.length === 0) {
  console.log("\n    No auth users exist. Run:  npm run db:users\n");
  process.exit(1);
}

for (const u of users.slice(0, 12)) {
  const confirmed = u.email_confirmed_at ? "confirmed" : "UNCONFIRMED";
  const provider = u.app_metadata?.provider ?? "?";
  console.log(
    `    ${u.email.padEnd(22)} ${confirmed.padEnd(12)} ${provider.padEnd(8)} id=${u.id.slice(0, 8)}`,
  );
}

const demo = users.filter((u) => u.email?.endsWith("@demo.in"));
console.log(`\n    ${demo.length} demo user(s) found`);

// ── 2. Profiles ─────────────────────────────────────────────────────────────
console.log("\n  2. profiles (created by the handle_new_user trigger)");
const { data: profiles } = await admin
  .from("profiles")
  .select("id, email, role, status")
  .order("email");

for (const p of profiles ?? []) {
  console.log(
    `    ${String(p.email).padEnd(22)} role=${String(p.role).padEnd(9)} status=${p.status}`,
  );
}

// Flag users with no profile row — those can sign in but hit the portal guard
const profileIds = new Set((profiles ?? []).map((p) => p.id));
const orphans = users.filter((u) => !profileIds.has(u.id));
if (orphans.length) {
  console.log(`\n    ✗ ${orphans.length} auth user(s) with NO profile row:`);
  for (const o of orphans) console.log(`      ${o.email} id=${o.id}`);
  console.log("      The trigger may not exist — re-run 0001_core_schema.sql.");
}

// ── 3. Actual sign-in attempt ───────────────────────────────────────────────
console.log("\n  3. sign-in attempt with the anon key");
const targets = process.argv[2]
  ? [process.argv[2]]
  : demo.slice(0, 3).map((u) => u.email);

for (const email of targets) {
  const { data, error } = await anonClient.auth.signInWithPassword({
    email,
    password: "demo1234",
  });

  if (error) {
    console.log(`    ✗ ${email.padEnd(22)} ${error.message}`);
  } else {
    console.log(
      `    ✓ ${email.padEnd(22)} signed in, session for ${data.user?.email}`,
    );
    await anonClient.auth.signOut();
  }
}

console.log("");