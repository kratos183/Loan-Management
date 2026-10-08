"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAmortization, calculateEmi, round2, totalInterest } from "@/lib/finance/emi";
import { approvalAuthority, assessEligibility } from "@/lib/finance/risk";
import type { AppPart, AppStatus, DocStatus, LoanProduct, UserRole } from "@/lib/db/types";

/** 90 days — the cooling-off period after a rejection (source doc line 124). */
const COOLING_DAYS = 90;

/* ═══════════════════════════════════════════════════════════════════════════
   APPLICANT ACTIONS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Start a new application. Returns the id so the wizard can navigate to it.
 * The `formData` variant below is what the form posts.
 */
export async function createApplication(input: {
  productId: string;
  requestedAmount: number;
  tenureMonths: number;
  purpose?: string;
}) {
  const session = await requireSession();
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: product } = await supabase
    .from("loan_products")
    .select("*")
    .eq("id", input.productId)
    .single<LoanProduct>();

  if (!product) throw new Error("That product is no longer available.");

  // 90-day block after a rejection, per category (source doc lines 123-125)
  const { data: block } = await supabase
    .from("cooling_periods")
    .select("*")
    .eq("user_id", session.user.id)
    .eq("category", product.category)
    .is("cleared_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (block) {
    const until = new Date(block.expires_at).toLocaleDateString("en-IN");
    throw new Error(
      `You cannot apply for a ${product.category.toLowerCase()} product until ${until}.`,
    );
  }

  const referenceNo = await nextReference(admin, "APP", "applications");

  const { data, error } = await supabase
    .from("applications")
    .insert({
      reference_no: referenceNo,
      user_id: session.user.id,
      product_id: product.id,
      requested_amount: input.requestedAmount,
      tenure_months: input.tenureMonths,
      purpose: input.purpose ?? null,
      status: "DRAFT",
      current_part: "A",
      completed_parts: [],
    })
    .select("id")
    .single<{ id: string }>();

  if (error) throw new Error(error.message);

  await logEvent({
    applicationId: data.id,
    actorId: session.user.id,
    actorRole: session.role,
    toStatus: "DRAFT",
    eventType: "CREATED",
    message: "Application started",
  });

  return data.id;
}

export async function createApplicationAction(formData: FormData) {
  try {
    const id = await createApplication({
      productId: String(formData.get("product_id")),
      requestedAmount: Number(formData.get("requested_amount")),
      tenureMonths: Number(formData.get("tenure_months")),
      purpose: String(formData.get("purpose") ?? ""),
    });
    revalidatePath("/user/applications");
    return { success: true, id };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not start the application.",
    };
  }
}

/** Persist one document value for a part. */
export async function saveDocument(input: {
  applicationId: string;
  part: AppPart;
  sectionKey: string;
  docType: string;
  value: string;
  fileUrl?: string;
  fileName?: string;
  filePath?: string;
}) {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: app } = await supabase
    .from("applications")
    .select("status, user_id")
    .eq("id", input.applicationId)
    .single<{ status: string; user_id: string }>();

  if (!app || app.user_id !== session.user.id) {
    throw new Error("Application not found.");
  }

  // Once submitted, only an open resubmission request may change documents
  if (app.status !== "DRAFT" && app.status !== "RESUBMISSION_REQUESTED") {
    throw new Error(
      "This application is locked for editing. Contact your officer if something needs to change.",
    );
  }

  const isText = ["NUMBER", "TEXT", "DATE", "SELECT", "CHECKBOX"].includes(
    input.docType === "WEIGHT" || input.docType === "TC" || input.docType === "CONSENT"
      ? "CHECKBOX"
      : input.value && !input.fileUrl
        ? "TEXT"
        : "FILE",
  );

  const { data: existing } = await supabase
    .from("application_documents")
    .select("id, is_locked")
    .eq("application_id", input.applicationId)
    .eq("section_key", input.sectionKey)
    .maybeSingle<{ id: string; is_locked: boolean }>();

  // On resubmission the officer decides which docs are unlocked
  if (app.status === "RESUBMISSION_REQUESTED" && existing?.is_locked) {
    throw new Error("This document is locked. Your officer marked it as verified.");
  }

  const payload = {
    application_id: input.applicationId,
    part: input.part,
    section_key: input.sectionKey,
    doc_type: input.docType,
    file_url: input.fileUrl ?? null,
    file_name: input.fileName ?? null,
    file_path: input.filePath ?? null,
    text_value: isText ? input.value : null,
    status: "PENDING" as DocStatus,
    uploaded_at: new Date().toISOString(),
  };

  if (existing) {
    await supabase.from("application_documents").update(payload).eq("id", existing.id);
  } else {
    await supabase.from("application_documents").insert(payload);
  }

  revalidatePath(`/user/applications/${input.applicationId}`);
  return { success: true };
}

