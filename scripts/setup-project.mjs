/**
 * One-shot project setup.
 *
 * The order matters and is easy to get wrong: the seed inserts `profiles` rows
 * keyed to `auth.users`, so the demo auth accounts must exist first. Getting
 * that backwards produces a bare foreign-key violation with no useful hint.
 *
 * This script runs the whole sequence in the only order that works, and stops
 * at the first failure with an actionable message.
 *
 *   npm run db:setup
 *
 * Requires DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

for (const file of [".env", ".env.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, "").trim();
    if (!process.env[m[1]]) process.env[m[1]] = value;
  }
}

const projectUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.DATABASE_URL;

// ── Step definitions ─────────────────────────────────────────────────────────
// Each step runs the underlying script directly through the current Node binary
// rather than going through `npm run`. Two reasons: `npm` is a `.cmd` shim on
// Windows, which modern Node refuses to spawn without a shell, and
// `shell: true` makes Node concatenate argv unescaped (DEP0190). Going direct
// is also meaningfully faster.
//
// Each step lists the *commands* it runs, because `db:check` is a `&&` chain.
// If these ever drift from package.json, db:setup will fail loudly rather than
// silently skipping a check.
const TSX = "node_modules/tsx/dist/cli.mjs";

const STEPS = [
  {
    name: "Validate SQL",
    commands: [
      [TSX, ["scripts/check-sql.ts"]],
      [
        "scripts/parse-sql.mjs",
        [
          "supabase/migrations/0001_core_schema.sql",
          "supabase/migrations/0002_seed.sql",
        ],
      ],
    ],
    note: "no database needed",
  },
  {
    name: "Create demo auth users",
    commands: [[TSX, ["scripts/create-demo-users.ts"]]],
    note: "must run before the seed",
  },
  {
    name: "Apply schema and seed",
    commands: [["scripts/migrate.mjs", []]],
  },
  {
    name: "Verify seed data",
    commands: [["scripts/verify-seed.mjs", []]],
  },
  {
    name: "Check PostgREST embeds",
    commands: [["scripts/check-embeds.mjs", []]],
  },
];

console.log("\n  Setting up the project\n");

// ── Preflight the environment ────────────────────────────────────────────────
const problems = [];
if (!projectUrl) problems.push("NEXT_PUBLIC_SUPABASE_URL");
if (!serviceKey) problems.push("SUPABASE_SERVICE_ROLE_KEY");
if (!dbUrl) problems.push("DATABASE_URL");

if (problems.length) {
  console.log("  Missing from .env:\n");
  for (const p of problems) console.log(`    - ${p}`);
  console.log(
    "\n  See .env.example. DATABASE_URL comes from Supabase -> Connect ->\n" +
      "  the pooled connection string (port 6543).\n",
  );
  process.exit(1);
}

console.log(`  project  ${projectUrl.replace(/\/+$/, "")}\n`);

// ── Run each step ────────────────────────────────────────────────────────────
const runOne = (entry) => {
  const [target, args] = entry;
  // A bare "scripts/foo.mjs" resolves against cwd; a path into node_modules is
  // passed to Node as-is. Both go through the current executable.
  return spawnSync(process.execPath, [target, ...args], {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
};

for (const step of STEPS) {
  process.stdout.write(`  ... ${step.name}`);
  if (step.note) process.stdout.write(`  (${step.note})`);
  process.stdout.write("\n");

  let output = "";
  let exitCode = 0;

  for (const entry of step.commands) {
    const result = runOne(entry);
    output += `${result.stdout ?? ""}${result.stderr ?? ""}`;

    if (result.error) {
      console.log(`  x ${step.name} could not start\n`);
      console.log(`    ${result.error.message}\n`);
      console.log("  Are dependencies installed? Try: npm ci\n");
      process.exit(1);
    }

    // Stop at the first failing command, the way `&&` would.
    if (result.status !== 0) {
      exitCode = result.status ?? 1;
      break;
    }
  }

  if (exitCode !== 0) {
    console.log(`  x ${step.name} failed (exit ${exitCode})\n`);
    const lines = output
      .split("\n")
      .map((l) => l.trim())
      .filter(
        (l) =>
          l.length > 0 &&
          !/^\s*(npm|>)\s/.test(l) &&
          /error|missing|violates|abort|operator does not|hint:|detail:|failed|✗/i.test(
            l,
          ),
      );
    if (lines.length) {
      console.log("  Key lines:");
      for (const l of lines.slice(0, 10)) console.log(`    ${l}`);
      console.log("");
    }
    console.log("  Fix the problem above and re-run:  npm run db:setup\n");
    process.exit(exitCode);
  }

  console.log(`  + ${step.name}\n`);
}

console.log("  Setup complete.\n");
console.log("  Next:");
console.log("    npm run dev");
console.log("    Sign in as officer@demo.in (password demo1234)\n");