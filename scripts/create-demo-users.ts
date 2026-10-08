/**
 * Create the demo auth users in Supabase.
 *
 * Supabase Auth owns passwords; the application tables (profiles, employees)
 * are seeded by SQL. So the order is:
 *
 *   1. This script        → creates auth.users rows with a password
 *   2. 0002_seed.sql      → fills profiles / employees / loans with demo data
 *
 * Re-running is safe: existing users are skipped.
 *
 * Usage:  npm run db:users
 */

import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * Validate and read Supabase config.
 *
 * Next.js loads .env / .env.local automatically, but `tsx` does not, so load
 * them here. `.env.local` wins if both exist, matching Next's precedence.
 */
for (const file of [".env", ".env.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = rawValue.replace(/^["']|["']$/g, "").trim();
    // Don't clobber a real environment variable
    if (!process.env[key]) process.env[key] = value;
  }
}

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!rawUrl || !key) {
  console.error(
    "\n  Missing credentials. Add these to .env (see .env.example):\n" +
      "    NEXT_PUBLIC_SUPABASE_URL\n" +
      "    SUPABASE_SERVICE_ROLE_KEY\n",
  );
  process.exit(1);
}

/**
 * Normalise the project URL.
 *
 * Supabase's dashboard shows `https://<ref>.supabase.co/rest/v1/` when you
 * copy from the API settings, but the client library appends `/rest/v1`
 * itself. Keeping the suffix produces `.../rest/v1/rest/v1/...` and every
 * request 404s, so strip it — a pasted URL should still work.
 */
const projectUrl = rawUrl.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");

if (projectUrl !== rawUrl.trim()) {
  console.log("\n  ⚠  Trimmed a trailing /rest/v1 from your project URL.");
  console.log(`     Using:  ${projectUrl}`);
  console.log("     Better: set NEXT_PUBLIC_SUPABASE_URL to the bare project URL.\n");
}

const admin = createClient(projectUrl, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Fixed UUIDs so the SQL seed can reference these rows.
 * Must match the ids declared in 0002_seed.sql.
 */
interface DemoUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: "ADMIN" | "EMPLOYEE" | "USER";
}

const USERS: DemoUser[] = [
  { id: "11111111-1111-4111-8111-111111111111", email: "admin@demo.in",    fullName: "Vikram Desai",  phone: "9820010001", role: "ADMIN" },
  { id: "22222222-2222-4222-8222-222222222222", email: "manager@demo.in",  fullName: "Anita Sharma",  phone: "9820010002", role: "EMPLOYEE" },
  { id: "33333333-3333-4333-8333-333333333333", email: "officer@demo.in",  fullName: "Ramesh Iyer",   phone: "9820010003", role: "EMPLOYEE" },
  { id: "44444444-4444-4444-8444-444444444444", email: "officer2@demo.in", fullName: "Sneha Patel",   phone: "9820010004", role: "EMPLOYEE" },
  { id: "55555555-5555-4555-8555-555555555555", email: "rahul@demo.in",    fullName: "Rahul Sharma",  phone: "9876543210", role: "USER" },
  { id: "66666666-6666-4666-8666-666666666666", email: "priya@demo.in",    fullName: "Priya Nair",    phone: "9876543211", role: "USER" },
  { id: "77777777-7777-4777-8777-777777777777", email: "arjun@demo.in",    fullName: "Arjun Mehta",   phone: "9876543212", role: "USER" },
  { id: "88888888-8888-4888-8888-888888888888", email: "meera@demo.in",    fullName: "Meera Reddy",   phone: "9876543213", role: "USER" },
  { id: "99999999-9999-4999-8999-999999999999", email: "sanjay@demo.in",   fullName: "Sanjay Kumar",  phone: "9876543214", role: "USER" },
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "kavya@demo.in",    fullName: "Kavya Joshi",   phone: "9876543215", role: "USER" },
];

const PASSWORD = "demo1234";

async function main() {
  // `--reset` also rewrites passwords on users that already exist. Useful if
  // a password gets changed, or if repeated failed attempts trip Supabase's
  // brute-force protection and start rejecting valid credentials.
  const reset = process.argv.includes("--reset");

  console.log(
    reset
      ? "\n  Creating or resetting demo auth users…\n"
      : "\n  Creating demo auth users…\n",
  );

  const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existingIds = new Set((existing?.users ?? []).map((u) => u.id));

  let created = 0;
  let skipped = 0;
  let resetCount = 0;

  for (const user of USERS) {
    if (existingIds.has(user.id)) {
      if (reset) {
        const { error } = await admin.auth.admin.updateUserById(user.id, {
          password: PASSWORD,
          email_confirm: true,
        });
        if (error) {
          console.error(`  ✗ ${user.email.padEnd(20)} ${error.message}`);
        } else {
          console.log(`  ↻ ${user.email.padEnd(20)} password reset`);
          resetCount++;
        }
      } else {
        console.log(`  = ${user.email.padEnd(20)} already exists`);
        skipped++;
      }
      continue;
    }

    const { error } = await admin.auth.admin.createUser({
      id: user.id,
      email: user.email,
      password: PASSWORD,
      email_confirm: true, // skip the confirmation click for a prototype
      user_metadata: {
        full_name: user.fullName,
        phone: user.phone,
        role: user.role,
      },
    });

    if (error) {
      console.error(`  ✗ ${user.email.padEnd(20)} ${error.message}`);
      continue;
    }

    console.log(`  + ${user.email.padEnd(20)} created`);
    created++;
  }

  console.log(
    `\n  ${created} created, ${skipped} already existed` +
      (resetCount ? `, ${resetCount} password(s) reset` : "") +
      ".\n",
  );

  if (created > 0) {
    console.log("  Next: apply the seed to populate profiles, products and loans.");
    console.log("    npm run db:migrate\n");
  }

  console.log(`  Sign in with any of these, password "${PASSWORD}":`);
  console.log("    User       rahul@demo.in");
  console.log("    Officer    officer@demo.in");
  console.log("    Admin      admin@demo.in\n");
}

main().catch((err) => {
  console.error("\n  Failed:", err.message, "\n");
  process.exit(1);
});