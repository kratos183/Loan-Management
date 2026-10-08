"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { BadgeCheck, Ban } from "lucide-react";
import { decideNocAction } from "@/lib/actions/decisions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { cn } from "@/lib/cn";

function Submit({ decision, disabled }: { decision: "APPROVED" | "REJECTED"; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      loading={pending}
      disabled={disabled}
      variant={decision === "APPROVED" ? "success" : "outline"}
      icon={
        !pending &&
        (decision === "APPROVED" ? (
          <BadgeCheck className="size-3.5" />
        ) : (
          <Ban className="size-3.5" />
        ))
      }
    >
      {pending
        ? "Working…"
        : decision === "APPROVED"
          ? "Approve & issue NOC"
          : "Decline"}
    </Button>
  );
}

export function NocDecision({ nocId }: { nocId: string }) {
  const router = useRouter();
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [note, setNote] = useState("");

  const [state, formAction, pending] = useActionState(decideNocAction, {});

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);

  return (
    <div className="mt-4 border-t border-ink-100 pt-4">
      {state?.error && (
        <p className="mb-2 text-xs font-medium text-danger-600">{state.error}</p>
      )}

      <div className="mb-3 flex gap-1.5">
        {(
          [
            { key: "APPROVED" as const, label: "Approve & issue" },
            { key: "REJECTED" as const, label: "Decline" },
          ]
        ).map((d) => (
          <button
            key={d.key}
            onClick={() => setDecision(d.key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
              decision === d.key
                ? d.key === "APPROVED"
                  ? "bg-positive-600 text-white"
                  : "bg-danger-600 text-white"
                : "bg-ink-100 text-ink-600 hover:bg-ink-200",
            )}
          >
            {d.label}
          </button>
        ))}
      </div>

      <Textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={
          decision === "APPROVED"
            ? "Optional note, e.g. all 24 instalments cleared"
            : "Reason the borrower will see — required"
        }
        className="text-[13px]"
      />

      <form action={formAction} className="mt-2.5">
        <input type="hidden" name="noc_id" value={nocId} />
        <input type="hidden" name="decision" value={decision} />
        <input type="hidden" name="note" value={note} />
        <Submit decision={decision} disabled={pending || (decision === "REJECTED" && note.trim().length < 10)} />
      </form>
    </div>
  );
}