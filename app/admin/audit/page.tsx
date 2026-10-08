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
                <Th>When</Th>
                <Th>Actor</Th>
                <Th>Action</Th>
                <Th>Entity</Th>
                <Th>Detail</Th>
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
                    <Td className="whitespace-nowrap text-xs text-ink-500">
                      {formatDateTime(log.created_at)}
                    </Td>
                    <Td>
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
                    <Td>
                      <Badge tone={ACTION_TONES[log.action] ?? "neutral"}>
                        {log.action}
                      </Badge>
                    </Td>
                    <Td className="font-mono text-[11px] text-ink-500">
                      {log.entity_type}
                      {log.entity_id && (
                        <span className="block text-ink-300">{log.entity_id.slice(0, 8)}</span>
                      )}
                    </Td>
                    <Td className="text-[13px] text-ink-700">{log.summary ?? "—"}</Td>
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