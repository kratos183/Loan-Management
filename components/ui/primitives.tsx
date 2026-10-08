import { cn } from "@/lib/cn";
import type { HTMLAttributes, ReactNode } from "react";
import { initials } from "@/lib/format";

/* ─── Page scaffolding ────────────────────────────────────────────────────── */

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        {breadcrumb && <div className="mb-1.5">{breadcrumb}</div>}
        <h1 className="text-xl font-semibold tracking-tight text-ink-900">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ─── Metric tile ─────────────────────────────────────────────────────────── */

export function StatCard({
  label,
  value,
  sublabel,
  icon,
  trend,
  tone = "brand",
  className,
  href,
}: {
  label: string;
  value: ReactNode;
  sublabel?: ReactNode;
  icon?: ReactNode;
  trend?: { value: string; positive: boolean };
  tone?: "brand" | "positive" | "warning" | "danger" | "info";
  className?: string;
  href?: string;
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    positive: "bg-positive-50 text-positive-700",
    warning: "bg-warning-50 text-warning-700",
    danger: "bg-danger-50 text-danger-700",
    info: "bg-info-50 text-info-700",
  };

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
          {label}
        </p>
        {icon && (
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", tones[tone])}>
            {icon}
          </span>
        )}
      </div>
      <p className="tabular-nums mt-2 text-2xl font-semibold tracking-tight text-ink-900">
        {value}
      </p>
      <div className="mt-1 flex items-center gap-2">
        {trend && (
          <span
            className={cn(
              "tabular-nums text-[11px] font-semibold",
              trend.positive ? "text-positive-600" : "text-danger-600",
            )}
          >
            {trend.positive ? "▲" : "▼"} {trend.value}
          </span>
        )}
        {sublabel && <span className="text-xs text-ink-500">{sublabel}</span>}
      </div>
    </>
  );

  const classes = cn(
    "block rounded-xl border border-ink-200 bg-white p-4 shadow-xs transition-all",
    href && "hover:border-brand-300 hover:shadow-md focus-visible:border-brand-400",
    className,
  );

  return href ? (
    <a href={href} className={classes}>
      {body}
    </a>
  ) : (
    <div className={classes}>{body}</div>
  );
}

/* ─── Progress ────────────────────────────────────────────────────────────── */

const PROGRESS_TONES = {
  brand: "bg-brand-500",
  positive: "bg-positive-500",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
} as const;

export function ProgressBar({
  value,
  max = 100,
  tone = "brand",
  size = "md",
  showLabel,
  label,
  className,
}: {
  value: number;
  max?: number;
  tone?: keyof typeof PROGRESS_TONES;
  size?: "sm" | "md";
  showLabel?: boolean;
  label?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div className={className}>
      {(label || showLabel) && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          {label && <span className="text-ink-600">{label}</span>}
          {showLabel && (
            <span className="tabular-nums font-semibold text-ink-900">{pct.toFixed(0)}%</span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn(
          "w-full overflow-hidden rounded-full bg-ink-100",
          size === "sm" ? "h-1.5" : "h-2.5",
        )}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-500", PROGRESS_TONES[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ─── Empty state ─────────────────────────────────────────────────────────── */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {icon && (
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-ink-100 text-ink-400">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-500">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ─── Alert ───────────────────────────────────────────────────────────────── */

const ALERT_TONES = {
  info: "border-info-200 bg-info-50 text-info-900 [&_svg]:text-info-600",
  success: "border-positive-200 bg-positive-50 text-positive-900 [&_svg]:text-positive-600",
  warning: "border-warning-200 bg-warning-50 text-warning-900 [&_svg]:text-warning-600",
  danger: "border-danger-200 bg-danger-50 text-danger-900 [&_svg]:text-danger-600",
  neutral: "border-ink-200 bg-ink-50 text-ink-800 [&_svg]:text-ink-500",
} as const;

export function Alert({
  tone = "info",
  title,
  children,
  icon,
  action,
  className,
}: {
  tone?: keyof typeof ALERT_TONES;
  title?: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border px-4 py-3 text-[13px] leading-relaxed",
        ALERT_TONES[tone],
        className,
      )}
    >
      {icon && <span className="mt-0.5 shrink-0 [&>svg]:size-4">{icon}</span>}
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5 opacity-90")}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

/* ─── Avatar ──────────────────────────────────────────────────────────────── */

const AVATAR_TONES = [
  "bg-brand-100 text-brand-700",
  "bg-positive-100 text-positive-700",
  "bg-warning-100 text-warning-700",
  "bg-info-100 text-info-700",
  "bg-ink-200 text-ink-700",
];

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string | null | undefined;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    xs: "size-6 text-[10px]",
    sm: "size-8 text-xs",
    md: "size-10 text-sm",
    lg: "size-14 text-lg",
  };
  // Deterministic colour so the same person is always the same tone
  const hash = (name ?? "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        sizes[size],
        AVATAR_TONES[hash % AVATAR_TONES.length],
        className,
      )}
      title={name ?? undefined}
    >
      {initials(name)}
    </span>
  );
}

/* ─── Description list — key/value pairs in a card ────────────────────────── */

export function DataList({
  items,
  columns = 2,
  className,
}: {
  items: { label: string; value: ReactNode }[];
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  const cols = {
    1: "sm:grid-cols-1",
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
  }[columns];

  return (
    <dl className={cn("grid gap-x-6 gap-y-4", cols, className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            {item.label}
          </dt>
          <dd className="tabular-nums mt-1 truncate text-sm font-medium text-ink-900">
            {item.value ?? "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ─── Skeleton ────────────────────────────────────────────────────────────── */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-ink-200", className)} />;
}

/* ─── Section heading inside a page ───────────────────────────────────────── */

export function SectionTitle({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 className="text-sm font-semibold tracking-tight text-ink-900">{children}</h2>
      {action}
    </div>
  );
}

/* ─── Generic div passthrough ─────────────────────────────────────────────── */

export function Stack({
  gap = "md",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { gap?: "xs" | "sm" | "md" | "lg" }) {
  const gaps = { xs: "gap-2", sm: "gap-3", md: "gap-4", lg: "gap-6" }[gap];
  return <div className={cn("flex flex-col", gaps, className)} {...props} />;
}