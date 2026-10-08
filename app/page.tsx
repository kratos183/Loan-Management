import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Calculator,
  FileText,
  Gauge,
  Landmark,
  MessagesSquare,
  Receipt,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { money, percent } from "@/lib/format";
import { calculateEmi } from "@/lib/finance/emi";

export const metadata = {
  title: "Digital lending, end to end",
  description:
    "Apply for secured and unsecured loans, track verification in real time, and service EMIs to NOC in one portal.",
};

const PRODUCTS = [
  { emoji: "🏠", name: "Home Loan", min: 500000, max: 10000000, rate: "8.60", secured: true },
  { emoji: "🚗", name: "Vehicle Loan", min: 100000, max: 2000000, rate: "9.25", secured: true },
  { emoji: "💛", name: "Gold Loan", min: 25000, max: 2500000, rate: "10.75", secured: true },
  { emoji: "🏢", name: "Loan Against Property", min: 500000, max: 7500000, rate: "9.10", secured: true },
  { emoji: "💼", name: "Personal Loan", min: 50000, max: 1000000, rate: "12.50", secured: false },
  { emoji: "🎓", name: "Education Loan", min: 100000, max: 4000000, rate: "9.90", secured: false },
  { emoji: "🏪", name: "Working Capital", min: 100000, max: 2500000, rate: "13.20", secured: false },
  { emoji: "💳", name: "Credit Card Loan", min: 20000, max: 500000, rate: "15.00", secured: false },
];

const FEATURES = [
  {
    icon: FileText,
    title: "Guided applications",
    body: "Nine products, each with its own document checklist. We only ask for what this loan actually needs.",
  },
  {
    icon: ShieldCheck,
    title: "Verification you can see",
    body: "Every document moves through pending, verified or rejected with a reason. Nothing goes quiet.",
  },
  {
    icon: MessagesSquare,
    title: "A named officer",
    body: "Your application is assigned a specific person. Ask them anything, in the portal.",
  },
  {
    icon: Calculator,
    title: "Transparent EMIs",
    body: "Full amortisation schedule, e-bills and prepayment maths before you commit.",
  },
  {
    icon: BadgeCheck,
    title: "Closure and NOC",
    body: "Pay off, claim your No Objection Certificate, download it. No branch visit.",
  },
  {
    icon: Gauge,
    title: "Credit health",
    body: "Check your CIBIL score and see exactly which products you qualify for.",
  },
];

