import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Landmark, ShieldCheck } from "lucide-react";
import { SignupForm } from "@/components/auth/signup-form";
import { getSession, PORTAL_HOME } from "@/lib/auth";

export const metadata: Metadata = { title: "Create account" };

/** Reads the session to redirect an already-signed-in user. */
export const instant = false;

export default async function SignupPage() {
  const session = await getSession();
  if (session) redirect(PORTAL_HOME[session.role]);

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 overflow-hidden bg-ink-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 10% 0%, #4338ca 0%, transparent 55%)," +
              "radial-gradient(90% 80% at 100% 100%, #0d9488 0%, transparent 50%)",
          }}
        />
        <Link href="/" className="relative flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
            <Landmark className="size-5 text-white" />
          </span>
          <span className="text-[17px] font-semibold tracking-tight text-white">SafarLoan</span>
        </Link>

        <div className="relative max-w-md">
          <h2 className="text-4xl leading-tight font-semibold tracking-tight text-white">
            Nine products.
            <br />
            One application flow.
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-white/70">
            Register once and you can apply for home, vehicle, gold, personal, education or
            working capital loans. We only ask for the documents relevant to the product you pick.
          </p>
          <ul className="mt-8 space-y-2.5 text-[13px] text-white/60">
            {[
              "Track every application in real time",
              "Pay EMIs and download e-bills instantly",
              "Claim your NOC the moment the loan closes",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <ShieldCheck className="size-4 shrink-0 text-accent-400" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[11px] text-white/40">
          Prototype environment — no real financial data is processed.
        </p>
      </div>

      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-600">
              <Landmark className="size-5 text-white" />
            </span>
            <span className="text-[17px] font-semibold tracking-tight text-ink-900">
              SafarLoan
            </span>
          </Link>

          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
            Create your account
          </h1>
          <p className="mt-1.5 text-sm text-ink-500">
            Takes under a minute. You can complete KYC later.
          </p>

          <div className="mt-8">
            <SignupForm />
          </div>
        </div>
      </div>
    </div>
  );
}