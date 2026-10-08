"use client";

import { useActionState } from "react";
import { updateTicketAction } from "@/lib/actions/decisions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

function Submit({ compact, pending }: { compact?: boolean; pending: boolean }) {
  return (
    <Button
      type="submit"
      size={compact ? "xs" : "sm"}
      loading={pending}
      disabled={pending}
      variant="outline"
      className={cn(!compact && "mt-3")}
    >
      {pending ? "Claiming…" : "Claim this ticket"}
    </Button>
  );
}

/**
 * Claims an unassigned ticket by setting `assigned_to` to the signed-in
 * officer. RLS allows staff to update tickets, and the customer is notified.
 */
export function TicketActions({
  ticketId,
  compact,
}: {
  ticketId: string;
  compact?: boolean;
}) {
  const [, formAction, pending] = useActionState(updateTicketAction, {});

  return (
    <form action={formAction}>
      <input type="hidden" name="ticket_id" value={ticketId} />
      <input type="hidden" name="status" value="IN_PROGRESS" />
      <Submit compact={compact} pending={pending} />
    </form>
  );
}