export default function LandingPage() {
  // A worked example so the calculator claim isn't just marketing
  const sampleEmi = calculateEmi(2500000, 8.6, 240);

  return (
    <div className="min-h-screen bg-white">
      {/* ─── Nav ─── */}
      <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-600">
              <Landmark className="size-5 text-white" />
            </span>
            <span className="text-[17px] font-semibold tracking-tight text-ink-900">
              SafarLoan
            </span>
          </div>

          <nav className="hidden items-center gap-7 md:flex">
            {["Products", "How it works", "Calculator", "Support"].map((item) => (
              <a
                key={item}
                href="#"
                className="text-[13px] font-medium text-ink-600 transition-colors hover:text-ink-900"
              >
                {item}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <LinkButton href="/login" variant="ghost" size="sm">
              Sign in
            </LinkButton>
            <LinkButton href="/signup" size="sm">
              Get started
            </LinkButton>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(70% 60% at 50% 0%, #eef2ff 0%, transparent 70%)," +
              "radial-gradient(50% 50% at 90% 20%, #f0fdfa 0%, transparent 60%)",
          }}
        />

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div>
              {/* Eyebrow removed — the H1 carries the message on its own */}
              <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-ink-900 sm:text-5xl lg:text-[3.4rem]">
                Lending that shows
                <br />
                you{" "}
                <span className="bg-gradient-to-r from-brand-600 to-accent-600 bg-clip-text text-transparent">
                  every step
                </span>
                .
              </h1>

              <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-600">
                From application to No Objection Certificate, in one portal. Upload once,
                watch verification happen live, talk to your assigned officer, and service
                your loan without visiting a branch.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <LinkButton href="/signup" size="lg">
                  Start an application
                  <ArrowRight className="size-4" />
                </LinkButton>
                <LinkButton href="/login" size="lg" variant="outline">
                  Sign in
                </LinkButton>
              </div>

              <dl className="mt-12 grid max-w-lg grid-cols-3 gap-4 border-t border-ink-200 pt-8 sm:gap-6">
                {[
                  { label: "Disbursal", value: "48 hrs" },
                  { label: "Products", value: "9" },
                  { label: "Interest from", value: "8.6%" },
                ].map((s) => (
                  <div key={s.label}>
                    <dd className="tabular-nums text-2xl font-semibold tracking-tight text-ink-900">
                      {s.value}
                    </dd>
                    <dt className="mt-0.5 text-[13px] text-ink-500">{s.label}</dt>
                  </div>
                ))}
              </dl>
            </div>

            {/* Hero visual — a loan card mock */}
            <div className="relative">
              <div
                aria-hidden
                className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-brand-100/60 to-accent-100/40 blur-2xl"
              />
              <div className="relative rounded-2xl border border-ink-200 bg-white p-6 shadow-xl">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                      Sanctioned
                    </p>
                    <p className="tabular-nums mt-1 text-3xl font-semibold tracking-tight text-ink-900">
                      ₹25,00,000
                    </p>
                    <p className="mt-0.5 text-[13px] text-ink-500">Home Loan · 20 years</p>
                  </div>
                  <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-xl">
                    🏠
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4 border-t border-ink-100 pt-5">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-ink-400">Monthly EMI</p>
                    <p className="tabular-nums mt-0.5 text-xl font-semibold text-ink-900">
                      {money(sampleEmi)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-ink-400">Interest</p>
                    <p className="tabular-nums mt-0.5 text-xl font-semibold text-ink-900">
                      8.60%
                    </p>
                  </div>
                </div>

                {/* Amortisation split visual */}
                <div className="mt-6">
                  <div className="mb-1.5 flex justify-between text-[11px] text-ink-500">
                    <span>Principal ₹25L</span>
                    <span>Interest {money(sampleEmi * 240 - 2500000)}</span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="bg-brand-500"
                      style={{ width: `${(2500000 / (sampleEmi * 240)) * 100}%` }}
                    />
                    <div className="flex-1 bg-ink-300" />
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-2 rounded-lg bg-positive-50 px-3 py-2.5">
                  <TrendingUp className="size-4 shrink-0 text-positive-600" />
                  <p className="text-[13px] text-positive-800">
                    First EMI due in 30 days · autopay enabled
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Products ─── */}
      <section className="border-y border-ink-200 bg-ink-50/60 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-ink-900">
              Every loan we offer
            </h2>
            <p className="mt-3 text-[17px] leading-relaxed text-ink-600">
              Secured products are backed by collateral, so they carry lower rates and longer
              tenures. Unsecured products need none.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PRODUCTS.map((p) => (
              <div
                key={p.name}
                className="group rounded-xl border border-ink-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <span className="text-2xl">{p.emoji}</span>
                  <Badge tone={p.secured ? "brand" : "info"}>
                    {p.secured ? "Secured" : "Unsecured"}
                  </Badge>
                </div>
                <h3 className="mt-3 text-[15px] font-semibold text-ink-900">{p.name}</h3>
                <p className="tabular-nums mt-2 text-[13px] text-ink-500">
                  {money(p.min)} – {money(p.max)}
                </p>
                <p className="tabular-nums mt-1 text-[13px] font-medium text-brand-700">
                  From {percent(p.rate)} p.a.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-ink-900">
              Built around transparency
            </h2>
            <p className="mt-3 text-[17px] leading-relaxed text-ink-600">
              Most lending portals go quiet after you hit submit. This one does not.
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 text-[15px] font-semibold text-ink-900">{title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="border-t border-ink-200 bg-ink-900 py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>

          <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: "01", title: "Pick a product", body: "See the exact amount, rate and tenure range before you commit." },
              { step: "02", title: "Upload and verify", body: "A checklist tailored to your loan type, verified as each item clears." },
              { step: "03", title: "Get sanctioned", body: "An officer reviews, answers your questions and sanctions the loan." },
              { step: "04", title: "Repay and close", body: "Pay EMIs, prepay if you like, then claim your NOC online." },
            ].map((s) => (
              <li key={s.step}>
                <span className="tabular-nums text-sm font-bold text-accent-400">{s.step}</span>
                <h3 className="mt-3 text-[15px] font-semibold">{s.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-white/60">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight text-ink-900">
            Ready when you are
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[17px] leading-relaxed text-ink-600">
            Create an account and see exactly what you qualify for. No documents required to
            look around.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <LinkButton href="/signup" size="lg">
              Create free account
              <ArrowRight className="size-4" />
            </LinkButton>
            <LinkButton href="/login" size="lg" variant="outline">
              I already have one
            </LinkButton>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-ink-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600">
              <Landmark className="size-4 text-white" />
            </span>
            <span className="text-[15px] font-semibold text-ink-900">SafarLoan</span>
          </div>
          <p className="text-[13px] text-ink-400">
            Prototype environment. Rates shown are illustrative and not an offer of credit.
          </p>
        </div>
      </footer>
    </div>
  );
}