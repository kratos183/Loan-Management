# SafarLoan — Loan Management Platform

A three-portal digital lending platform built from `USER-OMA.txt`: applicants apply
and service loans, loan officers verify and sanction, admins manage users,
products and reporting.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS 4 ·
Supabase (Postgres + Auth + Realtime + Storage)

---

## Quick start

```bash
npm install
cp .env.example .env     # then paste your Supabase keys
```

`NEXT_PUBLIC_SUPABASE_URL` must be the **bare project URL**
(`https://<ref>.supabase.co`) with no `/rest/v1` suffix — the client library
appends that itself, and leaving it in produces `.../rest/v1/rest/v1/...`.
The code normalises it either way, but a clean value avoids surprises.

**1. Validate the SQL.** Runs the real PostgreSQL parser (libpg_query via
`@supabase/pg-parser`) plus structural checks — no database needed:

```bash
npm run db:check
```

This catches syntax errors, unbalanced dollar quoting, truncation, unsafe
apostrophes and `INSERT` column/value arity mismatches.

**2. Apply it.** Two options.

**Option A — apply directly (recommended).** Add the connection string to `.env`:

```bash
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

```bash
npm run db:migrate
```

This runs both files in order against the real database. It is the only way to
catch **type** errors (`column "mode" is of type payment_mode but expression is
of type text`), because those need a catalog to resolve against. You get the
real message with the real line number.

**Option B — SQL Editor.** Supabase Dashboard → SQL Editor → paste and run, in
order:

| File | What it does |
|---|---|
| `supabase/migrations/0001_core_schema.sql` | Tables, enums, indexes, RLS policies, triggers, helpers |
| `supabase/migrations/0002_seed.sql` | Demo data: 9 products, 10 applications, 4 loans, chats, tickets |

`0001_core_schema.sql` is **idempotent** — every table, index, enum, function,
policy and publication entry is created conditionally, so re-running it is a
no-op rather than `ERROR: type "user_role" already exists`.

`0002_seed.sql` **truncates** the application tables first, so it wipes any
data you have created and reloads the demo set. Run it whenever you want a
clean slate.

**3. Create the auth users** (Supabase owns passwords, SQL seeds the profiles):

```bash
npm run db:users
```

All demo accounts use the password **`demo1234`**.

This must run before the seed: the `handle_new_user` trigger creates a
`profiles` row for each signup, and the seed upserts on top of those rows.

**4. Run the app:**

```bash
npm run dev
```

---

## Demo accounts

| Role | Email | What you'll see |
|---|---|---|
| User | `rahul@demo.in` | Active home loan, a personal loan under review, live chat |
| User | `priya@demo.in` | An application in **resubmission** state — the "fix your documents" flow |
| User | `sanjay@demo.in` | A loan with an **overdue** EMI and a bounced payment |
| User | `meera@demo.in` | Declined application, active 90-day block, issued NOC |
| Officer | `officer@demo.in` | Work queue, live underwriting scorecard, decision panel |
| Officer | `officer2@demo.in` | Different queue, ₹25L sanctioning limit |
| Manager | `manager@demo.in` | Manager-level authority |
| Admin | `admin@demo.in` | User management, product config, reports, audit log |

`kavya@demo.in` is deliberately **BLOCKED** — sign in to see the blocked-account path.

---

## How the source document maps to the code

### Entry point

`app/login` → `proxy.ts` resolves the role → redirects to one of three portals.
The `proxy.ts` filename matters: Next.js 16 **deprecated `middleware.ts`**. Supabase's
own setup guide still tells you to create `middleware.ts`, so ignore that part of it.

### 1 · User portal (source doc line 8)

| Document requirement | Route |
|---|---|
| Dashboard (7 destinations) | `app/user/dashboard` |
| New Loan | `app/user/new-loan` + `[productId]` |
| Application Status | `app/user/applications` + `[id]` |
| Current Loan Status | `app/user/loans` + `[id]` |
| EMI Calculator | `app/user/emi-calculator` |
| CIBIL Score | `app/user/cibil` |
| Payment History | `app/user/payments` |
| Chatbot & Chat | `app/user/chat` + `[id]` |

### 2 · Loan categories (lines 10-23)

Five secured (home, vehicle, gold, loan-against-property, loan-against-security) and
four unsecured (personal, education, business/working-capital, credit-card), all seeded
in `loan_products` with realistic Indian NBFC parameters.

### 3 · Validation & verification (lines 26-102)

The multi-part checklist is **data-driven**. `document_requirements` holds one row per
document with its `part` (A/B/C/D), label, file type and whether it applies to a given
collateral type. The wizard renders itself from those rows, so adding a document is a
database insert, not a code change.

**Part A** is identical for every applicant (identity, residence, income, banking,
credit, liability). **Part B** filters by collateral — a gold loan sees purity and
grammage; a home loan sees title deed and encumbrance certificate.

### 4 · Applicant status (lines 107-131)

| State | Implementation |
|---|---|
| `PENDING` | `SUBMITTED` / `UNDER_REVIEW`, SLA date from `loan_products.sla_max_days`, assigned officer shown on hover |
| `APPROVED` | Creates the loan, generates the amortisation schedule, disburses, issues an account number |
| `FAILED` | `REJECTED` + a `cooling_periods` row blocking that **category** for 90 days |
| `RESUBMISSION` | Officer names the exact documents; only those unlock. Everything else stays locked |

### 5 · Current loan status (lines 138-170)

Last payment · Next payment · Overdue · Call support · NOC. Prepayment re-runs the
amortisation maths via `prepaymentImpact()` and flags the officer.

### 6 · Payment history (lines 174-179)

Receipts, bounce charges, overdue flags, transaction status, CSV/statement download.

### 7 · CIBIL score (lines 195-201)

`ID proof → validation → third-party API → our API → DB → dashboard`. Scores expire
after 30 days and must be re-pulled. See "Third-party integrations" below.

---

## Resolved design questions

The source document left ten things open. Each was resolved with the industry-standard
practice, and the reasoning is recorded at the top of `0001_core_schema.sql`.

| # | Question | Decision |
|---|---|---|
| 1 | Admin portal scope | **User management, product config, reports, audit log** — all four |
| 2 | Employee tiers | Two-tier: **Officer** approves within a personal limit, **Manager** above it |
| 3 | Unsecured "Part C" asked for collateral | Copy-paste error. Replaced with **co-applicant/guarantor** verification, which is what unsecured lending actually uses |
| 4 | Loan configuration | `loan_products` table, fully admin-editable |
| 5 | Officer assignment | **Round-robin by category** — implemented as least-loaded, which self-corrects when someone is on leave |
| 6 | Processing time | Per-product `sla_min_days` / `sla_max_days` |
| 7 | Approval authority | Amount-based matrix: officer limit → manager → admin |
| 8 | Interest method | **Reducing balance.** Flat-rate interest is prohibited for retail loans under RBI norms |
| 9 | Grace period | **5 days** before an EMI is marked overdue |
| 10 | Bounce / late fee | `max(₹500 flat, 2% of overdue)`, configurable per product |

---

## Interest maths

Every number in the app comes from `lib/finance/emi.ts`, which mirrors the SQL
`calculate_emi()` function exactly.

```
EMI = P × r × (1+r)^n / ((1+r)^n − 1)      r = annualRate / 1200
```

`buildAmortization()` walks the balance month by month. The final instalment absorbs
accumulated rounding drift so the principal column sums back to the original amount
exactly — otherwise a ₹45L loan would be off by a few paise per row.

`prepaymentImpact()` models both options lenders offer: reduce tenure (EMI unchanged)
or reduce EMI (tenure unchanged), and reports the interest saved either way.

`lib/finance/risk.ts` implements **FOIR** — total obligations ÷ net monthly income —
plus income, amount, tenure, credit score and collateral-cover checks. Each rule returns
`PASS` / `WARN` / `FAIL` rather than a single opaque rejection, so officers see *which*
check failed and by how much.

---

## Realtime

Supabase Realtime is a managed WebSocket layer, so there's no socket server to run.

**Browser → Server is plain HTTP.** Server Components read Postgres during render;
Server Actions handle form posts. No WebSocket needed.

**Server → Browser is where Realtime earns its place** — five features from the source
document depend on push:

| Feature | Source line |
|---|---|
| Customer chats → notify officer in EMP portal | 111 |
| Officer replies → notify user in USER portal | 112 |
| Officer marks an EMI overdue → notify user | 155 |
| Chat Support, both directions | 110-112, 162 |
| Notification bell count | throughout |

Everything else — dashboards, the EMI calculator, application lists, payment history —
is a Server Component read and needs no subscription.

The pattern is consistent: **write to Postgres, then the Realtime subscription pushes
the new row.** Postgres is the source of truth; the WebSocket is only delivery. Tables
in the `supabase_realtime` publication: `notifications`, `applications`,
`chat_messages`, `emi_schedule`, `tickets`.

---

## Security

Three portals over one database means **Row Level Security is the security model**, not
an optional extra. Every table has RLS enabled and policies that scope reads to the
owner, the assigned officer, or an admin.

Two key types:

| Key | Where | RLS |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser | Enforced |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only, via `createAdminClient()` | Bypassed |

The service-role client exists for back-office work — listing all users, assigning
officers, cron jobs marking EMIs overdue. **Every call site must check the caller's role
first**, because that client trusts whoever holds it.

One DPDP Act 2023 note in the schema: `profiles.aadhaar_last4` stores only the last four
digits. Persisting full Aadhaar numbers is prohibited, and it is worth knowing that
before you build anything that does.

---

## Third-party integrations

All of these sit behind an adapter in `lib/services/`. Phase 1 ships mock
implementations returning realistic shapes, so business logic never changes when you
swap in the real call.

| Need | Production provider | Phase 1 |
|---|---|---|
| Credit bureau | Experian, Equifax, CRIF High Mark | Deterministic mock score in `lib/services/cibil.ts` |
| KYC / PAN / Aadhaar | IDfy, Signzy, Surepass, Setu | Form inputs only |
| Bank statements | Setu Account Aggregator, TrueBalance, Perfios | Manual upload rows |
| Payments | Razorpay, Cashfree, PayU | Mock gateway refs, `PAYMENT_PROVIDER=mock` |
| Email / SMS | Resend, MSG91, Interakt | `NOTIFICATION_PROVIDER=console` writes to the DB |
| Document storage | Cloudflare R2, Supabase Storage | `seed/…` placeholder paths |
| e-Bill / NOC PDF | `@react-pdf/renderer` | Bill rows generated, PDF pending |

Bureau and bank-statement APIs require signed NBFC agreements, so they can't be wired up
in a prototype. Payments, email and storage can be.

---

## Project structure

```
app/
  page.tsx                    # marketing landing
  login/ signup/              # auth (split-screen layout)
  user/                       # 7 dashboard destinations
  employee/                   # work queue, review screen, loans, NOC, chat, tickets
  admin/                      # users, products, staff, reports, audit

