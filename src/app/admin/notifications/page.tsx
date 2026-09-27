import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { formatDhakaDateTime, hoursAgo } from "@/lib/time";

export default async function AdminNotificationsPage() {
  const since = hoursAgo(7 * 24);
  const [deliveries, summary] = await Promise.all([
    prisma.notificationDelivery.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { notification: { select: { title: true, type: true, user: { select: { email: true } } } } },
    }),
    prisma.notificationDelivery.groupBy({ by: ["channel", "status"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-navy-900">Notification log</h1>
      <p className="flex flex-wrap gap-2 text-sm">
        {summary.map((s) => (
          <span key={`${s.channel}-${s.status}`} className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
            {s.channel.toLowerCase()} · {s.status.toLowerCase()}: <strong>{s._count._all}</strong>
          </span>
        ))}
        <span className="text-slate-500">(last 7 days)</span>
      </p>
      <Table>
        <THead>
          <TR>
            <TH>Time</TH>
            <TH>Channel</TH>
            <TH>Status</TH>
            <TH>Recipient</TH>
            <TH>Notification</TH>
            <TH>Error</TH>
          </TR>
        </THead>
        <TBody>
          {deliveries.map((d) => (
            <TR key={d.id}>
              <TD className="whitespace-nowrap text-xs">{formatDhakaDateTime(d.createdAt)}</TD>
              <TD>{d.channel}</TD>
              <TD>
                <Badge variant={d.status === "SENT" ? "success" : d.status === "FAILED" ? "danger" : d.status === "LOGGED" ? "info" : "muted"}>{d.status}</Badge>
              </TD>
              <TD className="text-xs">{d.notification?.user.email ?? d.target ?? "—"}</TD>
              <TD className="max-w-md text-sm">
                <span className="text-xs text-slate-500">{d.notification?.type}</span> {d.notification?.title}
              </TD>
              <TD className="max-w-xs text-xs text-red-700">{d.error}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
