import { cn } from "@/lib/cn";
import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";

/* ─── Field wrapper ───────────────────────────────────────────────────────── */

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="block text-[13px] font-medium text-ink-700"
        >
          {label}
          {required && <span className="ml-0.5 text-danger-600">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs font-medium text-danger-600">{error}</p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

/* ─── Shared control styles ───────────────────────────────────────────────── */

const control =
  "w-full rounded-lg border border-ink-300 bg-white text-sm text-ink-900 " +
  "placeholder:text-ink-400 transition-colors " +
  "hover:border-ink-400 focus:border-brand-500 focus:outline-none " +
  "focus:ring-2 focus:ring-brand-500/25 disabled:cursor-not-allowed " +
  "disabled:bg-ink-100 disabled:text-ink-500 aria-invalid:border-danger-400";

/* ─── Input ───────────────────────────────────────────────────────────────── */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  prefix?: string;
  suffix?: string;
  error?: boolean;
}

export function Input({ className, prefix, suffix, error, ...props }: InputProps) {
  const field = (
    <input
      className={cn(
        control,
        "h-10 px-3",
        prefix && "pl-8",
        suffix && "pr-14",
        error && "border-danger-400 focus:border-danger-500 focus:ring-danger-500/25",
        className,
      )}
      aria-invalid={error || undefined}
      {...props}
    />
  );

  if (!prefix && !suffix) return field;

  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-ink-400">
          {prefix}
        </span>
      )}
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-400">
          {suffix}
        </span>
      )}
      {field}
    </div>
  );
}

/* ─── Select ──────────────────────────────────────────────────────────────── */

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  options?: { value: string; label: string }[];
}

export function Select({ className, error, options, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        control,
        "h-10 cursor-pointer appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9 pl-3",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2364748b%22 stroke-width=%222%22><path d=%22M6 9l6 6 6-6%22/></svg>')]",
        error && "border-danger-400",
        className,
      )}
      aria-invalid={error || undefined}
      {...props}
    >
      {options?.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
      {children}
    </select>
  );
}

/* ─── Textarea ────────────────────────────────────────────────────────────── */

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-24 resize-y px-3 py-2", className)} {...props} />;
}

/* ─── Checkbox ────────────────────────────────────────────────────────────── */

export function Checkbox({
  label,
  description,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 select-none", className)}>
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-ink-300 text-brand-600 accent-brand-600 focus:ring-2 focus:ring-brand-500/25"
        {...props}
      />
      <span className="min-w-0">
        <span className="block text-[13px] leading-snug font-medium text-ink-800">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{description}</span>
        )}
      </span>
    </label>
  );
}

/* ─── Radio card — pick one big option ────────────────────────────────────── */

export function RadioCard({
  value,
  selected,
  onChange,
  title,
  description,
  meta,
  disabled,
  name,
}: {
  value: string;
  selected: boolean;
  onChange: (value: string) => void;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  disabled?: boolean;
  name: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-all",
        selected
          ? "border-brand-500 bg-brand-50/60 ring-1 ring-brand-500/25"
          : "border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-brand-600"
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-ink-900">{title}</span>
          {meta}
        </span>
        {description && (
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{description}</span>
        )}
      </span>
    </label>
  );
}

/* ─── File drop zone ──────────────────────────────────────────────────────── */

export function FileDrop({
  label,
  accept,
  multiple,
  disabled,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  return (
    <label
      className={cn(
        "group flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg",
        "border-2 border-dashed border-ink-300 bg-ink-50/60 px-4 py-6 text-center transition-colors",
        "hover:border-brand-400 hover:bg-brand-50/40",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      <svg
        className="size-6 text-ink-400 transition-colors group-hover:text-brand-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      >
        <path d="M12 16V4m0 0L8 8m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
      </svg>
      <span className="text-[13px] font-medium text-ink-700">{label ?? "Choose files"}</span>
      <span className="text-xs text-ink-500">PDF, JPG or PNG · max 5 MB each</span>
      <input type="file" accept={accept} multiple={multiple} className="sr-only" {...props} />
    </label>
  );
}

/* ─── Range slider ────────────────────────────────────────────────────────── */

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled,
  className,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn(
        "h-2 w-full cursor-pointer appearance-none rounded-full bg-ink-200 accent-brand-600",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "[&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none",
        "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white",
        "[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2",
        "[&::-webkit-slider-thumb]:border-brand-600",
        className,
      )}
    />
  );
}

/* ─── Switch ──────────────────────────────────────────────────────────────── */

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  name,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  name: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 select-none">
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-ink-800">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{description}</span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={typeof label === "string" ? label : name}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors",
          "disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-brand-600" : "bg-ink-300",
        )}
      >
        <span
          className={cn(
            "pointer-events-none absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
            checked && "translate-x-5",
          )}
        />
      </button>
    </label>
  );
}