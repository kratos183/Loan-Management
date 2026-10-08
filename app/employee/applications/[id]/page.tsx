import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  MessageSquare,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Portal, loadPortal } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";
import { getApplicantProfile, getApplicationWithDocs, getOfficerAuthority } from "@/lib/queries/staff";
import { getRequirements } from "@/lib/queries/applications";
import { assessEligibility } from "@/lib/finance/risk";
import { calculateEmi, totalInterest } from "@/lib/finance/emi";
import { StatusBadge, CategoryBadge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, Avatar, DataList, SectionTitle } from "@/components/ui/primitives";
import { TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { formatDate, formatDateTime, money, moneyCompact, percent, relativeTime, tenure } from "@/lib/format";
import { EligibilityScorecard } from "@/components/applications/eligibility-scorecard";
import { DecisionPanel } from "@/components/applications/decision-panel";

export const metadata = { title: "Review Application" };

export default async function ReviewApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await loadPortal("employee");
  const me = ctx.session.user.id;

  const bundle = await getApplicationWithDocs(id);
  if (!bundle) notFound();

  const { application: app, documents, collateral, events, resubmission } = bundle;
  if (!app.product) notFound();

  // Bind to a local so the null-check above narrows for the whole JSX tree
  const product = app.product;

  const [requirements, applicantData, authority] = await Promise.all([
    getRequirements(product.id, product.collateral_type),
    getApplicantProfile(app.user_id),
    getOfficerAuthority(me),
  ]);

  const midRate = (Number(product.min_rate) + Number(product.max_rate)) / 2;
  const emi = calculateEmi(app.requested_amount, midRate, app.tenure_months);

  // Documents the officer can flag for correction
  const correctable = documents.filter(
    (d) => d.part !== "C" && d.status !== "VERIFIED",
  );

  const decided = ["APPROVED", "REJECTED", "WITHDRAWN"].includes(app.status);
  const officerLimit = authority?.approval_limit ?? null;
  const canApproveDirectly = officerLimit == null || Number(app.requested_amount) <= officerLimit;

  // Pre-compute the applicant's standing scorecard for context
  const standing = assessEligibility({
    profile: {
      monthly_income: Number(applicantData.profile?.monthly_income ?? 0),
      pan: applicantData.profile?.pan ?? null,
    },
    product: product,
    requestedAmount: Number(app.requested_amount),
    tenureMonths: app.tenure_months,
    liabilities: applicantData.liabilities,
    cibilScore: applicantData.cibil?.score ?? null,
  });

  return (
    <Portal
      which="employee"
      maxWidth="max-w-[1500px]"
      breadcrumb={
        <Link
          href="/employee/applications"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-500 hover:text-brand-700"
        >
          <ArrowLeft className="size-3.5" />
          Back to queue
        </Link>
      }
      title={app.applicant?.full_name}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono">{app.reference_no}</span>
          <StatusBadge status={app.status} />
          <CategoryBadge category={product.category} />
          <span>· submitted {relativeTime(app.submitted_at)}</span>
        </span>
      }
      actions={
        app.user_id ? (
          <LinkButton
            href={`/employee/chat?user=${app.user_id}`}
            variant="outline"
            size="sm"
            icon={<MessageSquare className="size-4" />}
          >
            Message applicant
          </LinkButton>
        ) : undefined
      }
    >
      {/* Open resubmission request */}
      {resubmission && (
        <Alert tone="warning" title="Resubmission requested" icon={<ShieldCheck />} className="mb-5">
          <p className="whitespace-pre-line">{resubmission.reason}</p>
          <p className="mt-2 text-xs opacity-80">
            Requested {relativeTime(resubmission.requested_at)} ·{" "}
            {resubmission.allowed_documents.length} document(s) unlocked for the applicant.
          </p>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* ─── Main column ─── */}
        <div className="space-y-6">
          {/* Request summary */}
          <Card>
            <CardHeader
              title="Application summary"
              icon={<FileText className="size-4" />}
              action={
                <span className="text-xl">{product.thumbnail_emoji}</span>
              }
            />
            <CardBody>
              <DataList
                items={[
                  { label: "Product", value: product.name },
                  {
                    label: "Collateral",
                    value:
                      product.collateral_type === "NONE"
                        ? "None (unsecured)"
                        : product.collateral_type,
                  },
                  { label: "Requested amount", value: money(app.requested_amount) },
                  { label: "Tenure", value: tenure(app.tenure_months) },
                  { label: "Purpose", value: app.purpose ?? "—" },
                  {
                    label: "Rate band",
                    value: `${percent(product.min_rate)} – ${percent(product.max_rate)}`,
                  },
                  { label: "Indicative EMI", value: money(emi) },
                  {
                    label: "Total interest",
                    value: money(totalInterest(app.requested_amount, midRate, app.tenure_months)),
                  },
                ]}
              />

              {collateral.length > 0 && (
                <div className="mt-5 border-t border-ink-100 pt-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                    Collateral details
                  </p>
                  <DataList
                    items={collateral.flatMap((c) => [
                      { label: "Collateral type", value: c.type },
                      {
                        label: "Estimated value",
                        value: c.estimated_value ? money(c.estimated_value) : "—",
                      },
                      ...Object.entries(c.details ?? {}).map(([k, v]) => ({
                        label: k.replace(/_/g, " "),
                        value: String(v),
                      })),
                    ])}
                  />
                </div>
              )}
            </CardBody>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader
              title="Documents"
              description="Verify each item, or flag it for correction"
              icon={<FileText className="size-4" />}
              action={
                <span className="text-xs text-ink-500">
                  {documents.filter((d) => d.status === "VERIFIED").length}/
                  {documents.length} verified
                </span>
              }
            />
            <div className="divide-y divide-ink-100">
              {groupByPart(requirements, documents).map((part) => (
                <div key={part.part} className="p-5">
                  <SectionTitle>{partTitle(part.part, product.category)}</SectionTitle>
                  <ul className="space-y-2">
                    {part.items.map((item) => {
                      const doc = item.doc;
                      return (
                        <li
                          key={item.requirement.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 px-3.5 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-ink-800">
                              {item.requirement.label}
                              {item.requirement.is_required && (
                                <span className="ml-1 text-danger-500">*</span>
                              )}
                            </p>
                            <p className="font-mono text-[11px] text-ink-400">
                              {item.requirement.doc_type}
                              {doc?.file_name && ` · ${doc.file_name}`}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {!doc && <StatusBadge status="PENDING" />}
                            {doc && <StatusBadge status={doc.status} />}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </Card>

          {/* Applicant standing */}
          <Card>
            <CardHeader
              title="Applicant standing"
              description="Context on this applicant's file"
              icon={<Wallet className="size-4" />}
            />
            <CardBody>
              <div className="mb-4 flex items-center gap-3">
                <Avatar name={app.applicant?.full_name} size="lg" />
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-ink-900">
                    {app.applicant?.full_name}
                  </p>
                  <p className="text-[13px] text-ink-500">
                    {app.applicant?.email}
                    {app.applicant?.phone && ` · ${app.applicant.phone}`}
                  </p>
                </div>
              </div>

              <DataList
                items={[
                  {
                    label: "Monthly income",
                    value: applicantData.profile?.monthly_income
                      ? money(applicantData.profile.monthly_income)
                      : "Not declared",
                  },
                  { label: "Employment", value: applicantData.profile?.employment_type ?? "—" },
                  { label: "Employer", value: applicantData.profile?.employer ?? "—" },
                  {
                    label: "Credit score",
                    value: applicantData.cibil
                      ? `${applicantData.cibil.score} (${applicantData.cibil.band})`
                      : "Not checked",
                  },
                  {
                    label: "Existing EMIs",
                    value: `${applicantData.activeLoans.length} loan(s)`,
                  },
                  {
                    label: "Declared liabilities",
                    value: `${applicantData.liabilities.length}`,
                  },
                  {
                    label: "Computed FOIR",
                    value: percent(standing.foir, 1),
                  },
                  {
                    label: "Assessment",
                    value: standing.verdict,
                  },
                ]}
              />

              {applicantData.liabilities.length > 0 && (
                <div className="mt-5 border-t border-ink-100 pt-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                    Declared obligations
                  </p>
                  <ul className="space-y-1.5">
                    {applicantData.liabilities.map((l) => (
                      <li key={l.id} className="flex justify-between text-[13px]">
                        <span className="text-ink-600">
                          {l.lender}{" "}
                          <span className="text-ink-400">({l.liability_type.replace("_", " ")})</span>
                        </span>
                        <span className="tabular-nums font-medium text-ink-900">
                          {money(l.monthly_amount)}/mo
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="tabular-nums mt-2 border-t border-ink-100 pt-2 text-[13px] font-semibold text-ink-900">
                    Total {money(standing.existingEmiBurden)}/mo
                  </p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader title="Activity" description="Everything that has happened" />
            <CardBody>
              <ol className="space-y-4">
                {events.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <span className="mt-1 size-2 shrink-0 rounded-full bg-brand-400 ring-4 ring-brand-50" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-ink-800">
                        {e.message ?? e.event_type.replace(/_/g, " ").toLowerCase()}
                      </p>
                      <p className="text-[11px] text-ink-400">
                        {formatDateTime(e.created_at)}
                        {e.actor_role && ` · ${e.actor_role.toLowerCase()}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>

        {/* ─── Decision rail ─── */}
        <div className="space-y-5">
          {!decided && product && (
            <>
              <EligibilityScorecard
                product={product}
                applicant={applicantData.profile}
                liabilities={applicantData.liabilities}
                cibilScore={applicantData.cibil?.score ?? null}
                officerLimit={officerLimit}
                initialAmount={Number(app.requested_amount)}
                initialTenure={app.tenure_months}
              />

              <DecisionPanel
                applicationId={app.id}
                product={product}
                amount={Number(app.requested_amount)}
                tenureMonths={app.tenure_months}
                emi={emi}
                offeredRate={midRate}
                canApproveDirectly={canApproveDirectly}
                rejectedDocIds={correctable.map((d) => d.id)}
              />
            </>
          )}

          {decided && (
            <Card>
              <CardHeader title="Decision" />
              <CardBody className="space-y-3">
                <div className="flex items-center gap-2">
                  <StatusBadge status={app.status} />
                  <span className="text-xs text-ink-400">
                    {formatDateTime(app.decided_at)}
                  </span>
                </div>
                {app.decision_notes && (
                  <p className="rounded-lg bg-ink-50 p-3 text-[13px] leading-relaxed text-ink-700">
                    {app.decision_notes}
                  </p>
                )}
                {app.status === "APPROVED" && app.assigned_account_number && (
                  <div className="space-y-1.5 border-t border-ink-100 pt-3">
                    <Row label="Sanctioned" value={money(app.approved_amount)} />
                    <Row label="Rate" value={percent(app.offered_rate)} />
                    <Row label="EMI" value={money(app.emi_amount)} />
                    <Row label="Account" value={app.assigned_account_number} mono />
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Product policy" description={product.name} />
            <CardBody>
              <DataList
                columns={1}
                items={[
                  { label: "Min income", value: moneyCompact(product.min_monthly_income ?? 0) },
                  { label: "Min CIBIL", value: product.min_cibil ?? "—" },
                  { label: "Max FOIR", value: percent(product.max_foir, 0) },
                  { label: "Age range", value: `${product.min_age} – ${product.max_age}` },
                  { label: "Processing fee", value: percent(product.processing_fee_pct, 1) },
                  { label: "Grace period", value: `${product.grace_days} days` },
                  {
                    label: "Late fee",
                    value: `${money(product.late_fee_flat)} or ${percent(product.late_fee_pct, 1)}`,
                  },
                  {
                    label: "SLA",
                    value: `${product.sla_min_days}–${product.sla_max_days} working days`,
                  },
                ]}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </Portal>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-ink-500">{label}</span>
      <span className={`tabular-nums font-semibold text-ink-900 ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function partTitle(part: string, category: string) {
  switch (part) {
    case "A":
      return "Part A · Identity, income and banking";
    case "B":
      return category === "SECURED"
        ? "Part B · Collateral verification"
        : "Part B · Financial and risk assessment";
    case "C":
      return "Part C · Consent and acknowledgement";
    case "D":
      return "Part D · Final acknowledgement";
    default:
      return `Part ${part}`;
  }
}

/** Join requirements to whatever documents the applicant has uploaded. */
function groupByPart(
  requirements: { id: string; part: string; label: string; doc_type: string; is_required: boolean; sort_order: number }[],
  documents: { id: string; section_key: string; status: string; file_name: string | null }[],
) {
  const parts = ["A", "B", "C", "D"] as const;

  return parts
    .map((part) => {
      const reqs = requirements
        .filter((r) => r.part === part)
        .sort((a, b) => a.sort_order - b.sort_order);

      const items = reqs.map((req) => {
        // application_documents.requirement_id is the join key
        const doc = documents.find((d) => d.section_key === matchSectionKey(req.label)) ?? null;
        return { requirement: req, doc };
      });

      return { part, items };
    })
    .filter((g) => g.items.length > 0);
}

/** Map a requirement label to the section_key used in the seed data. */
function matchSectionKey(label: string): string {
  const map: Record<string, string> = {
    "PAN card": "identity_pan",
    "Aadhaar card": "identity_aadhaar",
    "Passport photograph": "identity_photo",
    "Address proof": "residence_proof",
    "Salary slips": "income_salary",
    "Income tax return": "income_itr",
    "Bank statements": "bank_statement",
    "Credit bureau consent": "credit_consent",
    "Existing obligations": "liability_declaration",
    "Title deed / ownership proof": "prop_title",
    "Encumbrance certificate": "prop_ec",
    "Property tax receipts": "prop_tax",
    "Approved building plan": "prop_plan",
    "Valuation report": "prop_estate",
    "RC book": "veh_rc",
    "Insurance policy": "veh_insurance",
    "Hypothecation form": "veh_hypo",
    "Purchase invoice": "veh_invoice",
    "Gold purchase invoice": "gold_receipt",
    "Purity certificate": "gold_purity",
    "Weight in grams": "gold_weight",
    "Terms and conditions": "tc_acceptance",
    "Applicant consent form": "applicant_consent",
    "Collateral acknowledgement form": "collateral_consent",
  };
  return map[label] ?? label.toLowerCase().replace(/[^a-z]+/g, "_");
}