import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { Portal, loadPortal } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";
import { getApplication, getApplicationDocuments } from "@/lib/queries/applications";
import { StatusBadge, CategoryBadge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, Avatar, DataList, SectionTitle } from "@/components/ui/primitives";
import { formatDate, formatDateTime, money, percent, relativeTime, tenure } from "@/lib/format";
import type { ApplicationEvent } from "@/lib/db/types";

export const metadata = { title: "Application" };

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await loadPortal("user");
  const supabase = await createClient();

  const app = await getApplication(id, ctx.session.user.id);
  if (!app) notFound();

  const [documents, eventsRes, resubRes] = await Promise.all([
    getApplicationDocuments(id),
    supabase
      .from("application_events")
      .select("*")
      .eq("application_id", id)
      .order("created_at", { ascending: false })
      .overrideTypes<ApplicationEvent[]>(),
    supabase
      .from("resubmission_requests")
      .select("*")
      .eq("application_id", id)
      .eq("status", "OPEN")
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const events = eventsRes.data ?? [];
  const resubmission = resubRes.data;

  // Documents the officer has unlocked for correction
  const needsFix = documents.filter((d) => d.status === "REJECTED" && !d.is_locked);
  const locked = documents.filter((d) => d.status === "REJECTED" && d.is_locked);
  const pending = documents.filter((d) => d.status === "PENDING");
  const verified = documents.filter((d) => d.status === "VERIFIED");

  const product = app.product;
  const canEdit = ["DRAFT", "RESUBMISSION_REQUESTED"].includes(app.status);

  return (
    <Portal
      which="user"
      maxWidth="max-w-[1200px]"
      breadcrumb={
        <Link
          href="/user/applications"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-500 hover:text-brand-700"
        >
          <ArrowLeft className="size-3.5" />
          All applications
        </Link>
      }
      title={product?.name ?? "Application"}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono">{app.reference_no}</span>
          <StatusBadge status={app.status} />
          {product && <CategoryBadge category={product.category} />}
          <span>· applied {relativeTime(app.created_at)}</span>
        </span>
      }
      actions={
        app.assigned_officer_id ? (
          <LinkButton
            href={`/user/chat?application=${app.id}`}
            variant="outline"
            size="sm"
            icon={<MessageSquare className="size-4" />}
          >
            Message officer
          </LinkButton>
        ) : undefined
      }
    >
      {/* ─── Status banners ─── */}
      <div className="space-y-3">
        {app.status === "RESUBMISSION_REQUESTED" && resubmission && (
          <Alert tone="warning" title="Your officer needs corrections" icon={<AlertTriangle />}>
            <p className="whitespace-pre-line">{resubmission.reason}</p>
            <p className="mt-2 text-xs opacity-80">
              Requested {relativeTime(resubmission.requested_at)}. Only the documents marked
              "Action needed" below can be replaced — everything else is already verified.
            </p>
          </Alert>
        )}

        {["SUBMITTED", "UNDER_REVIEW"].includes(app.status) && product && (
          <Alert tone="info" title="Under verification" icon={<Clock />}>
            Your application was submitted {relativeTime(app.submitted_at)}. Expected decision
            within {product.sla_min_days}–{product.sla_max_days} working days
            {app.sla_due_at && (
              <>
                , by {formatDate(app.sla_due_at)}
                {new Date(app.sla_due_at) < new Date() && " (past due — we're on it)"}
              </>
            )}
            .{" "}
            {app.officer && (
              <>
                Your application is with{" "}
                <strong className="font-semibold">{app.officer.full_name}</strong>.
              </>
            )}
          </Alert>
        )}

        {app.status === "APPROVED" && (
          <Alert tone="success" title="Approved and disbursed" icon={<CheckCircle2 />}>
            Your loan is active. You can now pay EMIs, download e-bills and track every
            instalment.
            <span className="mt-2 block">
              <LinkButton href={`/user/loans`} size="sm" variant="success">
                Go to my loan
              </LinkButton>
            </span>
          </Alert>
        )}

        {app.status === "REJECTED" && (
          <Alert tone="danger" title="Application declined" icon={<AlertTriangle />}>
            {app.decision_reason ?? "Your application did not meet the criteria for this product."}
          </Alert>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* ─── Documents ─── */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Documents"
              description="Track each item as it is verified"
              icon={<FileText className="size-4" />}
              action={
                <span className="text-xs text-ink-500">
                  {verified.length} of {documents.length} verified
                </span>
              }
            />
            <CardBody>
              {documents.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-ink-400">
                  No documents uploaded yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {needsFix.length > 0 && (
                    <div>
                      <SectionTitle>Action needed ({needsFix.length})</SectionTitle>
                      <ul className="space-y-2">
                        {needsFix.map((d) => (
                          <li
                            key={d.id}
                            className="rounded-lg border border-warning-300 bg-warning-50/50 p-3.5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[13px] font-medium text-ink-800">
                                  {labelFor(d.section_key, d.doc_type)}
                                </p>
                                {d.file_name && (
                                  <p className="truncate font-mono text-[11px] text-ink-400">
                                    {d.file_name}
                                  </p>
                                )}
                              </div>
                              <StatusBadge status={d.status} />
                            </div>
                            {d.rejection_reason && (
                              <p className="mt-2 rounded-md bg-white px-3 py-2 text-[12px] leading-relaxed text-ink-700">
                                <strong className="text-ink-900">Why:</strong>{" "}
                                {d.rejection_reason}
                              </p>
                            )}
                            {canEdit && (
                              <Button size="xs" variant="outline" className="mt-2.5">
                                Replace document
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {pending.length > 0 && (
                    <div>
                      <SectionTitle>Awaiting verification ({pending.length})</SectionTitle>
                      <ul className="space-y-2">
                        {pending.map((d) => (
                          <li
                            key={d.id}
                            className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 px-3.5 py-2.5"
                          >
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-ink-800">
                                {labelFor(d.section_key, d.doc_type)}
                              </p>
                              {d.file_name && (
                                <p className="truncate font-mono text-[11px] text-ink-400">
                                  {d.file_name}
                                </p>
                              )}
                            </div>
                            <StatusBadge status={d.status} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {verified.length > 0 && (
                    <div>
                      <SectionTitle>Verified ({verified.length})</SectionTitle>
                      <ul className="space-y-2">
                        {verified.map((d) => (
                          <li
                            key={d.id}
                            className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 px-3.5 py-2.5"
                          >
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-ink-700">
                                {labelFor(d.section_key, d.doc_type)}
                              </p>
                              {d.reviewed_at && (
                                <p className="text-[11px] text-ink-400">
                                  Verified {formatDate(d.reviewed_at)}
                                </p>
                              )}
                            </div>
                            <StatusBadge status={d.status} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader title="Progress" description="Every step so far" />
            <CardBody>
              <ol className="space-y-4">
                {events.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <span
                      className={cn2(
                        "mt-1.5 size-2 shrink-0 rounded-full ring-4",
                        e.event_type === "REJECTED"
                          ? "bg-danger-500 ring-danger-50"
                          : e.event_type === "DISBURSED"
                            ? "bg-positive-500 ring-positive-50"
                            : "bg-brand-400 ring-brand-50",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-ink-800">
                        {e.message ?? e.event_type.replace(/_/g, " ").toLowerCase()}
                      </p>
                      <p className="text-[11px] text-ink-400">
                        {formatDateTime(e.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>

        {/* ─── Summary rail ─── */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Request" />
            <CardBody>
              <DataList
                columns={1}
                items={[
                  { label: "Product", value: product?.name ?? "—" },
                  { label: "Amount", value: money(app.requested_amount) },
                  { label: "Tenure", value: tenure(app.tenure_months) },
                  { label: "Purpose", value: app.purpose ?? "—" },
                  ...(app.approved_amount
                    ? [{ label: "Sanctioned", value: money(app.approved_amount) }]
                    : []),
                  ...(app.offered_rate
                    ? [{ label: "Rate", value: `${percent(app.offered_rate)} p.a.` }]
                    : []),
                  ...(app.emi_amount ? [{ label: "EMI", value: money(app.emi_amount) }] : []),
                ]}
              />
            </CardBody>
          </Card>

          {app.officer && (
            <Card>
              <CardHeader title="Your officer" icon={<ShieldCheck className="size-4" />} />
              <CardBody>
                <div className="flex items-center gap-3">
                  <Avatar name={app.officer.full_name} size="md" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink-900">
                      {app.officer.full_name}
                    </p>
                    <p className="truncate text-xs text-ink-500">{app.officer.email}</p>
                  </div>
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-ink-500">
                  Hover over your application's status to see who is handling it, or message
                  them directly from the chat screen.
                </p>
                <LinkButton
                  href={`/user/chat?application=${app.id}`}
                  size="sm"
                  variant="outline"
                  fullWidth
                  className="mt-3"
                  icon={<MessageSquare className="size-3.5" />}
                >
                  Ask a question
                </LinkButton>
              </CardBody>
            </Card>
          )}

          {locked.length > 0 && (
            <Alert tone="neutral" title={`${locked.length} item(s) locked`}>
              Some documents were rejected by the officer but marked as final. Contact your
              officer if you believe that's wrong.
            </Alert>
          )}
        </div>
      </div>
    </Portal>
  );
}

function cn2(...parts: string[]) {
  return parts.filter(Boolean).join(" ");
}

const LABELS: Record<string, string> = {
  identity_pan: "PAN card",
  identity_aadhaar: "Aadhaar card",
  identity_photo: "Passport photograph",
  residence_proof: "Address proof",
  income_salary: "Salary slips",
  income_itr: "Income tax return",
  bank_statement: "Bank statements",
  credit_consent: "Credit bureau consent",
  liability_declaration: "Existing obligations",
  prop_title: "Title deed / ownership proof",
  prop_ec: "Encumbrance certificate",
  prop_tax: "Property tax receipts",
  prop_plan: "Approved building plan",
  prop_estate: "Valuation report",
  prop_valuation: "Valuation report",
  veh_rc: "RC book",
  veh_insurance: "Insurance policy",
  veh_valuation: "Valuation report",
  veh_hypo: "Hypothecation form",
  veh_invoice: "Purchase invoice",
  gold_receipt: "Gold purchase invoice",
  gold_purity: "Purity certificate",
  gold_weight: "Weight in grams",
  gold_valuation: "Valuation certificate",
  fin_fd: "Fixed deposit receipt",
  fin_demat: "Demat holding statement",
  fin_lien: "Lien / pledge authorisation",
  tc_acceptance: "Terms and conditions",
  applicant_consent: "Applicant consent form",
  collateral_consent: "Collateral acknowledgement form",
  loan_terms: "Loan terms you selected",
};

function labelFor(sectionKey: string, docType: string) {
  return LABELS[sectionKey] ?? docType.replace(/_/g, " ").toLowerCase();
}