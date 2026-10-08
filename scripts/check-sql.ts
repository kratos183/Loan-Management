/**
 * Validate the SQL migration files before pasting them into the Supabase
 * SQL Editor.
 *
 * The SQL Editor runs a file as one statement batch, so anything that looks
 * valid but breaks the batch is easy to miss. These are the failure modes
 * that actually bite:
 *
 *   1. Unbalanced dollar quoting — a nested `$$` (even inside a comment)
 *      silently terminates the enclosing DO block and orphans everything
 *      after it.
 *   2. `pg_temp` references — that schema may not exist in a fresh session.
 *   3. Statements after the final `end $$;` — unreachable if the block failed.
 *
 * Usage:  npm run db:check
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const FILES = [
  "supabase/migrations/0001_core_schema.sql",
  "supabase/migrations/0002_seed.sql",
];

let problems = 0;
let notes = 0;

const fail = (file: string, line: number, message: string) => {
  problems++;
  console.log(`  ✗ ${file}:${line}  ${message}`);
};

const note = (file: string, line: number, message: string) => {
  notes++;
  console.log(`  · ${file}:${line}  ${message}`);
};

/** Strip comments and string literals so structural checks see real syntax. */
function stripNoise(sql: string): string {
  let out = "";
  let inLineComment = false;
  let inBlockComment = false;
  let quote: string | null = null;

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      if (c === "\n") {
        inLineComment = false;
        out += c;
      }
      continue;
    }

    if (inBlockComment) {
      if (c === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (quote) {
      if (c === quote) {
        // '' is an escaped quote inside a literal
        if (next === quote) i++;
        else quote = null;
      }
      continue;
    }

    if (c === "-" && next === "-") {
      inLineComment = true;
      i++;
      continue;
    }
    if (c === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      continue;
    }

    out += c;
  }

  return out;
}

/**
 * Find apostrophes that sit inside a word outside of comments, e.g.
 * `'In the borrower's name'`. The inner quote closes the literal early and
 * Postgres then reports a syntax error on whatever follows.
 *
 * Returns the byte offsets of the offending quotes.
 */
