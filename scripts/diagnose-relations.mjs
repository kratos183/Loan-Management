/**
 * Diagnose PostgREST embedding failures.
 *
 * "Could not find a relationship between 'x' and 'y' in the schema cache"
 * usually means one of three things:
 *   1. PostgREST's schema cache is stale (tables were just created)
 *   2. The FK constraint name in the embed hint is wrong
 *   3. There is genuinely no FK, so the relationship cannot be inferred
 *
 * Usage:  node scripts/diagnose-relations.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { Client } from "pg";

for (const file of [".env", ".env.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, "").trim();
    if (!process.env[m[1]]) process.env[m[1]] = value;
  }
}

const connectionString =
  process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error("\n  Set DATABASE_URL in .env first.\n");
  process.exit(1);
}

const db = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

await db.connect();

// ── 1. Actual FK constraint names ───────────────────────────────────────────
console.log("\n  Foreign keys on the tables we embed");

const fks = await db.query(`
  select
    tc.table_name,
    kcu.column_name,
    ccu.table_name as ref_table,
    ccu.column_name as ref_column,
    tc.constraint_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on kcu.constraint_name = tc.constraint_name
  join information_schema.constraint_column_usage ccu
    on ccu.constraint_name = tc.constraint_name
  where tc.constraint_type = 'FOREIGN KEY'
    and tc.table_schema = 'public'
    and tc.table_name in (
      'applications','loans','emi_schedule','payments','ebills','noc_requests',
      'tickets','chat_conversations','chat_messages','notifications',
      'application_documents','application_events','audit_logs',
      'resubmission_requests','application_collateral','application_coapplicants',
      'employees','addresses','liabilities'
    )
  order by tc.table_name, tc.constraint_name
`);

for (const row of fks.rows) {
  console.log(
    `    ${row.table_name}.${row.column_name} → ${row.ref_table}.${row.ref_column}   [${row.constraint_name}]`,
  );
}

// ── 2. Validate every embed hint found in the app source ────────────────────
// Scan the codebase rather than a hand-kept list, so the check cannot drift
// out of sync with the queries that actually exist.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const sourceFiles = [...walk("app"), ...walk("lib")];

/** Matches `table!constraint_name` inside a PostgREST select string. */
const HINT_RE = /([a-z_]+)!([a-z0-9_]+)\b/g;

const found = new Map(); // constraint -> Set of "file:line"
for (const file of sourceFiles) {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    // Only consider lines that look like a PostgREST select fragment
    if (!/[a-z_]+![a-z0-9_]+/.test(line)) return;
    for (const m of line.matchAll(HINT_RE)) {
      const constraint = m[2];
      if (!found.has(constraint)) found.set(constraint, new Set());
      found.get(constraint).add(`${file}:${i + 1}`);
    }
  });
}

const names = new Set(fks.rows.map((r) => r.constraint_name));

console.log(
  `\n  Embed hints found in ${sourceFiles.length} source file(s) — ${found.size} distinct`,
);

let bad = 0;
for (const [constraint, locations] of [...found.entries()].sort()) {
  const ok = names.has(constraint);
  if (!ok) bad++;
  const where = [...locations].slice(0, 2).join(", ");
  const more = locations.size > 2 ? ` (+${locations.size - 2} more)` : "";
  console.log(
    `    ${ok ? "✓" : "✗"} ${constraint.padEnd(48)} ${ok ? `${locations.size} use(s)` : `no such constraint — ${where}${more}`}`,
  );
}

// ── 3. Ask PostgREST to reload and see what it thinks ──────────────────────
console.log("\n  PostgREST schema cache");
try {
  await db.query("notify pgrst, 'reload schema'");
  console.log("    ✓ sent `notify pgrst, 'reload schema'`");
  console.log("    (PostgREST reloads asynchronously — wait a second, then retry)");
} catch (err) {
  console.log(`    ✗ could not notify: ${err.message}`);
}

await db.end();

console.log("");
if (bad > 0) {
  console.log(
    `  ${bad} embed hint(s) reference a constraint that does not exist.\n` +
      `  Postgres names these <table>_<column>_fkey — check for a dropped "_id".\n`,
  );
  process.exit(1);
}
console.log("  Every embed hint resolves to a real foreign key.\n");