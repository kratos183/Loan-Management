import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/**
 * Scrollable table wrapper.
 *
 * The wrapper scrolls horizontally as a safety net, but `min-w` is 0 below
 * `sm` on purpose. A fixed minimum forced every table to be wider than a
 * 320px phone no matter which columns were visible, so roughly half the
 * columns sat off-screen with nothing to suggest scrolling existed.
 * Columns marked `priority="normal"` or `"hidden"` are `display: none` on
 * small screens and contribute no width, so the remaining `primary` columns
 * simply fit. From `sm` up the full set returns and the 640px minimum applies.
 *
 * Cell padding is `px-3` below `sm` for the same reason: at `px-4` the padding
 * alone was about 130px of a 288px row, leaving the content nothing to work
 * with before a single column was dropped.
 *
 * `overscroll-x-contain` stops a horizontal swipe from being read as a
 * back-navigation gesture, which otherwise makes the table feel like it is
 * fighting the browser.
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
      <table className="w-full min-w-0 border-collapse text-sm sm:min-w-[640px]">
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  align = "left",
  className,
  priority,
  ...props
}: {
  children?: ReactNode;
  align?: "left" | "right" | "center";
  /**
   * How much a column matters.
   *
   *   "primary" — always shown; a phone-width row is only ever this one.
   *   "normal"  — shown from `sm` up.
   *   "hidden"  — desktop-only reference data.
   *
   * A data table is the one thing here that cannot reflow, so at a 320px phone
   * width a six-column table either scrolls sideways or shows about half its
   * columns with nothing indicating more exist. Dropping the secondary columns
   * below `sm` keeps the essentials readable and needs no scroll at all.
   */
  priority?: "primary" | "normal" | "hidden";
} & React.ThHTMLAttributes<HTMLTableCellElement>) {
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
        "sticky top-0 border-b border-ink-200 bg-ink-50 px-3 py-2.5 text-[11px] sm:px-4",
        "font-semibold uppercase tracking-wider text-ink-500",
        align === "right" && "text-right",
        align === "center" && "text-center",
        priority === "hidden" && "hidden lg:table-cell",
        priority === "normal" && "hidden sm:table-cell",
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
  priority,
  ...props
}: {
  children?: ReactNode;
  align?: "left" | "right" | "center";
  mono?: boolean;
  /** Must match the `priority` on the corresponding `Th`. */
  priority?: "primary" | "normal" | "hidden";
} & React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "border-b border-ink-100 px-3 py-3 text-ink-700 sm:px-4",
        align === "right" && "tabular-nums text-right",
        align === "center" && "text-center",
        mono && "font-mono text-[13px]",
        priority === "hidden" && "hidden lg:table-cell",
        priority === "normal" && "hidden sm:table-cell",
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