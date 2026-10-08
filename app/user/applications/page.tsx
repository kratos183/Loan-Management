import Link from "next/link";
import { FileText, MessageSquare } from "lucide-react";
import { Portal, loadPortal } from "@/lib/portal";
import { listApplicationsForUser } from "@/lib/queries/applications";
import { Card } from "@/components/ui/card";
import { StatusBadge, CategoryBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/primitives";
import { TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { money, percent, relativeTime, tenure } from "@/lib/format";

export const metadata = { title: "Application Status" };

const TABS = [
  { key: "live", label: "In progress" },
  { key: "closed", label: "Decided" },
  { key: "all", label: "All" },
] as const;

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const ctx = await loadPortal("user");
  const params = await searchParams;
  const tab = params.tab ?? "live";

  const applications = await listApplicationsForUser(ctx.session.user.id);

  const live = applications.filter((a) =>
    ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "RESUBMISSION_REQUESTED"].includes(a.status),
  );
  const closed = applications.filter((a) =>
    ["APPROVED", "REJECTED", "WITHDRAWN"].includes(a.status),
  );

  const rows = tab === "closed" ? closed : tab === "all" ? applications : live;

  return (
    <Portal
      which="user"
      title="Application status"
      description="Track every application through verification and decision."
      actions={
        <LinkButton href="/user/new-loan" size="sm">
          New application
        </LinkButton>
      }
    >
      {/* Tab strip */}
      <div className="mb-5 flex gap-1 border-b border-ink-200">
        {TABS.map((t) => {
          const count =
            t.key === "live" ? live.length : t.key === "closed" ? closed.length : applications.length;
          const active = tab === t.key;
          return (
            <Link
              key={t.key}
              href={t.key === "all" ? "/user/applications?tab=all" : `/user/applications?tab=${t.key}`}
              className={`-mb-px border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors ${
                active
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-ink-500 hover:border-ink-300 hover:text-ink-800"
              }`}
            >
              {t.label}
              <span className="tabular-nums ml-1.5 text-xs text-ink-400">{count}</span>
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText className="size-6" />}
            title={tab === "live" ? "No applications in progress" : "Nothing here yet"}
            description={
              tab === "live"
                ? "Start a new application and we'll keep you posted at every step."
                : "Applications you submit will show up here with their decision."
            }
            action={<LinkButton href="/user/new-loan">Browse products</LinkButton>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((app) => {
            const needsAction = app.status === "RESUBMISSION_REQUESTED";
            return (
              <Card
                key={app.id}
                className={`p-5 transition-shadow hover:shadow-md ${
                  needsAction ? "border-warning-300 ring-1 ring-warning-100" : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/user/applications/${app.id}`}
                        className="font-mono text-[13px] font-semibold text-brand-700 hover:underline"
                      >
                        {app.reference_no}
                      </Link>
                      <StatusBadge status={app.status} />
                      {app.product && <CategoryBadge category={app.product.category} />}
                    </div>

                    <h3 className="mt-2 text-[15px] font-semibold text-ink-900">
                      {app.product?.name ?? "Loan application"}
                    </h3>

                    <div className="tabular-nums mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-500">
                      <span>{money(app.requested_amount)}</span>
                      <span>{tenure(app.tenure_months)}</span>
                      {app.offered_rate && <span>{percent(app.offered_rate)} p.a.</span>}
                      <span className="text-ink-400">Applied {relativeTime(app.created_at)}</span>
                    </div>

                    {app.purpose && (
                      <p className="mt-2 line-clamp-1 text-[13px] text-ink-500">
                        <span className="text-ink-400">Purpose:</span> {app.purpose}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <LinkButton
                      href={`/user/applications/${app.id}`}
                      size="sm"
                      variant={needsAction ? "primary" : "outline"}
                    >
                      {needsAction ? "Take action" : "View details"}
                    </LinkButton>
                    {app.assigned_officer_id && (
                      <Link
                        href={`/user/chat?application=${app.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-brand-600"
                      >
                        <MessageSquare className="size-3" />
                        Ask {app.officer?.full_name?.split(" ")[0] ?? "your officer"}
                      </Link>
                    )}
                  </div>
                </div>

                {/* PENDING: expected window + assigned officer (source doc 109-110) */}
                {["SUBMITTED", "UNDER_REVIEW"].includes(app.status) && app.product && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-ink-50 px-3.5 py-2.5 text-[13px]">
                    <span className="text-ink-600">
                      Expected decision within{" "}
                      <strong className="font-semibold text-ink-800">
                        {app.product.sla_min_days}–{app.product.sla_max_days} working days
                      </strong>
                      {app.sla_due_at && (
                        <span className="ml-1 text-ink-400">
                          (due {new Date(app.sla_due_at).toLocaleDateString("en-IN")})
                        </span>
                      )}
                    </span>
                    {app.officer && (
                      <span
                        className="inline-flex items-center gap-1.5 text-ink-600"
                        title="Your assigned officer"
                      >
                        Officer
                        <strong className="font-semibold text-ink-800">
                          {app.officer.full_name}
                        </strong>
                      </span>
                    )}
                  </div>
                )}

                {app.status === "RESUBMISSION_REQUESTED" && (
                  <Alert tone="warning" className="mt-4">
                    Your officer has asked you to correct some details. Open the application to
                    see exactly which documents to replace.
                  </Alert>
                )}

                {app.status === "REJECTED" && app.decision_reason && (
                  <Alert tone="danger" className="mt-4">
                    <strong>Reason:</strong> {app.decision_reason}
                    <p className="mt-1 text-xs opacity-80">
                      You can apply again for a different category now. Reapplying in this
                      category is blocked for 90 days.
                    </p>
                  </Alert>
                )}

                {app.status === "APPROVED" && (
                  <div className="mt-4 grid gap-3 rounded-lg border border-positive-200 bg-positive-50 px-3.5 py-3 sm:grid-cols-4">
                    <Detail label="Approved amount" value={money(app.approved_amount)} />
                    <Detail label="Rate" value={percent(app.offered_rate)} />
                    <Detail label="EMI" value={money(app.emi_amount)} />
                    <Detail label="Account" value={app.assigned_account_number ?? "—"} mono />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </Portal>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-positive-700">
        {label}
      </p>
      <p
        className={`tabular-nums mt-0.5 text-[13px] font-semibold text-positive-900 ${mono ? "font-mono" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}