/** Mark a part complete and advance the wizard. */
export async function completePart(applicationId: string, part: AppPart) {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: app } = await supabase
    .from("applications")
    .select("user_id, completed_parts, current_part")
    .eq("id", applicationId)
    .single<{ user_id: string; completed_parts: AppPart[]; current_part: AppPart | null }>();

  if (!app || app.user_id !== session.user.id) throw new Error("Application not found.");

  const completed = Array.from(new Set([...(app.completed_parts ?? []), part]));
  const order: AppPart[] = ["A", "B", "C", "D"];
  const idx = order.indexOf(part);
  const next = order[idx + 1] ?? null;

  await supabase
    .from("applications")
    .update({ completed_parts: completed, current_part: next })
    .eq("id", applicationId);

  revalidatePath(`/user/applications/${applicationId}`);
  return { success: true, next };
}

/**
 * Submit for verification.
 *
 * Assigns an officer round-robin within the category (GAP 5), sets the SLA
 * clock from the product's configured window (GAP 6), and notifies the officer
 * (source doc line 111).
 */
export async function submitApplication(applicationId: string) {
  const session = await requireSession();
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: app } = await supabase
    .from("applications")
    .select("*, product:loan_products (*)")
    .eq("id", applicationId)
    .single<{
      id: string;
      user_id: string;
      status: AppStatus;
      completed_parts: AppPart[];
      product: LoanProduct;
      reference_no: string;
      requested_amount: number;
    }>();

  if (!app || app.user_id !== session.user.id) throw new Error("Application not found.");
  if (["SUBMITTED", "UNDER_REVIEW", "APPROVED"].includes(app.status)) {
    throw new Error("This application has already been submitted.");
  }

  // Required checklist must be complete
  const { data: requirements } = await supabase
    .from("document_requirements")
    .select("id, part, is_required")
    .eq("product_id", app.product.id);

  const { data: docs } = await supabase
    .from("application_documents")
    .select("requirement_id, part")
    .eq("application_id", applicationId);

  const provided = new Set((docs ?? []).map((d) => d.requirement_id));
  const missing = (requirements ?? []).filter(
    (r) => r.is_required && r.part !== "C" && !provided.has(r.id),
  );

  if (missing.length) {
    throw new Error(
      `${missing.length} required document${missing.length > 1 ? "s are" : " is"} still missing.`,
    );
  }

  // ── Round-robin officer assignment by category (GAP 5) ────────────────────
  const officer = await pickOfficer(admin, app.product.category);

  const slaDays = app.product.sla_max_days;
  const submittedAt = new Date();
  const slaDueAt = new Date(submittedAt.getTime() + slaDays * 86_400_000);

  await supabase
    .from("applications")
    .update({
      status: "SUBMITTED",
      submitted_at: submittedAt.toISOString(),
      sla_due_at: slaDueAt.toISOString(),
      assigned_officer_id: officer?.id ?? null,
    })
    .eq("id", applicationId);

  // T&C acceptance with the IP address, for the audit trail
  await supabase.from("tc_acknowledgements").insert({
    application_id: applicationId,
    user_id: session.user.id,
    tc_version: "v1.2",
  });

  // Notify the officer (source doc line 111)
  if (officer) {
    await admin.from("notifications").insert({
      user_id: officer.id,
      type: "APPLICATION",
      title: "New application assigned to you",
      body: `${app.reference_no} — ${session.user.full_name}, ${app.product.name}, ₹${Number(app.requested_amount).toLocaleString("en-IN")}`,
      link: `/employee/applications/${applicationId}`,
    });

    await admin.from("chat_conversations").insert({
      reference_no: await nextReference(admin, "CHT", "chat_conversations"),
      user_id: session.user.id,
      application_id: applicationId,
      assigned_officer_id: officer.id,
      subject: `${app.product.name} application`,
      status: "OPEN",
      last_message_at: new Date().toISOString(),
    });
  }

  await logEvent({
    applicationId,
    actorId: session.user.id,
    actorRole: session.role,
    fromStatus: app.status,
    toStatus: "SUBMITTED",
    eventType: "SUBMITTED",
    message: officer
      ? `Submitted and assigned to ${officer.full_name}`
      : "Submitted — awaiting officer assignment",
  });

  revalidatePath(`/user/applications/${applicationId}`);
  revalidatePath("/user/applications");
  revalidatePath("/employee/applications");
  return { success: true };
}

