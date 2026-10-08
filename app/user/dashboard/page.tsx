import Link from "next/link";
import {
  ArrowRight,
  Calculator,
  CreditCard,
  FileText,
  Gauge,
  Landmark,
  MessagesSquare,
  Receipt,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { Portal, loadPortal } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";
import { listApplicationsForUser, listActiveProducts } from "@/lib/queries/applications";
import { Button, LinkButton } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  Alert,
  DataList,
  EmptyState,
  ProgressBar,
  SectionTitle,
  StatCard,
} from "@/components/ui/primitives";
import { TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { money, moneyCompact, number, percent, relativeTime, tenure } from "@/lib/format";
import type { Emi, LoanWithRelations } from "@/lib/db/types";

export const metadata = { title: "Dashboard" };

/** The seven destinations from source doc line 8. */
const SHORTCUTS = [
  { href: "/user/new-loan", label: "New Loan", icon: FileText, tone: "text-brand-600 bg-brand-50" },
  { href: "/user/applications", label: "Application Status", icon: FileText, tone: "text-info-600 bg-info-50" },
  { href: "/user/loans", label: "Current Loan", icon: Landmark, tone: "text-positive-600 bg-positive-50" },
  { href: "/user/emi-calculator", label: "EMI Calculator", icon: Calculator, tone: "text-warning-600 bg-warning-50" },
  { href: "/user/cibil", label: "CIBIL Score", icon: Gauge, tone: "text-brand-600 bg-brand-50" },
  { href: "/user/payments", label: "Payment History", icon: Receipt, tone: "text-ink-600 bg-ink-100" },
  { href: "/user/chat", label: "Chat Support", icon: MessagesSquare, tone: "text-info-600 bg-info-50" },
];

export default async function UserDashboardPage() {
  const ctx = await loadPortal("user");
  const supabase = await createClient();
  const userId = ctx.session.user.id;

  const [applications, products, loansRes, cibilRes] = await Promise.all([
    listApplicationsForUser(userId),
    listActiveProducts(),
    supabase
      .from("loans")
      .select("*, product:loan_products (*)")
      .eq("user_id", userId)
      .in("status", ["ACTIVE", "NOC_ISSUED"])
      .overrideTypes<LoanWithRelations[]>(),
    supabase
      .from("cibil_checks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const loans = loansRes.data ?? [];
  const cibil = cibilRes.data?.[0] ?? null;
  const cibilValid = cibil && new Date(cibil.expires_at) > new Date() ? cibil : null;

  // Active applications the user should care about
  const live = applications.filter((a) =>
    ["SUBMITTED", "UNDER_REVIEW", "RESUBMISSION_REQUESTED"].includes(a.status),
  );
  const awaitingAction = applications.filter((a) => a.status === "RESUBMISSION_REQUESTED");
  const rejected = applications.filter((a) => a.status === "REJECTED");

  // Next EMI across all active loans
  const nextEmis = await Promise.all(
    loans.map(async (loan) => {
      const { data } = await supabase
        .from("emi_schedule")
        .select("*")
        .eq("loan_id", loan.id)
        .in("status", ["UPCOMING", "OVERDUE"])
        .order("due_date", { ascending: true })
        .limit(1);
      return { loan, emi: (data?.[0] as Emi | undefined) ?? null };
    }),
  );
  const nextPayments = nextEmis.filter((p) => p.emi);
  const overdueEmi = nextPayments.find((p) => p.emi?.status === "OVERDUE");
  const upcomingEmi = nextPayments.find((p) => p.emi?.status === "UPCOMING");

  const totalOutstanding = loans.reduce((s, l) => s + Number(l.outstanding_principal), 0);
  const totalPortfolio = loans.reduce((s, l) => s + Number(l.principal), 0);
  const paidPercent = totalPortfolio
    ? ((totalPortfolio - totalOutstanding) / totalPortfolio) * 100
    : 0;

  return (
    <Portal
      which="user"
      title={`Good ${greeting()}, ${firstName(ctx.session.user.full_name)}`}
      description="Here's where your loans and applications stand today."
    >
      {/* ─── Action banners ─── */}
      <div className="space-y-3">
        {awaitingAction.length > 0 && (
          <Alert
            tone="warning"
            title={`${awaitingAction.length} application${awaitingAction.length > 1 ? "s need" : " needs"} your attention`}
            icon={<FileText />}
            action={
              <LinkButton href="/user/applications" size="sm" variant="outline">
                Fix now
              </LinkButton>
            }
          >
            Your officer has requested corrections. Open the application to see exactly which
            documents to replace.
          </Alert>
        )}

        {overdueEmi?.emi && (
          <Alert
            tone="danger"
            title="An EMI is overdue"
            icon={<CreditCard />}
            action={
              <LinkButton href={`/user/loans/${overdueEmi.loan.id}`} size="sm" variant="danger">
                Pay now
              </LinkButton>
            }
          >
            {money(overdueEmi.emi.amount_due + overdueEmi.emi.penalty_amount)} was due on{" "}
            {relativeTime(overdueEmi.emi.due_date)}. A late fee applies on overdue instalments.
          </Alert>
        )}

        {rejected.length > 0 && !awaitingAction.length && (
          <Alert tone="neutral" title="A previous application was declined" icon={<FileText />}>
            You can apply again for a different loan category. Reapplying for the same category
            is blocked for 90 days from the decision date.
          </Alert>
        )}
      </div>

      {/* ─── Metric tiles ─── */}
      <div className="stagger mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Outstanding"
          value={moneyCompact(totalOutstanding)}
          sublabel={`of ${moneyCompact(totalPortfolio)} sanctioned`}
          icon={<Wallet className="size-4" />}
          tone="brand"
          href="/user/loans"
        />
        <StatCard
          label="Active loans"
          value={number(loans.length)}
          sublabel={loans.length ? "in repayment" : "none yet"}
          icon={<Landmark className="size-4" />}
          tone="info"
          href="/user/loans"
        />
        <StatCard
          label="Live applications"
          value={number(live.length)}
          sublabel={live.length ? "in progress" : "none in progress"}
          icon={<FileText className="size-4" />}
          tone="warning"
          href="/user/applications"
        />
        <StatCard
          label="Credit score"
          value={cibilValid ? number(cibilValid.score) : "—"}
          sublabel={cibilValid ? cibilValid.band.toLowerCase() : "not checked"}
          icon={<Gauge className="size-4" />}
          tone={cibilValid?.band === "POOR" ? "danger" : "positive"}
          href="/user/cibil"
        />
      </div>

      {/* ─── Shortcuts ─── */}
      <div className="mt-8">
        <SectionTitle>Quick actions</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {SHORTCUTS.map(({ href, label, icon: Icon, tone }) => (
            <Link
              key={href + label}
              href={href}
              className="group flex flex-col items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-5 text-center shadow-xs transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <span
                className={`flex size-10 items-center justify-center rounded-xl ${tone} transition-transform group-hover:scale-110`}
              >
                <Icon className="size-5" />
              </span>
              <span className="text-xs leading-tight font-medium text-ink-700">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* ─── Active applications ─── */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Your applications"
            description="Most recent first"
            icon={<FileText className="size-4" />}
            action={
              <LinkButton href="/user/applications" size="sm" variant="ghost">
                View all <ArrowRight className="size-3.5" />
              </LinkButton>
            }
          />
          {applications.length === 0 ? (
            <EmptyState
              icon={<FileText className="size-6" />}
              title="No applications yet"
              description="Pick a product and start your first application. Most take about five minutes."
              action={<LinkButton href="/user/new-loan">Browse products</LinkButton>}
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th priority="primary">Reference</Th>
                  <Th priority="primary">Product</Th>
                  <Th priority="primary">Amount</Th>
                  <Th priority="primary">Status</Th>
                  <Th align="right" priority="normal">Applied</Th>
                </tr>
              </thead>
              <tbody>
                {applications.slice(0, 6).map((app) => (
                  <Tr key={app.id}>
                    <Td mono className="text-brand-700" priority="primary">
                      <Link href={`/user/applications/${app.id}`}>{app.reference_no}</Link>
                    </Td>
                    <Td priority="primary">
                      <span className="block font-medium text-ink-900">{app.product?.name}</span>
                      <span className="text-xs text-ink-400">
                        {app.product?.category === "SECURED" ? "Secured" : "Unsecured"}
                        {app.tenure_months ? ` · ${tenure(app.tenure_months)}` : ""}
                      </span>
                    </Td>
                    <Td mono priority="primary">{money(app.requested_amount)}</Td>
                    <Td priority="primary">
                      <StatusBadge status={app.status} />
                    </Td>
                    <Td align="right" className="text-xs text-ink-400" priority="normal">
                      {relativeTime(app.created_at)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>

        {/* ─── Next payment ─── */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Next payment" icon={<CreditCard className="size-4" />} />
            <CardBody>
              {upcomingEmi?.emi || overdueEmi?.emi ? (
                <>
                  <div className="flex items-baseline justify-between">
                    <span className="tabular-nums text-3xl font-semibold tracking-tight text-ink-900">
                      {money(
                        (upcomingEmi?.emi ?? overdueEmi!.emi)!.amount_due +
                          (upcomingEmi?.emi ?? overdueEmi!.emi)!.penalty_amount,
                      )}
                    </span>
                    {overdueEmi?.emi && <Badge tone="danger">Overdue</Badge>}
                  </div>
                  <p className="mt-1 text-[13px] text-ink-500">
                    Due{" "}
                    {new Date((upcomingEmi?.emi ?? overdueEmi!.emi)!.due_date).toLocaleDateString(
                      "en-IN",
                      { day: "numeric", month: "long", year: "numeric" },
                    )}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-[13px]">
                    <span className="text-ink-500">Principal</span>
                    <span className="tabular-nums font-medium">
                      {money((upcomingEmi?.emi ?? overdueEmi!.emi)!.principal_part)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[13px]">
                    <span className="text-ink-500">Interest</span>
                    <span className="tabular-nums font-medium">
                      {money((upcomingEmi?.emi ?? overdueEmi!.emi)!.interest_part)}
                    </span>
                  </div>
                  <LinkButton
                    href={`/user/loans/${(upcomingEmi?.loan ?? overdueEmi!.loan).id}`}
                    fullWidth
                    className="mt-4"
                  >
                    {overdueEmi?.emi ? "Pay overdue" : "View loan"}
                  </LinkButton>
                </>
              ) : (
                <EmptyState
                  icon={<TrendingDown className="size-6" />}
                  title="Nothing due"
                  description="You have no outstanding instalments."
                />
              )}
            </CardBody>
          </Card>

          {/* Repayment progress */}
          {loans.length > 0 && (
            <Card>
              <CardHeader title="Repayment progress" icon={<Wallet className="size-4" />} />
              <CardBody className="space-y-4">
                {loans.map((loan) => {
                  const paid = loan.principal - loan.outstanding_principal;
                  const pct =
                    loan.principal > 0 ? (paid / loan.principal) * 100 : 0;
                  return (
                    <div key={loan.id}>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-ink-800">
                          {loan.product?.name}
                        </span>
                        <span className="tabular-nums shrink-0 text-xs text-ink-500">
                          {percent(pct, 0)}
                        </span>
                      </div>
                      <ProgressBar
                        value={pct}
                        tone={pct >= 100 ? "positive" : "brand"}
                      />
                      <p className="tabular-nums mt-1.5 text-[11px] text-ink-400">
                        {money(paid)} of {money(loan.principal)} repaid
                      </p>
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          )}

          {/* Credit score teaser */}
          <Card>
            <CardHeader title="Credit score" icon={<Gauge className="size-4" />} />
            <CardBody>
              {cibilValid ? (
                <>
                  <div className="flex items-end gap-2">
                    <span className="tabular-nums text-3xl font-semibold tracking-tight text-ink-900">
                      {number(cibilValid.score)}
                    </span>
                    <Badge
                      tone={
                        cibilValid.band === "POOR"
                          ? "danger"
                          : cibilValid.band === "AVERAGE"
                            ? "warning"
                            : "positive"
                      }
                      className="mb-1.5"
                    >
                      {cibilValid.band}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-400">
                    Valid until{" "}
                    {new Date(cibilValid.expires_at).toLocaleDateString("en-IN")}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[13px] text-ink-500">
                    Check your credit score to see whether you qualify for our best rates.
                  </p>
                  <LinkButton href="/user/cibil" fullWidth variant="outline" className="mt-3">
                    Check CIBIL score
                  </LinkButton>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* ─── Products strip ─── */}
      <div className="mt-8">
        <SectionTitle
          action={
            <LinkButton href="/user/new-loan" size="sm" variant="ghost">
              See all <ArrowRight className="size-3.5" />
            </LinkButton>
          }
        >
          Products you might qualify for
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {products.slice(0, 4).map((p) => (
            <Card key={p.id} className="p-4 transition-all hover:border-brand-300 hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <span className="text-2xl">{p.thumbnail_emoji}</span>
                <Badge tone={p.category === "SECURED" ? "brand" : "info"}>
                  {p.category === "SECURED" ? "Secured" : "Unsecured"}
                </Badge>
              </div>
              <h3 className="mt-2.5 text-sm font-semibold text-ink-900">{p.name}</h3>
              <p className="tabular-nums mt-1 text-xs text-ink-500">
                {moneyCompact(p.min_amount)} – {moneyCompact(p.max_amount)}
              </p>
              <p className="tabular-nums mt-0.5 text-xs text-ink-400">
                {percent(p.min_rate, 2)} – {percent(p.max_rate, 2)} p.a.
              </p>
              <LinkButton href={`/user/new-loan?product=${p.id}`} size="sm" variant="outline" fullWidth className="mt-3">
                Apply
              </LinkButton>
            </Card>
          ))}
        </div>
      </div>
    </Portal>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function firstName(full: string) {
  return full.split(/\s+/)[0] ?? full;
}