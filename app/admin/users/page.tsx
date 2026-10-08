import { Search, UserCog, Users } from "lucide-react";
import { Portal, loadPortal } from "@/lib/portal";
import { listAllUsers } from "@/lib/queries/staff";
import { Card } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/form";
import { Avatar, EmptyState, SectionTitle, StatCard } from "@/components/ui/primitives";
import { TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { RoleSelect, StatusToggle } from "./UserAccessControl";
import { formatDate, moneyCompact, number } from "@/lib/format";
import type { UserRole, UserStatus } from "@/lib/db/types";

export const metadata = { title: "User Management" };

/**
 * GAP 1: admin user management.
 *
 * Reads every profile (RLS allows admins through `is_staff()`). Role changes
 * go through `updateUserAccess`, which re-checks the caller's role server-side
 * and writes an audit row.
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string }>;
}) {
  const ctx = await loadPortal("admin");
  const params = await searchParams;

  const all = await listAllUsers();

  const q = params.q?.toLowerCase() ?? "";
  const filtered = all.filter((u) => {
    if (params.role && params.role !== "ALL" && u.role !== params.role) return false;
    if (params.status && params.status !== "ALL" && u.status !== params.status) return false;
    if (!q) return true;
    return (
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone ?? "").includes(q) ||
      (u.pan ?? "").toLowerCase().includes(q)
    );
  });

  const borrowers = all.filter((u) => u.role === "USER");
  const staff = all.filter((u) => u.role !== "USER");
  const blocked = all.filter((u) => u.status === "BLOCKED");

  return (
    <Portal
      which="admin"
      title="User management"
      description="Every account on the platform, with role and access control."
      maxWidth="max-w-[1500px]"
    >
      <div className="stagger grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total users"
          value={number(all.length)}
          sublabel={`${borrowers.length} borrowers`}
          icon={<Users className="size-4" />}
          tone="brand"
        />
        <StatCard
          label="Staff accounts"
          value={number(staff.length)}
          sublabel="officers, managers, admins"
          icon={<UserCog className="size-4" />}
          tone="info"
        />
        <StatCard
          label="Blocked"
          value={number(blocked.length)}
          sublabel={blocked.length ? "cannot sign in" : "none blocked"}
          tone={blocked.length ? "danger" : "positive"}
        />
      </div>

      {/* Filters */}
      <Card className="mt-6 p-4">
        <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <Input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Search by name, email, phone or PAN"
              className="pl-9"
            />
          </div>
          <Select name="role" defaultValue={params.role ?? "ALL"} className="sm:w-40">
            <option value="ALL">All roles</option>
            <option value="USER">Borrowers</option>
            <option value="EMPLOYEE">Employees</option>
            <option value="ADMIN">Admins</option>
          </Select>
          <Select name="status" defaultValue={params.status ?? "ALL"} className="sm:w-40">
            <option value="ALL">Any status</option>
            <option value="ACTIVE">Active</option>
            <option value="BLOCKED">Blocked</option>
            <option value="CLOSED">Closed</option>
            <option value="PENDING">Pending</option>
          </Select>
        </form>
      </Card>

      <div className="mt-6">
        <SectionTitle>
          {filtered.length} {filtered.length === 1 ? "account" : "accounts"}
        </SectionTitle>

        <Card>
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Users className="size-6" />}
              title="No matching users"
              description="Try a different search term or clear the filters."
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>User</Th>
                  <Th>Contact</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th align="right">Income</Th>
                  <Th align="right">Joined</Th>
                  <Th align="right">Access</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <Tr key={user.id}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={user.full_name} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium text-ink-900">{user.full_name}</p>
                          {user.pan && (
                            <p className="font-mono text-[11px] text-ink-400">{user.pan}</p>
                          )}
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <p className="truncate text-ink-700">{user.email}</p>
                      {user.phone && (
                        <p className="text-[11px] text-ink-400">{user.phone}</p>
                      )}
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          user.role === "ADMIN"
                            ? "danger"
                            : user.role === "EMPLOYEE"
                              ? "brand"
                              : "neutral"
                        }
                      >
                        {user.role === "USER" ? "Borrower" : user.role === "EMPLOYEE" ? "Employee" : "Admin"}
                      </Badge>
                    </Td>
                    <Td>
                      <StatusBadge status={user.status} />
                    </Td>
                    <Td align="right" mono>
                      {user.monthly_income ? moneyCompact(user.monthly_income) : "—"}
                    </Td>
                    <Td align="right" className="text-xs text-ink-400">
                      {formatDate(user.created_at)}
                    </Td>
                    <Td align="right">
                      <AccessControl user={user} isSelf={user.id === ctx.session.user.id} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
      </div>
    </Portal>
  );
}

function AccessControl({
  user,
  isSelf,
}: {
  user: { id: string; role: UserRole; status: UserStatus };
  isSelf: boolean;
}) {
  // Self-service lockout: an admin shouldn't be able to block themselves
  return (
    <div className="inline-flex items-center gap-1.5">
      <RoleSelect user={user} />
      {!isSelf && <StatusToggle user={user} />}
    </div>
  );
}

