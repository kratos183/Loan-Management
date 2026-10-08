"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileUp,
  Loader2,
  Lock,
  Send,
} from "lucide-react";
import { createApplication, saveDocument } from "@/lib/actions/applications";
import { submitApplication } from "@/lib/actions/applications";
import { Button } from "@/components/ui/button";
import { Checkbox, FileDrop, Input, Select, Textarea } from "@/components/ui/form";
import { Alert, ProgressBar } from "@/components/ui/primitives";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { calculateEmi, totalInterest } from "@/lib/finance/emi";
import { money, moneyCompact, percent, tenure } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AppPart, DocumentRequirement, LoanProduct } from "@/lib/db/types";

interface Props {
  product: LoanProduct;
  requirements: DocumentRequirement[];
  coolingPeriod: { expires_at: string; reason: string | null } | null;
}

/**
 * The multi-part application wizard.
 *
 * The checklist is data-driven from `document_requirements`, so admin can add
 * or remove items without touching this component. Part B's items are already
 * filtered to the product's collateral type server-side.
 */
export function ApplicationWizard({ product, requirements, coolingPeriod }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState(0);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Terms
  const [amount, setAmount] = useState(
    Math.round(((product.min_amount + product.max_amount) / 2) / 1000) * 1000,
  );
  const [tenureMonths, setTenureMonths] = useState(product.max_tenure_months);
  const [purpose, setPurpose] = useState("");
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});

  // Document values: sectionKey → { fileName, value }
  const [values, setValues] = useState<Record<string, { fileName?: string; value?: string }>>({});

  const emi = calculateEmi(amount, (product.min_rate + product.max_rate) / 2, tenureMonths);
  const interest = totalInterest(amount, (product.min_rate + product.max_rate) / 2, tenureMonths);

  // Group requirements into wizard steps
  const parts: AppPart[] = (["A", "B", "C", "D"] as AppPart[]).filter((p) =>
    requirements.some((r) => r.part === p),
  );

  const currentPart = parts[step] ?? "A";
  const currentItems = requirements
    .filter((r) => r.part === currentPart)
    .sort((a, b) => a.sort_order - b.sort_order);

  const filled = (key: string) => {
    const v = values[key];
    return Boolean(v?.fileName || v?.value);
  };

  const requiredMissing = currentItems.filter(
    (r) => r.is_required && r.input_kind !== "CHECKBOX" && !filled(r.section_key),
  );
  const currentComplete = requiredMissing.length === 0;

  /* ── Create the application on first submit ────────────────────────────── */
  function ensureApplication(): string | null {
    if (applicationId) return applicationId;
    setCreating(true);
    return null;
  }

  async function createAndAdvance() {
    setError(null);
    setCreating(true);

    try {
      const id = await createApplication({
        productId: product.id,
        requestedAmount: amount,
        tenureMonths,
        purpose: purpose || undefined,
      });
      setApplicationId(id);
      setCreating(false);

      // Move to the first part that needs input
      const firstIncomplete = parts.findIndex((p) =>
        requirements.some(
          (r) => r.part === p && r.is_required && r.input_kind !== "CHECKBOX",
        ),
      );
      setStep(firstIncomplete === -1 ? 0 : firstIncomplete);

      // Terms are saved as a text document so they appear in the audit trail
      startTransition(async () => {
        await saveDocument({
          applicationId: id,
          part: "A",
          sectionKey: "loan_terms",
          docType: "TERMS",
          value: `Amount ${amount} | Tenure ${tenureMonths} | Purpose: ${purpose || "not stated"}`,
        });
      });

      router.push(`/user/applications/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the application.");
      setCreating(false);
    }
  }

  async function saveItem(requirement: DocumentRequirement) {
    if (!applicationId) return;
    const current = values[requirement.section_key];

    startTransition(async () => {
      try {
        await saveDocument({
          applicationId,
          part: requirement.part,
          sectionKey: requirement.section_key,
          docType: requirement.doc_type,
          value: current?.value ?? "",
          fileName: current?.fileName,
          filePath: current?.fileName ? `uploads/${current.fileName}` : undefined,
          fileUrl: current?.fileName ? `seed/${current.fileName}` : undefined,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save that document.");
      }
    });
  }

  function goNext() {
    if (!currentComplete) {
      setError(
        `${requiredMissing.length} required item${requiredMissing.length > 1 ? "s are" : " is"} still missing on this step.`,
      );
      return;
    }
    setError(null);

    if (step < parts.length - 1) {
      setStep(step + 1);
      return;
    }
    void submitAll();
  }

  async function submitAll() {
    if (!applicationId) {
      setError("Save your details first.");
      return;
    }

    try {
      await submitApplication(applicationId);
      router.push(`/user/applications/${applicationId}?submitted=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit the application.");
    }
  }

  /* ── Cooling period lock ───────────────────────────────────────────────── */
  if (coolingPeriod) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-warning-50 text-warning-700">
            <Lock className="size-6" />
          </span>
          <h2 className="text-[15px] font-semibold text-ink-900">
            Not available for you right now
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-ink-500">
            Your last {product.category.toLowerCase()} application was declined. You can apply
            again for a {product.category.toLowerCase()} product from{" "}
            <strong className="text-ink-800">
              {new Date(coolingPeriod.expires_at).toLocaleDateString("en-IN")}
            </strong>
            . Other product categories are unaffected.
          </p>
          {coolingPeriod.reason && (
            <p className="mx-auto mt-4 max-w-md rounded-lg bg-ink-50 p-3 text-left text-[13px] leading-relaxed text-ink-600">
              <strong className="block text-ink-800">Reason for the earlier decision</strong>
              {coolingPeriod.reason}
            </p>
          )}
        </CardBody>
      </Card>
    );
  }

  /* ── Step 0: loan terms ────────────────────────────────────────────────── */
  if (step === -1 || (step === 0 && parts[0] !== "A" && !applicationId)) {
    // Terms always come first
  }

  return (
    <div className="space-y-6">
      {error && <Alert tone="danger" icon={<AlertCircle />}>{error}</Alert>}

      {/* Stepper */}
      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <StepChip label="Loan details" active={!applicationId} done={!!applicationId} first />
            {parts.map((p) => (
              <StepChip
                key={p}
                label={partLabel(p, product.category)}
                active={Boolean(applicationId) && currentPart === p && step === parts.indexOf(p)}
                done={false}
              />
            ))}
            <StepChip label="Submit" active={false} done={false} last />
          </div>
          <ProgressBar
            value={
              !applicationId
                ? 8
                : ((step + 1) / (parts.length + 1)) * 100
            }
            tone="brand"
            size="sm"
          />
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ─── Main step content ─── */}
        <div className="space-y-5">
          {!applicationId ? (
            <Card>
              <CardHeader
                title="How much do you need?"
                description={`${product.name} · amounts from ${moneyCompact(product.min_amount)} to ${moneyCompact(product.max_amount)}`}
              />
              <CardBody className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <label className="text-[13px] font-medium text-ink-700">Amount</label>
                    <span className="tabular-nums text-lg font-semibold text-ink-900">
                      {money(amount)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={product.min_amount}
                    max={product.max_amount}
                    step={1000}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full accent-brand-600"
                  />
                  <div className="flex justify-between text-[11px] text-ink-400">
                    <span>{moneyCompact(product.min_amount)}</span>
                    <span>{moneyCompact(product.max_amount)}</span>
                  </div>
                  <Input
                    type="number"
                    value={amount}
                    step={1000}
                    onChange={(e) => setAmount(Number(e.target.value) || 0)}
                    prefix="₹"
                    className="tabular-nums"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <label className="text-[13px] font-medium text-ink-700">Tenure</label>
                    <span className="tabular-nums text-lg font-semibold text-ink-900">
                      {tenure(tenureMonths)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={product.min_tenure_months}
                    max={product.max_tenure_months}
                    step={1}
                    value={tenureMonths}
                    onChange={(e) => setTenureMonths(Number(e.target.value))}
                    className="w-full accent-brand-600"
                  />
                  <div className="flex justify-between text-[11px] text-ink-400">
                    <span>{product.min_tenure_months} months</span>
                    <span>{product.max_tenure_months} months</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-ink-700">
                    Purpose of the loan
                  </label>
                  <Textarea
                    rows={3}
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="e.g. Purchase of a 2BHK flat in Andheri"
                  />
                  <p className="text-xs text-ink-500">
                    Officers use this to understand the context of your request.
                  </p>
                </div>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader
                title={partLabel(currentPart, product.category)}
                description={
                  currentPart === "A"
                    ? "Documents every applicant provides, regardless of loan type."
                    : currentPart === "B"
                      ? product.category === "SECURED"
                        ? "Proof of the asset you're pledging."
                        : "Additional financial and risk information."
                      : "Consent forms and terms."
                }
                action={
                  pending ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink-500">
                      <Loader2 className="size-3.5 animate-spin" />
                      Saving
                    </span>
                  ) : undefined
                }
              />
              <CardBody className="space-y-3">
                {currentItems.map((req) => (
                  <DocumentField
                    key={req.id}
                    requirement={req}
                    value={values[req.section_key]}
                    onChange={(next) =>
                      setValues((prev) => ({ ...prev, [req.section_key]: next }))
                    }
                    onSave={() => saveItem(req)}
                    canSave={!!applicationId}
                  />
                ))}
              </CardBody>
            </Card>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => (step > 0 ? setStep(step - 1) : router.back())}
              icon={<ArrowLeft className="size-4" />}
              disabled={creating}
            >
              Back
            </Button>

            {!applicationId ? (
              <Button
                onClick={createAndAdvance}
                loading={creating}
                icon={<ArrowRight className="size-4" />}
              >
                Continue
              </Button>
            ) : step < parts.length - 1 ? (
              <Button onClick={goNext} disabled={pending}>
                Continue
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button
                onClick={submitAll}
                loading={pending}
                disabled={!currentComplete}
                icon={<Send className="size-4" />}
              >
                Submit application
              </Button>
            )}
          </div>
        </div>

        {/* ─── Summary rail ─── */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Your loan" description="Live estimate" />
            <CardBody className="space-y-2.5">
              <SummaryRow label="Amount" value={money(amount)} />
              <SummaryRow label="Tenure" value={tenure(tenureMonths)} />
              <SummaryRow
                label="Interest"
                value={`${percent(product.min_rate)} – ${percent(product.max_rate)}`}
              />
              <div className="space-y-2.5 border-t border-ink-100 pt-2.5">
                <SummaryRow label="Monthly EMI" value={money(emi)} emphasis />
                <SummaryRow label="Total interest" value={money(interest)} />
                <SummaryRow label="Total payable" value={money(amount + interest)} />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="What you'll need" />
            <CardBody>
              <ul className="space-y-2">
                {requirements
                  .filter((r) => r.is_required && r.input_kind !== "CHECKBOX")
                  .map((r) => (
                    <li key={r.id} className="flex items-start gap-2 text-[13px]">
                      <span
                        className={cn(
                          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full",
                          filled(r.section_key)
                            ? "bg-positive-100 text-positive-700"
                            : "bg-ink-100 text-ink-400",
                        )}
                      >
                        {filled(r.section_key) ? (
                          <Check className="size-2.5" />
                        ) : (
                          <span className="size-1 rounded-full bg-current" />
                        )}
                      </span>
                      <span className={cn(filled(r.section_key) && "text-ink-400 line-through")}>
                        {r.label}
                      </span>
                    </li>
                  ))}
              </ul>
              {product.requires_coapplicant && (
                <Alert tone="info" className="mt-3">
                  This product requires a co-applicant or guarantor. Your officer will ask for
                  their details during verification.
                </Alert>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-2 text-[12px] leading-relaxed text-ink-500">
              <p className="text-[13px] font-semibold text-ink-800">Before you submit</p>
              <p>
                We verify these documents and assign a named officer. Most applications are
                decided in {product.sla_min_days}–{product.sla_max_days} working days.
              </p>
              <p>
                Interest is calculated on the reducing balance. Processing fee of{" "}
                {percent(product.processing_fee_pct, 1)} applies at disbursal.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ─── One checklist item ──────────────────────────────────────────────────── */

function DocumentField({
  requirement,
  value,
  onChange,
  onSave,
  canSave,
}: {
  requirement: DocumentRequirement;
  value?: { fileName?: string; value?: string };
  onChange: (next: { fileName?: string; value?: string }) => void;
  onSave: () => void;
  canSave: boolean;
}) {
  const label = (
    <div>
      <p className="text-[13px] font-medium text-ink-800">
        {requirement.label}
        {requirement.is_required && <span className="ml-1 text-danger-500">*</span>}
      </p>
      {requirement.help_text && (
        <p className="mt-0.5 text-xs text-ink-500">{requirement.help_text}</p>
      )}
    </div>
  );

  return (
    <div className="rounded-lg border border-ink-200 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        {label}
        {value?.fileName ? (
          <Badge tone="positive" icon={<CheckCircle2 className="size-3" />}>
            Added
          </Badge>
        ) : requirement.input_kind === "CHECKBOX" ? null : (
          <Badge tone="warning">Pending</Badge>
        )}
      </div>

      {requirement.input_kind === "CHECKBOX" ? (
        <Checkbox
          checked={value?.value === "true"}
          onChange={(e) => {
            onChange({ value: String(e.target.checked) });
            if (canSave) onSave();
          }}
          label={requirement.label}
          description={requirement.help_text ?? undefined}
        />
      ) : requirement.input_kind === "NUMBER" ? (
        <Input
          type="number"
          value={value?.value ?? ""}
          onChange={(e) => onChange({ value: e.target.value })}
          suffix="grams"
          placeholder="e.g. 250"
          className="tabular-nums"
          onBlur={onSave}
        />
      ) : requirement.input_kind === "SELECT" ? (
        <Select
          value={value?.value ?? ""}
          onChange={(e) => onChange({ value: e.target.value })}
          onBlur={onSave}
          options={[{ value: "", label: "Select…" }, ...(requirement.input_options?.options ?? []).map((o) => ({ value: o, label: o }))]}
        />
      ) : requirement.input_kind === "DATE" ? (
        <Input
          type="date"
          value={value?.value ?? ""}
          onChange={(e) => onChange({ value: e.target.value })}
          onBlur={onSave}
        />
      ) : value?.fileName ? (
        <div className="flex items-center justify-between rounded-lg bg-positive-50 px-3 py-2.5">
          <span className="flex min-w-0 items-center gap-2 text-[13px] text-positive-800">
            <FileUp className="size-4 shrink-0" />
            <span className="truncate">{value.fileName}</span>
          </span>
          <button
            onClick={() => onChange({})}
            className="shrink-0 text-xs font-medium text-positive-700 underline"
          >
            Replace
          </button>
        </div>
      ) : (
        <FileDrop
          label="Choose a file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onChange({ fileName: file.name });
          }}
        />
      )}
    </div>
  );
}

/* ─── Small pieces ────────────────────────────────────────────────────────── */

function StepChip({
  label,
  active,
  done,
  first,
  last,
}: {
  label: string;
  active: boolean;
  done: boolean;
  first?: boolean;
  last?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {!first && <span className="h-px w-4 bg-ink-200" aria-hidden />}
      <span
        className={cn(
          "flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
          active && "bg-brand-600 text-white",
          done && "bg-positive-50 text-positive-700",
          !active && !done && "bg-ink-100 text-ink-500",
        )}
      >
        {done && <Check className="size-3" />}
        {label}
      </span>
      {!last && <span className="h-px w-4 bg-ink-200" aria-hidden />}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[13px]">
      <span className="text-ink-500">{label}</span>
      <span
        className={cn(
          "tabular-nums font-semibold",
          emphasis ? "text-brand-700 text-[15px]" : "text-ink-900",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function partLabel(part: string, category: string) {
  switch (part) {
    case "A":
      return "Identity & income";
    case "B":
      return category === "SECURED" ? "Collateral" : "Financials";
    case "C":
      return "Consent";
    case "D":
      return "Acknowledgement";
    default:
      return part;
  }
}