"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ConvStatus } from "@/lib/db/types";

/**
 * Send a message in a conversation.
 *
 * Writes to Postgres (the source of truth), then notifies the other party.
 * The Realtime subscription picks up the insert and pushes it over the
 * WebSocket, so neither side needs to poll.
 */
export async function sendMessage(conversationId: string, body: string) {
  const session = await requireSession();
  const supabase = await createClient();
  const admin = createAdminClient();

  const text = body.trim();
  if (!text) return { error: "Message cannot be empty." };
  if (text.length > 4000) return { error: "That message is too long." };

  // RLS on chat_messages already restricts this to participants
  const { data: conversation } = await supabase
    .from("chat_conversations")
    .select("id, user_id, assigned_officer_id, status, subject")
    .eq("id", conversationId)
    .maybeSingle<{
      id: string;
      user_id: string;
      assigned_officer_id: string | null;
      status: ConvStatus;
      subject: string | null;
    }>();

  if (!conversation) return { error: "Conversation not found." };
  if (conversation.status === "CLOSED") {
    return { error: "This conversation has been closed." };
  }

  const { error } = await supabase.from("chat_messages").insert({
    conversation_id: conversationId,
    sender_id: session.user.id,
    sender_role: session.role,
    body: text,
  });

  if (error) return { error: error.message };

  // Who should hear about this?
  const recipientId =
    session.user.id === conversation.user_id
      ? conversation.assigned_officer_id
      : conversation.user_id;

  // Flip the status so each side can see whose turn it is
  await supabase
    .from("chat_conversations")
    .update({
      last_message_at: new Date().toISOString(),
      status:
        session.role === "USER"
          ? ("PENDING_OFFICER" as ConvStatus)
          : ("PENDING_USER" as ConvStatus),
    })
    .eq("id", conversationId);

  // Notify the other party (source doc lines 111-112)
  if (recipientId) {
    const isUserSending = session.role === "USER";
    await admin.from("notifications").insert({
      user_id: recipientId,
      type: "CHAT",
      title: isUserSending
        ? `New message from ${session.user.full_name}`
        : `${session.user.full_name} replied to your message`,
      body: text.slice(0, 120),
      link: isUserSending
        ? `/employee/chat/${conversationId}`
        : `/user/chat/${conversationId}`,
    });
  }

  revalidatePath(`/user/chat/${conversationId}`);
  revalidatePath(`/employee/chat/${conversationId}`);
  return { success: true };
}

