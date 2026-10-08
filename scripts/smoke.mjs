/**
 * End-to-end smoke test against a running dev/prod server.
 *
 * Production `next build` does NOT prerender these routes (they read the
 * session), so a Server-Component error like "functions cannot be passed to
 * Client Components" only appears at request time. This drives the real HTTP
 * surface with a real session so that class of error surfaces here.
 *
 * Requires the app to be running (npm run dev).
 *
 * Usage:  node scripts/smoke.mjs [baseUrl]
 */

import { createServerClient } from "@supabase/ssr";
import { readFileSync, existsSync } from "node:fs";

for (const file of [".env", ".env.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, "").trim();
    if (!process.env[m[1]]) process.env[m[1]] = value;
  }
}

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/+$/, "");
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/rest\/v1$/, "");
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PASSWORD = "demo1234";

/** role → [email, routes that role can load] */
const SUITES = {
  USER: [
    ["rahul@demo.in", ["/user/dashboard", "/user/new-loan", "/user/applications",
                        "/user/applications/20000000-0000-4000-8000-000000000001",
                        "/user/loans", "/user/loans/40000000-0000-4000-8000-000000000001",
                        "/user/emi-calculator", "/user/cibil",
                        "/user/payments", "/user/chat",
                        "/user/chat/50000000-0000-4000-8000-000000000001",
                        "/user/tickets"]],
  ],
  EMPLOYEE: [
    ["officer@demo.in", ["/employee/dashboard", "/employee/applications",
                         "/employee/applications/20000000-0000-4000-8000-000000000002",
                         "/employee/chat", "/employee/tickets",
                         "/employee/loans", "/employee/noc"]],
  ],
  ADMIN: [
    ["admin@demo.in", ["/admin/dashboard", "/admin/users", "/admin/products",
                       "/admin/staff", "/admin/reports", "/admin/audit"]],
  ],
};

/** SUITES values are `[email, routes]` tuples. */
const suites = Object.entries(SUITES).map(([role, entry]) => {
  const [email, routes] = entry[0];
  return { role, email, routes };
});

/** Build a Supabase client that keeps cookies in a plain object we can replay. */
async function sessionFor(email) {
  const jar = {};

  const client = createServerClient(url, anon, {
    cookies: {
      getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })),
      setAll: (list) => {
        for (const { name, value } of list) jar[name] = value;
      },
    },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });

  if (error) throw new Error(`${email}: ${error.message}`);

  return {
    cookie: Object.entries(jar)
      .map(([name, value]) => `${name}=${value}`)
      .join("; "),
    userId: data.user?.id,
  };
}

/** Sign the HTTP failure markers we know how to recognise. */
function diagnose(html) {
  if (/Functions cannot be passed directly to Client Components/.test(html)) {
    return "passing a function across the server→client boundary";
  }
  if (/Only plain objects can be passed to Client Components/.test(html)) {
    return "passing a non-serialisable object across the server→client boundary";
  }
  if (/encountered the unstable value `Date\.now\(\)`/.test(html)) {
    return "Date.now() during prerender — needs connection()";
  }
  if (/encountered uncached or runtime data during prerendering/.test(html)) {
    return "uncached data accessed outside Suspense";
  }
  if (/Could not find a relationship between/.test(html)) {
    return "bad PostgREST embed hint";
  }
  if (/Application error: (a client-side exception|server-side exception)/.test(html)) {
    return "unhandled exception";
  }
  return "unknown error";
}

let pass = 0;
let fail = 0;
const failures = [];

console.log(`\n  Smoke testing ${base}\n`);

try {
  await fetch(`${base}/login`, { redirect: "manual" });
} catch (err) {
  console.error(
    `\n  Cannot reach ${base} — is the dev server running?\n` +
      `  Start it with:  npm run dev\n`,
  );
  process.exit(1);
}

for (const { role, email, routes } of suites) {
  let cookie;
  try {
    ({ cookie } = await sessionFor(email));
  } catch (err) {
    console.log(`  ✗ sign-in failed for ${email}: ${err.message}`);
    fail += routes.length;
    failures.push(`${email} could not sign in`);
    continue;
  }

  for (const route of routes) {
    let status = 0;
    let html = "";
    let location = null;
    try {
      const res = await fetch(`${base}${route}`, {
        headers: { cookie },
        redirect: "manual",
      });
      status = res.status;
      location = res.headers.get("location");
      html = await res.text();
    } catch (err) {
      console.log(`  ✗ ${route.padEnd(26)} request failed: ${err.message}`);
      fail++;
      failures.push(`${route} — request failed`);
      continue;
    }

    const hasError =
      status >= 500 ||
      /Functions cannot be passed directly to Client Components/.test(html) ||
      /encountered the unstable value/.test(html) ||
      /encountered uncached or runtime data/.test(html);

    // A signed-in request must not be redirected. loadPortal() bounces the
    // user to their own dashboard when the page declares the wrong portal,
    // which makes the page unreachable — a 307 there is a real bug, not a pass.
    if (hasError) {
      fail++;
      const why = status >= 500 ? `HTTP ${status}` : null;
      failures.push(`${route} — ${why ?? diagnose(html)}`);
      console.log(
        `  ✗ ${route.padEnd(26)} ${role.padEnd(9)} ${why ?? diagnose(html)}`,
      );
    } else if (status >= 300) {
      fail++;
      const to = location ?? "?";
      failures.push(`${route} — redirected to ${to} (wrong portal declared?)`);
      console.log(
        `  ✗ ${route.padEnd(26)} ${role.padEnd(9)} HTTP ${status} → ${to}`,
      );
    } else if (status >= 400) {
      fail++;
      failures.push(`${route} — HTTP ${status}`);
      console.log(`  ✗ ${route.padEnd(26)} ${role.padEnd(9)} HTTP ${status}`);
    } else {
      pass++;
      console.log(`  ✓ ${route.padEnd(26)} ${role.padEnd(9)} HTTP ${status}`);
    }
  }
}

// Public pages
for (const route of ["/", "/login", "/signup"]) {
  const res = await fetch(`${base}${route}`, { redirect: "manual" });
  if (res.status >= 400) {
    fail++;
    failures.push(`${route} — HTTP ${res.status}`);
    console.log(`  ✗ ${route.padEnd(26)} PUBLIC    HTTP ${res.status}`);
  } else {
    pass++;
    console.log(`  ✓ ${route.padEnd(26)} PUBLIC    HTTP ${res.status}`);
  }
}

// A signed-out request to a protected route must redirect, not 500
const anonRes = await fetch(`${base}/user/dashboard`, { redirect: "manual" });
if (anonRes.status === 500) {
  fail++;
  failures.push("auth guard — signed-out request 500s instead of redirecting");
  console.log("  ✗ auth guard              signed-out request returned 500");
} else {
  pass++;
  console.log(
    `  ✓ auth guard              signed-out → ${anonRes.status} ${
      anonRes.headers.get("location") ? "redirect" : ""
    }`,
  );
}

console.log(`\n  ${pass} passed · ${fail} failed`);

if (fail > 0) {
  console.log("\n  Failures:");
  for (const f of failures) console.log(`    - ${f}`);
  console.log("");
  process.exit(1);
}

console.log("\n  Every route renders.\n");