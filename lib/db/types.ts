/**
 * Domain types mirroring the Postgres schema.
 *
 * These are hand-maintained so the project runs without a codegen step. Once
 * your schema is live in Supabase you can tighten this up with:
 *
 *   npx supabase gen types typescript --project-id <ref> > lib/db/database.types.ts
 */

export type UserRole = "USER" | "EMPLOYEE" | "ADMIN";
export type EmployeeRole = "OFFICER" | "MANAGER";
export type UserStatus = "PENDING" | "ACTIVE" | "BLOCKED" | "CLOSED";
export type LoanCategory = "SECURED" | "UNSECURED";
export type CollateralType = "NONE" | "PROPERTY" | "VEHICLE" | "FINANCIAL" | "GOLD";
export type AppStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "RESUBMISSION_REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "WITHDRAWN";
export type AppPart = "A" | "B" | "C" | "D";
export type DocStatus = "PENDING" | "VERIFIED" | "REJECTED" | "NOT_REQUIRED";
export type LoanStatus = "ACTIVE" | "FORECLOSED" | "CLOSED" | "NOC_ISSUED";
export type EmiStatus = "UPCOMING" | "PAID" | "OVERDUE" | "PARTIALLY_PAID" | "PREPAID";
export type PaymentStatus = "SUCCESS" | "FAILED" | "BOUNCED" | "REFUNDED";
export type PaymentMode = "UPI" | "NEFT" | "RTGS" | "CARD" | "CHEQUE" | "MANUAL";
export type NocStatus = "PENDING" | "APPROVED" | "REJECTED";
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH";
export type ConvStatus = "OPEN" | "PENDING_USER" | "PENDING_OFFICER" | "CLOSED";
export type NotifType =
  | "APPLICATION" | "LOAN" | "PAYMENT" | "CHAT"
  | "TICKET" | "NOC" | "SYSTEM" | "CIBIL";
export type CibilBand = "EXCELLENT" | "GOOD" | "AVERAGE" | "POOR";

// ─── Tables ─────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  date_of_birth: string | null;
  role: UserRole;
  status: UserStatus;
  avatar_url: string | null;
  monthly_income: number | null;
  employment_type: string | null;
  employer: string | null;
  job_tenure_years: number | null;
  pan: string | null;
  aadhaar_last4: string | null;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  user_id: string;
  employee_code: string | null;
  employee_role: EmployeeRole;
  approval_limit: number;
  territory: string | null;
  specialities: string[] | null;
  created_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  address_type: string;
  is_primary: boolean;
  created_at: string;
}

export interface Liability {
  id: string;
  user_id: string;
  source: string;
  liability_type: string;
  lender: string;
  monthly_amount: number;
  outstanding: number | null;
  is_active: boolean;
  created_at: string;
}

