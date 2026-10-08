"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea, Input } from "@/components/ui/form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/primitives";
import { decideApplication } from "@/lib/actions/decisions";
import { money, percent, tenure } from "@/lib/format";
import type { LoanProduct } from "@/lib/db/types";

type Mode = "APPROVE" | "REJECT" | "RESUBMIT";

function Submit({
  mode,
  disabled,
  pending,
}: {
  mode: Mode;
  disabled?: boolean;
  pending: boolean;
}) {
  const label =
    mode === "APPROVE" ? "Sanction loan" : mode === "REJECT" ? "Decline application" : "Request corrections";

  return (
    <Button
      type="submit"
      fullWidth
      loading={pending}
      disabled={disabled}
      variant={mode === "APPROVE" ? "success" : mode === "REJECT" ? "danger" : "primary"}
      icon={
        mode === "APPROVE" ? (
          <CheckCircle2 className="size-4" />
        ) : mode === "REJECT" ? (
          <Ban className="size-4" />
        ) : (
          <RotateCcw className="size-4" />
        )
      }
    >
      {pending ? "Working…" : label}
    </Button>
  );
}

/**
 * The officer's decision panel. Three outcomes, mirroring the four states in
 * the source document:
 *   APPROVE → loan created, schedule generated
 *   REJECT  → 90-day cooling period for that category
 *   RESUBMIT → unlocks exactly the named documents for the customer
 */
export function DecisionPanel({
  applicationId,
  product,
  amount,
  tenureMonths,
  emi,
  offeredRate,
  canApproveDirectly,
  rejectedDocIds,
}: {
  applicationId: string;
  product: LoanProduct;
  amount: number;
  tenureMonths: number;
  emi: number;
  offeredRate: number;
  canApproveDirectly: boolean;
  rejectedDocIds: string[];
}) {
  const [mode, setMode] = useState<Mode>("APPROVE");
  const [reason, setReason] = useState("");
  const [state, formAction, pending] = useActionState(decideApplication, {});
  const router = useRouter();

  // Surface server errors and refresh the review screen on success
  useEffect(() => {
    if (state?.error) return;
    if (state?.success) router.refresh();
  }, [state, router]);

  return (
    <Card>
      {state?.error && (
        <div className="border-b border-ink-200 px-5 py-3">
          <Alert tone="danger">{state.error}</Alert>
        </div>
      )}
      <CardHeader
        title="Decision"
        description={
          canApproveDirectly
            ? "You can sanction this amount"
            : "Above your limit — this will escalate for authorisation"
        }
      />
      <CardBody>
        {/* Mode switch */}
        <div className="mb-4 grid grid-cols-3 gap-1.5 rounded-lg bg-ink-100 p-1">
          {(
            [
              { key: "APPROVE" as Mode, label: "Approve" },
              { key: "RESUBMIT" as Mode, label: "Ask changes" },
              { key: "REJECT" as Mode, label: "Decline" },
            ]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setMode(t.key)}
              className={`rounded-md px-2 py-2 text-[13px] font-medium transition-all ${
                mode === t.key
                  ? "bg-white text-ink-900 shadow-xs"
                  : "text-ink-500 hover:text-ink-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Terms preview */}
        <div className="mb-4 space-y-2 rounded-lg border border-ink-200 bg-ink-50 p-3.5">
          <Row label="Product" value={product.name} />
          <Row label="Amount" value={money(amount)} />
          <Row label="Tenure" value={tenure(tenureMonths)} />
          <Row label="Offered rate" value={percent(offeredRate)} />
          <Row label="Monthly EMI" value={money(emi)} />
          <Row
            label="Total interest"
            value={money(emi * tenureMonths - amount)}
          />
          {Number(product.processing_fee_pct) > 0 && (
            <Row
              label="Processing fee"
              value={`${money((amount * Number(product.processing_fee_pct)) / 100)} (${percent(product.processing_fee_pct, 0)})`}
            />
          )}
        </div>

        {mode === "APPROVE" && !canApproveDirectly && (
          <Alert tone="warning" className="mb-4">
            {money(amount)} exceeds your sanctioning limit. This application will be routed to a
            manager for final authorisation, and you will be notified once they decide.
          </Alert>
        )}

        {mode === "REJECT" && (
          <Alert tone="danger" className="mb-4">
            Declining blocks this applicant from reapplying for any{" "}
            <strong>{product.category.toLowerCase()}</strong> product for 90 days. Write a reason
            they can act on — vague rejections generate disputes.
          </Alert>
        )}

        {mode === "RESUBMIT" && (
          <Alert tone="warning" className="mb-4">
            Only the documents you flag below become editable. Everything else stays locked, so
            the applicant knows exactly what to fix.
          </Alert>
        )}

        {/* Form */}
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="application_id" value={applicationId} />
          <input type="hidden" name="mode" value={mode} />

          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium text-ink-700">
              {mode === "REJECT"
                ? "Reason for rejection (shown to the applicant)"
                : mode === "RESUBMIT"
                  ? "What needs to be corrected"
                  : "Sanction note (internal)"}
              {mode === "REJECT" && <span className="ml-0.5 text-danger-600">*</span>}
            </label>
            <Textarea
              name="reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required={mode === "REJECT"}
              placeholder={
                mode === "REJECT"
                  ? "e.g. FOIR of 62% exceeds the 50% ceiling for this product. Reduce the requested amount or close one existing EMI."
                  : mode === "RESUBMIT"
                    ? "e.g. The Aadhaar scan is unreadable. Please re-upload both sides, and provide salary slips from the last 3 months."
                    : "e.g. Verified income against bank credits. Sanctioned within authority."
              }
            />
          </div>

          {mode === "APPROVE" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-ink-700">Rate p.a.</label>
                <Input
                  type="number"
                  name="rate"
                  step="0.05"
                  min={product.min_rate}
                  max={product.max_rate}
                  defaultValue={offeredRate}
                  suffix="%"
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-ink-700">
                  Amount sanctioned
                </label>
                <Input
                  type="number"
                  name="approved_amount"
                  step="1000"
                  defaultValue={amount}
                  prefix="₹"
                  className="tabular-nums"
                />
              </div>
            </div>
          )}

          {mode === "RESUBMIT" && rejectedDocIds.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[13px] font-medium text-ink-700">
                Documents the applicant may replace
              </p>
              <div className="space-y-1.5">
                {rejectedDocIds.map((id) => (
                  <label
                    key={id}
                    className="flex items-center gap-2.5 rounded-lg border border-ink-200 px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      name="allowed_docs"
                      value={id}
                      defaultChecked
                      className="size-4 accent-brand-600"
                    />
                    <span className="font-mono text-[12px] text-ink-600">{id}</span>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-ink-400">
                Pre-ticked. Untick anything the applicant should leave alone.
              </p>
            </div>
          )}

          <Submit
            mode={mode}
            pending={pending}
            disabled={mode === "REJECT" && reason.trim().length < 20}
          />
        </form>
      </CardBody>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-ink-500">{label}</span>
      <span className="tabular-nums font-semibold text-ink-900">{value}</span>
    </div>
  );
}

