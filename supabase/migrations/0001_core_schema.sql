-- ═══════════════════════════════════════════════════════════════════════════
-- SAFARLOAN — Core Schema
-- Supabase (PostgreSQL)
--
-- Run this in:  Supabase Dashboard → SQL Editor → New query → Run
-- Or:          psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_core_schema.sql
--
-- ───────────────────────────────────────────────────────────────────────────
-- GAP RESOLUTIONS APPLIED (from the Part 9 open-questions list)
--
-- 1. ADMIN PORTAL ......... User management + Product config + Reports + Audit
-- 2. EMPLOYEE PORTAL ...... Two-tier: OFFICER (reviews, approves up to a limit)
--                           and MANAGER (final authority above that limit).
--                           Implemented via `employees.approval_limit`.
-- 3. UNSECURED "PART C" ... The source doc asked for collateral verification on
--                           an UNSECURED loan — a copy-paste error. Industry
--                           practice replaces it with CO-APPLICANT / GUARANTOR
--                           verification. That is what Part C is now.
-- 4. LOAN CONFIG .......... `loan_products` table, admin-configurable.
-- 5. OFFICER ASSIGNMENT ... Round-robin by loan category + manual reassignment.
-- 6. PROCESSING SLA ....... `sla_min_days` / `sla_max_days` per product.
-- 7. APPROVAL AUTHORITY ... Amount-based authority matrix (officer vs manager).
-- 8. INTEREST METHOD ..... REDUCING BALANCE (EMI). Flat-rate interest is a
--                           legacy practice and is prohibited for retail loans
--                           under RBI norms. Every loan uses reducing balance.
-- 9. GRACE PERIOD ......... `grace_days` (default 5). An EMI is only marked
--                           OVERDUE after the grace window lapses.
-- 10. BOUNCE / LATE FEE ... Configurable: `late_fee_flat` (₹500) OR
--                           `late_fee_pct` (2%), whichever is higher.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Extensions ────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Enums ─────────────────────────────────────────────────────────────────
-- Postgres has no `create type if not exists`, so each enum is created
-- conditionally. That makes this migration re-runnable: if you already ran
-- it, running it again is a no-op instead of
-- `ERROR: type "user_role" already exists`.
do $enum$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role       as enum ('USER', 'EMPLOYEE', 'ADMIN');
  end if;
  if not exists (select 1 from pg_type where typname = 'employee_role') then
    create type employee_role   as enum ('OFFICER', 'MANAGER');
  end if;
  if not exists (select 1 from pg_type where typname = 'user_status') then
    create type user_status     as enum ('PENDING', 'ACTIVE', 'BLOCKED', 'CLOSED');
  end if;
  if not exists (select 1 from pg_type where typname = 'loan_category') then
    create type loan_category   as enum ('SECURED', 'UNSECURED');
  end if;
  if not exists (select 1 from pg_type where typname = 'collateral_type') then
    create type collateral_type as enum ('NONE', 'PROPERTY', 'VEHICLE', 'FINANCIAL', 'GOLD');
  end if;
  if not exists (select 1 from pg_type where typname = 'app_status') then
    create type app_status      as enum ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW',
                                         'RESUBMISSION_REQUESTED', 'APPROVED',
                                         'REJECTED', 'WITHDRAWN');
  end if;
  if not exists (select 1 from pg_type where typname = 'app_part') then
    create type app_part        as enum ('A', 'B', 'C', 'D');
  end if;
  if not exists (select 1 from pg_type where typname = 'doc_status') then
    create type doc_status      as enum ('PENDING', 'VERIFIED', 'REJECTED', 'NOT_REQUIRED');
  end if;
  if not exists (select 1 from pg_type where typname = 'loan_status') then
    create type loan_status     as enum ('ACTIVE', 'FORECLOSED', 'CLOSED', 'NOC_ISSUED');
  end if;
  if not exists (select 1 from pg_type where typname = 'emi_status') then
    create type emi_status      as enum ('UPCOMING', 'PAID', 'OVERDUE', 'PARTIALLY_PAID', 'PREPAID');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status  as enum ('SUCCESS', 'FAILED', 'BOUNCED', 'REFUNDED');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_mode') then
    create type payment_mode    as enum ('UPI', 'NEFT', 'RTGS', 'CARD', 'CHEQUE', 'MANUAL');
  end if;
  if not exists (select 1 from pg_type where typname = 'noc_status') then
    create type noc_status      as enum ('PENDING', 'APPROVED', 'REJECTED');
  end if;
  if not exists (select 1 from pg_type where typname = 'ticket_status') then
    create type ticket_status   as enum ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
  end if;
  if not exists (select 1 from pg_type where typname = 'ticket_priority') then
    create type ticket_priority as enum ('LOW', 'MEDIUM', 'HIGH');
  end if;
  if not exists (select 1 from pg_type where typname = 'conv_status') then
    create type conv_status     as enum ('OPEN', 'PENDING_USER', 'PENDING_OFFICER', 'CLOSED');
  end if;
  if not exists (select 1 from pg_type where typname = 'notif_type') then
    create type notif_type      as enum ('APPLICATION', 'LOAN', 'PAYMENT', 'CHAT',
                                         'TICKET', 'NOC', 'SYSTEM', 'CIBIL');
  end if;
  if not exists (select 1 from pg_type where typname = 'cibil_band') then
    create type cibil_band      as enum ('EXCELLENT', 'GOOD', 'AVERAGE', 'POOR');
  end if;
  if not exists (select 1 from pg_type where typname = 'audit_action') then
    create type audit_action    as enum ('CREATE', 'UPDATE', 'DELETE', 'APPROVE',
                                         'REJECT', 'RESUBMIT', 'LOGIN', 'DISBURSE');
  end if;
