-- ═══════════════════════════════════════════════════════════════════════════
-- SAFARLOAN — Demo data seed
--
-- Creates one realistic dataset covering every state the UI must render:
--   • 3 staff (2 officers with different authority limits, 1 admin)
--   • 6 customers across income bands, one with a CIBIL pull
--   • 9 loan products (5 secured, 4 unsecured) with document checklists
--   • 10 applications across every status, including a resubmission request
--   • 3 live loans with real amortisation schedules, payments, overdue EMIs
--   • chats, tickets, notifications, cooling periods
--
-- Run AFTER 0001_core_schema.sql.
-- WARNING: truncates application data. Fine for a prototype, destructive otherwise.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Reset ─────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['chat_messages','chat_conversations','tickets',
                           'noc_requests','ebills','payments','emi_schedule',
                           'loans','resubmission_requests','tc_acknowledgements',
                           'application_coapplicants','application_collateral',
                           'application_documents','application_events',
                           'applications','document_requirements','loan_products',
                           'liabilities','cibil_checks','cooling_periods',
                           'notifications','addresses','employees','audit_logs']
  loop
    execute format('truncate table %I cascade', t);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Run AFTER the auth users exist:  npm run db:users
--
-- Every insert below is guarded by `where exists (...)` or `on conflict do
-- nothing`, so re-running this is safe and will not error or duplicate.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Stable IDs so the seed is idempotent and easy to reason about ─────────
-- ─── Stable IDs ──────────────────────────────────────────────────────────────
-- Declared as literals rather than variables. Each INSERT below is an
-- independent top-level statement, so a truncated paste costs one statement
-- instead of the entire file, and there is no dollar quoting to get wrong.
--
--   staff
--     admin      11111111-1111-4111-8111-111111111111
--     manager    22222222-2222-4222-8222-222222222222
--     officer    33333333-3333-4333-8333-333333333333
--     officer2   44444444-4444-4444-8444-444444444444
--
--   customers
--     rahul      55555555-5555-4555-8555-555555555555
--     priya      66666666-6666-4666-8666-666666666666
--     arjun      77777777-7777-4777-8777-777777777777
--     meera      88888888-8888-4888-8888-888888888888
--     sanjay     99999999-9999-4999-8999-999999999999
--     kavya      aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
--
--   products (…0001 home, 0002 vehicle, 0003 gold, 0004 LAP, 0005 personal,
--              0006 education, 0007 business, 0008 card, 0009 working capital)


-- ─── Staff and customer accounts ───────────────────────────────────────────
-- `npm run db:users` creates the auth.users rows, and the handle_new_user
-- trigger has ALREADY inserted a profiles row for each one (status ACTIVE).
--
-- So this must be an UPSERT, not `on conflict do nothing` — otherwise kavya
-- would stay ACTIVE and the blocked-account path would never be reachable.

