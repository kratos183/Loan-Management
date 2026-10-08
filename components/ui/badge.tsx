import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type Tone = "neutral" | "brand" | "positive" | "warning" | "danger" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-700 ring-ink-200",
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  positive: "bg-positive-50 text-positive-700 ring-positive-100",
  warning: "bg-warning-50 text-warning-700 ring-warning-100",
  danger: "bg-danger-50 text-danger-700 ring-danger-100",
  info: "bg-info-50 text-info-700 ring-info-100",
};

export function Badge({
  tone = "neutral",
  children,
  icon,
  dot,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  icon?: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px]",
        "font-semibold uppercase tracking-wide ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {icon}
      {children}
    </span>
  );
}

/**
 * Single source of truth for how a status renders.
 * Every status pill in the app goes through here so colours stay consistent.
 */
const STATUS_MAP: Record<string, { tone: Tone; label: string }> = {
  // Application
  DRAFT: { tone: "neutral", label: "Draft" },
  SUBMITTED: { tone: "info", label: "Submitted" },
  UNDER_REVIEW: { tone: "info", label: "Under review" },
  RESUBMISSION_REQUESTED: { tone: "warning", label: "Action needed" },
  APPROVED: { tone: "positive", label: "Approved" },
  REJECTED: { tone: "danger", label: "Rejected" },
  WITHDRAWN: { tone: "neutral", label: "Withdrawn" },

  // Loan
  ACTIVE: { tone: "positive", label: "Active" },
  FORECLOSED: { tone: "neutral", label: "Foreclosed" },
  CLOSED: { tone: "neutral", label: "Closed" },
  NOC_ISSUED: { tone: "brand", label: "NOC issued" },

  // EMI
  UPCOMING: { tone: "neutral", label: "Upcoming" },
  PAID: { tone: "positive", label: "Paid" },
  OVERDUE: { tone: "danger", label: "Overdue" },
  PARTIALLY_PAID: { tone: "warning", label: "Partial" },
  PREPAID: { tone: "brand", label: "Prepaid" },

  // Documents  (PENDING and REJECTED are shared with applications above —
  // the label and tone are identical, so they are defined only once)
  VERIFIED: { tone: "positive", label: "Verified" },
  NOT_REQUIRED: { tone: "neutral", label: "N/A" },

  // Payments / tickets
  OPEN: { tone: "info", label: "Open" },
  IN_PROGRESS: { tone: "info", label: "In progress" },
  RESOLVED: { tone: "positive", label: "Resolved" },
  SUCCESS: { tone: "positive", label: "Success" },
  FAILED: { tone: "danger", label: "Failed" },
  BOUNCED: { tone: "danger", label: "Bounced" },
  REFUNDED: { tone: "info", label: "Refunded" },

  // Tickets & conversations
  // (OPEN, IN_PROGRESS, RESOLVED, CLOSED also cover NOC requests)
  PENDING_USER: { tone: "warning", label: "Awaiting user" },
  PENDING_OFFICER: { tone: "info", label: "Awaiting officer" },

  // Users
  BLOCKED: { tone: "danger", label: "Blocked" },
  CLOSED_ACCOUNT: { tone: "neutral", label: "Closed" },

  // CIBIL bands
  EXCELLENT: { tone: "positive", label: "Excellent" },
  GOOD: { tone: "positive", label: "Good" },
  AVERAGE: { tone: "warning", label: "Average" },
  POOR: { tone: "danger", label: "Poor" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const config = STATUS_MAP[status] ?? { tone: "neutral" as Tone, label: status };
  return (
    <Badge tone={config.tone} dot className={className}>
      {config.label}
    </Badge>
  );
}

export function VerdictBadge({ verdict }: { verdict: "PASS" | "WARN" | "FAIL" }) {
  const map = {
    PASS: { tone: "positive" as Tone, label: "Pass" },
    WARN: { tone: "warning" as Tone, label: "Review" },
    FAIL: { tone: "danger" as Tone, label: "Fail" },
  };
  return <Badge tone={map[verdict].tone} dot>{map[verdict].label}</Badge>;
}

export function CategoryBadge({ category }: { category: "SECURED" | "UNSECURED" }) {
  return (
    <Badge tone={category === "SECURED" ? "brand" : "info"}>
      {category === "SECURED" ? "Secured" : "Unsecured"}
    </Badge>
  );
}