/**
 * Validate SQL with the real PostgreSQL parser.
 *
 * `@supabase/pg-parser` wraps libpg_query — the same parser the Postgres
 * server uses — compiled to WASM. Anything it accepts, Postgres accepts, so
 * this is the ground truth for syntax.
 *
 * The heuristics in `check-sql.ts` still earn their place for things a parse
 * alone cannot see (truncation, unsafe apostrophes, INSERT arity), but
 * syntax validation itself should not be home-grown.
 *
 * `parse()` reports failures in the returned `error` field rather than
 * throwing, so both paths are handled.
 *
 * Usage:  node scripts/parse-sql.mjs <file.sql> [...]
 */

import { readFileSync } from "node:fs";
import { PgParser } from "@supabase/pg-parser";

const files = process.argv.slice(2);

if (files.length === 0) {
  console.error("\n  Usage: node scripts/parse-sql.mjs <file.sql> [...]\n");
  process.exit(1);
}

/** Locate a byte offset in the source so errors can cite a line number. */
function lineAt(sql, offset) {
  if (typeof offset !== "number" || offset < 0) return null;
  return sql.slice(0, offset).split("\n").length;
}

/**
 * libpg_query often omits a cursor position, but the message usually carries
 * the offending token (`syntax error at or near "s"`). Find its first
 * occurrence in the source and use that as the line number.
 */
function lineFromMessage(sql, message) {
  const near = /at or near "([^"]+)"/.exec(message ?? "");
  if (near) {
    const token = near[1];
    const index = sql.indexOf(token);
    if (index >= 0) return sql.slice(0, index).split("\n").length;
  }
  if (/end of input/i.test(message ?? "")) {
    // The error is that the statement never finished.
    return sql.split("\n").length;
  }
  return null;
}

let failed = 0;
let statementTotal = 0;
let errorTotal = 0;

console.log("\n  Parsing with libpg_query (the real PostgreSQL parser)\n");

const parser = new PgParser();

for (const file of files) {
  let sql;
  try {
    sql = readFileSync(file, "utf8");
  } catch (err) {
    console.log(`  ✗ ${file}  cannot read: ${err.message}`);
    failed++;
    continue;
  }

  const lineCount = sql.split("\n").length;

  try {
    const result = await parser.parse(sql);
    const tree = result?.tree ?? result;
    const stmts = tree?.stmts ?? [];
    statementTotal += stmts.length;

    if (result?.error) {
      failed++;
      errorTotal++;
      const { message, cursorPosition, hint } = result.error;
      const line =
        lineAt(sql, cursorPosition) ?? lineFromMessage(sql, message);
      const lines = sql.split("\n");
      const snippet = line ? lines[line - 1]?.trim().slice(0, 72) : null;

      console.log(`  ✗ ${file}:${line ?? "?"}`);
      console.log(`      ${message}`);
      if (snippet) console.log(`      near: ${snippet}`);
      if (hint) console.log(`      hint: ${hint}`);
    } else {
      console.log(
        `  ✓ ${file}  — ${lineCount} lines, ${stmts.length} statement(s)`,
      );
    }
  } catch (err) {
    failed++;
    errorTotal++;
    console.log(`  ✗ ${file}  ${err?.message ?? err}`);
  }
}

console.log("");
if (failed > 0) {
  console.log(`  ${failed} file(s) failed to parse.\n`);
  process.exit(1);
}

console.log(
  `  All ${files.length} file(s) parsed cleanly (${statementTotal} statements).\n`,
);