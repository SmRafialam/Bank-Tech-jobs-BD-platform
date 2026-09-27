import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { formatDhakaDateTime } from "@/lib/time";

export default async function AdminAuditPage() {
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 300, include: { actor: { select: { email: true } } } });
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-navy-900">Audit log</h1>
      <Table>
        <THead>
          <TR>
            <TH>Time</TH>
            <TH>Actor</TH>
            <TH>Action</TH>
            <TH>Entity</TH>
            <TH>IP</TH>
            <TH>Details</TH>
          </TR>
        </THead>
        <TBody>
          {logs.map((l) => (
            <TR key={l.id}>
              <TD className="whitespace-nowrap text-xs">{formatDhakaDateTime(l.createdAt)}</TD>
              <TD className="text-xs">{l.actor?.email ?? "—"}</TD>
              <TD className="font-mono text-xs">{l.action}</TD>
              <TD className="text-xs">
                {l.entity} {l.entityId ? <span className="text-slate-400">{l.entityId}</span> : null}
              </TD>
              <TD className="text-xs">{l.ip ?? "—"}</TD>
              <TD className="max-w-sm truncate font-mono text-xs text-slate-500">{l.meta ? JSON.stringify(l.meta) : ""}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