components/
  ui/                         # Button, Card, Badge, form controls, table, primitives
  layout/                     # portal shell, sidebar, notification bell
  applications/               # wizard, underwriting scorecard, decision panel
  chat/ loan/ cibil/          # feature components

lib/
  supabase/{client,server,admin}.ts    # three client variants
  actions/                    # Server Actions: auth, applications, chat, cibil
  services/cibil.ts           # credit bureau adapter (mockable)
  finance/emi.ts              # EMI + amortisation + prepayment
  finance/risk.ts             # FOIR, eligibility rules, approval authority
  queries/                    # read models per portal
  db/types.ts                 # domain types

supabase/migrations/          # 0001 schema · 0002 seed
proxy.ts                      # session refresh + role-based route guards
```

---

## Scripts

```bash
npm run dev         # dev server
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm run test        # finance test suite
npm run db:check    # validate SQL (real parser, no DB needed)
npm run db:migrate  # apply SQL to the real database (needs DATABASE_URL)
npm run db:users    # create demo auth users
npm run db:types    # regenerate types from a live database
```

---

## What's built and what's next

**Done:** full schema with RLS, seed data covering every state, auth and role routing,
all three portals, the data-driven multi-part wizard, live underwriting scorecard,
approve/reject/resubmit with schedule generation, loans with amortisation and overdue
tracking, CIBIL with expiry, live chat, tickets, NOC flow, EMI calculator.

**Not yet:** payment gateway integration, real bureau calls, PDF generation for e-Bill
and NOC, file upload to Supabase Storage, the chatbot (the source doc says
*"based on timing we create enhance one"*), and a scheduled job for overdue detection
and cooling-period expiry — that last one belongs in a Supabase Edge Function triggered
by `pg_cron`, which Supabase runs for you.