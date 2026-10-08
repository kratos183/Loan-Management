import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/** Scrollable table wrapper with a sticky header. */
export function TableWrap({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  align = "left",
  className,
  ...props
}: { children?: ReactNode; align?: "left" | "right" | "center" } & React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "sticky top-0 z-10 border-b border-ink-200 bg-ink-50/95 px-4 py-2.5 text-[11px]",
        "font-semibold uppercase tracking-wider text-ink-500 backdrop-blur",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  mono,
  className,
  ...props
}: {
  children?: ReactNode;
  align?: "left" | "right" | "center";
  mono?: boolean;
} & React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "border-b border-ink-100 px-4 py-3 text-ink-700",
        align === "right" && "tabular-nums text-right",
        align === "center" && "text-center",
        mono && "font-mono text-[13px]",
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}

export function Tr({
  children,
  className,
  hover = true,
  ...props
}: { hover?: boolean } & React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(hover && "hover:bg-ink-50/70", className)}
      {...props}
    >
      {children}
    </tr>
  );
}

/** Compact two-column table for statement-style data. */
export function MiniTable({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-ink-100">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 py-2">
          <dt className="text-[13px] text-ink-500">{r.label}</dt>
          <dd className="tabular-nums text-[13px] font-semibold text-ink-900">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}