/** Open a conversation against an application. */
export async function openConversationForApplication(applicationId: string) {
  const session = await requireSession();
  const supabase = await createClient();
  const admin = createAdminClient();

  // Reuse an existing conversation for this application
  const { data: existing } = await supabase
    .from("chat_conversations")
    .select("id")
    .eq("application_id", applicationId)
    .not("status", "eq", "CLOSED")
    .maybeSingle<{ id: string }>();

  if (existing) return existing.id;

  const { data: app } = await supabase
    .from("applications")
    .select("user_id, assigned_officer_id, reference_no, product:loan_products (name)")
    .eq("id", applicationId)
    .maybeSingle();

  if (!app) return null;

  type AppRow = {
    user_id: string;
    assigned_officer_id: string | null;
    reference_no: string;
    product: { name: string } | null;
  };
  const row = app as unknown as AppRow;

  const { count } = await admin
    .from("chat_conversations")
    .select("id", { count: "exact", head: true });

  const { data, error } = await supabase
    .from("chat_conversations")
    .insert({
      reference_no: `CHT-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, "0")}`,
      user_id: row.user_id,
      application_id: applicationId,
      assigned_officer_id: row.assigned_officer_id,
      subject: `${row.product?.name ?? "Loan"} application`,
      status: "OPEN",
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return null;

  // Greet the customer so the thread isn't empty
  await supabase.from("chat_messages").insert({
    conversation_id: data.id,
    sender_id: session.user.id,
    sender_role: session.role,
    body:
      session.role === "USER"
        ? "Hi, I have a question about my application."
        : `Hi ${session.user.full_name}, you've reached your loan officer. How can I help?`,
  });

  return data.id;
}

export async function closeConversation(conversationId: string) {
  const session = await requireSession();
  const supabase = await createClient();

  await supabase
    .from("chat_conversations")
    .update({ status: "CLOSED" })
    .eq("id", conversationId);

  revalidatePath(`/user/chat/${conversationId}`);
  revalidatePath(`/employee/chat/${conversationId}`);
  return { success: true };
}

/* ─── Tickets (source doc line 162: "raise ticket to user") ──────────────── */

export async function raiseTicket(input: {
  subject: string;
  description: string;
  category: string;
  priority: string;
  loanId?: string | null;
}) {
  const session = await requireSession();
  const supabase = await createClient();
  const admin = createAdminClient();

  const { count } = await admin.from("tickets").select("id", { count: "exact", head: true });
  const ticketNo = `TKT-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const { data, error } = await supabase
    .from("tickets")
    .insert({
      ticket_no: ticketNo,
      user_id: session.user.id,
      loan_id: input.loanId ?? null,
      subject: input.subject,
      description: input.description,
      category: input.category,
      priority: input.priority as never,
      status: "OPEN",
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return { error: error.message };

  // A ticket opens its own chat thread, so the bot and the officer see
  // the same conversation the customer does (source doc line 163)
  const { count: convCount } = await admin
    .from("chat_conversations")
    .select("id", { count: "exact", head: true });

  const { data: conversation } = await supabase
    .from("chat_conversations")
    .insert({
      reference_no: `CHT-${new Date().getFullYear()}-${String((convCount ?? 0) + 1).padStart(4, "0")}`,
      user_id: session.user.id,
      loan_id: input.loanId ?? null,
      ticket_id: data.id,
      subject: input.subject,
      status: "PENDING_OFFICER",
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single<{ id: string }>();

  if (conversation) {
    await supabase.from("tickets").update({ conversation_id: conversation.id }).eq("id", data.id);
    await supabase.from("chat_messages").insert({
      conversation_id: conversation.id,
      sender_id: session.user.id,
      sender_role: "USER",
      body: input.description,
    });
  }

  // Route to an officer who can handle it
  const { data: officers } = await admin
    .from("employees")
    .select("user_id, employee_role")
    .eq("employee_role", "OFFICER")
    .overrideTypes<{ user_id: string; employee_role: string }[]>();

  if (officers?.length) {
    const assignee = officers[Math.floor(Math.random() * officers.length)];
    await supabase.from("tickets").update({ assigned_to: assignee.user_id }).eq("id", data.id);

    await admin.from("notifications").insert({
      user_id: assignee.user_id,
      type: "TICKET",
      title: `New ticket: ${input.subject}`,
      body: `${ticketNo} · ${input.category}`,
      link: `/employee/tickets/${data.id}`,
    });
  }

  revalidatePath("/user/tickets");
  return { success: true, ticketId: data.id, conversationId: conversation?.id };
}

export async function updateTicketStatus(
  ticketId: string,
  status: string,
  resolution?: string,
) {
  const session = await requireSession();
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: ticket } = await supabase
    .from("tickets")
    .select("user_id, ticket_no")
    .eq("id", ticketId)
    .maybeSingle<{ user_id: string; ticket_no: string }>();

  if (!ticket) return { error: "Ticket not found." };

  await supabase
    .from("tickets")
    .update({
      status: status as never,
      resolution: resolution ?? null,
      resolved_at: ["RESOLVED", "CLOSED"].includes(status) ? new Date().toISOString() : null,
    })
    .eq("id", ticketId);

  await admin.from("notifications").insert({
    user_id: ticket.user_id,
    type: "TICKET",
    title: `Ticket ${ticket.ticket_no} is now ${status.toLowerCase().replace("_", " ")}`,
    body: resolution ?? undefined,
    link: "/user/tickets",
  });

  revalidatePath("/employee/tickets");
  revalidatePath("/user/tickets");
  return { success: true };
}

/* ─── NOC (source doc lines 166-170) ──────────────────────────────────────── */

export async function requestNoc(loanId: string) {
  const session = await requireSession();
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: loan } = await supabase
    .from("loans")
    .select("id, account_number, status, user_id")
    .eq("id", loanId)
    .eq("user_id", session.user.id)
    .maybeSingle<{ id: string; account_number: string; status: string; user_id: string }>();

  if (!loan) return { error: "Loan not found." };

  // Only a fully repaid loan qualifies
  const { data: unpaid } = await supabase
    .from("emi_schedule")
    .select("id")
    .eq("loan_id", loanId)
    .in("status", ["UPCOMING", "OVERDUE", "PARTIALLY_PAID"]);

  if (unpaid && unpaid.length > 0) {
    return {
      error: `You still have ${unpaid.length} instalment(s) outstanding. An NOC can only be claimed once the loan is fully repaid.`,
    };
  }

  const { error } = await supabase.from("noc_requests").insert({
    loan_id: loanId,
    user_id: session.user.id,
    account_number: loan.account_number,
    status: "PENDING",
  });

  if (error && !error.message.includes("duplicate")) {
    return { error: error.message };
  }

  // Notify a manager to review
  const { data: managers } = await admin
    .from("employees")
    .select("user_id")
    .eq("employee_role", "MANAGER")
    .overrideTypes<{ user_id: string }[]>();

  for (const m of managers ?? []) {
    await admin.from("notifications").insert({
      user_id: m.user_id,
      type: "NOC",
      title: "NOC request awaiting approval",
      body: `Account ${loan.account_number} — all instalments cleared.`,
      link: "/employee/noc",
    });
  }

  await supabase.from("loans").update({ status: "CLOSED", closed_at: new Date().toISOString() }).eq("id", loanId);

  revalidatePath(`/user/loans/${loanId}`);
  revalidatePath("/employee/noc");
  return { success: true };
}

export async function decideNoc(
  nocId: string,
  decision: "APPROVED" | "REJECTED",
  note?: string,
) {
  const session = await requireSession();
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: noc } = await supabase
    .from("noc_requests")
    .select("loan_id, user_id, account_number")
    .eq("id", nocId)
    .maybeSingle<{ loan_id: string; user_id: string; account_number: string }>();

  if (!noc) return { error: "NOC request not found." };

  await supabase
    .from("noc_requests")
    .update({
      status: decision,
      reviewed_by: session.user.id,
      reviewed_at: new Date().toISOString(),
      decision_note: note ?? null,
    })
    .eq("id", nocId);

  if (decision === "APPROVED") {
    await supabase
      .from("loans")
      .update({ status: "NOC_ISSUED", noc_issued_at: new Date().toISOString() })
      .eq("id", noc.loan_id);
  }

  await admin.from("notifications").insert({
    user_id: noc.user_id,
    type: "NOC",
    title:
      decision === "APPROVED"
        ? "Your No Objection Certificate is ready"
        : "Your NOC request was declined",
    body:
      decision === "APPROVED"
        ? `Download it from account ${noc.account_number}.`
        : note ?? "Contact your officer for details.",
    link: `/user/loans/${noc.loan_id}`,
  });

  revalidatePath("/employee/noc");
  revalidatePath(`/user/loans/${noc.loan_id}`);
  return { success: true };
}

/* ─── Servicing ───────────────────────────────────────────────────────────── */

export async function markEmiPaid(emiId: string, mode: string) {
  const session = await requireSession();
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: emi } = await supabase
    .from("emi_schedule")
    .select("*, loan:loans (user_id, account_number, outstanding_principal, id)")
    .eq("id", emiId)
    .maybeSingle();

  if (!emi) return { error: "Instalment not found." };

  const amount = Number(emi.amount_due) + Number(emi.penalty_amount);

  const { count } = await admin.from("payments").select("id", { count: "exact", head: true });
  const receiptNo = `RCP-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${String((count ?? 0) + 1).padStart(4, "0")}`;

  await admin.from("payments").insert({
    loan_id: emi.loan_id,
    emi_id: emiId,
    receipt_no: receiptNo,
    amount,
    penalty_amount: Number(emi.penalty_amount),
    mode: mode as never,
    gateway: process.env.PAYMENT_PROVIDER ?? "mock",
    gateway_ref: `PG${Math.random().toString(36).slice(2, 12).toUpperCase()}`,
    txn_id: `TXN${Math.random().toString(36).slice(2, 14).toUpperCase()}`,
    status: "SUCCESS",
  });

  await admin
    .from("emi_schedule")
    .update({
      status: "PAID",
      paid_amount: amount,
      paid_at: new Date().toISOString(),
      days_past_due: 0,
    })
    .eq("id", emiId);

  // Reduce the outstanding balance
  const loan = emi.loan as unknown as { id: string; outstanding_principal: number };
  await admin
    .from("loans")
    .update({ outstanding_principal: Number(loan.outstanding_principal) - Number(emi.principal_part) })
    .eq("id", loan.id);

  await admin.from("notifications").insert({
    user_id: session.user.id,
    type: "PAYMENT",
    title: `Payment received — ${receiptNo}`,
    body: `${amount.toLocaleString("en-IN", { style: "currency", currency: "INR" })} against instalment #${emi.installment_no}.`,
    link: "/user/payments",
  });

  revalidatePath("/user/loans");
  revalidatePath("/user/payments");
  revalidatePath("/employee/loans");
  return { success: true };
}

