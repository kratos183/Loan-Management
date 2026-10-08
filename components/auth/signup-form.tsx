"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { AlertCircle, ArrowRight } from "lucide-react";
import { signUp, type AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/primitives";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" fullWidth loading={pending} className="mt-1">
      {pending ? "Creating account…" : "Create account"}
      {!pending && <ArrowRight className="size-4" />}
    </Button>
  );
}

export function SignupForm() {
  const [state, formAction] = useActionState<AuthState, FormData>(signUp, {});
  const e = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <Alert tone={state.error.includes("confirm") ? "success" : "danger"} icon={<AlertCircle />}>
          {state.error}
        </Alert>
      )}

      <div className="space-y-1.5">
        <label htmlFor="full_name" className="block text-[13px] font-medium text-ink-700">
          Full name <span className="text-danger-600">*</span>
        </label>
        <Input id="full_name" name="full_name" placeholder="As per PAN" error={!!e.full_name} required />
        {e.full_name && <p className="text-xs font-medium text-danger-600">{e.full_name}</p>}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-[13px] font-medium text-ink-700">
          Email address <span className="text-danger-600">*</span>
        </label>
        <Input id="email" name="email" type="email" placeholder="you@example.com" error={!!e.email} required />
        {e.email && <p className="text-xs font-medium text-danger-600">{e.email}</p>}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="phone" className="block text-[13px] font-medium text-ink-700">
          Mobile number <span className="text-danger-600">*</span>
        </label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          maxLength={10}
          placeholder="10-digit number"
          prefix="+91"
          error={!!e.phone}
          required
        />
        {e.phone && <p className="text-xs font-medium text-danger-600">{e.phone}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-[13px] font-medium text-ink-700">
            Password <span className="text-danger-600">*</span>
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Min 8 characters"
            error={!!e.password}
            required
          />
          {e.password && <p className="text-xs font-medium text-danger-600">{e.password}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirm_password" className="block text-[13px] font-medium text-ink-700">
            Confirm password <span className="text-danger-600">*</span>
          </label>
          <Input
            id="confirm_password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat password"
            error={!!e.confirm_password}
            required
          />
          {e.confirm_password && (
            <p className="text-xs font-medium text-danger-600">{e.confirm_password}</p>
          )}
        </div>
      </div>

      <Submit />

      <p className="text-center text-[13px] text-ink-500">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}