end
$enum$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. IDENTITY & ACCESS
--    `profiles.id` mirrors `auth.users.id` (Supabase Auth). One row per user.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null unique,
  full_name     text not null,
  phone         text,
  date_of_birth date,
  role          user_role    not null default 'USER',
  status        user_status  not null default 'ACTIVE',
  avatar_url    text,
  -- Applicant financial snapshot (used for FOIR + eligibility)
  monthly_income numeric(12,2),
  employment_type text,          -- SALARIED | SELF_EMPLOYED | BUSINESS | RETIRED
  employer      text,
  job_tenure_years numeric(4,1),
  pan           text,
  aadhaar_last4 text,            -- store ONLY the last 4 digits (DPDP Act 2023)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column profiles.aadhaar_last4 is
  'Aadhaar stored as last-4 only. Full Aadhaar must not be persisted (DPDP Act 2023, Section 8).';

-- Employee-specific attributes (approval authority matrix)
create table if not exists employees (
  user_id         uuid primary key references profiles(id) on delete cascade,
  employee_code   text unique,
  employee_role   employee_role not null default 'OFFICER',
  approval_limit  numeric(14,2) not null default 500000,  -- GAP 2 & 7
  territory       text,
  specialities    text[],         -- loan categories this officer handles
  created_at      timestamptz not null default now()
);

comment on column employees.approval_limit is
  'Max principal this employee may approve. Applications above this escalate to a MANAGER.';