export interface LoanProduct {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: LoanCategory;
  collateral_type: CollateralType;
  min_amount: number;
  max_amount: number;
  min_tenure_months: number;
  max_tenure_months: number;
  min_rate: number;
  max_rate: number;
  min_monthly_income: number | null;
  min_cibil: number | null;
  max_foir: number;
  max_age: number;
  min_age: number;
  requires_coapplicant: boolean;
  processing_fee_pct: number;
  grace_days: number;
  late_fee_flat: number;
  late_fee_pct: number;
  prepayment_allowed: boolean;
  foreclosure_allowed: boolean;
  autopay_enabled: boolean;
  sla_min_days: number;
  sla_max_days: number;
  thumbnail_emoji: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentRequirement {
  id: string;
  product_id: string;
  part: AppPart;
  section_key: string;
  label: string;
  help_text: string | null;
  doc_type: string;
  is_required: boolean;
  applies_to_collateral: CollateralType[] | null;
  max_files: number;
  sort_order: number;
  input_kind: "FILE" | "TEXT" | "NUMBER" | "SELECT" | "DATE" | "CHECKBOX";
  input_options: { options?: string[] } | null;
  created_at: string;
}

export interface Application {
  id: string;
  reference_no: string;
  user_id: string;
  product_id: string;
  requested_amount: number;
  tenure_months: number;
  purpose: string | null;
  status: AppStatus;
  current_part: AppPart | null;
  completed_parts: AppPart[];
  assigned_officer_id: string | null;
  submitted_at: string | null;
  sla_due_at: string | null;
  review_started_at: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  decision_notes: string | null;
  offered_rate: number | null;
  approved_amount: number | null;
  emi_amount: number | null;
  computed_foir: number | null;
  assigned_account_number: string | null;
  resubmission_count: number;
  created_at: string;
  updated_at: string;
}

export interface ApplicationDocument {
  id: string;
  application_id: string;
  requirement_id: string | null;
  part: AppPart;
  section_key: string;
  doc_type: string;
  file_path: string | null;
  file_url: string | null;
  file_name: string | null;
  text_value: string | null;
  status: DocStatus;
  rejection_reason: string | null;
  is_locked: boolean;
  uploaded_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationCollateral {
  id: string;
  application_id: string;
  type: CollateralType;
  details: Record<string, unknown>;
  estimated_value: number | null;
  verified_at: string | null;
  created_at: string;
}

export interface CoApplicant {
  id: string;
  application_id: string;
  relationship: string;
  full_name: string;
  dob: string | null;
  pan: string | null;
  monthly_income: number | null;
  employer: string | null;
  consent_signed: boolean;
  consent_signed_at: string | null;
  consent_ip: string | null;
  verified_at: string | null;
  created_at: string;
}

export interface TcAcknowledgement {
  id: string;
  application_id: string;
  user_id: string;
  tc_version: string;
  accepted_at: string;
  ip_address: string | null;
}

export interface ResubmissionRequest {
  id: string;
  application_id: string;
  requested_by: string;
  allowed_documents: string[];
  reason: string;
  status: "OPEN" | "RESOLVED" | "CANCELLED";
  requested_at: string;
  resolved_at: string | null;
}

export interface ApplicationEvent {
  id: number;
  application_id: string;
  actor_id: string | null;
  actor_role: UserRole | null;
  from_status: AppStatus | null;
  to_status: AppStatus | null;
  event_type: string;
  message: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface Loan {
  id: string;
  application_id: string;
  user_id: string;
  account_number: string;
  product_id: string;
  principal: number;
  annual_rate: number;
  tenure_months: number;
  emi_amount: number;
  interest_method: string;
  outstanding_principal: number;
  total_interest: number;
  total_payable: number;
  total_paid: number;
  status: LoanStatus;
  disbursement_txn_id: string | null;
  disbursed_at: string | null;
  start_date: string | null;
  end_date: string | null;
  sanction_letter_path: string | null;
  agreement_signed_at: string | null;
  closed_at: string | null;
  noc_issued_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Emi {
  id: string;
  loan_id: string;
  installment_no: number;
  due_date: string;
  principal_part: number;
  interest_part: number;
  amount_due: number;
  penalty_amount: number;
  paid_amount: number;
  status: EmiStatus;
  is_prepayment: boolean;
  days_past_due: number;
  paid_at: string | null;
}

export interface Payment {
  id: string;
  loan_id: string;
  emi_id: string | null;
  receipt_no: string;
  amount: number;
  penalty_amount: number;
  mode: PaymentMode;
  gateway: string;
  gateway_ref: string | null;
  txn_id: string | null;
  txn_date: string;
  status: PaymentStatus;
  bounce_charge: number;
  failure_reason: string | null;
  is_prepayment: boolean;
  created_at: string;
  /** Present on joined queries: `*, loan:loans(...)`. */
  loan?: {
    account_number: string;
    product: { name: string } | null;
  } | null;
}

export interface EBill {
  id: string;
  loan_id: string;
  emi_id: string | null;
  bill_no: string;
  period_from: string;
  period_to: string;
  amount: number;
  pdf_path: string | null;
  generated_at: string;
}

export interface NocRequest {
  id: string;
  loan_id: string;
  user_id: string;
  account_number: string;
  status: NocStatus;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  decision_note: string | null;
  pdf_path: string | null;
}

export interface Ticket {
  id: string;
  ticket_no: string;
  user_id: string;
  loan_id: string | null;
  application_id: string | null;
  conversation_id: string | null;
  subject: string;
  description: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_to: string | null;
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface ChatConversation {
  id: string;
  reference_no: string;
  user_id: string;
  application_id: string | null;
  loan_id: string | null;
  ticket_id: string | null;
  assigned_officer_id: string | null;
  subject: string | null;
  status: ConvStatus;
  last_message_at: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  sender_role: UserRole;
  body: string;
  attachment_path: string | null;
  created_at: string;
  read_at: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotifType;
  title: string;
  body: string | null;
  link: string | null;
  meta: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface CibilCheck {
  id: string;
  user_id: string;
  pan: string;
  score: number;
  band: CibilBand;
  provider: string;
  factors: Record<string, unknown>;
  raw_response: unknown;
  expires_at: string;
  created_at: string;
}

export interface CoolingPeriod {
  id: string;
  user_id: string;
  category: LoanCategory;
  application_id: string | null;
  reason: string | null;
  starts_at: string;
  expires_at: string;
  cleared_at: string | null;
  notified_at: string | null;
}

export interface AuditLog {
  id: number;
  actor_id: string | null;
  actor_role: UserRole | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string | null;
  meta: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

// ─── Composite / joined shapes used by the UI ──────────────────────────────

export interface ApplicationWithRelations extends Application {
  product: LoanProduct | null;
  applicant: Pick<Profile, "id" | "full_name" | "email" | "phone" | "monthly_income"> | null;
  officer: Pick<Profile, "id" | "full_name" | "email"> | null;
  documents?: ApplicationDocument[];
  collateral?: ApplicationCollateral[];
  coapplicants?: CoApplicant[];
  events?: ApplicationEvent[];
  resubmission?: ResubmissionRequest | null;
}

export interface LoanWithRelations extends Loan {
  product: LoanProduct | null;
  borrower: Pick<Profile, "id" | "full_name" | "email" | "phone"> | null;
}

export interface ConversationWithMessages extends ChatConversation {
  messages: ChatMessage[];
  customer: Pick<Profile, "id" | "full_name" | "email"> | null;
  officer: Pick<Profile, "id" | "full_name"> | null;
}