import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  ChartNoAxesColumn,
  FileCheck2,
  Landmark,
  MessageSquareText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { getSession, PORTAL_HOME } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your SafarLoan account",
};

/**
 * Reads the session to redirect an already-signed-in user, so this route
 * cannot be prerendered into a static shell.
 */
export const instant = false;

const HIGHLIGHTS = [
  {
    icon: FileCheck2,
    title: "Guided applications",
    body: "Multi-part KYC flows for secured and unsecured loans, with a checklist your officer verifies.",
  },
  {
    icon: ChartNoAxesColumn,
    title: "Live underwriting",
    body: "FOIR, credit score and collateral cover evaluated as you apply — decisions in hours, not days.",
  },
  {
    icon: MessageSquareText,
    title: "Officer on hand",
    body: "Every pending application is assigned a named officer you can chat with directly.",
  },
  {
    icon: BadgeCheck,
    title: "Servicing to closure",
    body: "EMI schedules, e-bills, prepayment and NOC issuance without leaving the portal.",
  },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session) redirect(PORTAL_HOME[session.role]);

  const params = await searchParams;
  const blocked = params?.error === "account_blocked";

  return (
    <div className="flex min-h-screen">
      {/* ─── Brand panel ─── */}
      <div className="relative hidden w-1/2 overflow-hidden bg-ink-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Ambient gradient wash */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(120% 90% at 10% 0%, #4338ca 0%, transparent 55%)," +
              "radial-gradient(90% 80% at 100% 100%, #0d9488 0%, transparent 50%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />

        <Link href="/" className="relative flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
            <Landmark className="size-5 text-white" />
          </span>
          <span className="text-[17px] font-semibold tracking-tight text-white">SafarLoan</span>
        </Link>

        <div className="relative max-w-lg">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/90 ring-1 ring-white/15">
            <ShieldCheck className="size-3" />
            NBFC-grade loan servicing
          </p>
          <h1 className="text-[2.6rem] leading-[1.1] font-semibold tracking-tight text-white">
            From application
            <br />
            to NOC, in one place.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">
            Secure and unsecured lending across home, vehicle, gold, personal, education and
            working capital — with transparent status at every step.
          </p>

          <ul className="mt-10 space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3.5">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <Icon className="size-4 text-white" />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-white">{title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-white/60">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-6 text-[11px] font-medium text-white/45">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" /> DPDP Act 2023 compliant
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="size-3.5" /> RBI-aligned underwriting
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" /> 3 role-based portals
          </span>
        </div>
      </div>

      {/* ─── Form panel ─── */}
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          {/* Mobile brand mark */}
          <Link href="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-600">
              <Landmark className="size-5 text-white" />
            </span>
            <span className="text-[17px] font-semibold tracking-tight text-ink-900">
              SafarLoan
            </span>
          </Link>

          <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
            Welcome back
          </h2>
          <p className="mt-1.5 text-sm text-ink-500">
            Sign in to continue to your dashboard.
          </p>

          <div className="mt-8">
            <LoginForm blocked={blocked} />
          </div>

          <p className="mt-8 text-center text-[11px] leading-relaxed text-ink-400">
            By signing in you agree to the Terms of Service and Privacy Policy.
            <br />
            Prototype environment — no real financial data is processed.
          </p>
        </div>
      </div>
    </div>
  );
}