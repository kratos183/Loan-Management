"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { CheckCircle2, LifeBuoy } from "lucide-react";
import { raiseTicket } from "@/lib/actions/chat";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/primitives";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

interface Result {
  error?: string;
  success?: boolean;
  ticketId?: string;
  conversationId?: string | null;
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" fullWidth loading={pending} icon={!pending && <LifeBuoy className="size-4" />}>
      {pending ? "Raising ticket…" : "Raise ticket"}
    </Button>
  );
}

export function NewTicketForm() {
  const router = useRouter();
  const [state, formAction] = useActionState<Result, FormData>(
    async (_prev, formData) => {
      return raiseTicket({
        subject: String(formData.get("subject") ?? ""),
        description: String(formData.get("description") ?? ""),
        category: String(formData.get("category") ?? "GENERAL"),
        priority: String(formData.get("priority") ?? "MEDIUM"),
        loanId: (formData.get("loan_id") as string) || null,
      });
    },
    {},
  );

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);

  return (
    <Card>
      <CardHeader
        title="Raise a ticket"
        description="Opens a chat thread with an officer automatically"
      />
      <CardBody>
        <form action={formAction} className="space-y-4">
          {state?.error && <Alert tone="danger">{state.error}</Alert>}
          {state?.success && (
            <Alert tone="success" icon={<CheckCircle2 className="size-4" />}>
              Ticket raised. An officer has been notified and you can continue the conversation
              from your chat screen.
            </Alert>
          )}

          <Field label="Subject" htmlFor="subject" required>
            <Input
              id="subject"
              name="subject"
              required
              placeholder="e.g. Payment shows bounced but money left my account"
            />
          </Field>

          <Field label="Category" htmlFor="category">
            <Select
              id="category"
              name="category"
              defaultValue="GENERAL"
              options={[
                { value: "GENERAL", label: "General question" },
                { value: "PAYMENT", label: "Payment or EMI" },
                { value: "DOCUMENT", label: "Documents or verification" },
                { value: "TECHNICAL", label: "Something is broken" },
              ]}
            />
          </Field>

          <Field
            label="Priority"
            htmlFor="priority"
            hint="High priority goes to the top of the queue."
          >
            <Select
              id="priority"
              name="priority"
              defaultValue="MEDIUM"
              options={[
                { value: "LOW", label: "Low — no rush" },
                { value: "MEDIUM", label: "Medium — affects me" },
                { value: "HIGH", label: "High — blocking or money involved" },
              ]}
            />
          </Field>

          <Field
            label="What's happening?"
            htmlFor="description"
            required
            hint="Include dates, amounts and transaction references where you can."
          >
            <Textarea
              id="description"
              name="description"
              rows={5}
              required
              placeholder="Describe the issue in your own words…"
            />
          </Field>

          <Submit />
        </form>
      </CardBody>
    </Card>
  );
}