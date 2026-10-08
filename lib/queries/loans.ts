import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Emi, LoanWithRelations, Payment } from "@/lib/db/types";

export async function listLoansForUser(userId: string, statuses?: string[]) {
  const supabase = await createClient();
  let query = supabase
    .from("loans")
    .select("*, product:loan_products (*)")
    .eq("user_id", userId)
    .order("disbursed_at", { ascending: false });

  if (statuses?.length) query = query.in("status", statuses);
  else query = query.neq("status", "CLOSED");

  const { data, error } = await query.overrideTypes<LoanWithRelations[]>();
  if (error) throw new Error(`listLoansForUser: ${error.message}`);
  return data ?? [];
}

export async function getLoanForUser(loanId: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("loans")
    .select("*, product:loan_products (*)")
    .eq("id", loanId)
    .eq("user_id", userId)
    .single<LoanWithRelations>();
  return data ?? null;
}

export async function listEmis(loanId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("emi_schedule")
    .select("*")
    .eq("loan_id", loanId)
    .order("installment_no", { ascending: true })
    .overrideTypes<Emi[]>();
  return (data ?? []) as Emi[];
}

export async function listPayments(userId: string, loanId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("payments")
    .select("*, loan:loans (account_number, product:loan_products (name))")
    .order("txn_date", { ascending: false })
    .limit(200);

  if (loanId) query = query.eq("loan_id", loanId);
  else {
    const { data: loans } = await supabase.from("loans").select("id").eq("user_id", userId);
    const ids = (loans ?? []).map((l) => l.id);
    if (!ids.length) return [];
    query = query.in("loan_id", ids);
  }

  const { data } = await query.overrideTypes<Payment[]>();
  return (data ?? []) as Payment[];
}

export async function listAllLoans(statuses?: string[]) {
  const supabase = await createClient();
  let query = supabase
    .from("loans")
    .select("*, product:loan_products (*)")
    .order("disbursed_at", { ascending: false });

  if (statuses?.length) query = query.in("status", statuses);
  const { data } = await query.overrideTypes<LoanWithRelations[]>();
  return data ?? [];
}

export async function getLoan(loanId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("loans")
    .select("*, product:loan_products (*)")
    .eq("id", loanId)
    .single<LoanWithRelations>();
  return data ?? null;
}

export async function listOverdueEmis() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("emi_schedule")
    .select("*, loan:loans (account_number, user_id, product:loan_products (name))")
    .eq("status", "OVERDUE")
    .order("due_date", { ascending: true })
    .overrideTypes<(Emi & { loan: unknown })[]>();
  return data ?? [];
}

export async function listNocRequests(statuses: string[] = ["PENDING"]) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("noc_requests")
    .select("*, loan:loans (account_number, product:loan_products (name))")
    .in("status", statuses)
    .order("requested_at", { ascending: true });
  return data ?? [];
}

export async function getNocForLoan(loanId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("noc_requests")
    .select("*")
    .eq("loan_id", loanId)
    .maybeSingle();
  return data ?? null;
}

/** Roll-up used on the user dashboard and loan detail header. */
export function summariseLoan(loan: LoanWithRelations, emis: Emi[]) {
  const paid = emis.filter((e) => e.status === "PAID" || e.status === "PREPAID").length;
  const overdue = emis.filter((e) => e.status === "OVERDUE");
  const next = emis.find((e) => e.status === "UPCOMING");
  const paidAmount = emis
    .filter((e) => e.status === "PAID" || e.status === "PREPAID")
    .reduce((s, e) => s + Number(e.paid_amount), 0);

  return {
    instalmentsPaid: paid,
    instalmentsTotal: loan.tenure_months,
    progressPercent: loan.tenure_months ? (paid / loan.tenure_months) * 100 : 0,
    overdueCount: overdue.length,
    overdueAmount: overdue.reduce((s, e) => s + Number(e.amount_due) + Number(e.penalty_amount), 0),
    nextEmi: next ?? null,
    paidAmount,
    isClosed: loan.status === "CLOSED" || loan.status === "NOC_ISSUED",
  };
}