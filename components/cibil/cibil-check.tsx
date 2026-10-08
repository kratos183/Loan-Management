"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Gauge, ShieldCheck, XCircle } from "lucide-react";
import { fetchCibilScore } from "@/lib/actions/cibil";
import { Button } from "@/components/ui/button";
import { Alert, ProgressBar } from "@/components/ui/primitives";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { number } from "@/lib/format";
import { cn } from "@/lib/cn";

interface ActionResult {
  error?: string;
  success?: boolean;
  score?: number;
}

function CheckButton({ hasPan }: { hasPan: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" fullWidth loading={pending} disabled={!hasPan}>
      {pending ? "Contacting bureau…" : "Check my score"}
    </Button>
  );
}

export function CibilCheck({ hasPan }: { hasPan: boolean }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(fetchCibilScore, {});

  if (!hasPan) {
    return (
      <Card>
        <CardBody className="py-8 text-center">
          <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-warning-50 text-warning-700">
            <ShieldCheck className="size-6" />
          </span>
          <h3 className="text-[15px] font-semibold text-ink-900">PAN required first</h3>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-ink-500">
            A credit bureau enquiry needs your PAN as the identifier. Add it to your profile and
            the check takes a few seconds.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <form action={formAction}>
      <Card>
        <CardHeader
          title="Credit bureau check"
          description="We run a bureau enquiry against your PAN. This does not affect your score."
          icon={<Gauge className="size-4" />}
        />
        <CardBody className="space-y-4">
          {state.error && (
            <Alert tone="danger" icon={<AlertCircle />}>
              {state.error}
            </Alert>
          )}
          {state.success && (
            <Alert tone="success" icon={<CheckCircle2 />}>
              Score {state.score} retrieved and saved to your dashboard.
            </Alert>
          )}

          <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-4">
            <h4 className="text-[13px] font-semibold text-ink-800">What you are consenting to</h4>
            <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-ink-600">
              <li className="flex gap-2">
                <span className="text-ink-400">·</span>
                A credit information enquiry against your PAN with the bureau.
              </li>
              <li className="flex gap-2">
                <span className="text-ink-400">·</span>
                The result is stored for 30 days, then it expires and must be re-pulled.
              </li>
              <li className="flex gap-2">
                <span className="text-ink-400">·</span>
                Soft enquiries like this do not reduce your score.
              </li>
            </ul>
          </div>

          <CheckButton hasPan={hasPan} />
        </CardBody>
      </Card>
    </form>
  );
}

/** Visual gauge + factor breakdown. */
export function CibilGauge({
  score,
  band,
  factors,
  expiresAt,
}: {
  score: number;
  band: string;
  factors: Record<string, unknown>;
  expiresAt: string;
}) {
  // CIBIL scale runs 300–900
  const pct = ((score - 300) / 600) * 100;

  const tone =
    band === "EXCELLENT" || band === "GOOD" ? "positive" : band === "AVERAGE" ? "warning" : "danger";

  const bars = [
    { min: 300, max: 699, label: "Poor", tone: "danger" },
    { min: 700, max: 749, label: "Average", tone: "warning" },
    { min: 750, max: 799, label: "Good", tone: "positive" },
    { min: 800, max: 900, label: "Excellent", tone: "positive" },
  ];

  return (
    <Card>
      <CardHeader
        title="Your credit score"
        description={`Valid until ${new Date(expiresAt).toLocaleDateString("en-IN")}`}
        icon={<Gauge className="size-4" />}
        action={
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
              tone === "positive" && "bg-positive-50 text-positive-700",
              tone === "warning" && "bg-warning-50 text-warning-700",
              tone === "danger" && "bg-danger-50 text-danger-700",
            )}
          >
            {band}
          </span>
        }
      />
      <CardBody>
        <div className="flex items-baseline gap-2">
          <span className="tabular-nums text-5xl font-semibold tracking-tight text-ink-900">
            {number(score)}
          </span>
          <span className="text-sm text-ink-400">/ 900</span>
        </div>

        {/* Scale */}
        <div className="mt-5">
          <div className="relative h-2.5 overflow-hidden rounded-full bg-gradient-to-r from-danger-400 via-warning-400 to-positive-500">
            <div
              className="absolute top-0 size-2.5 -translate-x-1/2 rounded-full bg-white shadow-md ring-2 ring-ink-900"
              style={{ left: `${Math.max(1, Math.min(99, pct))}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] font-medium text-ink-400">
            {bars.map((b) => (
              <span key={b.label}>{b.min}</span>
            ))}
          </div>
        </div>

        {/* Factors */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Factor
            label="Payment history"
            value={Number(factors.paymentHistory ?? 0)}
            display={`${Math.round(Number(factors.paymentHistory ?? 0))}%`}
            hint="Share of EMIs paid on time"
            good={Number(factors.paymentHistory ?? 0) >= 85}
          />
          <Factor
            label="Credit utilisation"
            value={100 - Math.min(100, Number(factors.creditUtilisation ?? 0))}
            display={`${Math.round(Number(factors.creditUtilisation ?? 0))}% used`}
            hint="Lower is better — under 30% is ideal"
            good={Number(factors.creditUtilisation ?? 100) <= 30}
          />
          <Factor
            label="Account age"
            value={Math.min(100, Number(factors.accountAgeYears ?? 0) * 7)}
            display={`${Number(factors.accountAgeYears ?? 0)} years`}
            hint="Length of your credit history"
            good={Number(factors.accountAgeYears ?? 0) >= 5}
          />
          <Factor
            label="Hard inquiries"
            value={Math.max(0, 100 - Number(factors.hardQueries ?? 0) * 12)}
            display={String(factors.hardQueries ?? 0)}
            hint="Credit applications in the last year"
            good={Number(factors.hardQueries ?? 0) <= 2}
          />
        </div>
      </CardBody>
    </Card>
  );
}

function Factor({
  label,
  value,
  display,
  hint,
  good,
}: {
  label: string;
  value: number;
  display: string;
  hint: string;
  good: boolean;
}) {
  return (
    <div className="rounded-lg border border-ink-200 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-semibold text-ink-800">{label}</p>
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full",
            good ? "bg-positive-100 text-positive-700" : "bg-warning-100 text-warning-700",
          )}
        >
          {good ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
        </span>
      </div>
      <p className="tabular-nums mt-1 text-lg font-semibold text-ink-900">{display}</p>
      <div className="mt-2">
        <ProgressBar value={value} size="sm" tone={good ? "positive" : "warning"} />
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-400">{hint}</p>
    </div>
  );
}

/** Which products this score unlocks. */
export function ScoreEligibility({ score }: { score: number }) {
  const rows = [
    { label: "Best available rates", products: "Home, Loan Against Property", needs: 750, ok: score >= 750 },
    { label: "Standard rates", products: "Vehicle, Education, Personal", needs: 700, ok: score >= 700 },
    { label: "Higher rates", products: "Credit Card Loan", needs: 680, ok: score >= 680 },
  ];

  return (
    <Card>
      <CardHeader title="What you qualify for" description="Based on your current score" />
      <CardBody className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-ink-800">{r.label}</p>
              <p className="truncate text-xs text-ink-500">{r.products}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="tabular-nums text-xs text-ink-400">needs {r.needs}+</span>
              {r.ok ? (
                <CheckCircle2 className="size-4 text-positive-600" />
              ) : (
                <XCircle className="size-4 text-ink-300" />
              )}
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}