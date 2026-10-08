"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { AlertCircle, ArrowRight, Lock, Mail, ShieldCheck } from "lucide-react";
import { signIn, type AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

const DEMO_ACCOUNTS = [
  {
    role: "User",
    email: "rahul@demo.in",
    hint: "Active home loan, overdue EMI",
  },
  {
    role: "Officer",
    email: "officer@demo.in",
    hint: "Work queue, scorecard, decisions",
  },
  { role: "Admin", email: "admin@demo.in", hint: "Users, products, reports" },
];

const DEMO_PASSWORD = "demo1234";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" fullWidth loading={pending} className="mt-1">
      {pending ? "Signing in…" : "Sign in"}
      {!pending && <ArrowRight className="size-4" />}
    </Button>
  );
}

export function LoginForm({ blocked }: { blocked?: boolean }) {
  const [state, formAction] = useActionState<AuthState, FormData>(signIn, {});

  // Controlled so the demo-account buttons can fill the form. Without this,
  // clicking a preset still needs a manual copy/paste — which is exactly the
  // kind of thing that produces "invalid credentials" on a working setup.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function useDemoAccount(demoEmail: string) {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
  }

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4">
        {blocked && (
          <Alert tone="danger" title="Account blocked" icon={<ShieldCheck />}>
            This account has been blocked or closed. Please contact your branch.
          </Alert>
        )}

        {state.error && <Alert tone="danger" icon={<AlertCircle />}>{state.error}</Alert>}

        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-[13px] font-medium text-ink-700">
            Email address
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="you@example.com"
              className="pl-9"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={!!state.fieldErrors?.email}
              required
            />
          </div>
          {state.fieldErrors?.email && (
            <p className="text-xs font-medium text-danger-600">{state.fieldErrors.email}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-[13px] font-medium text-ink-700">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="pl-9"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={!!state.fieldErrors?.password}
              required
            />
          </div>
          {state.fieldErrors?.password && (
            <p className="text-xs font-medium text-danger-600">{state.fieldErrors.password}</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-600 select-none">
            <input
              type="checkbox"
              name="remember"
              className="size-4 rounded border-ink-300 accent-brand-600"
            />
            Keep me signed in
          </label>
          <span className="text-[13px] text-ink-400">Forgot password?</span>
        </div>

        <SubmitButton />
      </form>

      {/* Clicking a preset fills the form — no typing, no typos. */}
      <div className="rounded-lg border border-brand-200 bg-brand-50/60 p-3">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700">
            Demo accounts
          </p>
          <p className="font-mono text-[11px] text-brand-600">{DEMO_PASSWORD}</p>
        </div>
        <ul className="space-y-1">
          {DEMO_ACCOUNTS.map((a) => {
            const selected = email === a.email;
            return (
              <li key={a.email}>
                <button
                  type="button"
                  onClick={() => useDemoAccount(a.email)}
                  className={cn(
                    "flex w-full items-baseline gap-2 rounded px-1.5 py-1 text-left text-[13px] transition-colors",
                    selected ? "bg-white ring-1 ring-brand-300" : "hover:bg-white/70",
                  )}
                >
                  <span className="w-14 shrink-0 font-semibold text-brand-900">{a.role}</span>
                  <span className="font-mono text-xs text-brand-700">{a.email}</span>
                  <span className="hidden truncate text-xs text-brand-600 sm:inline">
                    {a.hint}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="text-center text-[13px] text-ink-500">
        New to SafarLoan?{" "}
        <Link href="/signup" className="font-medium text-brand-600 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}