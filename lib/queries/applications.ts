import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  Application,
  ApplicationDocument,
  ApplicationWithRelations,
  Employee,
  LoanProduct,
  Profile,
} from "@/lib/db/types";

/**
 * Data access for the application workflow.
 *
 * Every function reads through the caller's Supabase session, so Row Level
 * Security decides what comes back. There is no `user_id` filter here that
 * the user could tamper with.
 */

const APP_SELECT = `
  *,
  product:loan_products (*),
  applicant:profiles!applications_user_id_fkey (
    id, full_name, email, phone, monthly_income
  ),
  officer:profiles!applications_assigned_officer_id_fkey (
    id, full_name, email
  )
`;

export async function listApplicationsForUser(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("applications")
    .select(APP_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .overrideTypes<ApplicationWithRelations[]>();

  if (error) throw new Error(`listApplicationsForUser: ${error.message}`);
  return data ?? [];
}

export async function getApplication(id: string, userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("applications")
    .select(APP_SELECT)
    .eq("id", id)
    .eq("user_id", userId)
    .single<ApplicationWithRelations>();

  if (error || !data) return null;
  return data;
}

export async function getApplicationDocuments(applicationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("application_documents")
    .select("*")
    .eq("application_id", applicationId)
    .order("sort_order", { referencedTable: "document_requirements" });
  return (data ?? []) as ApplicationDocument[];
}

/** The checklist for a product, split by the Part A/B/C/D wizard steps. */
export async function getRequirements(productId: string, collateralType: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("document_requirements")
    .select("*")
    .eq("product_id", productId)
    .order("part")
    .order("sort_order")
    .overrideTypes<import("@/lib/db/types").DocumentRequirement[]>();

  const all = (data ?? []) as import("@/lib/db/types").DocumentRequirement[];

  // Part B is the collateral-specific checklist; filter out sections that
  // belong to a different collateral type.
  if (collateralType && collateralType !== "NONE") {
    return all.filter((r) => {
      if (!r.applies_to_collateral || r.applies_to_collateral.length === 0) return true;
      return r.applies_to_collateral.includes(
        collateralType as import("@/lib/db/types").CollateralType,
      );
    });
  }
  return all;
}

export async function listActiveProducts() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("loan_products")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
    .order("category")
    .overrideTypes<LoanProduct[]>();
  return (data ?? []) as LoanProduct[];
}

export async function getProduct(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("loan_products")
    .select("*")
    .eq("id", id)
    .single<LoanProduct>();
  return data ?? null;
}

/**
 * Is this applicant inside a cooling-off window for the category?
 * Source doc lines 123–125: a rejected applicant cannot reapply to the SAME
 * category for three months.
 */
export async function getActiveCoolingPeriod(userId: string, category: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cooling_periods")
    .select("*")
    .eq("user_id", userId)
    .eq("category", category)
    .is("cleared_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return data ?? null;
}

/** Employee-side queue: everything assigned to this officer. */
export async function listAssignedApplications(officerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select(APP_SELECT)
    .eq("assigned_officer_id", officerId)
    .order("submitted_at", { ascending: true })
    .overrideTypes<ApplicationWithRelations[]>();
  return data ?? [];
}

export async function listAllApplications(statuses?: string[]) {
  const supabase = await createClient();
  let query = supabase
    .from("applications")
    .select(APP_SELECT)
    .order("created_at", { ascending: false });

  if (statuses?.length) query = query.in("status", statuses);

  const { data } = await query.overrideTypes<ApplicationWithRelations[]>();
  return data ?? [];
}

export async function getApplicationForStaff(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select(APP_SELECT)
    .eq("id", id)
    .single<ApplicationWithRelations>();
  return data ?? null;
}

/** Officers available for assignment, with their authority limits. */
export async function listOfficers() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("employees")
    .select(`
      *,
      profile:profiles!employees_user_id_fkey (id, full_name, email, role, status)
    `)
    .eq("employee_role", "OFFICER")
    .overrideTypes<(Employee & { profile: Profile | null })[]>();
  return (data ?? []) as (Employee & { profile: Profile | null })[];
}