function findUnsafeApostrophes(sql: string): number[] {
  const bad: number[] = [];
  let inLineComment = false;
  let inBlockComment = false;
  let quote: string | null = null;

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      if (c === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (c === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (quote) {
      if (c === quote) {
        if (next === quote) i++;
        else quote = null;
      }
      continue;
    }

    if (c === "-" && next === "-") {
      inLineComment = true;
      i++;
      continue;
    }
    if (c === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }

    if (c === "'") {
      // Legal openers are preceded by punctuation, whitespace or a newline.
      const prev = sql[i - 1];
      const safePrev =
        prev === undefined ||
        /[\s,(\[=:+*/<>|-]/.test(prev);

      if (!safePrev) bad.push(i);
      quote = c;
      continue;
    }

    if (c === '"') {
      quote = c;
    }
  }

  return bad;
}

/**
 * Split stripped SQL into statements on `;` at parenthesis depth zero,
 * keeping the offset of each so we can report line numbers.
 */
function splitStatements(syntax: string): { text: string; offset: number }[] {
  const out: { text: string; offset: number }[] = [];
  let start = 0;
  let depth = 0;

  for (let i = 0; i < syntax.length; i++) {
    if (syntax[i] === "(") depth++;
    if (syntax[i] === ")") depth--;
    if (syntax[i] === ";" && depth === 0) {
      out.push({ text: syntax.slice(start, i), offset: start });
      start = i + 1;
    }
  }
  return out;
}

/** Count top-level commas in [from, to), ignoring nested parentheses. */
function countTopLevel(text: string, from: number, to: number): number {
  let depth = 0;
  let commas = 0;
  let seenContent = false;

  for (let i = from; i < to; i++) {
    const c = text[i];
    if (c === "(") {
      depth++;
      seenContent = true;
    } else if (c === ")") {
      depth--;
    } else if (c === "," && depth === 0) {
      commas++;
      seenContent = true;
    } else if (depth === 0 && !/\s/.test(c)) {
      seenContent = true;
    }
  }
  return seenContent ? commas + 1 : 0;
}

/**
 * Compare each INSERT's target column count against the number of
 * expressions it supplies.
 *
 * Postgres reports a mismatch as either
 *   "INSERT has more target columns than expressions"
 *   "INSERT has more expressions than target columns"
 * which is easy to hit when a column is added to the list but not the values.
 */
function auditInsertArity(
  syntax: string,
  lineOf: number[],
  report: (line: number, message: string) => void,
): number {
  let checked = 0;

  for (const stmt of splitStatements(syntax)) {
    const m = /insert\s+into\s+([\w.]+)/i.exec(stmt.text);
    if (!m) continue;

    const table = m[1];
    let afterTable = m.index + m[0].length;

    // Skip whitespace — the column list often starts on the next line.
    while (afterTable < stmt.text.length && /\s/.test(stmt.text[afterTable])) {
      afterTable++;
    }
    if (stmt.text[afterTable] !== "(") continue;

    let depth = 0;
    let close = -1;
    for (let i = afterTable; i < stmt.text.length; i++) {
      if (stmt.text[i] === "(") depth++;
      if (stmt.text[i] === ")") {
        depth--;
        if (depth === 0) {
          close = i;
          break;
        }
      }
    }
    if (close === -1) continue;

    const columnCount = countTopLevel(stmt.text, afterTable + 1, close);
    const body = stmt.text.slice(close + 1);
    checked++;

    // ── INSERT ... VALUES ──
    const valuesMatch = /^\s*values\b/i.exec(body);
    if (valuesMatch) {
      const valuesAt = close + 1 + valuesMatch[0].length;
      const open = stmt.text.indexOf("(", valuesAt);
      if (open < 0) continue;

      depth = 0;
      for (let i = open; i < stmt.text.length; i++) {
        if (stmt.text[i] === "(") depth++;
        if (stmt.text[i] === ")") {
          depth--;
          if (depth === 0) {
            const arity = countTopLevel(stmt.text, open + 1, i);
            if (arity !== columnCount) {
              report(
                lineOf[stmt.offset + open],
                `${table}: ${columnCount} target column(s) but the VALUES tuple has ${arity}`,
              );
            }
            break;
          }
        }
      }
      continue;
    }

    // ── INSERT ... SELECT ──
    const selectMatch = /^\s*select\b/i.exec(body);
    if (!selectMatch) continue;

    const fromAt = body.search(/\bfrom\b/i);
    if (fromAt <= 0) continue;

    const selectListStart = selectMatch[0].length;
    const supplied = countTopLevel(body, selectListStart, fromAt);
    if (supplied !== columnCount) {
      report(
        lineOf[stmt.offset + afterTable],
        `${table}: ${columnCount} target column(s) but the SELECT supplies ${supplied}`,
      );
    }
  }

  return checked;
}

/** Map each character offset in stripped SQL back to a 1-based line number. */
function buildLineMap(syntax: string): number[] {
  const map = new Array<number>(syntax.length);
  let line = 1;
  for (let i = 0; i < syntax.length; i++) {
    map[i] = line;
    if (syntax[i] === "\n") line++;
  }
  map[syntax.length - 1] = line;
  return map;
}

console.log("\n  Checking SQL migrations\n");

for (const file of FILES) {
  if (!existsSync(file)) {
    fail(file, 0, "file not found");
    continue;
  }

  const raw = readFileSync(file, "utf8");
  const lines = raw.split("\n");

  // ── 1. Dollar-quote balance ─────────────────────────────────────────────
  // Track every occurrence of $$ and verify they pair up in order.
  let depth = 0;
  let openAt = 0;

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    // The real trap: inside a dollar-quoted string the parser does not know
    // about comments, so a `$$` in a -- comment silently ends the block.
    if (trimmed.startsWith("--") && trimmed.includes("$$")) {
      fail(
        file,
        i + 1,
        "dollar-quote tag inside a comment still terminates the enclosing block",
      );
    }

    const matches = line.match(/\$\$/g);
    if (!matches) return;

    for (let m = 0; m < matches.length; m++) {
      if (depth === 0) {
        depth++;
        openAt = i + 1;
      } else {
        depth--;
      }
    }
  });

  if (depth !== 0) {
    fail(file, openAt, `unbalanced dollar quoting — a block opened here never closes`);
  }

  // ── 2. pg_temp ──────────────────────────────────────────────────────────
  lines.forEach((line, i) => {
    if (!line.includes("pg_temp")) return;
    // Allow it if the line is clearly a comment explaining why not
    const isExplanatory = /pg_temp schema may not exist/i.test(line);
    if (!isExplanatory) {
      fail(file, i + 1, "references pg_temp, which may not exist in a fresh session");
    }
  });

  // ── 3. Nested function definitions ──────────────────────────────────────
  lines.forEach((line, i) => {
    if (/create\s+(or\s+replace\s+)?function/i.test(line) && depth > 0) {
      fail(
        file,
        i + 1,
        "CREATE FUNCTION inside a dollar-quoted block needs a different tag",
      );
    }
  });

  // ── 4. Structure sanity ─────────────────────────────────────────────────
  const hasDo = lines.some((l) => /^\s*do\s+\$\$/.test(l));

  if (hasDo) {
    const openCount = lines.filter((l) => /^\s*do\s+\$\$/.test(l)).length;
    const endCount = lines.filter((l) => /^\s*end\s+\$\$+;/.test(l)).length;
    if (openCount !== endCount) {
      fail(file, 0, `${openCount} DO block(s) opened but ${endCount} closed`);
    }
  }

  // ── 5. Parenthesis balance, ignoring comments and string literals ────────
  const syntax = stripNoise(raw);
  let paren = 0;
  let brace = 0;
  for (let i = 0; i < syntax.length; i++) {
    if (syntax[i] === "(") paren++;
    if (syntax[i] === ")") paren--;
    if (syntax[i] === "{") brace++;
    if (syntax[i] === "}") brace--;
  }
  if (paren !== 0) {
    fail(file, 0, `unbalanced parentheses (${paren > 0 ? "missing )" : "extra )"}) — likely truncated`);
  }
  if (brace !== 0) {
    fail(file, 0, `unbalanced braces (${brace > 0 ? "missing }" : "extra }"}) — likely truncated`);
  }

  // ── 7. Unsafe apostrophes ───────────────────────────────────────────────
  // `'the borrower's name'` closes the literal at the inner quote, so
  // Postgres reports a syntax error somewhere after it. Escape it as
  // `borrower''s` or reword.
  //
  // One bad quote desynchronises the lexer for everything that follows, so
  // only report the first offender per statement — otherwise a single typo
  // produces a wall of misleading errors.
  const lineOfRaw = buildLineMap(raw);
  const semicolonOffsets: number[] = [];
  for (let i = 0; i < syntax.length; i++) {
    if (syntax[i] === ";") semicolonOffsets.push(i);
  }

  const reported = new Set<number>();
  for (const offset of findUnsafeApostrophes(raw)) {
    // Index of the first semicolon after this offset in stripped SQL
    const stmtIndex = semicolonOffsets.findIndex((s) => s > offset);
    const key = stmtIndex === -1 ? -1 : stmtIndex;
    if (reported.has(key)) continue;
    reported.add(key);

    const snippet = raw
      .slice(Math.max(0, offset - 25), Math.min(raw.length, offset + 35))
      .replace(/\s+/g, " ");
    fail(
      file,
      lineOfRaw[offset],
      `apostrophe inside a word closes the string early — near: …${snippet}…`,
    );
  }

  // ── 8. Statement termination ───────────────────────────────────────────
  // Every top-level statement must end with a semicolon. A trailing
  // statement without one is the signature of a truncated paste.
  const tail = syntax.trimEnd();
  if (tail.length > 0 && !tail.endsWith(";")) {
    fail(file, lines.length, "file does not end with a semicolon — likely truncated");
  }

  // ── 7. Corruption pattern: an opening paren followed by a comment ──────
  // Inside a VALUES or column list this is a syntax error, and it is easy to
  // introduce when inserting a comment mid-statement.
  lines.forEach((line, i) => {
    if (/\(\s*--/.test(line)) {
      fail(file, i + 1, "opening parenthesis followed by a comment is a syntax error");
    }
  });

  // ── 8. Per-statement parenthesis depth ─────────────────────────────────
  // Depth must never go negative and must return to zero at each semicolon
  // that ends a top-level statement.
  let parenDepth = 0;
  const lineOf = buildLineMap(syntax);
  for (let i = 0; i < syntax.length; i++) {
    if (syntax[i] === "(") parenDepth++;
    if (syntax[i] === ")") {
      parenDepth--;
      if (parenDepth < 0) {
        fail(file, lineOf[i], "unmatched closing parenthesis");
        parenDepth = 0;
      }
    }
  }

  // ── 9. INSERT column/value arity ───────────────────────────────────────
  const insertsChecked = auditInsertArity(syntax, lineOf, (line, message) => {
    fail(file, line, `INSERT arity mismatch — ${message}`);
  });

  console.log(
    `  ✓ ${file}  (${lines.length} lines, ${insertsChecked} INSERT(s) arity-checked)`,
  );
}

console.log("");
if (problems > 0) {
  console.log(`  ${problems} problem(s) found — do NOT paste these yet.\n`);
  process.exit(1);
}

console.log(`  No blocking problems${notes > 0 ? ` (${notes} note(s))` : ""}.`);
console.log("  Safe to paste into the Supabase SQL Editor.\n");