export async function flagOverdue(emiId: string) {
  const session = await requireSession();
  const admin = createAdminClient();

  const { data: emi } = await admin
    .from("emi_schedule")
    .select("*, loan:loans (user_id, account_number, product:loan_products (grace_days, late_fee_flat, late_fee_pct))")
    .eq("id", emiId)
    .maybeSingle();

  if (!emi) return { error: "Instalment not found." };

  const loan = emi.loan as unknown as {
    user_id: string;
    account_number: string;
    product: { grace_days: number; late_fee_flat: number; late_fee_pct: number };
  };

  const daysPastDue = Math.max(
    0,
    Math.floor((Date.now() - new Date(emi.due_date).getTime()) / 86_400_000),
  );

  // Late fee only applies once the grace period has lapsed (GAP 9)
  const penalty =
    daysPastDue > loan.product.grace_days
      ? Math.max(
          Number(loan.product.late_fee_flat),
          (Number(emi.amount_due) * Number(loan.product.late_fee_pct)) / 100,
        )
      : 0;

  await admin
    .from("emi_schedule")
    .update({
      status: "OVERDUE",
      days_past_due: daysPastDue,
      penalty_amount: penalty,
    })
    .eq("id", emiId);

  // Notify the borrower (source doc line 155)
  await admin.from("notifications").insert({
    user_id: loan.user_id,
    type: "PAYMENT",
    title: "An EMI on your loan is overdue",
    body: `Instalment #${emi.installment_no} on account ${loan.account_number} was due on ${emi.due_date}.${penalty > 0 ? ` A late fee of ₹${penalty.toFixed(0)} applies.` : ""}`,
    link: `/user/loans/${emi.loan_id}`,
  });

  revalidatePath("/employee/loans");
  revalidatePath("/user/loans");
  return { success: true };
}

