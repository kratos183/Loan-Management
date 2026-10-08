import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/**
 * Scrollable table wrapper.
 *
 * Data tables are the one thing here that genuinely cannot reflow to a phone —
 * a five-column loan schedule has no honest single-column equivalent. So it
 * scrolls horizontally instead, with two details that matter on touch:
 *
 *   - `overscroll-x-contain` stops a horizontal swipe from being interpreted as
 *     a back-navigation gesture, which otherwise makes the table feel like it
 *     is fighting the browser.
 *   - the minimum width relaxes on small screens so a four-column table needs
 *     far less scrolling on a phone than a seven-column one.
 *
 * Note for anyone reaching for a sticky column header: it cannot work here.
 * `overflow-x: auto` with `overflow-y: visible` computes the y axis to `auto`
 * as well (CSS Overflow 3), which makes this div a scroll container in both
 * directions. A sticky `<th>` therefore resolves its `top` against *this* box,
 * not the viewport, and since the box is auto-height it never scrolls
 * vertically. A non-zero `top` does not clear the app topbar — it just offsets
 * the header down over the first row.
 */
export function TableWrap({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("overflow-x-auto overscroll-x-contain", className)}>
      <table className="w-full min-w-[520px] border-collapse text-sm sm:min-w-[640px]">
        {children}
      </table>
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
        // `top-0`, and it has to stay 0. See the note on TableWrap: the
        // wrapper is already a scroll container, so any non-zero offset is
        // measured from the table's own top edge and pushes the header down
        // over the first row instead of clearing the app topbar.
        //
        // Background is opaque for the same reason — a translucent header that
        // ends up overlapping a row ghosts the data through it. `backdrop-blur`
        // is dropped: it cannot sample anything here, and a `backdrop-filter`
        // is precisely the kind of property that silently re-parents fixed
        // descendants (see the mobile drawer).
        "sticky top-0 border-b border-ink-200 bg-ink-50 px-4 py-2.5 text-[11px]",
        "font-semibold uppercase tracking-wider text-ink-500",
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