/* ═══════════════════════════════════════════════════════════════════════════
   OFFICER ACTIONS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Verify or reject a single document. */
export async function reviewDocument(input: {
  documentId: string;
  decision: "VERIFIED" | "REJECTED";
  reason?: string;
}) {
  const session = await requireSession();
  const supabase = await createClient();

  const { error } = await supabase
    .from("application_documents")
    .update({
      status: input.decision,
      rejection_reason: input.decision === "REJECTED" ? input.reason : null,
      reviewed_by: session.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", input.documentId);

  if (error) throw new Error(error.message);
  revalidatePath("/employee/applications");
  return { success: true };
}

/**
 * The decision form on the review screen.
 *
 * APPROVE  → creates the loan, generates the EMI schedule, disburses
 * REJECT   → starts the 90-day cooling period for that category
 * RESUBMIT → unlocks only the named documents for the applicant
 */
export async function decideApplication(
  formData: FormData,
): Promise<{ success?: true; loanId?: string; error?: string }> {
  const session = await requireSession();
  const applicationId = String(formData.get("application_id"));
  const mode = String(formData.get("mode")) as "APPROVE" | "REJECT" | "RESUBMIT";
  const reason = String(formData.get("reason") ?? "").trim();

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: app } = await supabase
    .from("applications")
    .select("*, product:loan_products (*)")
    .eq("id", applicationId)
    .single<{
      id: string;
      user_id: string;
      reference_no: string;
      status: AppStatus;
      requested_amount: number;
      tenure_months: number;
      product: LoanProduct;
      applicant: { full_name: string; monthly_income: number | null };
    }>();

  if (!app) throw new Error("Application not found.");

  // ── RESUBMISSION ─────────────────────────────────────────────────────────
  if (mode === "RESUBMIT") {
    const allowedDocs = formData.getAll("allowed_docs").map(String);

    await supabase
      .from("applications")
      .update({ status: "RESUBMISSION_REQUESTED", resubmission_count: 1 })
      .eq("id", applicationId);

    // Unlock ONLY the documents the officer named
    await supabase
      .from("application_documents")
      .update({ is_locked: false })
      .in("id", allowedDocs);

    await supabase.from("resubmission_requests").insert({
      application_id: applicationId,
      requested_by: session.user.id,
      allowed_documents: allowedDocs,
      reason,
      status: "OPEN",
    });

    // Notify the applicant (source doc lines 126-129)
    await admin.from("notifications").insert({
      user_id: app.user_id,
      type: "APPLICATION",
      title: "Action needed on your application",
      body: reason.slice(0, 160),
      link: `/user/applications/${applicationId}`,
    });

    await logEvent({
      applicationId,
      actorId: session.user.id,
      actorRole: session.role,
      fromStatus: app.status,
      toStatus: "RESUBMISSION_REQUESTED",
      eventType: "RESUBMISSION_REQUESTED",
      message: reason,
    });

    revalidatePath(`/employee/applications/${applicationId}`);
    revalidatePath("/employee/applications");
    return { success: true };
  }

  // ── REJECTION ────────────────────────────────────────────────────────────
  if (mode === "REJECT") {
    await supabase
      .from("applications")
      .update({
        status: "REJECTED",
        decided_at: new Date().toISOString(),
        decision_reason: reason,
        decision_notes: reason,
      })
      .eq("id", applicationId);

    // 90-day block for that category (source doc lines 123-125)
    await admin.from("cooling_periods").insert({
      user_id: app.user_id,
      category: app.product.category,
      application_id: applicationId,
      reason,
      starts_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + COOLING_DAYS * 86_400_000).toISOString(),
    });

    await admin.from("notifications").insert({
      user_id: app.user_id,
      type: "APPLICATION",
      title: "Your application was declined",
      body: reason.slice(0, 160),
      link: `/user/applications/${applicationId}`,
    });

    await logEvent({
      applicationId,
      actorId: session.user.id,
      actorRole: session.role,
      fromStatus: app.status,
      toStatus: "REJECTED",
      eventType: "REJECTED",
      message: reason,
    });

    revalidatePath(`/employee/applications/${applicationId}`);
    revalidatePath("/employee/applications");
    return { success: true };
  }

  // ── APPROVAL ─────────────────────────────────────────────────────────────
  const approvedAmount = Number(formData.get("approved_amount") ?? app.requested_amount);
  const rate = Number(formData.get("rate") ?? (Number(app.product.min_rate) + Number(app.product.max_rate)) / 2);

  // Authority check (GAP 2 & 7)
  const { data: employee } = await supabase
    .from("employees")
    .select("approval_limit, employee_role")
    .eq("user_id", session.user.id)
    .maybeSingle<{ approval_limit: number; employee_role: string }>();

  const authority = approvalAuthority({
    amount: approvedAmount,
    officerLimit: employee?.approval_limit ?? null,
  });

  if (authority !== "OFFICER") {
    // Escalate rather than silently approving
    await admin.from("notifications").insert({
      user_id: session.user.id,
      type: "APPLICATION",
      title: "Approval needs escalation",
      body: `${app.reference_no} at ₹${approvedAmount.toLocaleString("en-IN")} is above your limit. Routed to a ${authority.toLowerCase()}.`,
      link: `/employee/applications/${applicationId}`,
    });

    await logEvent({
      applicationId,
      actorId: session.user.id,
      actorRole: session.role,
      eventType: "ESCALATED",
      message: `Escalated for authorisation — ₹${approvedAmount.toLocaleString("en-IN")} above limit`,
    });

    return {
      error: `This amount is above your sanctioning limit and has been escalated to a ${authority.toLowerCase()}.`,
    };
  }

  const emi = calculateEmi(approvedAmount, rate, app.tenure_months);
  const interest = totalInterest(approvedAmount, rate, app.tenure_months);
  const accountNumber = await generateAccountNumber(admin);

  const loanId = await disburseLoan({
    admin,
    application: app,
    approvedAmount,
    rate,
    emi,
    interest,
    accountNumber,
    officerId: session.user.id,
    note: reason,
  });

  await supabase
    .from("applications")
    .update({
      status: "APPROVED",
      decided_at: new Date().toISOString(),
      decision_notes: reason || "Sanctioned",
      offered_rate: rate,
      approved_amount: approvedAmount,
      emi_amount: emi,
      assigned_account_number: accountNumber,
    })
    .eq("id", applicationId);

  await admin.from("notifications").insert({
    user_id: app.user_id,
    type: "APPLICATION",
    title: "Your application was approved",
    body: `₹${approvedAmount.toLocaleString("en-IN")} sanctioned at ${rate}% for ${app.tenure_months} months. EMI ₹${emi.toLocaleString("en-IN")}.`,
    link: `/user/applications/${applicationId}`,
  });

  revalidatePath(`/employee/applications/${applicationId}`);
  revalidatePath("/employee/applications");
  revalidatePath("/employee/dashboard");
  revalidatePath("/user/loans");
  return { success: true, loanId };
}