export async function makePrepayment(loanId: string, amount: number) {
  const session = await requireSession();
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: loan } = await supabase
    .from("loans")
    .select("*")
    .eq("id", loanId)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!loan) return { error: "Loan not found." };

  const nextEmi = (
    await supabase
      .from("emi_schedule")
      .select("id")
      .eq("loan_id", loanId)
      .in("status", ["UPCOMING", "OVERDUE"])
      .order("due_date", { ascending: true })
      .limit(1)
  ).data?.[0];

  if (!nextEmi) return { error: "There is no upcoming instalment to attach this to." };

  const { count } = await admin.from("payments").select("id", { count: "exact", head: true });
  const receiptNo = `RCP-PP-${String((count ?? 0) + 1).padStart(4, "0")}`;

  await admin.from("payments").insert({
    loan_id: loanId,
    emi_id: nextEmi.id,
    receipt_no: receiptNo,
    amount,
    mode: "UPI",
    gateway: process.env.PAYMENT_PROVIDER ?? "mock",
    txn_id: `TXN${Math.random().toString(36).slice(2, 14).toUpperCase()}`,
    status: "SUCCESS",
    is_prepayment: true,
  });

  await admin
    .from("loans")
    .update({ outstanding_principal: Number(loan.outstanding_principal) - amount })
    .eq("id", loanId);

  // Flag to the officer that a prepayment landed, so they can re-issue the
  // schedule and the e-bill (source doc lines 149-151)
  await admin.from("notifications").insert({
    user_id: loan.user_id,
    type: "PAYMENT",
    title: `Prepayment received — ${receiptNo}`,
    body: `₹${amount.toLocaleString("en-IN")} applied against your ${loan.product_id ? "loan" : "loan"}. Your officer will re-issue the schedule.`,
    link: `/user/loans/${loanId}`,
  });

  revalidatePath(`/user/loans/${loanId}`);
  revalidatePath("/employee/loans");
  return { success: true };
}

export async function generateEbill(loanId: string) {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: nextEmi } = await supabase
    .from("emi_schedule")
    .select("*")
    .eq("loan_id", loanId)
    .in("status", ["UPCOMING", "OVERDUE"])
    .order("due_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!nextEmi) return { error: "No upcoming instalment to bill." };

  const { count } = await supabase.from("ebills").select("id", { count: "exact", head: true });

  await supabase.from("ebills").insert({
    loan_id: loanId,
    emi_id: nextEmi.id,
    bill_no: `BILL-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${String((count ?? 0) + 1).padStart(4, "0")}`,
    period_from: nextEmi.due_date,
    period_to: nextEmi.due_date,
    amount: Number(nextEmi.amount_due) + Number(nextEmi.penalty_amount),
  });

  revalidatePath(`/user/loans/${loanId}`);
  return { success: true };
}