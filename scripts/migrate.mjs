/**
 * Run the SQL migrations against a real Postgres database.
 *
 * Parsing catches syntax errors. It cannot catch type errors — "column X is
 * of type payment_mode but expression is of type text" only surfaces once a
 * catalog exists. This script connects directly so you get the real error,
 * with the real line number, in your terminal.
 *
 * Get the connection string from:
 *   Supabase → Project → Connect → OR use the Transaction/Session pooler
 *
 *   postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
 *
 * Put it in .env as DATABASE_URL, then:
 *   npm run db:migrate            # both files, in order
 *   npm run db:migrate -- --check # dry run: parse only, no writes
 *
 * NOTE: --check still needs a connection; use `npm run db:check` for a
 * fully offline syntax check.
 */

import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { Client } from "pg";

// Load .env / .env.local the way Next does, without clobbering real env vars.
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

const FILES = [
  "supabase/migrations/0001_core_schema.sql",
  "supabase/migrations/0002_seed.sql",
];

if (!connectionString) {
  console.error(
    "\n  No database connection string found.\n\n" +
      "  Add this to .env:\n" +
      "    DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres\n\n" +
      "  Find it at: Supabase → your project → Connect\n" +
      "  (Use the connection pooler, port 6543, not 5432.)\n",
  );
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

async function main() {
  try {
    await client.connect();
  } catch (err) {
    console.error(`\n  Could not connect: ${err.message}\n`);
    process.exit(1);
  }

  console.log("\n  Connected. Running migrations.\n");

  let failures = 0;

  for (const file of FILES) {
    if (!existsSync(file)) {
      console.log(`  ✗ ${file}  not found`);
      failures++;
      continue;
    }

    const sql = readFileSync(file, "utf8");
    const name = file.split("/").pop();
    process.stdout.write(`  … ${name} `);

    try {
      await client.query(sql);
      console.log("✓");
    } catch (err) {
      console.log("✗");
      failures++;

      console.log(`\n      ${err.message}\n`);
      if (err.position) {
        const line = sql.slice(0, err.position).split("\n").length;
        const snippet = sql.split("\n")[line - 1]?.trim();
        console.log(`      line ${line}: ${snippet}\n`);
      }
      if (err.detail) console.log(`      detail: ${err.detail}\n`);
      if (err.hint) console.log(`      hint: ${err.hint}\n`);

      // Stop: later files depend on earlier ones.
      break;
    }
  }

  await client.end();

  console.log("");
  if (failures > 0) {
    console.log("  Migration failed. Nothing after the error was applied.\n");
    process.exit(1);
  }

  console.log("  All migrations applied.\n");
  console.log("  Verify with:");
  console.log("    npm run db:verify\n");
}

main().catch((err) => {
  console.error(`\n  ${err.message}\n`);
  process.exit(1);
});