/** Record a call attempt / note against an application. */
export async function addOfficerNote(applicationId: string, message: string) {
  const session = await requireSession();
  await logEvent({
    applicationId,
    actorId: session.user.id,
    actorRole: session.role,
    eventType: "NOTE",
    message,
  });
  revalidatePath(`/employee/applications/${applicationId}`);
  return { success: true };
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Create the loan, generate the amortisation schedule and mark it disbursed.
 * All of this happens in one place so the loan is never half-created.
 */
async function disburseLoan(args: {
  admin: ReturnType<typeof createAdminClient>;
  application: {
    id: string;
    user_id: string;
    reference_no: string;
    tenure_months: number;
    product: LoanProduct;
    applicant: { full_name: string };
  };
  approvedAmount: number;
  rate: number;
  emi: number;
  interest: number;
  accountNumber: string;
  officerId: string;
  note: string;
}) {
  const { admin, application, approvedAmount, rate, emi, interest, accountNumber } = args;

  const startDate = new Date();

  const { data: loan, error } = await admin
    .from("loans")
    .insert({
      application_id: application.id,
      user_id: application.user_id,
      account_number: accountNumber,
      product_id: application.product.id,
      principal: approvedAmount,
      annual_rate: rate,
      tenure_months: application.tenure_months,
      emi_amount: emi,
      interest_method: "REDUCING_BALANCE",
      outstanding_principal: approvedAmount,
      total_interest: interest,
      total_payable: round2(approvedAmount + interest),
      total_paid: 0,
      status: "ACTIVE",
      disbursement_txn_id: `TXN${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      disbursed_at: startDate.toISOString(),
      start_date: startDate.toISOString().slice(0, 10),
      agreement_signed_at: startDate.toISOString(),
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !loan) throw new Error(`Could not create the loan: ${error?.message}`);

  // Amortisation schedule — the same maths the calculator uses
  const schedule = buildAmortization({
    principal: approvedAmount,
    annualRate: rate,
    months: application.tenure_months,
    startDate,
  });

  const rows = schedule.map((r) => ({
    loan_id: loan.id,
    installment_no: r.installmentNo,
    due_date: r.dueDate,
    principal_part: r.principalPart,
    interest_part: r.interestPart,
    amount_due: r.amountDue,
    penalty_amount: 0,
    paid_amount: 0,
    status: "UPCOMING" as const,
    days_past_due: 0,
  }));

  // Insert in chunks; PostgREST caps a single statement at 1000 rows
  for (let i = 0; i < rows.length; i += 500) {
    const { error: batchError } = await admin.from("emi_schedule").insert(rows.slice(i, i + 500));
    if (batchError) throw new Error(`Schedule generation failed: ${batchError.message}`);
  }

  // e-Bill for the first instalment
  if (schedule[0]) {
    await admin.from("ebills").insert({
      loan_id: loan.id,
      emi_id: null,
      bill_no: `BILL-${accountNumber}-0001`,
      period_from: startDate.toISOString().slice(0, 10),
      period_to: schedule[0].dueDate,
      amount: schedule[0].amountDue,
    });
  }

  await admin.from("audit_logs").insert({
    actor_id: args.officerId,
    actor_role: "EMPLOYEE",
    action: "DISBURSE",
    entity_type: "loans",
    entity_id: loan.id,
    summary: `Disbursed ₹${approvedAmount.toLocaleString("en-IN")} at ${rate}% to account ${accountNumber}`,
  });

  await logEvent({
    applicationId: application.id,
    actorId: args.officerId,
    actorRole: "EMPLOYEE",
    toStatus: "APPROVED",
    eventType: "DISBURSED",
    message: `Loan disbursed to ${accountNumber}. ${args.note}`,
  });

  return loan.id;
}

/** Round-robin pick among officers who handle the category. */
async function pickOfficer(
  admin: ReturnType<typeof createAdminClient>,
  category: "SECURED" | "UNSECURED",
) {
  type OfficerRow = {
    user_id: string;
    employee_role: string;
    specialities: string[] | null;
    profile: { id: string; full_name: string; email: string; status: string } | null;
  };

  const { data: officers } = await admin
    .from("employees")
    .select(`
      user_id,
      employee_role,
      specialities,
      profile:profiles!employees_user_id_fkey (id, full_name, email, status)
    `)
    .eq("employee_role", "OFFICER")
    .overrideTypes<OfficerRow[]>();

  const eligible = (officers ?? []).filter((o) => {
    if (!o.profile || o.profile.status !== "ACTIVE") return false;
    if (!o.specialities || o.specialities.length === 0) return true;
    return o.specialities.includes(category);
  });

  if (eligible.length === 0) return null;

  // Least-loaded officer wins — a fair approximation of round-robin that
  // self-corrects when someone is on leave.
  const loads = await Promise.all(
    eligible.map(async (o) => {
      const { count } = await admin
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("assigned_officer_id", o.user_id)
        .in("status", ["SUBMITTED", "UNDER_REVIEW", "RESUBMISSION_REQUESTED"]);
      return { officer: o, load: count ?? 0 };
    }),
  );

  loads.sort((a, b) => a.load - b.load);
  const pick = loads[0].officer;

  return { id: pick.user_id, full_name: pick.profile?.full_name ?? "your officer" };
}

async function nextReference(
  admin: ReturnType<typeof createAdminClient>,
  prefix: string,
  table: string,
) {
  const year = new Date().getFullYear();
  const { count } = await admin.from(table).select("id", { count: "exact", head: true });
  return `${prefix}-${year}-${String((count ?? 0) + 1).padStart(6, "0")}`;
}

async function generateAccountNumber(admin: ReturnType<typeof createAdminClient>) {
  const year = new Date().getFullYear();
  const { count } = await admin
    .from("loans")
    .select("id", { count: "exact", head: true });
  return `LN${year}${String((count ?? 0) + 1).padStart(10, "0")}`;
}

type StatusLiteral = AppStatus;

async function logEvent(args: {
  applicationId: string;
  actorId: string;
  actorRole: UserRole;
  fromStatus?: StatusLiteral;
  toStatus?: StatusLiteral;
  eventType: string;
  message: string;
}) {
  const admin = createAdminClient();
  await admin.from("application_events").insert({
    application_id: args.applicationId,
    actor_id: args.actorId,
    actor_role: args.actorRole,
    from_status: args.fromStatus ?? null,
    to_status: args.toStatus ?? null,
    event_type: args.eventType,
    message: args.message,
  });
}