create table if not exists addresses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  label      text not null default 'Home',   -- HOME | WORK | OTHER
  line1      text not null,
  line2      text,
  city       text not null,
  state      text not null,
  pincode    text not null,
  address_type text not null default 'PERMANENT', -- PERMANENT | CURRENT
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. LIABILITY REGISTRY  (drives FOIR calculation)
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists liabilities (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references profiles(id) on delete cascade,
  source           text not null default 'DECLARED', -- DECLARED | IMPORTED
  liability_type   text not null,   -- LOAN | CREDIT_CARD | EMI | CC | OTHER
  lender           text not null,
  monthly_amount   numeric(12,2) not null check (monthly_amount >= 0),
  outstanding      numeric(14,2),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. LOAN CATALOG  (admin-configurable)  — GAP 4, 6, 9, 10
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists loan_products (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,
  name               text not null,
  description        text,
  category           loan_category   not null,
  collateral_type    collateral_type not null default 'NONE',

  -- Eligibility envelope
  min_amount         numeric(14,2) not null,
  max_amount         numeric(14,2) not null,
  min_tenure_months  int  not null,
  max_tenure_months  int  not null,
  min_rate           numeric(5,2) not null,   -- annual %
  max_rate           numeric(5,2) not null,

  -- Underwriting rules
  min_monthly_income numeric(12,2),
  min_cibil           int,
  max_foir            numeric(5,2) default 50.00,  -- % of net income
  max_age             int default 65,
  min_age             int default 21,
  requires_coapplicant boolean not null default false,

  -- Fees
  processing_fee_pct numeric(5,2) default 2.00,

  -- Servicing rules  — GAP 9 & 10
  grace_days         int  not null default 5,
  late_fee_flat      numeric(10,2) default 500.00,
  late_fee_pct       numeric(5,2)  default 2.00,
  prepayment_allowed boolean not null default true,
  foreclosure_allowed boolean not null default true,
  autopay_enabled    boolean not null default true,

  -- Processing SLA (days) — GAP 6
  sla_min_days       int not null default 3,
  sla_max_days       int not null default 7,

  thumbnail_emoji    text default '🏦',
  is_active          boolean not null default true,
  sort_order         int not null default 100,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint product_amount_range check (min_amount <= max_amount),
  constraint product_tenure_range  check (min_tenure_months <= max_tenure_months),
  constraint product_rate_range    check (min_rate <= max_rate)
);

-- Data-driven document checklist: the multi-step form renders itself from this.
create table if not exists document_requirements (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references loan_products(id) on delete cascade,
  part             app_part not null,
  section_key      text not null,    -- e.g. 'identity', 'income', 'collateral_property'
  label            text not null,
  help_text        text,
  doc_type         text not null,    -- PAN | AADHAAR | SALARY_SLIP | RC_BOOK | ...
  is_required      boolean not null default true,
  applies_to_collateral collateral_type[],   -- NULL = applies to all collateral types
  max_files        int not null default 1,
  sort_order       int not null default 10,
  -- UI hints for the upload step
  input_kind       text not null default 'FILE',  -- FILE | TEXT | NUMBER | SELECT | DATE
  input_options    jsonb,           -- for SELECT: {"options":["a","b"]}
  created_at       timestamptz not null default now(),

  unique (product_id, part, section_key)
);

comment on table document_requirements is
  'Drives the multi-step application form. Admin can add/remove checklist items without a code deploy.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. APPLICATIONS
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists applications (
  id                uuid primary key default gen_random_uuid(),
  reference_no      text not null unique,
  user_id           uuid not null references profiles(id) on delete cascade,
  product_id        uuid not null references loan_products(id),
  requested_amount  numeric(14,2) not null check (requested_amount > 0),
  tenure_months     int  not null,
  purpose           text,
  status            app_status not null default 'DRAFT',
  current_part      app_part,
  completed_parts   app_part[] not null default '{}',

  -- Workflow
  assigned_officer_id uuid references profiles(id),
  submitted_at      timestamptz,
  sla_due_at        timestamptz,           -- computed from product SLA at submission
  review_started_at  timestamptz,
  decided_at        timestamptz,
  decision_reason   text,
  decision_notes    text,

  -- Underwriting snapshot (frozen at decision time for auditability)
  offered_rate      numeric(5,2),
  approved_amount   numeric(14,2),
  emi_amount        numeric(12,2),
  computed_foir     numeric(6,2),
  assigned_account_number text,

  resubmission_count int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_applications_user    on applications(user_id);
create index if not exists idx_applications_status  on applications(status);
create index if not exists idx_applications_officer on applications(assigned_officer_id);

create table if not exists application_documents (
  id               uuid primary key default gen_random_uuid(),
  application_id   uuid not null references applications(id) on delete cascade,
  requirement_id   uuid references document_requirements(id) on delete set null,
  part             app_part not null,
  section_key      text not null,
  doc_type         text not null,
  -- Either a file upload or a typed value, depending on requirement.input_kind
  file_path        text,
  file_url         text,
  file_name        text,
  text_value       text,
  status           doc_status not null default 'PENDING',
  rejection_reason text,
  -- GAP: employee decides which fields the user may edit on resubmission
  is_locked        boolean not null default false,
  uploaded_at      timestamptz,
  reviewed_by      uuid references profiles(id),
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_app_docs_application on application_documents(application_id);

create table if not exists application_collateral (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  type           collateral_type not null,
  -- Shape varies by type (gold: grams/purity; property: area/title/valuation…)
  details        jsonb not null default '{}'::jsonb,
  estimated_value numeric(14,2),
  verified_at    timestamptz,
  created_at     timestamptz not null default now()
);

-- Co-applicant / guarantor — this is GAP 3, the industry-standard replacement
-- for "collateral verification" on unsecured loans.
create table if not exists application_coapplicants (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  relationship   text not null,   -- SPOUSE | PARENT | SIBLING | FRIEND | BUSINESS_PARTNER
  full_name      text not null,
  dob            date,
  pan            text,
  monthly_income numeric(12,2),
  employer       text,
  consent_signed boolean not null default false,
  consent_signed_at timestamptz,
  consent_ip     text,
  verified_at    timestamptz,
  created_at     timestamptz not null default now()
);

create table if not exists tc_acknowledgements (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  user_id        uuid not null references profiles(id),
  tc_version     text not null,
  accepted_at    timestamptz not null default now(),
  ip_address     text,
  user_agent     text,
  unique (application_id, tc_version)
);

create table if not exists resubmission_requests (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  requested_by   uuid not null references profiles(id),
  -- Exactly which checklist items the user is allowed to correct
  allowed_documents uuid[] not null default '{}',
  reason         text not null,
  status         text not null default 'OPEN',  -- OPEN | RESOLVED | CANCELLED
  requested_at   timestamptz not null default now(),
  resolved_at    timestamptz
);

create table if not exists application_events (
  id             bigint generated always as identity primary key,
  application_id uuid not null references applications(id) on delete cascade,
  actor_id       uuid references profiles(id),
  actor_role     user_role,
  from_status    app_status,
  to_status      app_status,
  event_type     text not null,
  message        text,
  meta           jsonb default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists idx_app_events_app on application_events(application_id, created_at desc);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. LOANS & SERVICING
--    All interest is REDUCING BALANCE (GAP 8).
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists loans (
  id                uuid primary key default gen_random_uuid(),
  application_id    uuid not null unique references applications(id),
  user_id           uuid not null references profiles(id),
  account_number    text not null unique,
  product_id        uuid not null references loan_products(id),

  principal         numeric(14,2) not null,
  annual_rate       numeric(5,2)  not null,
  tenure_months     int  not null,
  emi_amount        numeric(12,2) not null,
  interest_method   text not null default 'REDUCING_BALANCE',

  outstanding_principal numeric(14,2) not null,
  total_interest    numeric(14,2) not null,
  total_payable     numeric(14,2) not null,
  total_paid        numeric(14,2) default 0,

  status            loan_status not null default 'ACTIVE',
  disbursement_txn_id  text,
  disbursed_at      timestamptz,
  start_date        date,
  end_date          date,

  sanction_letter_path text,
  agreement_signed_at timestamptz,

  closed_at         timestamptz,
  noc_issued_at     timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_loans_user   on loans(user_id);
create index if not exists idx_loans_status on loans(status);

create table if not exists emi_schedule (
  id             uuid primary key default gen_random_uuid(),
  loan_id        uuid not null references loans(id) on delete cascade,
  installment_no int  not null,
  due_date       date not null,
  principal_part numeric(12,2) not null,
  interest_part  numeric(12,2) not null,
  amount_due     numeric(12,2) not null,
  -- Penalty is computed when the grace window lapses, not at generation time
  penalty_amount numeric(12,2) not null default 0,
  paid_amount    numeric(12,2) not null default 0,
  status         emi_status not null default 'UPCOMING',
  is_prepayment  boolean not null default false,
  days_past_due  int not null default 0,
  paid_at        timestamptz,
  unique (loan_id, installment_no)
);

create index if not exists idx_emi_loan_due on emi_schedule(loan_id, due_date);
create index if not exists idx_emi_overdue on emi_schedule(status) where status = 'OVERDUE';

create table if not exists payments (
  id             uuid primary key default gen_random_uuid(),
  loan_id        uuid not null references loans(id) on delete cascade,
  emi_id         uuid references emi_schedule(id) on delete set null,
  receipt_no     text not null unique,
  amount         numeric(12,2) not null,
  penalty_amount numeric(12,2) not null default 0,
  mode           payment_mode not null default 'UPI',
  gateway        text not null default 'MOCK',
  gateway_ref    text,
  txn_id         text,
  txn_date       timestamptz not null default now(),
  status         payment_status not null default 'SUCCESS',
  bounce_charge  numeric(10,2) not null default 0,
  failure_reason text,
  is_prepayment  boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists idx_payments_loan on payments(loan_id, txn_date desc);

create table if not exists ebills (
  id           uuid primary key default gen_random_uuid(),
  loan_id      uuid not null references loans(id) on delete cascade,
  emi_id       uuid references emi_schedule(id) on delete cascade,
  bill_no      text not null unique,
  period_from  date not null,
  period_to    date not null,
  amount       numeric(12,2) not null,
  pdf_path     text,
  generated_at timestamptz not null default now()
);

create table if not exists noc_requests (
  id             uuid primary key default gen_random_uuid(),
  loan_id        uuid not null references loans(id) on delete cascade,
  user_id        uuid not null references profiles(id),
  account_number text not null,
  status         noc_status not null default 'PENDING',
  requested_at   timestamptz not null default now(),
  reviewed_by    uuid references profiles(id),
  reviewed_at    timestamptz,
  decision_note  text,
  pdf_path       text,
  unique (loan_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. COMMUNICATION
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists tickets (
  id             uuid primary key default gen_random_uuid(),
  ticket_no      text not null unique,
  user_id        uuid not null references profiles(id) on delete cascade,
  loan_id        uuid references loans(id) on delete set null,
  application_id uuid references applications(id) on delete set null,
  conversation_id uuid,
  subject        text not null,
  description    text not null,
  category       text not null default 'GENERAL',  -- GENERAL | PAYMENT | TECHNICAL | DOCUMENT
  priority       ticket_priority not null default 'MEDIUM',
  status         ticket_status not null default 'OPEN',
  assigned_to    uuid references profiles(id),
  resolution     text,
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz
);

create index if not exists idx_tickets_user on tickets(user_id, created_at desc);

create table if not exists chat_conversations (
  id             uuid primary key default gen_random_uuid(),
  reference_no   text not null unique,
  user_id        uuid not null references profiles(id) on delete cascade,
  application_id uuid references applications(id) on delete set null,
  loan_id        uuid references loans(id) on delete set null,
  ticket_id      uuid references tickets(id) on delete set null,
  assigned_officer_id uuid references profiles(id),
  subject        text,
  status         conv_status not null default 'OPEN',
  last_message_at timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists idx_conv_user on chat_conversations(user_id, last_message_at desc);
create index if not exists idx_conv_officer on chat_conversations(assigned_officer_id, status);

create table if not exists chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  sender_id       uuid references profiles(id),
  sender_role     user_role not null,
  body            text not null,
  attachment_path text,
  created_at      timestamptz not null default now(),
  read_at         timestamptz
);

create index if not exists idx_chat_msgs_conv on chat_messages(conversation_id, created_at);

create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  type       notif_type not null default 'SYSTEM',
  title      text not null,
  body       text,
  link       text,
  meta       jsonb default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notif_user on notifications(user_id, created_at desc);
create index if not exists idx_notif_unread on notifications(user_id) where read_at is null;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. RISK & COMPLIANCE
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists cibil_checks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  pan         text not null,
  score       int not null check (score between 300 and 900),
  band        cibil_band not null,
  provider    text not null default 'MOCK',
  factors     jsonb default '{}'::jsonb,   -- payment history, credit utilisation, …
  raw_response jsonb,                      -- full provider payload, for audit
  expires_at  timestamptz not null,        -- score is only valid for a window
  created_at  timestamptz not null default now()
);

create index if not exists idx_cibil_user on cibil_checks(user_id, created_at desc);

-- 3-month cooling-off after a rejection (source doc lines 123-125)
create table if not exists cooling_periods (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles(id) on delete cascade,
  category       loan_category not null,
  application_id uuid references applications(id) on delete set null,
  reason         text,
  starts_at      timestamptz not null default now(),
  expires_at     timestamptz not null,
  cleared_at     timestamptz,
  notified_at    timestamptz,
  constraint cooling_period_positive check (expires_at > starts_at)
);

create index if not exists idx_cooling_active on cooling_periods(user_id, category) where cleared_at is null;

create table if not exists audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references profiles(id),
  actor_role  user_role,
  action      audit_action not null,
  entity_type text not null,
  entity_id   uuid,
  summary     text,
  meta        jsonb default '{}'::jsonb,
  ip_address  text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_entity on audit_logs(entity_type, entity_id, created_at desc);
create index if not exists idx_audit_actor  on audit_logs(actor_id, created_at desc);

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. ROW LEVEL SECURITY
--    This is the security boundary for all three portals.
-- ═══════════════════════════════════════════════════════════════════════════

-- helper: the caller's role, looked up from their own profile
create or replace function public.current_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role() in ('EMPLOYEE', 'ADMIN'), false)
$$;

-- profiles: you can always read and update yourself; staff can read all
alter table profiles           enable row level security;
alter table addresses          enable row level security;
alter table liabilities        enable row level security;
alter table loan_products      enable row level security;
alter table document_requirements enable row level security;
alter table applications       enable row level security;
alter table application_documents enable row level security;
alter table application_collateral  enable row level security;
alter table application_coapplicants enable row level security;
alter table tc_acknowledgements enable row level security;
alter table resubmission_requests enable row level security;
alter table application_events enable row level security;
alter table loans              enable row level security;
alter table emi_schedule       enable row level security;
alter table payments           enable row level security;
alter table ebills             enable row level security;
alter table noc_requests       enable row level security;
alter table tickets            enable row level security;
alter table chat_conversations enable row level security;
alter table chat_messages      enable row level security;
alter table notifications      enable row level security;
alter table cibil_checks       enable row level security;
alter table cooling_periods    enable row level security;
alter table audit_logs         enable row level security;

alter table employees          enable row level security;

-- ── profiles ──
drop policy if exists profiles_select_self on profiles;
create policy profiles_select_self on profiles for select
  using (id = auth.uid() or public.is_staff());

drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_insert_self on profiles;
create policy profiles_insert_self on profiles for insert
  with check (id = auth.uid());

-- ── catalog: world-readable (needed to render the product catalogue pre-login-ish) ──
drop policy if exists products_read on loan_products;
create policy products_read on loan_products for select using (true);

drop policy if exists docreq_read on document_requirements;
create policy docreq_read on document_requirements for select using (true);

-- ── addresses / liabilities: owner only ──
drop policy if exists addresses_owner on addresses;
create policy addresses_owner on addresses for all
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid());

drop policy if exists liabilities_owner on liabilities;
create policy liabilities_owner on liabilities for all
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid());

-- ── applications ──
drop policy if exists applications_owner on applications;
create policy applications_owner on applications for select
  using (user_id = auth.uid()
         or assigned_officer_id = auth.uid()
         or public.current_role() = 'ADMIN');

drop policy if exists applications_insert on applications;
create policy applications_insert on applications for insert
  with check (user_id = auth.uid());

drop policy if exists applications_update_owner on applications;
create policy applications_update_owner on applications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists applications_update_staff on applications;
create policy applications_update_staff on applications for update
  using (public.is_staff());

-- ── supporting application tables ──
drop policy if exists app_docs_policy on application_documents;
create policy app_docs_policy on application_documents for all
  using (exists (select 1 from applications a
                 where a.id = application_id
                   and (a.user_id = auth.uid() or a.assigned_officer_id = auth.uid()
                        or public.current_role() = 'ADMIN')))
  with check (exists (select 1 from applications a
                      where a.id = application_id
                        and (a.user_id = auth.uid() or public.current_role() = 'ADMIN')));

drop policy if exists app_collateral_policy on application_collateral;
create policy app_collateral_policy on application_collateral for all
  using (exists (select 1 from applications a
                 where a.id = application_id
                   and (a.user_id = auth.uid() or public.is_staff())))
  with check (exists (select 1 from applications a
                      where a.id = application_id
                        and (a.user_id = auth.uid() or public.current_role() = 'ADMIN')));

drop policy if exists app_coapp_policy on application_coapplicants;
create policy app_coapp_policy on application_coapplicants for all
  using (exists (select 1 from applications a
                 where a.id = application_id and (a.user_id = auth.uid() or public.is_staff())))
  with check (exists (select 1 from applications a
                      where a.id = application_id
                        and (a.user_id = auth.uid() or public.current_role() = 'ADMIN')));

drop policy if exists tc_ack_policy on tc_acknowledgements;
create policy tc_ack_policy on tc_acknowledgements for insert
  with check (user_id = auth.uid());
drop policy if exists tc_ack_select on tc_acknowledgements;
create policy tc_ack_select on tc_acknowledgements for select
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists resub_policy on resubmission_requests;
create policy resub_policy on resubmission_requests for select
  using (exists (select 1 from applications a
                 where a.id = application_id and (a.user_id = auth.uid() or public.is_staff())));

drop policy if exists events_policy on application_events;
create policy events_policy on application_events for select
  using (exists (select 1 from applications a
                 where a.id = application_id
                   and (a.user_id = auth.uid() or a.assigned_officer_id = auth.uid()
                        or public.current_role() = 'ADMIN')));
drop policy if exists events_insert on application_events;
create policy events_insert on application_events for insert
  with check (public.is_staff() or actor_id = auth.uid());

-- ── loans / servicing: borrower or assigned officer or admin ──
drop policy if exists loans_policy on loans;
create policy loans_policy on loans for select
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists emi_policy on emi_schedule;
create policy emi_policy on emi_schedule for select
  using (exists (select 1 from loans l
                 where l.id = loan_id and (l.user_id = auth.uid() or public.is_staff())));

drop policy if exists payments_policy on payments;
create policy payments_policy on payments for select
  using (exists (select 1 from loans l
                 where l.id = loan_id and (l.user_id = auth.uid() or public.is_staff())));

drop policy if exists ebills_policy on ebills;
create policy ebills_policy on ebills for select
  using (exists (select 1 from loans l
                 where l.id = loan_id and (l.user_id = auth.uid() or public.is_staff())));

drop policy if exists noc_policy on noc_requests;
create policy noc_policy on noc_requests for all
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid() or public.is_staff());

-- ── communication ──
drop policy if exists tickets_policy on tickets;
create policy tickets_policy on tickets for select
  using (user_id = auth.uid() or assigned_to = auth.uid() or public.current_role() = 'ADMIN');

drop policy if exists tickets_insert on tickets;
create policy tickets_insert on tickets for insert with check (user_id = auth.uid());

drop policy if exists tickets_update_staff on tickets;
create policy tickets_update_staff on tickets for update using (public.is_staff());

drop policy if exists conv_policy on chat_conversations;
create policy conv_policy on chat_conversations for select
  using (user_id = auth.uid() or assigned_officer_id = auth.uid()
         or public.current_role() = 'ADMIN');

drop policy if exists conv_insert on chat_conversations;
create policy conv_insert on chat_conversations for insert
  with check (user_id = auth.uid() or public.is_staff());

drop policy if exists conv_update on chat_conversations;
create policy conv_update on chat_conversations for update
  using (user_id = auth.uid() or assigned_officer_id = auth.uid() or public.is_staff());

drop policy if exists chat_msgs_policy on chat_messages;
create policy chat_msgs_policy on chat_messages for select
  using (exists (select 1 from chat_conversations c
                 where c.id = conversation_id
                   and (c.user_id = auth.uid() or c.assigned_officer_id = auth.uid()
                        or public.current_role() = 'ADMIN')));

drop policy if exists chat_msgs_insert on chat_messages;
create policy chat_msgs_insert on chat_messages for insert
  with check (exists (select 1 from chat_conversations c
                      where c.id = conversation_id
                        and (c.user_id = auth.uid() or c.assigned_officer_id = auth.uid()
                             or public.is_staff())));

-- ── notifications ──
drop policy if exists notif_policy on notifications;
create policy notif_policy on notifications for select using (user_id = auth.uid());

drop policy if exists notif_update on notifications;
create policy notif_update on notifications for update using (user_id = auth.uid());

-- ── risk ──
drop policy if exists cibil_policy on cibil_checks;
create policy cibil_policy on cibil_checks for select
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists cooling_policy on cooling_periods;
create policy cooling_policy on cooling_periods for select
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists audit_select on audit_logs;
create policy audit_select on audit_logs for select
  using (public.current_role() = 'ADMIN');

-- ── employees: staff directory read for staff; admin writes ──
drop policy if exists employees_read on employees;
create policy employees_read on employees for select using (public.is_staff());

drop policy if exists employees_admin_write on employees;
create policy employees_admin_write on employees for all
  using (public.current_role() = 'ADMIN') with check (public.current_role() = 'ADMIN');

-- Staff-only tables get no anon policy at all → default deny.

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. REALTIME
--    Tables whose changes should push to the browser live.
--
--    Adding a table to a publication twice raises
--    `ERROR: table "x" is already member of publication "y"`, so each add is
--    guarded on pg_publication_tables.
-- ═══════════════════════════════════════════════════════════════════════════
do $realtime$
declare
  t text;
begin
  foreach t in array array['notifications', 'applications', 'chat_messages',
                           'emi_schedule', 'tickets']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$realtime$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. UTILITIES
-- ═══════════════════════════════════════════════════════════════════════════

-- Handle new signups: create a profile row automatically.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name',
             new.raw_user_meta_data ->> 'name',
             split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'phone',
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'USER')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles','loan_products','applications',
                           'application_documents','loans']
  loop
    execute format(
      'drop trigger if exists set_updated_at_%s on %I;', t, t);
    execute format(
      'create trigger set_updated_at_%s before update on %I
       for each row execute function public.touch_updated_at();', t, t);
  end loop;
end $$;

-- EMI calculator (reducing balance). Mirrors lib/emi.ts exactly.
create or replace function public.calculate_emi(
  p_principal numeric, p_annual_rate numeric, p_months int
) returns numeric language plpgsql immutable as $$
declare
  v_r numeric := p_annual_rate / 1200.0;
  v_emi numeric;
begin
  if p_months <= 0 then return 0; end if;
  if v_r = 0 then return round(p_principal / p_months, 2); end if;
  v_emi := p_principal * v_r * power(1 + v_r, p_months)
           / (power(1 + v_r, p_months) - 1);
  return round(v_emi, 2);
end;
$$;

-- Next reference number, e.g. APP-2026-000123
create or replace function public.next_reference(p_prefix text, p_table text)
returns text language plpgsql volatile as $$
declare v_count bigint; v_year int := extract(year from now())::int;
begin
  execute format('select count(*) from %I', p_table) into v_count;
  return format('%s-%s-%s', p_prefix, v_year, lpad((v_count + 1)::text, 6, '0'));
end;
$$;