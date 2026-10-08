/**
 * Exercise every Supabase embed used in the app against the real database.
 *
 * PostgREST embed hints are hand-written constraint names, so a typo only
 * surfaces at runtime on whichever page happens to use that query — which is
 * exactly the failure mode that bit us on /user/dashboard.
 *
 * Each check names the page that owns the query.
 *
 * Usage:  node scripts/check-embeds.mjs
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

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/rest\/v1$/, "");
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !service) {
  console.error("\n  Missing Supabase credentials in .env\n");
  process.exit(1);
}

// service_role so RLS does not hide rows; we are testing query shape only.
const db = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** [page, description, query builder thunk] */
const CHECKS = [
  ["user/dashboard", "applications + applicant + officer", () =>
    db.from("applications").select(`
      *,
      product:loan_products (*),
      applicant:profiles!applications_user_id_fkey (id, full_name, email, phone, monthly_income),
      officer:profiles!applications_assigned_officer_id_fkey (id, full_name, email)
    `).limit(1)],

  ["employee/review", "applicant full profile", () =>
    db.from("applications").select(`
      *,
      product:loan_products (*),
      applicant:profiles!applications_user_id_fkey (*),
      officer:profiles!applications_assigned_officer_id_fkey (id, full_name, email)
    `).limit(1)],

  ["employee/queue", "applicant contact only", () =>
    db.from("applications").select(`
      *,
      product:loan_products (*),
      applicant:profiles!applications_user_id_fkey (id, full_name, email, phone, monthly_income)
    `).limit(1)],

  ["employee/dashboard", "officer directory", () =>
    db.from("employees").select(`
      *,
      profile:profiles!employees_user_id_fkey (id, full_name, email, role, status)
    `).limit(1)],

  ["admin/staff", "staff with full profile", () =>
    db.from("employees").select(`
      *, profile:profiles!employees_user_id_fkey (id, full_name, email, role, status)
    `).limit(1)],

  ["user/chat list", "conversation + officer", () =>
    db.from("chat_conversations").select(`
      *,
      messages:chat_messages (*),
      officer:profiles!chat_conversations_assigned_officer_id_fkey (id, full_name),
      customer:profiles!chat_conversations_user_id_fkey (id, full_name, email),
      application:applications (reference_no, product:loan_products (name))
    `).limit(1)],

  ["user/chat thread", "thread + customer + loan + ticket", () =>
    db.from("chat_conversations").select(`
      *,
      messages:chat_messages (*),
      customer:profiles!chat_conversations_user_id_fkey (id, full_name, email, phone, monthly_income),
      application:applications (id, reference_no, product:loan_products (name)),
      loan:loans (id, account_number, outstanding_principal),
      ticket:tickets (id, ticket_no, subject, status)
    `).limit(1)],

  ["employee/chat", "conversation + customer", () =>
    db.from("chat_conversations").select(`
      *,
      messages:chat_messages (*),
      customer:profiles!chat_conversations_user_id_fkey (id, full_name, email)
    `).limit(1)],

  ["user/payments", "payment + loan + product", () =>
    db.from("payments").select(`
      *, loan:loans (account_number, product:loan_products (name))
    `).limit(1)],

  ["user/loans", "loan + product", () =>
    db.from("loans").select("*, product:loan_products (*)").limit(1)],

  ["employee/loans", "overdue EMI + loan + borrower", () =>
    db.from("emi_schedule").select(`
      *,
      loan:loans (
        account_number, emi_amount,
        product:loan_products (name),
        borrower:profiles!loans_user_id_fkey (id, full_name, phone, email)
      )
    `).limit(1)],

  ["employee/tickets", "ticket + customer", () =>
    db.from("tickets").select(`
      *, customer:profiles!tickets_user_id_fkey (id, full_name, email, phone)
    `).limit(1)],

  ["employee/tickets (unassigned)", "minimal customer embed", () =>
    db.from("tickets").select(
      `*, customer:profiles!tickets_user_id_fkey (id, full_name, email)`,
    ).limit(1)],

  ["employee/noc", "NOC + loan + borrower", () =>
    db.from("noc_requests").select(`
      *,
      loan:loans (
        account_number, principal, tenure_months, status,
        product:loan_products (name),
        borrower:profiles!loans_user_id_fkey (id, full_name, email, phone)
      )
    `).limit(1)],

  ["admin/audit", "audit + actor", () =>
    db.from("audit_logs").select(
      `*, actor:profiles!audit_logs_actor_id_fkey (id, full_name, email)`,
    ).limit(1)],

  ["admin/reports", "loan + product + borrower", () =>
    db.from("loans").select(`
      *,
      product:loan_products (name, category, code),
      borrower:profiles!loans_user_id_fkey (id, full_name, email)
    `).limit(1)],

  ["admin/reports (applications)", "application + product + officer", () =>
    db.from("applications").select(`
      *,
      product:loan_products (name, category, code),
      applicant:profiles!applications_user_id_fkey (id, full_name, email),
      officer:profiles!applications_assigned_officer_id_fkey (id, full_name)
    `).limit(1)],
];

console.log("\n  Testing Supabase embeds against the live database\n");

let pass = 0;
let fail = 0;

for (const [page, description, build] of CHECKS) {
  const { error } = await build();

  if (error) {
    fail++;
    console.log(`  ✗ ${page}`);
    console.log(`      ${description}`);
    console.log(`      ${error.message}\n`);
  } else {
    pass++;
    console.log(`  ✓ ${page.padEnd(32)} ${description}`);
  }
}

console.log(`\n  ${pass} embed(s) OK · ${fail} failed\n`);

if (fail > 0) {
  console.log("  Fix the constraint name in the hint, then re-run.\n");
  process.exit(1);
}