import { ScrollText } from "lucide-react";
import { Portal, loadPortal } from "@/lib/portal";
import { listAuditLog } from "@/lib/queries/staff";
import { Card } from "@/components/ui/card";
import { Avatar, EmptyState } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Audit Log" };

/** RLS on audit_logs allows admins only. */
export default async function AdminAuditPage() {
  await loadPortal("admin");
  const logs = await listAuditLog(200);

  const ACTION_TONES: Record<string, "brand" | "positive" | "danger" | "warning" | "neutral"> = {
    CREATE: "neutral",
    UPDATE: "brand",
    DELETE: "danger",
    APPROVE: "positive",
    REJECT: "danger",
    RESUBMIT: "warning",
    LOGIN: "neutral",
    DISBURSE: "positive",
  };

  return (
    <Portal
      which="admin"
      title="Audit log"
      description="Every decision taken on the platform, with who took it and when."
      maxWidth="max-w-[1300px]"
    >
      <Card>
        {logs.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="size-6" />}
            title="Nothing logged yet"
            description="Approvals, rejections, disbursals and escalations appear here."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                {/* An audit trail has no dispensable column — dropping any of
                    it would hide the record someone came to audit. So only the
                    two widest are trimmed, and the wrapper still scrolls
                    horizontally as a safety net. */}
                <Th priority="primary">When</Th>
                <Th priority="primary">Actor</Th>
                <Th priority="primary">Action</Th>
                <Th priority="normal">Entity</Th>
                <Th priority="normal">Detail</Th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const actor = log.actor as unknown as {
                  full_name: string;
                  email: string;
                } | null;

                return (
                  <Tr key={log.id}>
                    <Td className="whitespace-nowrap text-xs text-ink-500" priority="primary">
                      {formatDateTime(log.created_at)}
                    </Td>
                    <Td priority="primary">
                      <div className="flex items-center gap-2">
                        <Avatar name={actor?.full_name ?? "System"} size="xs" />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-ink-800">
                            {actor?.full_name ?? "System"}
                          </p>
                          {log.actor_role && (
                            <p className="text-[10px] uppercase text-ink-400">
                              {log.actor_role}
                            </p>
                          )}
                        </div>
                      </div>
                    </Td>
                    <Td priority="primary">
                      <Badge tone={ACTION_TONES[log.action] ?? "neutral"}>
                        {log.action}
                      </Badge>
                    </Td>
                    <Td className="font-mono text-[11px] text-ink-500" priority="normal">
                      {log.entity_type}
                      {log.entity_id && (
                        <span className="block text-ink-300">{log.entity_id.slice(0, 8)}</span>
                      )}
                    </Td>
                    <Td className="text-[13px] text-ink-700" priority="normal">{log.summary ?? "—"}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </Portal>
  );
}