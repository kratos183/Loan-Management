import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  ApplicationWithRelations,
  ConversationWithMessages,
  LoanWithRelations,
  Notification,
  Profile,
  Ticket,
  UserRole,
} from "@/lib/db/types";

/* ─── Employee portal ─────────────────────────────────────────────────────── */

export async function listStaffQueue(officerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select(`
      *,
      product:loan_products (*),
      applicant:profiles!applications_user_id_fkey (id, full_name, email, phone, monthly_income)
    `)
    .eq("assigned_officer_id", officerId)
    .in("status", ["SUBMITTED", "UNDER_REVIEW", "RESUBMISSION_REQUESTED"])
    .order("submitted_at", { ascending: true })
    .overrideTypes<ApplicationWithRelations[]>();
  return data ?? [];
}

export async function getApplicationWithDocs(applicationId: string) {
  const supabase = await createClient();

  const [appRes, docsRes, collateralRes, eventsRes, resubRes] = await Promise.all([
    supabase
      .from("applications")
      .select(`
        *,
        product:loan_products (*),
        applicant:profiles!applications_user_id_fkey (*),
        officer:profiles!applications_assigned_officer_id_fkey (id, full_name, email)
      `)
      .eq("id", applicationId)
      .single<ApplicationWithRelations>(),
    supabase
      .from("application_documents")
      .select("*")
      .eq("application_id", applicationId)
      .order("part"),
    supabase.from("application_collateral").select("*").eq("application_id", applicationId),
    supabase
      .from("application_events")
      .select("*")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("resubmission_requests")
      .select("*")
      .eq("application_id", applicationId)
      .eq("status", "OPEN")
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (appRes.error || !appRes.data) return null;

  return {
    application: appRes.data,
    documents: docsRes.data ?? [],
    collateral: collateralRes.data ?? [],
    events: eventsRes.data ?? [],
    resubmission: resubRes.data ?? null,
  };
}

/** Applicant's liabilities, needed to compute FOIR on the review screen. */
export async function getApplicantProfile(userId: string) {
  const supabase = await createClient();

  const [profileRes, liabilitiesRes, loansRes, cibilRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single<Profile>(),
    supabase
      .from("liabilities")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true),
    supabase
      .from("loans")
      .select("id, emi_amount, status")
      .eq("user_id", userId)
      .eq("status", "ACTIVE"),
    supabase
      .from("cibil_checks")
      .select("score, band, expires_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const cibil = cibilRes.data?.[0];
  return {
    profile: profileRes.data ?? null,
    liabilities: liabilitiesRes.data ?? [],
    activeLoans: loansRes.data ?? [],
    cibil: cibil && new Date(cibil.expires_at) > new Date() ? cibil : null,
  };
}

export async function listStaffConversations(officerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chat_conversations")
    .select(`
      *,
      customer:profiles!chat_conversations_user_id_fkey (id, full_name, email),
      messages:chat_messages (*)
    `)
    .eq("assigned_officer_id", officerId)
    .order("last_message_at", { ascending: false })
    .overrideTypes<ConversationWithMessages[]>();
  return data ?? [];
}

export async function listStaffTickets(officerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tickets")
    .select(`
      *,
      customer:profiles!tickets_user_id_fkey (id, full_name, email, phone)
    `)
    .eq("assigned_to", officerId)
    .order("created_at", { ascending: false })
    .overrideTypes<Ticket[]>();
  return data ?? [];
}

export async function listUnassignedTickets() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tickets")
    .select(`*, customer:profiles!tickets_user_id_fkey (id, full_name, email)`)
    .is("assigned_to", null)
    .in("status", ["OPEN", "IN_PROGRESS"])
    .order("priority", { ascending: true });
  return data ?? [];
}

export async function listOverdueAcrossBook() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("emi_schedule")
    .select(`
      *,
      loan:loans (
        account_number,
        emi_amount,
        product:loan_products (name),
        borrower:profiles!loans_user_id_fkey (id, full_name, phone, email)
      )
    `)
    .eq("status", "OVERDUE")
    .order("due_date", { ascending: true });

  return data ?? [];
}

export async function listNocQueue() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("noc_requests")
    .select(`
      *,
      loan:loans (
        account_number, principal, tenure_months, status,
        product:loan_products (name),
        borrower:profiles!loans_user_id_fkey (id, full_name, email, phone)
      )
    `)
    .order("requested_at", { ascending: true });
  return data ?? [];
}

