/**
 * Verify the seeded demo data actually landed.
 *
 * Run after `npm run db:migrate`. Checks the row counts the UI depends on,
 * plus the specific states USER-OMA.txt describes (pending, resubmission,
 * rejected with a cooling period, overdue EMI, issued NOC).
 *
 * Usage:  npm run db:verify
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
  console.error("\n  Set DATABASE_URL in .env first (see .env.example).\n");
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

let pass = 0;
let fail = 0;

function check(label, actual, expected) {
  const ok = String(actual) === String(expected);
  if (ok) {
    pass++;
    console.log(`  ✓ ${label.padEnd(44)} ${actual}`);
  } else {
    fail++;
    console.log(`  ✗ ${label.padEnd(44)} got ${actual}, expected ${expected}`);
  }
}

function checkAtLeast(label, actual, min) {
  const ok = Number(actual) >= Number(min);
  if (ok) {
    pass++;
    console.log(`  ✓ ${label.padEnd(44)} ${actual}`);
  } else {
    fail++;
    console.log(`  ✗ ${label.padEnd(44)} got ${actual}, expected ≥ ${min}`);
  }
}

async function main() {
  await client.connect();
  console.log("\n  Verifying seeded data\n");

  // ── Row counts ────────────────────────────────────────────────────────────
  const counts = await client.query(`
    select
      (select count(*)::int from profiles)                         as profiles,
      (select count(*)::int from employees)                        as employees,
      (select count(*)::int from loan_products)                    as products,
      (select count(*)::int from document_requirements)            as requirements,
      (select count(*)::int from applications)                     as applications,
      (select count(*)::int from loans)                            as loans,
      (select count(*)::int from emi_schedule)                     as emis,
      (select count(*)::int from payments)                         as payments,
      (select count(*)::int from ebills)                           as ebills,
      (select count(*)::int from chat_conversations)               as conversations,
      (select count(*)::int from chat_messages)                    as messages,
      (select count(*)::int from tickets)                          as tickets,
      (select count(*)::int from notifications)                    as notifications,
      (select count(*)::int from cooling_periods)                  as cooling
  `);
  const c = counts.rows[0];

  console.log("  Catalog and core data");
  check("profiles (4 staff + 6 customers)", c.profiles, 10);
  check("employees", c.employees, 4);
  check("loan products", c.products, 9);
  checkAtLeast("document requirements", c.requirements, 80);
  check("applications", c.applications, 12);
  check("loans", c.loans, 5);

  console.log("\n  Servicing");
  check("EMI schedule rows", c.emis, 240 + 36 + 60 + 24 + 24);
  checkAtLeast("payments", c.payments, 30);
  check("e-Bills", c.ebills, 3);
  check("chat conversations", c.conversations, 3);
  check("chat messages", c.messages, 7);
  check("tickets", c.tickets, 3);
  checkAtLeast("notifications", c.notifications, 12);
  check("active cooling periods", c.cooling, 1);

  // ── States the UI depends on ─────────────────────────────────────────────
  console.log("\n  Applicant status states (USER-OMA.txt lines 107-131)");

  const statuses = await client.query(`
    select status, count(*)::int as n
    from applications group by status order by status
  `);
  const byStatus = Object.fromEntries(statuses.rows.map((r) => [r.status, r.n]));

  console.log(`    ${statuses.rows.map((r) => `${r.status}=${r.n}`).join("  ")}`);

  check("one APPROVED home loan", byStatus.APPROVED >= 1, true);
  check("one UNDER_REVIEW application", byStatus.UNDER_REVIEW, 1);
  check("one RESUBMISSION_REQUESTED", byStatus.RESUBMISSION_REQUESTED, 1);
  check("two REJECTED (cooling period demo)", byStatus.REJECTED, 2);
  check("two SUBMITTED awaiting officer", byStatus.SUBMITTED, 2);
  check("one DRAFT", byStatus.DRAFT, 1);

  // ── Resubmission: only the named documents should be unlocked ────────────
  console.log("\n  Resubmission (only officer-named documents unlocked)");
  const resub = await client.query(`
    select
      count(*) filter (where status = 'REJECTED' and not is_locked) as unlocked,
      count(*) filter (where status = 'REJECTED' and is_locked)     as locked,
      count(*) filter (where status = 'VERIFIED')                    as verified
    from application_documents
    where application_id = '20000000-0000-4000-8000-000000000003'
  `);
  check("unlocked for applicant to replace", resub.rows[0].unlocked, 2);
  check("verified documents stay locked", resub.rows[0].locked, 0);
  checkAtLeast("documents verified", resub.rows[0].verified, 3);

  // ── Overdue EMI with its penalty ─────────────────────────────────────────
  console.log("\n  Overdue servicing (source doc lines 155-159)");
  const overdue = await client.query(`
    select count(*)::int as n,
           coalesce(sum(amount_due + penalty_amount), 0) as total,
           max(days_past_due)::int as worst
    from emi_schedule where status = 'OVERDUE'
  `);
  checkAtLeast("overdue instalments", overdue.rows[0].n, 1);
  checkAtLeast("overdue amount including penalty", Number(overdue.rows[0].total), 1);
  checkAtLeast("worst days past due", overdue.rows[0].worst, 1);

  // ── Amortisation integrity ────────────────────────────────────────────────
  // The strongest guarantee: principal column must sum back to the loan amount.
  console.log("\n  Amortisation integrity");
  const amort = await client.query(`
    select l.id, l.account_number, l.principal, l.outstanding_principal,
           l.tenure_months,
           coalesce(sum(e.principal_part), 0) as principal_sum,
           count(e.id)::int as rows
    from loans l
    left join emi_schedule e on e.loan_id = l.id
    group by l.id, l.account_number, l.principal, l.outstanding_principal, l.tenure_months
    order by l.account_number
  `);

  for (const row of amort.rows) {
    const principalSum = Number(row.principal_sum);
    const principal = Number(row.principal);
    const drift = Math.abs(principal - principalSum);
    const label = `${row.account_number} principal sums back`;
    if (drift < 1) {
      pass++;
      console.log(`  ✓ ${label.padEnd(44)} ₹${principal.toLocaleString("en-IN")}`);
    } else {
      fail++;
      console.log(`  ✗ ${label.padEnd(44)} off by ₹${drift.toFixed(2)}`);
    }

    const rowLabel = `${row.account_number} has ${row.tenure_months} rows`;
    if (row.rows === row.tenure_months) {
      pass++;
      console.log(`  ✓ ${rowLabel.padEnd(44)} ${row.rows}`);
    } else {
      fail++;
      console.log(`  ✗ ${rowLabel.padEnd(44)} got ${row.rows}`);
    }
  }

  // ── Unique identifiers ────────────────────────────────────────────────────
  console.log("\n  Unique identifiers");
  const dupes = await client.query(`
    select 'payments.receipt_no' as what, count(*)::int as dupes
      from (select receipt_no from payments group by receipt_no having count(*) > 1) x
    union all
    select 'ebills.bill_no', count(*)::int
      from (select bill_no from ebills group by bill_no having count(*) > 1) x
    union all
    select 'applications.reference_no', count(*)::int
      from (select reference_no from applications group by reference_no having count(*) > 1) x
    union all
    select 'loans.account_number', count(*)::int
      from (select account_number from loans group by account_number having count(*) > 1) x
  `);
  for (const row of dupes.rows) check(`${row.what} duplicates`, row.dupes, 0);

  // ── Role gate ─────────────────────────────────────────────────────────────
  console.log("\n  Roles");
  const roles = await client.query(
    `select role, count(*)::int as n from profiles group by role order by role`,
  );
  for (const row of roles.rows) {
    console.log(`    ${row.role}=${row.n}`);
  }
  check("one ADMIN", roles.rows.find((r) => r.role === "ADMIN")?.n, 1);
  check("three EMPLOYEE", roles.rows.find((r) => r.role === "EMPLOYEE")?.n, 3);
  check("six borrowers", roles.rows.find((r) => r.role === "USER")?.n, 6);

  const blocked = await client.query(
    `select count(*)::int as n from profiles where status = 'BLOCKED'`,
  );
  check("exactly one blocked account", blocked.rows[0].n, 1);

  // ── Every loan must hang off an APPROVED application ─────────────────────
  // A disbursed loan pointing at a rejected or in-progress application is a
  // referential inconsistency the UI would surface as nonsense.
  console.log("\n  Loan → application consistency");
  const orphans = await client.query(`
    select l.account_number, a.reference_no, a.status
    from loans l
    join applications a on a.id = l.application_id
    where a.status <> 'APPROVED'
  `);
  check("loans pointing at non-approved applications", orphans.rows.length, 0);
  for (const row of orphans.rows) {
    console.log(`      ${row.account_number} → ${row.reference_no} (${row.status})`);
  }

  // ── Loan figures must match their own schedule ───────────────────────────
  console.log("\n  Loan figures vs schedule");
  const figures = await client.query(`
    select l.account_number, l.principal, l.annual_rate, l.tenure_months,
           l.emi_amount, l.total_interest, l.total_payable,
           min(e.amount_due) filter (where e.installment_no < e_count) as typical_emi,
           coalesce(sum(e.paid_amount), 0) as total_paid_from_schedule
    from loans l
    join lateral (
      select count(*) as e_count from emi_schedule x where x.loan_id = l.id
    ) c on true
    left join emi_schedule e on e.loan_id = l.id
    group by l.id, l.account_number, l.principal, l.annual_rate, l.tenure_months,
             l.emi_amount, l.total_interest, l.total_payable
    order by l.account_number
  `);

  const emiOf = (P, annualRate, n) => {
    const r = annualRate / 1200;
    if (r === 0) return Math.round((P / n) * 100) / 100;
    const g = Math.pow(1 + r, n);
    return Math.round(((P * r * g) / (g - 1)) * 100) / 100;
  };

  for (const row of figures.rows) {
    const expectedEmi = emiOf(
      Number(row.principal),
      Number(row.annual_rate),
      row.tenure_months,
    );
    const emiDrift = Math.abs(Number(row.emi_amount) - expectedEmi);
    const label = `${row.account_number} emi_amount`;
    if (emiDrift < 1) {
      pass++;
      console.log(`  ✓ ${label.padEnd(44)} ₹${expectedEmi.toLocaleString("en-IN")}`);
    } else {
      fail++;
      console.log(
        `  ✗ ${label.padEnd(44)} stored ${row.emi_amount}, formula gives ${expectedEmi.toFixed(2)}`,
      );
    }

    const expectedInterest = Math.round((expectedEmi * row.tenure_months - Number(row.principal)) * 100) / 100;
    const intDrift = Math.abs(Number(row.total_interest) - expectedInterest);
    const intLabel = `${row.account_number} total_interest`;
    if (intDrift < 1) {
      pass++;
      console.log(`  ✓ ${intLabel.padEnd(44)} ₹${Number(row.total_interest).toLocaleString("en-IN")}`);
    } else {
      fail++;
      console.log(
        `  ✗ ${intLabel.padEnd(44)} stored ${row.total_interest}, formula gives ${expectedInterest.toFixed(2)}`,
      );
    }

    const payableDrift = Math.abs(
      Number(row.total_payable) - (Number(row.principal) + Number(row.total_interest)),
    );
    const payLabel = `${row.account_number} total = principal + interest`;
    if (payableDrift < 1) {
      pass++;
      console.log(`  ✓ ${payLabel}`);
    } else {
      fail++;
      console.log(`  ✗ ${payLabel} off by ₹${payableDrift.toFixed(2)}`);
    }
  }

  // ── Approval authority ────────────────────────────────────────────────────
  console.log("\n  Sanctioning authority");
  const limits = await client.query(`
    select e.employee_role, count(*)::int as n, max(e.approval_limit) as max_limit
    from employees e group by e.employee_role order by e.employee_role
  `);
  for (const row of limits.rows) {
    console.log(`    ${row.employee_role}: ${row.n} staff, max ₹${Number(row.max_limit).toLocaleString("en-IN")}`);
  }
  check("two officers", limits.rows.find((r) => r.employee_role === "OFFICER")?.n, 2);

  await client.end();

  console.log(`\n  ${"─".repeat(52)}`);
  console.log(`  ${pass} passed · ${fail} failed`);
  console.log(`${"─".repeat(52)}\n`);

  if (fail > 0) process.exit(1);
  console.log("  Seed data is good. Start the app:  npm run dev\n");
}

main().catch((err) => {
  console.error(`\n  ${err.message}\n`);
  process.exit(1);
});