insert into profiles (id, email, full_name, phone, role, status, pan, aadhaar_last4)
values
  ('11111111-1111-4111-8111-111111111111',  'admin@demo.in',    'Vikram Desai',  '9820010001', 'ADMIN',    'ACTIVE', 'ABCDE1234F', '1234'),
  ('22222222-2222-4222-8222-222222222222','manager@demo.in', 'Anita Sharma',  '9820010002', 'EMPLOYEE', 'ACTIVE', 'BCDEF2345G', '2345'),
  ('33333333-3333-4333-8333-333333333333','officer@demo.in', 'Ramesh Iyer',   '9820010003', 'EMPLOYEE', 'ACTIVE', 'CDEFG3456H', '3456'),
  ('44444444-4444-4444-8444-444444444444','officer2@demo.in','Sneha Patel',  '9820010004', 'EMPLOYEE', 'ACTIVE', 'DEFGH4567J', '4567'),
  ('55555555-5555-4555-8555-555555555555',  'rahul@demo.in',   'Rahul Sharma',  '9876543210', 'USER',     'ACTIVE', 'FGHIJ5678K', '5678'),
  ('66666666-6666-4666-8666-666666666666',  'priya@demo.in',   'Priya Nair',    '9876543211', 'USER',     'ACTIVE', 'GHIJK6789L', '6789'),
  ('77777777-7777-4777-8777-777777777777',  'arjun@demo.in',   'Arjun Mehta',   '9876543212', 'USER',     'ACTIVE', 'HIJKL7890M', '7890'),
  ('88888888-8888-4888-8888-888888888888',  'meera@demo.in',   'Meera Reddy',   '9876543213', 'USER',     'ACTIVE', 'IJKLM8901N', '8901'),
  ('99999999-9999-4999-8999-999999999999', 'sanjay@demo.in',  'Sanjay Kumar',  '9876543214', 'USER',     'ACTIVE', 'JKLMN9012O', '9012'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',  'kavya@demo.in',   'Kavya Joshi',   '9876543215', 'USER',     'BLOCKED','LMNOP0123P', '0123')
on conflict (id) do update
  set email        = excluded.email,
      full_name    = excluded.full_name,
      phone        = excluded.phone,
      role         = excluded.role,
      status       = excluded.status,
      pan          = excluded.pan,
      aadhaar_last4 = excluded.aadhaar_last4;

-- Applicant financial profile
update profiles set
  monthly_income = 185000, employment_type = 'SALARIED', employer = 'Infosys Technologies',
  job_tenure_years = 7.5
where id = '55555555-5555-4555-8555-555555555555';
update profiles set
  monthly_income = 92000, employment_type = 'SALARIED', employer = 'TCS',
  job_tenure_years = 3.2
where id = '66666666-6666-4666-8666-666666666666';
update profiles set
  monthly_income = 340000, employment_type = 'BUSINESS', employer = 'Mehta Textiles',
  job_tenure_years = 11
where id = '77777777-7777-4777-8777-777777777777';
update profiles set
  monthly_income = 55000, employment_type = 'SELF_EMPLOYED', employer = 'Freelance design',
  job_tenure_years = 2.0
where id = '88888888-8888-4888-8888-888888888888';
update profiles set
  monthly_income = 145000, employment_type = 'SALARIED', employer = 'Wipro',
  job_tenure_years = 5.5
where id = '99999999-9999-4999-8999-999999999999';

-- ─── Employee authority matrix (GAP 2 & 7) ────────────────────────────────
insert into employees (user_id, employee_code, employee_role, approval_limit, territory, specialities)
values
  ('11111111-1111-4111-8111-111111111111',   'ADM-001', 'MANAGER', 50000000, 'Head Office', '{SECURED,UNSECURED}'),
  -- GAP 2 & 7: officers have a personal sanctioning limit. Anything above it
  -- escalates to a MANAGER, which in turn escalates to ADMIN.
  ('22222222-2222-4222-8222-222222222222', 'MGR-001', 'MANAGER', 50000000, 'Head Office', '{SECURED,UNSECURED}'),
  ('33333333-3333-4333-8333-333333333333', 'OFF-001', 'OFFICER',  1000000, 'South Mumbai', '{SECURED,UNSECURED}'),
  ('44444444-4444-4444-8444-444444444444','OFF-002', 'OFFICER',  2500000, 'Thane',        '{SECURED}')
on conflict (user_id) do nothing;

-- ─── Addresses ─────────────────────────────────────────────────────────────
insert into addresses (user_id, label, line1, city, state, pincode, is_primary)
values
  ('55555555-5555-4555-8555-555555555555',  'Home', '402, Sea Breeze Apartments, Carter Road', 'Mumbai',    'Maharashtra', '400050', true),
  ('66666666-6666-4666-8666-666666666666',  'Home', 'B-12, Green Meadows, Baner',                'Pune',      'Maharashtra', '411045', true),
  ('77777777-7777-4777-8777-777777777777',  'Office','Shop 7, Cloth Market, Ring Road',           'Surat',     'Gujarat',     '395002', true),
  ('88888888-8888-4888-8888-888888888888',  'Home', '18, Shivaji Nagar, Aundh',                  'Pune',      'Maharashtra', '411007', true),
  ('99999999-9999-4999-8999-999999999999', 'Home', 'C-9, Lake View, Powai',                     'Mumbai',    'Maharashtra', '400076', true);

-- ─── Existing liabilities (drives FOIR) ───────────────────────────────────
insert into liabilities (user_id, lender, liability_type, monthly_amount, outstanding)
values
  ('55555555-5555-4555-8555-555555555555',  'HDFC Bank',        'CREDIT_CARD',  8400,  62000),
  ('55555555-5555-4555-8555-555555555555',  'Bajaj Finserv',    'EMI',          14500, 340000),
  ('66666666-6666-4666-8666-666666666666',  'ICICI Bank',       'EMI',          9500,  210000),
  ('99999999-9999-4999-8999-999999999999', 'Axis Bank',        'CREDIT_CARD',  6200,  38000);

-- ─── Loan products (GAP 4, 6, 9, 10) ─────────────────────────────────────
insert into loan_products (
  id, code, name, description, category, collateral_type,
  min_amount, max_amount, min_tenure_months, max_tenure_months,
  min_rate, max_rate, min_monthly_income, min_cibil, max_foir,
  requires_coapplicant, processing_fee_pct,
  grace_days, late_fee_flat, late_fee_pct,
  sla_min_days, sla_max_days, thumbnail_emoji, sort_order, is_active)
values
  ('10000000-0000-4000-8000-000000000001', 'HOME_L', 'Home Loan',
   'Finance your home purchase with a loan secured against the property.',
   'SECURED', 'PROPERTY', 500000, 10000000, 60, 360, 8.60, 9.90,
   75000, 720, 45, false, 1.00, 5, 500, 2.00, 3, 7, '🏠', 10, true),

  ('10000000-0000-4000-8000-000000000002', 'VEH_L', 'Vehicle Loan',
   'New or used car and two-wheeler finance, secured against the vehicle.',
   'SECURED', 'VEHICLE', 100000, 2500000, 12, 84, 9.25, 12.50,
   40000, 700, 50, false, 2.00, 5, 500, 2.00, 2, 5, '🚗', 20, true),

  ('10000000-0000-4000-8000-000000000003', 'GOLD_L', 'Gold Loan',
   'Quick liquidity against your gold holdings. No income proof needed.',
   'SECURED', 'GOLD', 25000, 2500000, 3, 36, 10.75, 14.00,
   null, 650, 60, false, 1.00, 3, 300, 1.50, 1, 3, '💛', 30, true),

  ('10000000-0000-4000-8000-000000000004', 'LAP', 'Loan Against Property',
   'Unlock the value of a property you already own without selling it.',
   'SECURED', 'PROPERTY', 500000, 7500000, 36, 240, 9.10, 11.50,
   60000, 700, 50, false, 1.50, 5, 500, 2.00, 3, 7, '🏢', 40, true),

  ('10000000-0000-4000-8000-000000000005', 'PERSONAL', 'Personal Loan',
   'Unsecured funds for medical needs, travel or debt consolidation.',
   'UNSECURED', 'NONE', 50000, 1000000, 12, 72, 12.50, 18.00,
   30000, 700, 50, false, 3.00, 5, 500, 2.00, 2, 5, '💼', 110, true),

  ('10000000-0000-4000-8000-000000000006', 'EDU_L', 'Education Loan',
   'Fees and living costs for higher studies in India or abroad.',
   'UNSECURED', 'NONE', 100000, 4000000, 24, 120, 9.90, 13.50,
   25000, 680, 45, true, 1.50, 7, 500, 2.00, 4, 10, '🎓', 120, true),

  ('10000000-0000-4000-8000-000000000007', 'BUSINESS_L', 'Business Loan',
   'Term loan for expansion, equipment and working capital needs.',
   'UNSECURED', 'NONE', 200000, 3000000, 12, 60, 13.20, 18.00,
   60000, 700, 55, false, 2.50, 5, 750, 2.50, 4, 8, '🏪', 130, true),

  ('10000000-0000-4000-8000-000000000008', 'CARD_L', 'Credit Card Loan',
   'Transfer an outstanding card balance to a longer-tenure loan.',
   'UNSECURED', 'NONE', 20000, 500000, 6, 48, 15.00, 22.00,
   25000, 680, 45, false, 3.50, 5, 500, 3.00, 2, 5, '💳', 140, true),

  ('10000000-0000-4000-8000-000000000009', 'WC_L', 'Working Capital Loan',
   'A revolving limit for day-to-day operations and inventory.',
   'UNSECURED', 'NONE', 100000, 2500000, 12, 48, 12.80, 17.00,
   50000, 700, 55, false, 2.00, 5, 750, 2.50, 3, 7, '🏭', 150, true);

-- ═══ Document checklists ═══════════════════════════════════════════════════
-- The multi-step wizard renders itself from these rows.
-- Part A is the same for every applicant; Part B varies by collateral.

-- PART A — identity / residence / income / banking / credit / liability
insert into document_requirements
 (product_id, part, section_key, label, help_text, doc_type, is_required, sort_order, input_kind)
select p.id, 'A', v.section_key, v.label, v.help, v.doc_type, v.required, v.sort, 'FILE'
from loan_products p
cross join (values
  ('identity_pan',    'PAN card',                 'Scanned copy of your PAN',        'PAN',         true,  10),
  ('identity_aadhaar','Aadhaar card',             'Front and back, or e-Aadhaar',    'AADHAAR',     true,  20),
  ('identity_photo',  'Passport photograph',       'Recent, clear background',        'PHOTO',       true,  30),
  ('residence_proof', 'Address proof',             'Aadhaar, utility bill or rent agreement', 'ADDRESS_PROOF', true, 40),
  ('income_salary',   'Salary slips',              'Last 3 months',                   'SALARY_SLIP', true,  50),
  ('income_itr',      'Income tax return',         'Last 2 years, optional',          'ITR',         false, 60),
  ('bank_statement',  'Bank statements',           'Last 6 months with transaction detail', 'BANK_STATEMENT', true, 70),
  ('credit_consent',  'Credit bureau consent',     'Authorises a CIBIL enquiry',      'CONSENT',     true,  80),
  ('liability_declaration', 'Existing obligations', 'List current EMIs and card dues', 'DECLARATION', true,  90)
) as v(section_key, label, help, doc_type, required, sort)
where true;

-- PART B — collateral specific. `applies_to_collateral` filters the wizard.
insert into document_requirements
 (product_id, part, section_key, label, help_text, doc_type, is_required,
  applies_to_collateral, sort_order, input_kind)
values
  -- PROPERTY
  ('10000000-0000-4000-8000-000000000001', 'B', 'prop_title',   'Title deed / ownership proof', 'Sale deed or chain of documents', 'TITLE_DEED', true, '{PROPERTY}', 10, 'FILE'),
  ('10000000-0000-4000-8000-000000000001', 'B', 'prop_ec',      'Encumbrance certificate',      'Proves the property is free of legal claims', 'EC', true, '{PROPERTY}', 20, 'FILE'),
  ('10000000-0000-4000-8000-000000000001', 'B', 'prop_tax',     'Property tax receipts',        'Last 3 years paid', 'TAX_RECEIPT', true, '{PROPERTY}', 30, 'FILE'),
  ('10000000-0000-4000-8000-000000000001', 'B', 'prop_plan',    'Approved building plan',       'Sanctioned by the authority', 'BLD_PLAN', true, '{PROPERTY}', 40, 'FILE'),
  ('10000000-0000-4000-8000-000000000001', 'B', 'prop_estate',  'Valuation report',             'Market value assessment', 'VALUATION', true, '{PROPERTY}', 50, 'FILE'),
  ('10000000-0000-4000-8000-000000000004',  'B', 'prop_title',   'Title deed / ownership proof', 'Sale deed or chain of documents', 'TITLE_DEED', true, '{PROPERTY}', 10, 'FILE'),
  ('10000000-0000-4000-8000-000000000004',  'B', 'prop_ec',      'Encumbrance certificate',      'Proves the property is free of legal claims', 'EC', true, '{PROPERTY}', 20, 'FILE'),
  ('10000000-0000-4000-8000-000000000004',  'B', 'prop_tax',     'Property tax receipts',        'Last 3 years paid', 'TAX_RECEIPT', true, '{PROPERTY}', 30, 'FILE'),
  ('10000000-0000-4000-8000-000000000004',  'B', 'prop_valuation','Valuation report',             'Market value assessment', 'VALUATION', true, '{PROPERTY}', 40, 'FILE'),

  -- VEHICLE
  ('10000000-0000-4000-8000-000000000002', 'B', 'veh_rc',       'RC book',            'Registration certificate', 'RC', true, '{VEHICLE}', 10, 'FILE'),
  ('10000000-0000-4000-8000-000000000002', 'B', 'veh_insurance','Insurance policy',   'Comprehensive cover', 'INSURANCE', true, '{VEHICLE}', 20, 'FILE'),
  ('10000000-0000-4000-8000-000000000002', 'B', 'veh_valuation','Valuation report',   'Condition assessment', 'VALUATION', true, '{VEHICLE}', 30, 'FILE'),
  ('10000000-0000-4000-8000-000000000002', 'B', 'veh_hypo',     'Hypothecation form', 'Authorises the lender to register a lien', 'HYPOTHECATION', true, '{VEHICLE}', 40, 'FILE'),
  ('10000000-0000-4000-8000-000000000002', 'B', 'veh_invoice',  'Purchase invoice',   'Proves the price paid', 'INVOICE', false, '{VEHICLE}', 50, 'FILE'),

  -- GOLD
  ('10000000-0000-4000-8000-000000000003', 'B', 'gold_receipt', 'Gold purchase invoice', 'Proves ownership of the ornaments', 'INVOICE', true, '{GOLD}', 10, 'FILE'),
  ('10000000-0000-4000-8000-000000000003', 'B', 'gold_purity',  'Purity certificate',   'Hallmark / BIS stamp', 'PURITY', true, '{GOLD}', 20, 'FILE'),
  ('10000000-0000-4000-8000-000000000003', 'B', 'gold_weight',  'Weight in grams',      'Net weight of the pledged gold', 'WEIGHT', true, '{GOLD}', 30, 'NUMBER'),
  ('10000000-0000-4000-8000-000000000003', 'B', 'gold_valuation','Valuation certificate','As on date of pledge', 'VALUATION', true, '{GOLD}', 40, 'FILE'),

  -- FINANCIAL
  ('10000000-0000-4000-8000-000000000001', 'B', 'fin_fd',      'Fixed deposit receipt', 'In the name of the borrower', 'FD_RECEIPT', false, '{FINANCIAL}', 50, 'FILE'),
  ('10000000-0000-4000-8000-000000000001', 'B', 'fin_demat',   'Demat holding statement', 'Share portfolio', 'DEMAT', false, '{FINANCIAL}', 60, 'FILE'),
  ('10000000-0000-4000-8000-000000000001', 'B', 'fin_lien',    'Lien / pledge authorisation', 'Consent to hold the asset', 'LIEN_AUTH', false, '{FINANCIAL}', 70, 'FILE');

-- PART C — differs by category (see the source doc's structure)
insert into document_requirements
 (product_id, part, section_key, label, help_text, doc_type, is_required, sort_order, input_kind, input_options)
select p.id, 'C', 'tc_acceptance', 'Terms and conditions',
       'Read and accept the lending terms for this product',
       'TC', true, 10, 'CHECKBOX', null
from loan_products p;

insert into document_requirements
 (product_id, part, section_key, label, help_text, doc_type, is_required, sort_order, input_kind, input_options)
select p.id, 'C', 'applicant_consent', 'Applicant consent form',
       'Signature and consent for verification checks',
       'CONSENT_FORM', true, 20, 'FILE', null
from loan_products p;

-- Collateral-specific consent for secured products
insert into document_requirements
 (product_id, part, section_key, label, help_text, doc_type, is_required,
  applies_to_collateral, sort_order, input_kind)
values
  ('10000000-0000-4000-8000-000000000001', 'C', 'collateral_consent', 'Collateral acknowledgement form',
   'Confirms you understand the asset is pledged', 'COLLATERAL_ACK', true, '{PROPERTY}', 30, 'FILE'),
  ('10000000-0000-4000-8000-000000000002','C','collateral_consent','Collateral acknowledgement form',
   'Confirms you understand the asset is pledged', 'COLLATERAL_ACK', true, '{VEHICLE}', 30, 'FILE'),
  ('10000000-0000-4000-8000-000000000003',   'C', 'collateral_consent','Collateral acknowledgement form',
   'Confirms you understand the asset is pledged', 'COLLATERAL_ACK', true, '{GOLD}', 30, 'FILE'),
  ('10000000-0000-4000-8000-000000000004',    'C', 'collateral_consent','Collateral acknowledgement form',
   'Confirms you understand the asset is pledged', 'COLLATERAL_ACK', true, '{PROPERTY}', 30, 'FILE');

-- ─── CIBIL check for one applicant so the dashboard card has data ─────────
insert into cibil_checks (user_id, pan, score, band, provider, factors, expires_at)
values ('55555555-5555-4555-8555-555555555555', 'FGHIJ5678K', 782, 'GOOD', 'MOCK',
  '{"paymentHistory": 94, "creditUtilisation": 28, "accountAgeYears": 9, "hardQueries": 2}'::jsonb,
  now() + interval '30 days');

-- ═══ APPLICATIONS ══════════════════════════════════════════════════════════
-- 10 applications covering every status the UI must render.

-- 1. Rahul — APPROVED home loan, disbursed (has a live loan row)
insert into applications (
  id, reference_no, user_id, product_id, requested_amount, tenure_months, purpose,
  status, completed_parts, assigned_officer_id, submitted_at, sla_due_at,
  review_started_at, decided_at, offered_rate, approved_amount, emi_amount,
  computed_foir, assigned_account_number, created_at)
values (
  '20000000-0000-4000-8000-000000000001', 'APP-2026-000001', '55555555-5555-4555-8555-555555555555', '10000000-0000-4000-8000-000000000001',
  4500000, 240, 'Purchase a 3BHK in Khar West',
  'APPROVED', '{A,B,C}', '33333333-3333-4333-8333-333333333333',
  now() - interval '120 days', now() - interval '116 days',
  now() - interval '119 days', now() - interval '113 days',
  8.75, 4500000, 35322, 24.6, 'LN2026000001234', now() - interval '120 days');

-- 2. Rahul — UNDER_REVIEW personal loan (second application)
insert into applications (
  id, reference_no, user_id, product_id, requested_amount, tenure_months, purpose,
  status, current_part, completed_parts, assigned_officer_id, submitted_at,
  sla_due_at, review_started_at, created_at)
values (
  '20000000-0000-4000-8000-000000000002', 'APP-2026-000002', '55555555-5555-4555-8555-555555555555', '10000000-0000-4000-8000-000000000005',
  500000, 48, 'Medical expenses for a family member',
  'UNDER_REVIEW', 'B', '{A}', '33333333-3333-4333-8333-333333333333',
  now() - interval '2 days', now() + interval '3 days',
  now() - interval '1 day', now() - interval '2 days');

-- 3. Priya — RESUBMISSION_REQUESTED (this is the "fix your documents" flow)
insert into applications (
  id, reference_no, user_id, product_id, requested_amount, tenure_months, purpose,
  status, current_part, completed_parts, assigned_officer_id, submitted_at,
  sla_due_at, review_started_at, resubmission_count, created_at)
values (
  '20000000-0000-4000-8000-000000000003', 'APP-2026-000003', '66666666-6666-4666-8666-666666666666', '10000000-0000-4000-8000-000000000006',
  1200000, 84, 'MBA at Symbiosis, Pune',
  'RESUBMISSION_REQUESTED', 'A', '{A}', '22222222-2222-4222-8222-222222222222',
  now() - interval '6 days', now() + interval '4 days',
  now() - interval '5 days', 1, now() - interval '7 days');

-- 4. Arjun — APPROVED working capital, disbursed
insert into applications (
  id, reference_no, user_id, product_id, requested_amount, tenure_months, purpose,
  status, completed_parts, assigned_officer_id, submitted_at, sla_due_at,
  review_started_at, decided_at, offered_rate, approved_amount, emi_amount,
  computed_foir, assigned_account_number, created_at)
values (
  '20000000-0000-4000-8000-000000000004', 'APP-2026-000004', '77777777-7777-4777-8777-777777777777', '10000000-0000-4000-8000-000000000009',
  1500000, 36, 'Inventory for the textile business',
  'APPROVED', '{A,B,C}', '44444444-4444-4444-8444-444444444444',
  now() - interval '200 days', now() - interval '196 days',
  now() - interval '199 days', now() - interval '192 days',
  13.80, 1500000, 52794, 18.2, 'LN2026000005678', now() - interval '200 days');

-- 5. Arjun — SUBMITTED gold loan (fresh, assigned, awaiting officer)
insert into applications (
  id, reference_no, user_id, product_id, requested_amount, tenure_months, purpose,
  status, current_part, completed_parts, assigned_officer_id, submitted_at,
  sla_due_at, created_at)
values (
  '20000000-0000-4000-8000-000000000005', 'APP-2026-000005', '77777777-7777-4777-8777-777777777777', '10000000-0000-4000-8000-000000000003',
  400000, 18, 'Working capital against family gold',
  'SUBMITTED', 'A', '{A,B,C}', '44444444-4444-4444-8444-444444444444',
  now() - interval '6 hours', now() + interval '2 days', now() - interval '8 hours');

-- 6. Meera — REJECTED (triggers the 90-day cooling period)
insert into applications (
  id, reference_no, user_id, product_id, requested_amount, tenure_months, purpose,
  status, completed_parts, assigned_officer_id, submitted_at, sla_due_at,
  review_started_at, decided_at, decision_reason, created_at)
values (
  '20000000-0000-4000-8000-000000000006', 'APP-2026-000006', '88888888-8888-4888-8888-888888888888', '10000000-0000-4000-8000-000000000005',
  300000, 36, 'Debt consolidation',
  'REJECTED', '{A,B,C}', '33333333-3333-4333-8333-333333333333',
  now() - interval '20 days', now() - interval '17 days',
  now() - interval '19 days', now() - interval '18 days',
  'FOIR of 68% exceeds the 50% limit for this product. Existing obligations must be reduced before reapplying.',
  now() - interval '21 days');

-- 7. Sanjay — APPROVED vehicle loan, disbursed (has an OVERDUE EMI)
insert into applications (
  id, reference_no, user_id, product_id, requested_amount, tenure_months, purpose,
  status, completed_parts, assigned_officer_id, submitted_at, sla_due_at,
  review_started_at, decided_at, offered_rate, approved_amount, emi_amount,
  computed_foir, assigned_account_number, created_at)
values (
  '20000000-0000-4000-8000-000000000007', 'APP-2026-000007', '99999999-9999-4999-8999-999999999999', '10000000-0000-4000-8000-000000000002',
  650000, 60, 'New car purchase',
  'APPROVED', '{A,B,C}', '33333333-3333-4333-8333-333333333333',
  now() - interval '90 days', now() - interval '87 days',
  now() - interval '89 days', now() - interval '85 days',
  10.25, 650000, 13759, 14.8, 'LN2026000009012', now() - interval '90 days');

-- 8. Sanjay — DRAFT (started but not submitted)
insert into applications (
  id, reference_no, user_id, product_id, requested_amount, tenure_months, purpose,
  status, current_part, completed_parts, created_at)
values (
  '20000000-0000-4000-8000-000000000008', 'APP-2026-000008', '99999999-9999-4999-8999-999999999999', '10000000-0000-4000-8000-000000000004',
  2000000, 120, 'Funds against the Thane flat',
  'DRAFT', 'A', '{}', now() - interval '1 day');

-- 9. Priya — SUBMITTED vehicle loan (second officer's queue)
insert into applications (
  id, reference_no, user_id, product_id, requested_amount, tenure_months, purpose,
  status, current_part, completed_parts, assigned_officer_id, submitted_at,
  sla_due_at, created_at)
values (
  '20000000-0000-4000-8000-000000000009', 'APP-2026-000009', '66666666-6666-4666-8666-666666666666', '10000000-0000-4000-8000-000000000002',
  350000, 48, 'Second-hand car',
  'SUBMITTED', 'C', '{A,B,C}', '44444444-4444-4444-8444-444444444444',
  now() - interval '1 day', now() + interval '4 days', now() - interval '1 day');

-- 10. Rahul — REJECTED older, already cooled down (lets us show a cleared period)
insert into applications (
  id, reference_no, user_id, product_id, requested_amount, tenure_months, purpose,
  status, completed_parts, assigned_officer_id, submitted_at, sla_due_at,
  review_started_at, decided_at, decision_reason, created_at)
values (
  '20000000-0000-4000-8000-000000000010', 'APP-2026-000010', '55555555-5555-4555-8555-555555555555', '10000000-0000-4000-8000-000000000008',
  200000, 24, 'Balance transfer',
  'REJECTED', '{A,B,C}', '33333333-3333-4333-8333-333333333333',
  now() - interval '200 days', now() - interval '197 days',
  now() - interval '199 days', now() - interval '198 days',
  'Credit utilisation of 91% indicates an unhealthy revolving balance.',
  now() - interval '201 days');

-- 12. Priya — an older APPROVED personal loan, now fully repaid with an NOC
--     requested but still awaiting officer approval. Backs the "pending NOC"
--     state on the employee queue.
insert into applications (
  id, reference_no, user_id, product_id, requested_amount, tenure_months, purpose,
  status, completed_parts, assigned_officer_id, submitted_at, sla_due_at,
  review_started_at, decided_at, decision_notes, offered_rate, approved_amount,
  emi_amount, computed_foir, assigned_account_number, created_at)
values (
  '20000000-0000-4000-8000-000000000012', 'APP-2025-000012', '66666666-6666-4666-8666-666666666666', '10000000-0000-4000-8000-000000000005',
  150000, 24, 'Medical expenses',
  'APPROVED', '{A,B,C}', '22222222-2222-4222-8222-222222222222',
  now() - interval '406 days', now() - interval '401 days',
  now() - interval '405 days', now() - interval '402 days',
  'Salary verified against bank credits. Within officer authority.',
  12.50, 150000, 7096.10, 18.9, 'LN2026000004455',
  now() - interval '407 days');

-- 11. Meera — an older APPROVED education loan, now fully repaid with an
--     issued NOC. Exists so the closure flow has real history behind it,
--     and so her loan row has an application of its own to point at
--     (a loan cannot hang off a REJECTED or in-progress application).
insert into applications (
  id, reference_no, user_id, product_id, requested_amount, tenure_months, purpose,
  status, completed_parts, assigned_officer_id, submitted_at, sla_due_at,
  review_started_at, decided_at, decision_notes, offered_rate, approved_amount,
  emi_amount, computed_foir, assigned_account_number, created_at)
values (
  '20000000-0000-4000-8000-000000000011', 'APP-2025-000011', '88888888-8888-4888-8888-888888888888', '10000000-0000-4000-8000-000000000006',
  400000, 24, 'Postgraduate certification, design course',
  'APPROVED', '{A,B,C}', '22222222-2222-4222-8222-222222222222',
  now() - interval '806 days', now() - interval '800 days',
  now() - interval '805 days', now() - interval '798 days',
  'Verified freelancer invoices and a guarantor. Sanctioned within authority.',
  9.90, 400000, 18438.40, 16.4, 'LN2025000003344',
  now() - interval '807 days');

-- ─── Document rows + verification state ───────────────────────────────────
-- Enough to make the checklist and the officer review screen meaningful.
insert into application_documents
 (application_id, part, section_key, doc_type, file_name, file_path, status, is_locked, uploaded_at, reviewed_at)
values
  ('20000000-0000-4000-8000-000000000001','A','identity_pan',   'PAN','PAN_Rahul.pdf',   'seed/pan-rahul.pdf',   'VERIFIED', true,  now() - interval '120 days', now() - interval '119 days'),
  ('20000000-0000-4000-8000-000000000001','A','identity_aadhaar','AADHAAR','Aadhaar_Rahul.pdf','seed/aadhaar-rahul.pdf','VERIFIED', true,  now() - interval '120 days', now() - interval '119 days'),
  ('20000000-0000-4000-8000-000000000001','A','identity_photo',  'PHOTO','Photo_Rahul.jpg', 'seed/photo-rahul.jpg',  'VERIFIED', true,  now() - interval '120 days', now() - interval '119 days'),
  ('20000000-0000-4000-8000-000000000001','A','residence_proof','ADDRESS_PROOF','Address_Rahul.pdf','seed/addr-rahul.pdf','VERIFIED', true, now() - interval '120 days', now() - interval '119 days'),
  ('20000000-0000-4000-8000-000000000001','A','income_salary',   'SALARY_SLIP','Salary_3m.pdf','seed/salary-rahul.pdf','VERIFIED', true, now() - interval '120 days', now() - interval '119 days'),
  ('20000000-0000-4000-8000-000000000001','A','bank_statement',  'BANK_STATEMENT','Bank_6m.pdf','seed/bank-rahul.pdf','VERIFIED', true, now() - interval '120 days', now() - interval '119 days'),
  ('20000000-0000-4000-8000-000000000001','A','credit_consent',  'CONSENT','Consent.pdf','seed/consent-rahul.pdf','VERIFIED', true, now() - interval '120 days', now() - interval '119 days'),
  ('20000000-0000-4000-8000-000000000001','B','prop_title',      'TITLE_DEED','Title.pdf','seed/title.pdf','VERIFIED', true, now() - interval '120 days', now() - interval '117 days'),
  ('20000000-0000-4000-8000-000000000001','B','prop_ec',         'EC','Encumbrance.pdf','seed/ec.pdf','VERIFIED', true, now() - interval '120 days', now() - interval '117 days'),
  ('20000000-0000-4000-8000-000000000001','B','prop_tax',        'TAX_RECEIPT','Tax_3y.pdf','seed/tax.pdf','VERIFIED', true, now() - interval '120 days', now() - interval '117 days'),
  ('20000000-0000-4000-8000-000000000001','B','prop_plan',       'BLD_PLAN','Plan.pdf','seed/plan.pdf','VERIFIED', true, now() - interval '120 days', now() - interval '117 days'),
  ('20000000-0000-4000-8000-000000000001','C','tc_acceptance',   'TC',null,null,'VERIFIED', true, now() - interval '120 days', now() - interval '113 days'),

  -- Priya's resubmission: two documents flagged as needing correction
  ('20000000-0000-4000-8000-000000000003','A','identity_aadhaar','AADHAAR','Aadhaar_blurry.jpg','seed/aadhaar-blurry.jpg','REJECTED', false, now() - interval '6 days', now() - interval '1 day'),
  ('20000000-0000-4000-8000-000000000003','A','income_salary',   'SALARY_SLIP','Salary_old.pdf','seed/salary-old.pdf','REJECTED', false, now() - interval '6 days', now() - interval '1 day'),
  ('20000000-0000-4000-8000-000000000003','A','identity_pan',    'PAN','PAN_Priya.pdf','seed/pan-priya.pdf','VERIFIED', true, now() - interval '6 days', now() - interval '1 day'),
  ('20000000-0000-4000-8000-000000000003','A','residence_proof', 'ADDRESS_PROOF','Address_Priya.pdf','seed/addr-priya.pdf','VERIFIED', true, now() - interval '6 days', now() - interval '1 day'),
  ('20000000-0000-4000-8000-000000000003','A','bank_statement',  'BANK_STATEMENT','Bank_Priya.pdf','seed/bank-priya.pdf','VERIFIED', true, now() - interval '6 days', now() - interval '1 day'),

  -- Rahul's live personal loan — mid review, one doc still pending
  ('20000000-0000-4000-8000-000000000002','A','identity_pan',    'PAN','PAN_Rahul.pdf','seed/pan-rahul.pdf','VERIFIED', true, now() - interval '2 days', now() - interval '1 day'),
  ('20000000-0000-4000-8000-000000000002','A','identity_aadhaar','AADHAAR','Aadhaar_Rahul.pdf','seed/aadhaar-rahul.pdf','VERIFIED', true, now() - interval '2 days', now() - interval '1 day'),
  ('20000000-0000-4000-8000-000000000002','A','residence_proof', 'ADDRESS_PROOF','Address_Rahul.pdf','seed/addr-rahul.pdf','VERIFIED', true, now() - interval '2 days', now() - interval '1 day'),
  ('20000000-0000-4000-8000-000000000002','A','income_salary',   'SALARY_SLIP','Salary_3m.pdf','seed/salary-rahul.pdf','PENDING', true, now() - interval '2 days', null),
  ('20000000-0000-4000-8000-000000000002','A','bank_statement',  'BANK_STATEMENT','Bank_6m.pdf','seed/bank-rahul.pdf','PENDING', true, now() - interval '2 days', null),

  -- Sanjay's vehicle loan
  ('20000000-0000-4000-8000-000000000007','A','identity_pan',    'PAN','PAN_Sanjay.pdf','seed/pan-sanjay.pdf','VERIFIED', true, now() - interval '90 days', now() - interval '88 days'),
  ('20000000-0000-4000-8000-000000000007','A','identity_aadhaar','AADHAAR','Aadhaar_Sanjay.pdf','seed/aadhaar-sanjay.pdf','VERIFIED', true, now() - interval '90 days', now() - interval '88 days'),
  ('20000000-0000-4000-8000-000000000007','B','veh_rc',          'RC','RC_book.pdf','seed/rc.pdf','VERIFIED', true, now() - interval '90 days', now() - interval '87 days'),
  ('20000000-0000-4000-8000-000000000007','B','veh_insurance',   'INSURANCE','Policy.pdf','seed/policy.pdf','VERIFIED', true, now() - interval '90 days', now() - interval '87 days'),
  ('20000000-0000-4000-8000-000000000007','B','veh_valuation',   'VALUATION','Valuation.pdf','seed/valuation.pdf','VERIFIED', true, now() - interval '90 days', now() - interval '87 days'),
  ('20000000-0000-4000-8000-000000000007','B','veh_hypo',        'HYPOTHECATION','Hypo.pdf','seed/hypo.pdf','VERIFIED', true, now() - interval '90 days', now() - interval '87 days'),

  -- Arjun's working capital loan
  ('20000000-0000-4000-8000-000000000004','A','identity_pan',    'PAN','PAN_Arjun.pdf','seed/pan-arjun.pdf','VERIFIED', true, now() - interval '200 days', now() - interval '198 days'),
  ('20000000-0000-4000-8000-000000000004','A','income_itr',      'ITR','ITR_2y.pdf','seed/itr-arjun.pdf','VERIFIED', true, now() - interval '200 days', now() - interval '198 days'),
  ('20000000-0000-4000-8000-000000000004','A','bank_statement',  'BANK_STATEMENT','Bank_Arjun.pdf','seed/bank-arjun.pdf','VERIFIED', true, now() - interval '200 days', now() - interval '198 days'),

  -- Arjun's fresh gold loan, all uploaded, awaiting officer
  ('20000000-0000-4000-8000-000000000005','A','identity_pan',    'PAN','PAN_Arjun.pdf','seed/pan-arjun.pdf','VERIFIED', true, now() - interval '8 hours', null),
  ('20000000-0000-4000-8000-000000000005','A','identity_aadhaar','AADHAAR','Aadhaar_Arjun.pdf','seed/aadhaar-arjun.pdf','VERIFIED', true, now() - interval '8 hours', null),
  ('20000000-0000-4000-8000-000000000005','B','gold_receipt',    'INVOICE','Gold_invoice.pdf','seed/gold-invoice.pdf','PENDING', true, now() - interval '7 hours', null),
  ('20000000-0000-4000-8000-000000000005','B','gold_purity',     'PURITY','Purity.pdf','seed/purity.pdf','PENDING', true, now() - interval '7 hours', null),
  ('20000000-0000-4000-8000-000000000005','B','gold_weight',     'WEIGHT',null,null,'PENDING', true, now() - interval '7 hours', null),

  -- Priya's vehicle loan, submitted today
  ('20000000-0000-4000-8000-000000000009','A','identity_pan',    'PAN','PAN_Priya.pdf','seed/pan-priya.pdf','VERIFIED', true, now() - interval '1 day', null),
  ('20000000-0000-4000-8000-000000000009','B','veh_rc',          'RC','RC_Priya.pdf','seed/rc-priya.pdf','PENDING', true, now() - interval '22 hours', null);

-- Rejection reasons on the two docs Priya must fix
update application_documents set rejection_reason = 'Image is too blurry to read the Aadhaar number. Please re-upload a clearer scan, both sides.'
where application_id = '20000000-0000-4000-8000-000000000003' and section_key = 'identity_aadhaar';

update application_documents set rejection_reason = 'These salary slips are from over 12 months ago. Please upload the most recent 3 months.'
where application_id = '20000000-0000-4000-8000-000000000003' and section_key = 'income_salary';

-- ─── Resubmission request: the employee names exactly which docs may change ─
insert into resubmission_requests (id, application_id, requested_by, allowed_documents, reason, status, requested_at)
values (
  '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222',
  '{}'::uuid[],
  'Two documents need to be corrected before I can proceed:

1. Aadhaar — the scan is too blurry to read the number clearly. Please re-upload both sides.
2. Salary slips — the ones provided are over a year old. I need the most recent 3 months.

Everything else is verified and does not need to change.',
  'OPEN', now() - interval '1 day');

-- Mark the two offending docs as editable by the user
update application_documents set is_locked = false
where application_id = '20000000-0000-4000-8000-000000000003'
  and section_key in ('identity_aadhaar', 'income_salary');

-- ─── T&C acknowledgements ─────────────────────────────────────────────────
insert into tc_acknowledgements (application_id, user_id, tc_version)
values
  ('20000000-0000-4000-8000-000000000001', '55555555-5555-4555-8555-555555555555',  'v1.2'),
  ('20000000-0000-4000-8000-000000000003', '66666666-6666-4666-8666-666666666666',  'v1.2'),
  ('20000000-0000-4000-8000-000000000004', '77777777-7777-4777-8777-777777777777',  'v1.2'),
  ('20000000-0000-4000-8000-000000000007', '99999999-9999-4999-8999-999999999999', 'v1.2'),
  ('20000000-0000-4000-8000-000000000011', '88888888-8888-4888-8888-888888888888', 'v1.2'),
  ('20000000-0000-4000-8000-000000000012', '66666666-6666-4666-8666-666666666666', 'v1.2');

-- ─── Event timeline ───────────────────────────────────────────────────────
insert into application_events
 (application_id, actor_id, actor_role, from_status, to_status, event_type, message, created_at)
values
  ('20000000-0000-4000-8000-000000000001', '55555555-5555-4555-8555-555555555555',   'USER',     'DRAFT', 'SUBMITTED', 'SUBMITTED',      'Application submitted',                                  now() - interval '120 days'),
  ('20000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'EMPLOYEE', 'SUBMITTED','UNDER_REVIEW','OFFICER_ASSIGNED','Assigned to Ramesh Iyer',                 now() - interval '119 days'),
  ('20000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'EMPLOYEE', 'UNDER_REVIEW','UNDER_REVIEW','DOC_VERIFIED','21 documents verified',                        now() - interval '115 days'),
  ('20000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'EMPLOYEE', 'UNDER_REVIEW','APPROVED','APPROVED','Sanctioned at 8.75% — within officer authority',              now() - interval '113 days'),

  ('20000000-0000-4000-8000-000000000002', '55555555-5555-4555-8555-555555555555',   'USER',     'DRAFT', 'SUBMITTED', 'SUBMITTED',      'Application submitted',                                  now() - interval '2 days'),
  ('20000000-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333', 'EMPLOYEE', 'SUBMITTED','UNDER_REVIEW','REVIEW_STARTED','Review started',                                      now() - interval '1 day'),

  ('20000000-0000-4000-8000-000000000003', '66666666-6666-4666-8666-666666666666',    'USER',     'DRAFT', 'SUBMITTED', 'SUBMITTED',      'Application submitted',                                  now() - interval '6 days'),
  ('20000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'EMPLOYEE', 'SUBMITTED','RESUBMISSION_REQUESTED','RESUBMISSION_REQUESTED','2 documents need correction',                 now() - interval '1 day'),

  ('20000000-0000-4000-8000-000000000005', '77777777-7777-4777-8777-777777777777',   'USER',     'DRAFT', 'SUBMITTED', 'SUBMITTED',      'Application submitted',                                  now() - interval '6 hours'),

  ('20000000-0000-4000-8000-000000000006', '33333333-3333-4333-8333-333333333333', 'EMPLOYEE', 'UNDER_REVIEW','REJECTED','REJECTED','FOIR at 68% exceeds the 50% limit',                        now() - interval '18 days'),

  ('20000000-0000-4000-8000-000000000007', '33333333-3333-4333-8333-333333333333', 'EMPLOYEE', 'UNDER_REVIEW','APPROVED','APPROVED','Sanctioned at 10.25%',                                    now() - interval '85 days'),

  ('20000000-0000-4000-8000-000000000009', '66666666-6666-4666-8666-666666666666',    'USER',     'DRAFT', 'SUBMITTED', 'SUBMITTED',      'Application submitted',                                  now() - interval '1 day'),

  ('20000000-0000-4000-8000-000000000010', '33333333-3333-4333-8333-333333333333', 'EMPLOYEE', 'UNDER_REVIEW','REJECTED','REJECTED','Credit utilisation too high at 91%',                          now() - interval '198 days'),

  -- Meera's closed education loan
  ('20000000-0000-4000-8000-000000000011', '88888888-8888-4888-8888-888888888888',   'USER',     'DRAFT', 'SUBMITTED', 'SUBMITTED',      'Application submitted',                                  now() - interval '806 days'),
  ('20000000-0000-4000-8000-000000000011', '22222222-2222-4222-8222-222222222222', 'EMPLOYEE', 'SUBMITTED','APPROVED',   'APPROVED',       'Sanctioned at 9.90%',                                     now() - interval '798 days'),
  ('20000000-0000-4000-8000-000000000011', '88888888-8888-4888-8888-888888888888',   'EMPLOYEE', 'APPROVED',  'APPROVED',   'NOC_ISSUED',      'All 24 instalments cleared. NOC issued.',                  now() - interval '65 days'),

  -- Priya's closed personal loan, NOC still awaiting approval
  ('20000000-0000-4000-8000-000000000012', '66666666-6666-4666-8666-666666666666',   'USER',     'DRAFT', 'SUBMITTED', 'SUBMITTED',      'Application submitted',                                  now() - interval '406 days'),
  ('20000000-0000-4000-8000-000000000012', '22222222-2222-4222-8222-222222222222', 'EMPLOYEE', 'SUBMITTED','APPROVED',   'APPROVED',       'Sanctioned at 12.50%',                                    now() - interval '402 days'),
  ('20000000-0000-4000-8000-000000000012', '66666666-6666-4666-8666-666666666666',   'USER',     'APPROVED',  'APPROVED',   'NOC_REQUESTED',  'Borrower claimed NOC — awaiting officer approval',       now() - interval '2 days');

-- ─── Cooling period for Meera (GAP: 90-day block after rejection) ─────────
insert into cooling_periods (user_id, category, application_id, reason, starts_at, expires_at)
values ('88888888-8888-4888-8888-888888888888', 'UNSECURED', '20000000-0000-4000-8000-000000000006',
        'Application declined — FOIR 68% above the 50% limit',
        now() - interval '18 days', now() + interval '72 days');

-- ═══ LOANS ════════════════════════════════════════════════════════════════
-- 5 loans with full amortisation schedules generated in SQL so the EMI tables
-- are populated without needing the app running.
--
-- EMI, total_interest and total_payable are computed values, not estimates —
-- `npm run db:verify` recomputes them and fails if a loan row disagrees with
-- its own schedule. Figures below come from the same reducing-balance formula
-- the app uses (lib/finance/emi.ts).

-- 1. Rahul — home loan, active, 8/240 paid
insert into loans (
  id, application_id, user_id, account_number, product_id,
  principal, annual_rate, tenure_months, emi_amount,
  outstanding_principal, total_interest, total_payable, total_paid,
  status, disbursement_txn_id, disbursed_at, start_date, end_date, created_at)
values (
  '40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '55555555-5555-4555-8555-555555555555',
  'LN2026000001234', '10000000-0000-4000-8000-000000000001', 4500000, 8.75, 240, 39766.98,
  4500000, 5044075.20, 9544075.20, 0,
  'ACTIVE', 'TXN8X2K9M4P', now() - interval '119 days',
  current_date - interval '119 days', current_date + interval '481 days',
  now() - interval '119 days');

-- 2. Arjun — working capital, active, 12/36 paid
insert into loans (
  id, application_id, user_id, account_number, product_id,
  principal, annual_rate, tenure_months, emi_amount,
  outstanding_principal, total_interest, total_payable, total_paid,
  status, disbursement_txn_id, disbursed_at, start_date, end_date, created_at)
values (
  '40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000004', '77777777-7777-4777-8777-777777777777',
  'LN2026000005678', '10000000-0000-4000-8000-000000000009', 1500000, 13.80, 36, 51120.86,
  1500000, 340350.96, 1840350.96, 0,
  'ACTIVE', 'TXN3B7N1Q8R', now() - interval '191 days',
  current_date - interval '191 days', current_date + interval '1096 days',
  now() - interval '191 days');

-- 3. Sanjay — vehicle loan, active, 14/60 paid, 1 OVERDUE EMI
insert into loans (
  id, application_id, user_id, account_number, product_id,
  principal, annual_rate, tenure_months, emi_amount,
  outstanding_principal, total_interest, total_payable, total_paid,
  status, disbursement_txn_id, disbursed_at, start_date, end_date, created_at)
values (
  '40000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000007', '99999999-9999-4999-8999-999999999999',
  'LN2026000009012', '10000000-0000-4000-8000-000000000002', 650000, 10.25, 60, 13890.67,
  650000, 183440.20, 833440.20, 0,
  'ACTIVE', 'TXN6C4L2W7Y', now() - interval '84 days',
  current_date - interval '84 days', current_date + interval '1816 days',
  now() - interval '84 days');

-- 4. Meera — fully repaid education loan, NOC already issued.
--    Dates are internally consistent: disbursed 800 days ago, 24 monthly
--    instalments, so the final one fell ~70 days ago and the loan closed then.
insert into loans (
  id, application_id, user_id, account_number, product_id,
  principal, annual_rate, tenure_months, emi_amount,
  outstanding_principal, total_interest, total_payable, total_paid,
  status, disbursement_txn_id, disbursed_at, start_date, end_date,
  closed_at, noc_issued_at, created_at)
select
  '40000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000011', '88888888-8888-4888-8888-888888888888',
  'LN2025000003344', '10000000-0000-4000-8000-000000000006', 400000, 9.90, 24, 18439.51,
  0, 42548.24, 442548.24, 442548.24,
  'NOC_ISSUED', 'TXN1Z5H8J3K', now() - interval '800 days',
  (now() - interval '800 days')::date, (now() - interval '70 days')::date,
  now() - interval '68 days', now() - interval '65 days', now() - interval '800 days'
where exists (select 1 from profiles where id = '88888888-8888-4888-8888-888888888888');

-- 5. Priya — fully repaid personal loan, NOC requested but NOT yet approved.
--    This is the one that gives the employee NOC queue something to action:
--    until an officer approves it, her download stays locked.
insert into loans (
  id, application_id, user_id, account_number, product_id,
  principal, annual_rate, tenure_months, emi_amount,
  outstanding_principal, total_interest, total_payable, total_paid,
  status, disbursement_txn_id, disbursed_at, start_date, end_date,
  closed_at, created_at)
select
  '40000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000012', '66666666-6666-4666-8666-666666666666',
  'LN2026000004455', '10000000-0000-4000-8000-000000000005', 150000, 12.50, 24, 7096.10,
  0, 20306.40, 170306.40, 170306.40,
  'CLOSED', 'TXN9J2M5Q1Z', now() - interval '400 days',
  (now() - interval '400 days')::date, (now() - interval '330 days')::date,
  now() - interval '328 days', now() - interval '400 days'
where exists (select 1 from profiles where id = '66666666-6666-4666-8666-666666666666');

-- ─── EMI schedules ────────────────────────────────────────────────────────
-- Set-based: one INSERT driven by generate_series, using the closed-form
-- amortisation balance instead of a procedural loop.
--
--   opening(i) = P(1+r)^(i-1) − EMI·((1+r)^(i-1) − 1) / r
--   interest(i) = opening(i) · r
--   principal(i) = EMI − interest(i)        (final instalment takes the balance)
--
-- Deliberately NOT a CREATE FUNCTION. Two reasons:
--   1. This script is wrapped in a dollar-quoted DO block, so a nested
--      function body would need a different tag or it closes the block early.
--   2. A pg_temp schema may not exist yet in a fresh SQL Editor session.
--
-- NOTE: never write the dollar-quote sequence literally inside this file's
-- body, not even in a comment. Inside a dollar-quoted string there is no
-- comment parsing — the parser stops at the first closing tag it finds.

insert into emi_schedule (
  loan_id, installment_no, due_date, principal_part, interest_part,
  amount_due, penalty_amount, paid_amount, status, days_past_due, paid_at
)
with plan(loan_id, paid_through, overdue_at) as (
  -- Which instalments are settled, and which one is late.
  -- Loans 4 and 5 are fully repaid (all instalments paid) — they back the
  -- closure / NOC flows.
  values
    ('40000000-0000-4000-8000-000000000001'::uuid,   8, null::int),
    ('40000000-0000-4000-8000-000000000002'::uuid,  12, null::int),
    ('40000000-0000-4000-8000-000000000003'::uuid,  14, 15::int),
    ('40000000-0000-4000-8000-000000000004'::uuid,  24, null::int),
    ('40000000-0000-4000-8000-000000000005'::uuid,  24, null::int)
),
params as (
  -- Take principal / rate / tenure / start_date from the loan row itself, so
  -- the schedule can never disagree with the loan it belongs to.
  select pl.loan_id, pl.paid_through, pl.overdue_at,
         l.principal, l.annual_rate, l.tenure_months as months, l.start_date
  from plan pl
  join loans l on l.id = pl.loan_id
),
series as (
  select p.*, i as n
  from params p
  cross join generate_series(1, p.months) as i
),
calc as (
  select
    s.*,
    s.annual_rate / 1200.0 as r,
    -- EMI, guarding the zero-interest case
    case when s.annual_rate = 0 then s.principal / s.months
         else s.principal * (s.annual_rate / 1200.0)
              * power(1 + s.annual_rate / 1200.0, s.months)
              / (power(1 + s.annual_rate / 1200.0, s.months) - 1)
    end as emi
  from series s
),
with_balances as (
  select
    c.*,
    case
      when c.annual_rate = 0 then c.principal - c.emi * (c.n - 1)
      else c.principal * power(1 + c.r, c.n - 1)
           - c.emi * (power(1 + c.r, c.n - 1) - 1) / c.r
    end as opening
  from calc c
),
parts as (
  select
    w.*,
    round(w.opening * w.r, 2) as interest_part,
    case when w.n = w.months
         then round(w.opening, 2)
         else round(w.emi - (w.opening * w.r), 2)
    end as principal_part
  from with_balances w
),
dates as (
  -- Instalment i is due one month after disbursal, then monthly.
  select p.*, (p.start_date + (p.n || ' months')::interval)::date as due
  from parts p
)
select
  d.loan_id,
  d.n,
  d.due as due_date,
  d.principal_part,
  d.interest_part,
  round(d.principal_part + d.interest_part, 2) as amount_due,
  case when d.n = d.overdue_at then 500.00 else 0 end as penalty_amount,
  case when d.n <= d.paid_through
       then round(d.principal_part + d.interest_part, 2) else 0 end as paid_amount,
  case
    when d.n <= d.paid_through then 'PAID'::emi_status
    when d.n = d.overdue_at then 'OVERDUE'::emi_status
    else 'UPCOMING'::emi_status
  end as status,
  case when d.n = d.overdue_at then 12 else 0 end as days_past_due,
  -- Paid two days before the due date
  case when d.n <= d.paid_through
       then (d.start_date + (d.n || ' months')::interval) - interval '2 days'
  end as paid_at
from dates d;

-- ─── Payments for the paid instalments ────────────────────────────────────
-- Two details that only show up against a real database:
--
--  1. The array literal needs an explicit cast: without it Postgres infers
--     text[] and the expression lands as `text`, which will not implicitly
--     convert to the `payment_mode` enum.
--  2. receipt_no is UNIQUE across the table, so it must identify the loan.
--     Date + instalment number is NOT enough: instalment 1 of three different
--     loans settles on the same day and produced three identical numbers.
--     Deriving it from the account number matches how real receipts are built,
--     and the account number is unique by constraint.
insert into payments (loan_id, emi_id, receipt_no, amount, mode, gateway, gateway_ref, txn_id, txn_date, status)
select
  e.loan_id, e.id,
  'RCP-' || right(l.account_number, 9)
        || '-' || to_char(e.paid_at, 'YYMMDD')
        || '-' || lpad(e.installment_no::text, 4, '0'),
  e.paid_amount,
  (array['UPI','NEFT','CARD']::payment_mode[])[1 + (e.installment_no % 3)],
  'MOCK', 'PG' || substr(md5(e.id::text), 1, 10),
  'TXN' || substr(md5((e.id::text || 'tx')), 1, 12),
  e.paid_at, 'SUCCESS'::payment_status
from emi_schedule e
join loans l on l.id = e.loan_id
where e.status = 'PAID';

-- One bounced payment so the history page can show a bounce charge
update payments set
  status = 'BOUNCED',
  bounce_charge = 500,
  failure_reason = 'Insufficient funds in the linked bank account',
  amount = 0
where loan_id = '40000000-0000-4000-8000-000000000003'
  and txn_date = (select min(txn_date) from payments where loan_id = '40000000-0000-4000-8000-000000000003');

-- The EMI that bounced goes back to outstanding, and the next one is overdue
update emi_schedule set status = 'UPCOMING', paid_amount = 0, paid_at = null, penalty_amount = 0
where loan_id = '40000000-0000-4000-8000-000000000003' and installment_no = 10;

-- ─── e-Bills for the next instalment of each active loan ───────────────────
-- bill_no is UNIQUE, so it needs the loan in it for the same reason
-- receipt_no does: two loans can have the same next instalment number.
insert into ebills (loan_id, emi_id, bill_no, period_from, period_to, amount)
select
  e.loan_id, e.id,
  'BILL-' || right(l.account_number, 9)
          || '-' || to_char(current_date, 'YYYYMM')
          || '-' || lpad(e.installment_no::text, 4, '0'),
  e.due_date - 30, e.due_date,
  e.amount_due + e.penalty_amount
from emi_schedule e
join loans l on l.id = e.loan_id
where e.status in ('UPCOMING', 'OVERDUE')
  and e.id = (
    select id from emi_schedule x
    where x.loan_id = e.loan_id and x.status in ('UPCOMING','OVERDUE')
    order by x.due_date asc limit 1
  );

-- ─── NOC requests ─────────────────────────────────────────────────────────
-- Meera's closed loan: NOC approved (so the download is live).
-- Requested after the final instalment cleared ~70 days ago.
insert into noc_requests (loan_id, user_id, account_number, status, requested_at, reviewed_by, reviewed_at, decision_note)
select
  '40000000-0000-4000-8000-000000000004', '88888888-8888-4888-8888-888888888888', 'LN2025000003344',
  'APPROVED', now() - interval '64 days', '22222222-2222-4222-8222-222222222222', now() - interval '63 days',
  'All 24 instalments cleared. No outstanding balance. NOC issued.'
where exists (select 1 from profiles where id = '88888888-8888-4888-8888-888888888888');

-- Priya's closed loan: NOC requested but not yet approved. Until an officer
-- approves it her download stays locked — this is the flow the employee
-- NOC queue exists to action.
insert into noc_requests (loan_id, user_id, account_number, status, requested_at)
select
  '40000000-0000-4000-8000-000000000005', '66666666-6666-4666-8666-666666666666', 'LN2026000004455',
  'PENDING', now() - interval '2 days'
where exists (select 1 from loans where id = '40000000-0000-4000-8000-000000000005');

-- ─── Chat conversations ───────────────────────────────────────────────────
insert into chat_conversations (id, reference_no, user_id, application_id, assigned_officer_id, subject, status, last_message_at, created_at)
values
  ('50000000-0000-4000-8000-000000000001', 'CHT-2026-0001', '55555555-5555-4555-8555-555555555555',  '20000000-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333',
   'Question about personal loan documents', 'PENDING_OFFICER', now() - interval '5 hours', now() - interval '2 days'),
  ('50000000-0000-4000-8000-000000000002', 'CHT-2026-0002', '66666666-6666-4666-8666-666666666666',  '20000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222',
   'Education loan — which documents to re-upload?', 'PENDING_USER', now() - interval '20 hours', now() - interval '1 day'),
  ('50000000-0000-4000-8000-000000000003', 'CHT-2026-0003', '99999999-9999-4999-8999-999999999999', null, '33333333-3333-4333-8333-333333333333',
   'Overdue EMI and penalty charge', 'PENDING_OFFICER', now() - interval '1 day', now() - interval '2 days');

insert into chat_messages (conversation_id, sender_id, sender_role, body, created_at, read_at)
values
  ('50000000-0000-4000-8000-000000000001', '55555555-5555-4555-8555-555555555555',   'USER',
   'Hi, my personal loan application has been under review for two days. Do I need to upload anything else?',
   now() - interval '2 days', now() - interval '2 days' + interval '30 minutes'),
  ('50000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'EMPLOYEE',
   'Hi Rahul, thanks for reaching out. I am reviewing it today. Your salary slips and bank statements are still pending — could you confirm they were uploaded successfully?',
   now() - interval '1 day', now() - interval '1 day' + interval '2 hours'),
  ('50000000-0000-4000-8000-000000000001', '55555555-5555-4555-8555-555555555555',   'USER',
   'They are uploaded, yes. I can see both in the documents tab. Is there anything else?',
   now() - interval '5 hours', null),

  ('50000000-0000-4000-8000-000000000002', '66666666-6666-4666-8666-666666666666',   'USER',
   'I got a request to fix two documents. Do I need to re-upload everything or only those two?',
   now() - interval '1 day', now() - interval '1 day' + interval '1 hour'),
  ('50000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'EMPLOYEE',
   'Only the two that are marked red, Priya. The Aadhaar needs to be clearer and the salary slips should be from the last 3 months. Everything else is verified.',
   now() - interval '20 hours', null),

  ('50000000-0000-4000-8000-000000000003', '99999999-9999-4999-8999-999999999999',  'USER',
   'I see a late fee on my vehicle loan. My payment was debited but the system marked it bounced.',
   now() - interval '1 day', now() - interval '1 day' + interval '1 hour'),
  ('50000000-0000-4000-8000-000000000003', '33333333-3333-4333-8333-333333333333', 'EMPLOYEE',
   'Let me check with the gateway and revert. A debit confirmation from your bank would help.',
   now() - interval '22 hours', null);

-- ─── Tickets ──────────────────────────────────────────────────────────────
insert into tickets (
  id, ticket_no, user_id, loan_id, application_id, conversation_id,
  subject, description, category, priority, status, assigned_to, created_at)
values
  ('60000000-0000-4000-8000-000000000001', 'TKT-2026-0001', '99999999-9999-4999-8999-999999999999',
   '40000000-0000-4000-8000-000000000003', null, '50000000-0000-4000-8000-000000000003',
   'Payment shows bounced but money left my account',
   'My EMI of Rs.13,759 was debited on the 12th but the portal shows it as bounced with a Rs.500 penalty. I have the bank confirmation. Please reverse the penalty.',
   'PAYMENT', 'HIGH', 'IN_PROGRESS', '33333333-3333-4333-8333-333333333333', now() - interval '2 days'),

  ('60000000-0000-4000-8000-000000000002', 'TKT-2026-0002', '55555555-5555-4555-8555-555555555555',
   '40000000-0000-4000-8000-000000000001', null, null,
   'Cannot download my e-Bill for this month',
   'The e-Bill download button is not responding on the loan details page.',
   'TECHNICAL', 'MEDIUM', 'OPEN', '33333333-3333-4333-8333-333333333333', now() - interval '1 day'),

  ('60000000-0000-4000-8000-000000000003', 'TKT-2026-0003', '88888888-8888-4888-8888-888888888888',
   null, null, null,
   'Question about my rejected application',
   'I understand my FOIR was too high. If I pay off one of my credit cards, when can I reapply?',
   'GENERAL', 'LOW', 'OPEN', null, now() - interval '10 days');

-- ─── Notifications ────────────────────────────────────────────────────────
insert into notifications (user_id, type, title, body, link, read_at, created_at)
values
  -- To the applicant: officer replied (source doc line 112)
  ('55555555-5555-4555-8555-555555555555', 'CHAT', 'Ramesh Iyer replied to your message',
   '"Could you confirm they were uploaded successfully?"', '/user/chat', null, now() - interval '1 day'),

  -- To the applicant: officer marked OD (source doc line 155)
  ('99999999-9999-4999-8999-999999999999', 'PAYMENT', 'An EMI on your vehicle loan is overdue',
   'Instalment 15 of Rs.13,758.94 was due. A late fee of Rs.500 applies.', '/user/loans/40000000-0000-4000-8000-000000000003', null, now() - interval '12 days'),

  -- To the applicant: documents need correction (source doc line 126-129)
  ('66666666-6666-4666-8666-666666666666', 'APPLICATION', 'Action needed on your education loan',
   '2 documents need to be re-uploaded: Aadhaar and salary slips.', '/user/applications/20000000-0000-4000-8000-000000000003', null, now() - interval '1 day'),

  ('55555555-5555-4555-8555-555555555555', 'APPLICATION', 'Your home loan was approved',
   'Rs.45,00,000 sanctioned at 8.75% for 240 months.', '/user/applications/20000000-0000-4000-8000-000000000001', now() - interval '112 days', now() - interval '113 days'),

  ('88888888-8888-4888-8888-888888888888', 'NOC', 'Your No Objection Certificate is ready',
   'All instalments cleared. Download your NOC from the loan page.', '/user/loans/40000000-0000-4000-8000-000000000004', now() - interval '5 days', now() - interval '6 days'),

  ('88888888-8888-4888-8888-888888888888', 'APPLICATION', 'Your application was declined',
   'FOIR of 68% exceeded the 50% limit. You can reapply in this category after 18 Oct 2026.', '/user/applications/20000000-0000-4000-8000-000000000006', now() - interval '17 days', now() - interval '18 days'),

  -- To the OFFICER: new application assigned (source doc line 111)
  ('33333333-3333-4333-8333-333333333333', 'APPLICATION', 'New application assigned to you',
   'APP-2026-000002 — Rahul Sharma, Personal Loan, Rs.5,00,000', '/employee/applications/20000000-0000-4000-8000-000000000002', null, now() - interval '2 days'),

  ('33333333-3333-4333-8333-333333333333', 'APPLICATION', 'New chat from Rahul Sharma',
   '"They are uploaded, yes. I can see both in the documents tab."', '/employee/chat/50000000-0000-4000-8000-000000000001', null, now() - interval '5 hours'),

  ('33333333-3333-4333-8333-333333333333', 'TICKET', 'Escalated ticket: bounced payment dispute',
   'TKT-2026-0001 — Sanjay Kumar, HIGH priority', '/employee/tickets/60000000-0000-4000-8000-000000000001', null, now() - interval '2 days'),

  ('44444444-4444-4444-8444-444444444444', 'APPLICATION', 'New application assigned to you',
   'APP-2026-000005 — Arjun Mehta, Gold Loan, Rs.4,00,000', '/employee/applications/20000000-0000-4000-8000-000000000005', null, now() - interval '6 hours'),

  ('44444444-4444-4444-8444-444444444444', 'APPLICATION', 'New application assigned to you',
   'APP-2026-000009 — Priya Nair, Vehicle Loan, Rs.3,50,000', '/employee/applications/20000000-0000-4000-8000-000000000009', null, now() - interval '1 day'),

  ('22222222-2222-4222-8222-222222222222', 'APPLICATION', 'Resubmission requested by you',
   'APP-2026-000003 — Priya Nair has 2 documents to correct.', '/employee/applications/20000000-0000-4000-8000-000000000003', null, now() - interval '1 day');

-- ─── Audit log ────────────────────────────────────────────────────────────
insert into audit_logs (actor_id, actor_role, action, entity_type, entity_id, summary, created_at)
values
  ('33333333-3333-4333-8333-333333333333', 'EMPLOYEE', 'APPROVE', 'applications', '20000000-0000-4000-8000-000000000001',
   'Sanctioned Rs.45,00,000 at 8.75% (within OFF-001 authority of Rs.10,00,000)', now() - interval '113 days'),
  ('33333333-3333-4333-8333-333333333333', 'EMPLOYEE', 'REJECT', 'applications', '20000000-0000-4000-8000-000000000006',
   'Declined — FOIR 68% above the 50% limit', now() - interval '18 days'),
  ('22222222-2222-4222-8222-222222222222', 'EMPLOYEE', 'RESUBMIT', 'applications', '20000000-0000-4000-8000-000000000003',
   'Requested correction of 2 documents', now() - interval '1 day'),
  ('33333333-3333-4333-8333-333333333333', 'EMPLOYEE', 'APPROVE', 'noc_requests', '40000000-0000-4000-8000-000000000004',
   'NOC issued for LN2025000003344', now() - interval '65 days');