export async function getOfficerAuthority(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("employees")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

/* ─── Admin portal ────────────────────────────────────────────────────────── */

export async function listAllUsers() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .overrideTypes<Profile[]>();
  return data ?? [];
}

export async function listAllStaff() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("employees")
    .select(`*, profile:profiles!employees_user_id_fkey (id, full_name, email, role, status)`)
    .overrideTypes<
      { user_id: string; employee_code: string | null; employee_role: string;
        approval_limit: number; territory: string | null; specialities: string[] | null;
        profile: Profile | null }[]
    >();
  return data ?? [];
}

export async function listAllLoansForAdmin() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("loans")
    .select(`
      *,
      product:loan_products (name, category, code),
      borrower:profiles!loans_user_id_fkey (id, full_name, email)
    `)
    .order("disbursed_at", { ascending: false })
    .overrideTypes<LoanWithRelations[]>();
  return data ?? [];
}

export async function listAllApplicationsForAdmin() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select(`
      *,
      product:loan_products (name, category, code),
      applicant:profiles!applications_user_id_fkey (id, full_name, email),
      officer:profiles!applications_assigned_officer_id_fkey (id, full_name)
    `)
    .order("created_at", { ascending: false })
    .overrideTypes<ApplicationWithRelations[]>();
  return data ?? [];
}

export async function listAuditLog(limit = 100) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_logs")
    .select(`*, actor:profiles!audit_logs_actor_id_fkey (id, full_name, email)`)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function listAllNotifications(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200)
    .overrideTypes<Notification[]>();
  return data ?? [];
}

/** Aggregate figures for the admin dashboard and reports. */
export async function getPlatformStats() {
  const supabase = await createClient();

  const [users, apps, loans, outstanding, overdue, tickets, noc] = await Promise.all([
    supabase.from("profiles").select("id, role, status", { count: "exact" }),
    supabase.from("applications").select("id, status, requested_amount, product_id"),
    supabase
      .from("loans")
      .select("id, principal, outstanding_principal, status, disbursed_at, account_number")
      .overrideTypes<{
        id: string;
        principal: number;
        outstanding_principal: number;
        status: string;
        disbursed_at: string | null;
        account_number: string;
      }[]>(),
    supabase
      .from("loans")
      .select("outstanding_principal")
      .eq("status", "ACTIVE")
      .overrideTypes<{ outstanding_principal: number }[]>(),
    supabase
      .from("emi_schedule")
      .select("id, amount_due, penalty_amount")
      .eq("status", "OVERDUE")
      .overrideTypes<{ id: string; amount_due: number; penalty_amount: number }[]>(),
    supabase.from("tickets").select("id", { count: "exact" }).in("status", ["OPEN", "IN_PROGRESS"]),
    supabase.from("noc_requests").select("id", { count: "exact" }).eq("status", "PENDING"),
  ]);

  const applications = apps.data ?? [];
  const allLoans = loans.data ?? [];

  const byStatus = applications.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  const totalDisbursed = allLoans.reduce((s, l) => s + Number(l.principal), 0);
  const totalOutstanding = (outstanding.data ?? []).reduce(
    (s, l) => s + Number(l.outstanding_principal),
    0,
  );
  const overdueRows = overdue.data ?? [];

  return {
    userCount: users.count ?? 0,
    applicationCount: applications.length,
    applicationsByStatus: byStatus,
    loanCount: allLoans.length,
    totalDisbursed,
    totalOutstanding,
    overdueCount: overdueRows.length,
    overdueAmount: overdueRows.reduce(
      (s, e) => s + Number(e.amount_due) + Number(e.penalty_amount),
      0,
    ),
    openTickets: tickets.count ?? 0,
    pendingNoc: noc.count ?? 0,
    loans: allLoans,
  };
}