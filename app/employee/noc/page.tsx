import { BadgeCheck, ScrollText } from "lucide-react";
import { Portal } from "@/lib/portal";
import { listNocQueue } from "@/lib/queries/staff";
import { Card, CardBody } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar, Alert, DataList, EmptyState, SectionTitle, StatCard } from "@/components/ui/primitives";
import { formatDate, money, number, relativeTime } from "@/lib/format";
import { NocDecision } from "./NocDecision";

export const metadata = { title: "NOC Requests" };

interface NocRow {
  id: string;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
  decision_note: string | null;
  account_number: string;
  loan: {
    id: string;
    account_number: string;
    principal: number;
    tenure_months: number;
    status: string;
    product: { name: string } | null;
    borrower: { id: string; full_name: string; email: string; phone: string } | null;
  } | null;
}

/**
 * Source doc lines 166-170: the borrower claims an NOC once the loan is fully
 * repaid; an officer approves it, and only then does the download unlock.
 */
export default async function NocQueuePage() {
  const requests = (await listNocQueue()) as unknown as NocRow[];

  const pending = requests.filter((r) => r.status === "PENDING");
  const decided = requests.filter((r) => r.status !== "PENDING");

  return (
    <Portal
      which="employee"
      title="NOC requests"
      description="Borrowers who have fully repaid and are waiting on their closure document."
      maxWidth="max-w-[1200px]"
    >
      <div className="stagger grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Awaiting approval"
          value={number(pending.length)}
          sublabel={pending.length ? "borrowers waiting" : "queue is clear"}
          icon={<ScrollText className="size-4" />}
          tone={pending.length ? "warning" : "positive"}
        />
        <StatCard
          label="Issued"
          value={number(decided.filter((r) => r.status === "APPROVED").length)}
          sublabel="all time"
          icon={<BadgeCheck className="size-4" />}
          tone="positive"
        />
        <StatCard
          label="Declined"
          value={number(decided.filter((r) => r.status === "REJECTED").length)}
          sublabel="all time"
          tone="brand"
        />
      </div>

      <div className="mt-8">
        <SectionTitle>Pending ({pending.length})</SectionTitle>

        {pending.length === 0 ? (
          <Card>
            <EmptyState
              icon={<BadgeCheck className="size-6" />}
              title="Nothing waiting"
              description="Every NOC request has been reviewed."
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {pending.map((r) => (
              <Card key={r.id}>
                <CardBody>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Avatar name={r.loan?.borrower?.full_name} size="md" />
                      <div>
                        <h3 className="text-[14px] font-semibold text-ink-900">
                          {r.loan?.borrower?.full_name}
                        </h3>
                        <p className="text-[13px] text-ink-500">
                          {r.loan?.product?.name}
                        </p>
                        <p className="tabular-nums mt-0.5 font-mono text-[11px] text-ink-400">
                          {r.loan?.account_number}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>

                  <div className="mt-4 grid gap-4 border-t border-ink-100 pt-4 sm:grid-cols-2">
                    <DataList
                      items={[
                        { label: "Principal", value: money(r.loan?.principal ?? 0) },
                        { label: "Tenure", value: `${r.loan?.tenure_months} months` },
                      ]}
                    />
                    <DataList
                      items={[
                        { label: "Loan status", value: r.loan?.status.replace(/_/g, " ") ?? "—" },
                        { label: "Requested", value: relativeTime(r.requested_at) },
                      ]}
                    />
                  </div>

                  <NocDecision nocId={r.id} />
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>

      {decided.length > 0 && (
        <div className="mt-8">
          <SectionTitle>Recently decided</SectionTitle>
          <Card>
            <ul className="divide-y divide-ink-100">
              {decided.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink-900">
                      {r.loan?.borrower?.full_name}
                    </p>
                    <p className="tabular-nums font-mono text-[11px] text-ink-400">
                      {r.loan?.account_number}
                    </p>
                    {r.decision_note && (
                      <p className="mt-1 text-[12px] leading-relaxed text-ink-500">
                        {r.decision_note}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusBadge status={r.status} />
                    <p className="mt-1 text-[11px] text-ink-400">
                      {formatDate(r.reviewed_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      <Alert tone="neutral" className="mt-8">
        Approving an NOC sets the loan to <code className="font-mono">NOC_ISSUED</code>, which
        unlocks the download on the borrower's loan page and closes the account permanently.
        Declining leaves the account open, so write a reason the borrower can act on.
      </Alert>
    </Portal>
  );
}