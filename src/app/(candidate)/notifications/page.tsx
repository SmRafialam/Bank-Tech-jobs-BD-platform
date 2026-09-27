import type { Metadata } from "next";
import Link from "next/link";
import { markAllReadAction, markNotificationReadAction } from "@/app/actions/candidate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatDhakaDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

const TYPE_LABEL: Record<string, string> = {
  NEW_JOB: "New job",
  HIGH_PRIORITY: "High priority",
  JOB_UPDATED: "Updated",
  DEADLINE_REMINDER: "Deadline",
  CLOSING_SOON: "Closing soon",
  DIGEST: "Digest",
  SYSTEM: "System",
};

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const user = await requireUser("/notifications");
  const unreadOnly = (await searchParams).filter === "unread";
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id, ...(unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { deliveries: { select: { channel: true, status: true } } },
  });
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Notifications</h1>
          <p className="text-slate-600">Alerts are sent once per job and change — unchanged jobs never notify twice.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={unreadOnly ? "/notifications" : "/notifications?filter=unread"}>{unreadOnly ? "Show all" : "Unread only"}</Link>
          </Button>
          <form action={markAllReadAction}>
            <Button type="submit" size="sm">
              Mark all read
            </Button>
          </form>
        </div>
      </div>
      {notifications.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">No notifications.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {notifications.map((n) => (
            <li key={n.id} className={cn("rounded-lg border bg-white p-4", n.readAt ? "border-slate-200" : "border-blue-300 bg-blue-50/40")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <Badge variant={n.priority ? "danger" : "default"}>{TYPE_LABEL[n.type] ?? n.type}</Badge>
                    {!n.readAt ? <span className="text-xs font-semibold text-blue-700">Unread</span> : null}
                  </p>
                  <p className="mt-1 font-medium text-navy-900">{n.url ? <Link href={n.url} className="hover:underline">{n.title}</Link> : n.title}</p>
                  <p className="whitespace-pre-line text-sm text-slate-700">{n.body}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDhakaDateTime(n.createdAt)} · delivered via {n.deliveries.map((d) => `${d.channel.toLowerCase()} (${d.status.toLowerCase()})`).join(", ") || "in-app"}
                    {n.digestPending ? " · email in next daily digest" : ""}
                  </p>
                </div>
                {!n.readAt ? (
                  <form action={markNotificationReadAction}>
                    <input type="hidden" name="notificationId" value={n.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      Mark read
                    </Button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
