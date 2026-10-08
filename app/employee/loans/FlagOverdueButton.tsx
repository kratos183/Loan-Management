"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Bell } from "lucide-react";
import { flagOverdueAction } from "@/lib/actions/decisions";

function Submit({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-50"
    >
      <Bell className="size-3" />
      {pending ? "Notifying…" : "Notify"}
    </button>
  );
}

/**
 * Flags an instalment as overdue and pushes a notification to the borrower.
 * (Source doc line 155: "Notify user when emp mark OD for user".)
 */
export function FlagOverdueButton({ emiId }: { emiId: string }) {
  const router = useRouter();
  const [, formAction, pending] = useActionState(flagOverdueAction, {});

  return (
    <form action={formAction}>
      <input type="hidden" name="emiId" value={emiId} />
      <Submit pending={pending} />
    </form>
  );
}