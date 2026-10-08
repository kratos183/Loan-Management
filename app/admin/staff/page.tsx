import { ScrollText, ShieldCheck, Users } from "lucide-react";
import { Portal, loadPortal } from "@/lib/portal";
import { listAllStaff } from "@/lib/queries/staff";
import { Card } from "@/components/ui/card";
import { Avatar, Alert, DataList, EmptyState, SectionTitle, StatCard } from "@/components/ui/primitives";
import { TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { money, moneyCompact, number } from "@/lib/format";

export const metadata = { title: "Staff & Authority" };

/**
 * GAP 2 & 7: the approval authority matrix.
 *
 * An officer may sanction up to their own `approval_limit`. Above that the
 * application escalates to a manager; above a manager's ceiling it goes to an
 * admin. Editing a limit here immediately changes routing in `decideApplication`.
 */
export default async function AdminStaffPage() {
  await loadPortal("admin");
  const staff = await listAllStaff();

  const officers = staff.filter((s) => s.employee_role === "OFFICER");
  const managers = staff.filter((s) => s.employee_role === "MANAGER");

  const avgLimit = officers.length
    ? officers.reduce((s, o) => s + Number(o.approval_limit), 0) / officers.length
    : 0;

  return (
    <Portal
      which="admin"
      title="Staff & sanctioning authority"
      description="Officer roles, territories and the amounts each person may sanction."
      maxWidth="max-w-[1300px]"
    >
      <div className="stagger grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Officers"
          value={number(officers.length)}
          sublabel={`avg limit ${moneyCompact(avgLimit)}`}
          icon={<Users className="size-4" />}
          tone="brand"
        />
        <StatCard
          label="Managers"
          value={number(managers.length)}
          sublabel="unlimited within policy"
          icon={<ScrollText className="size-4" />}
          tone="info"
        />
        <StatCard
          label="Highest limit"
          value={moneyCompact(
            Math.max(...staff.map((s) => Number(s.approval_limit)), 0),
          )}
          sublabel="manager ceiling"
          icon={<ShieldCheck className="size-4" />}
          tone="positive"
        />
      </div>

      {/* How the matrix works */}
      <Card className="mt-6">
        <CardBodyWrapper title="How approval routing works">
          <ol className="space-y-3">
            {[
              {
                step: "1",
                title: "Officer reviews",
                body: "Any officer with the category specialisation can pick up the application. Once assigned, only that officer (or a manager) can decide it.",
              },
              {
                step: "2",
                title: "Amount within limit",
                body: "If the sanctioned amount is at or below that officer's approval_limit, they sanction it themselves and the loan is created immediately.",
              },
              {
                step: "3",
                title: "Above limit escalates",
                body: "Anything higher is routed to a manager for final authorisation. The officer is notified; the applicant is not blocked.",
              },
              {
                step: "4",
                title: "Audit trail",
                body: "Every approval, rejection and escalation writes a row to audit_logs with the actor, the amount and the limit it was measured against.",
              },
            ].map((s) => (
              <li key={s.step} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                  {s.step}
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-ink-800">{s.title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-ink-500">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardBodyWrapper>
      </Card>

      {/* Staff table */}
      <div className="mt-8">
        <SectionTitle>Staff accounts</SectionTitle>
        <Card>
          {staff.length === 0 ? (
            <EmptyState icon={<Users className="size-6" />} title="No staff accounts" />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Role</Th>
                  <Th>Territory</Th>
                  <Th>Categories</Th>
                  <Th align="right">Sanctioning limit</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {staff.map((member) => (
                  <Tr key={member.user_id}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={member.profile?.full_name} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium text-ink-900">
                            {member.profile?.full_name}
                          </p>
                          <p className="truncate text-[11px] text-ink-400">
                            {member.employee_code} · {member.profile?.email}
                          </p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={member.employee_role === "MANAGER" ? "brand" : "neutral"}>
                        {member.employee_role}
                      </Badge>
                    </Td>
                    <Td className="text-ink-600">{member.territory ?? "—"}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {(member.specialities ?? []).map((s) => (
                          <span
                            key={s}
                            className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-medium text-ink-600"
                          >
                            {s === "SECURED" ? "Secured" : "Unsecured"}
                          </span>
                        ))}
                      </div>
                    </Td>
                    <Td align="right" mono className="font-semibold">
                      {money(member.approval_limit)}
                    </Td>
                    <Td>
                      <StatusBadge status={member.profile?.status ?? "ACTIVE"} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
      </div>

      <Alert tone="info" className="mt-6" title="Round-robin assignment">
        New applications are assigned to the least-loaded eligible officer in that category.
        An officer with no specialities handles both. This self-corrects when someone is on
        leave, which pure round-robin does not.
      </Alert>
    </Portal>
  );
}

function CardBodyWrapper({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-4 text-sm font-semibold text-ink-900">{title}</h2>
      {children}
    </div>
  );
}