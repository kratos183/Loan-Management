import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";

type Variant =
  | "primary" | "secondary" | "outline" | "ghost"
  | "success" | "danger" | "warning" | "link";
type Size = "xs" | "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 " +
    "disabled:bg-brand-300",
  secondary:
    "bg-ink-900 text-white shadow-sm hover:bg-ink-800 active:bg-ink-950 " +
    "disabled:bg-ink-400",
  outline:
    "border border-ink-300 bg-white text-ink-800 shadow-xs hover:bg-ink-50 " +
    "hover:border-ink-400 active:bg-ink-100 disabled:opacity-50",
  ghost:
    "text-ink-700 hover:bg-ink-100 active:bg-ink-200 disabled:opacity-50",
  success:
    "bg-positive-600 text-white shadow-sm hover:bg-positive-700 active:bg-positive-700",
  danger:
    "bg-danger-600 text-white shadow-sm hover:bg-danger-700 active:bg-danger-700",
  warning:
    "bg-warning-600 text-white shadow-sm hover:bg-warning-700 active:bg-warning-700",
  link:
    "text-brand-600 underline-offset-4 hover:underline hover:text-brand-700 p-0 h-auto",
};

const SIZES: Record<Size, string> = {
  xs: "h-7 px-2.5 text-xs gap-1.5 rounded-md",
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-lg",
  lg: "h-12 px-6 text-[15px] gap-2.5 rounded-xl",
};

interface BaseProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const base =
  "inline-flex items-center justify-center font-medium whitespace-nowrap " +
  "transition-all duration-150 disabled:cursor-not-allowed select-none";

const spinner =
  "size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent";

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading,
  icon,
  fullWidth,
  children,
  disabled,
  ...props
}: BaseProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        base,
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className={spinner} /> : icon}
      {children}
    </button>
  );
}

export function LinkButton({
  className,
  variant = "primary",
  size = "md",
  icon,
  fullWidth,
  children,
  ...props
}: BaseProps & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      className={cn(base, VARIANTS[variant], SIZES[size], fullWidth && "w-full", className)}
      {...props}
    >
      {icon}
      {children}
    </a>
  );
}

/** Square icon-only button. `label` is required for accessibility. */
export function IconButton({
  className,
  label,
  children,
  ...props
}: { label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        base,
        "size-9 rounded-lg text-ink-600 hover:bg-ink-100 hover:text-ink-900",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}