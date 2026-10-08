"use client";

import { useActionState } from "react";
import { updateUserAccessAction } from "@/lib/actions/decisions";
import type { UserRole, UserStatus } from "@/lib/db/types";

/**
 * Role + status editor.
 *
 * `updateUserAccess` re-checks the caller's role server-side and writes an audit
 * row, so the UI is not the security boundary. An admin cannot block
 * themselves, which `isSelf` enforces on the client too.
 */
export function RoleSelect({ user }: { user: { id: string; role: UserRole } }) {
  const [, formAction, pending] = useActionState(updateUserAccessAction, {});

  return (
    <form action={formAction} className="inline-flex items-center">
      <input type="hidden" name="user_id" value={user.id} />
      <input type="hidden" name="status" value="ACTIVE" />
      <select
        name="role"
        defaultValue={user.role}
        disabled={pending}
        className="h-8 cursor-pointer rounded-md border border-ink-300 bg-white px-2 text-xs font-medium text-ink-800 focus:border-brand-500 focus:outline-none disabled:opacity-50"
      >
        <option value="USER">Borrower</option>
        <option value="EMPLOYEE">Employee</option>
        <option value="ADMIN">Admin</option>
      </select>
      <button
        type="submit"
        disabled={pending}
        className="ml-1 text-[11px] font-medium text-brand-600 hover:underline disabled:opacity-50"
      >
        {pending ? "…" : "Save"}
      </button>
    </form>
  );
}

export function StatusToggle({
  user,
}: {
  user: { id: string; role: UserRole; status: UserStatus };
}) {
  const [, formAction, pending] = useActionState(updateUserAccessAction, {});

  const next = user.status === "BLOCKED" ? "ACTIVE" : "BLOCKED";

  return (
    <form action={formAction} className="ml-1 inline-flex">
      <input type="hidden" name="user_id" value={user.id} />
      <input type="hidden" name="role" value={user.role} />
      <input type="hidden" name="status" value={next} />
      <button
        type="submit"
        disabled={pending}
        className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
          user.status === "BLOCKED"
            ? "bg-positive-50 text-positive-700 hover:bg-positive-100"
            : "bg-danger-50 text-danger-700 hover:bg-danger-100"
        }`}
      >
        {pending ? "…" : user.status === "BLOCKED" ? "Unblock" : "Block"}
      </button>
    </form>
  );
}