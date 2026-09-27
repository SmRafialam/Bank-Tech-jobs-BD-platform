import type { Metadata } from "next";
import Link from "next/link";
import { DeadlineText, MatchBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { ACTIVE_STATUSES } from "@/lib/jobs/status";
import { APPLICATION_STATUS_LABELS, VERDICT_LABELS } from "@/lib/jobs/taxonomy";
import { requireUser } from "@/lib/session";
import { formatDhakaDate, formatDhakaDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const active = { archivedAt: null, reviewStatus: "APPROVED" as const, status: { in: ACTIVE_STATUSES } };
  const [profile, verdictCounts, top, saved, applications, notifications] = await Promise.all([
    prisma.candidateProfile.findUnique({ where: { userId: user.id } }),
    prisma.matchResult.groupBy({ by: ["verdict"], where: { userId: user.id, job: active }, _count: { _all: true } }),
    prisma.matchResult.findMany({
      where: { userId: user.id, job: active, verdict: { in: ["STRONG", "POSSIBLE", "MANUAL_REVIEW"] } },
      orderBy: { score: "desc" },
      take: 8,
      include: { job: { select: { slug: true, title: true, deadline: true, organization: { select: { name: true } } } } },
    }),
    prisma.savedJob.findMany({ where: { userId: user.id, job: active }, include: { job: { select: { slug: true, title: true, deadline: true } } }, orderBy: { job: { deadline: "asc" } }, take: 5 }),
    prisma.application.findMany({ where: { userId: user.id }, include: { job: { select: { slug: true, title: true } } }, orderBy: { updatedAt: "desc" }, take: 5 }),
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const profileComplete = Boolean(profile?.discipline && profile.bachelorCgpa != null && profile.experienceYears != null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Welcome{profile?.fullName ? `, ${profile.fullName}` : ""}</h1>
        <p className="text-slate-600">Your personalised view of technology jobs in Bangladeshi banking and finance.</p>
      </div>
      {!profileComplete ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Your profile is incomplete — eligibility needs your discipline, CGPA and experience.{" "}
          <Link href="/settings/profile" className="font-semibold underline">
            Complete profile
          </Link>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(["STRONG", "POSSIBLE", "WEAK", "NOT_ELIGIBLE", "MANUAL_REVIEW"] as const).map((v) => (
          <Link key={v} href={`/jobs?verdict=${v}&sort=match`} className="rounded-xl border border-slate-200 bg-white p-3 hover:border-blue-300">
            <p className="text-2xl font-bold text-navy-900">{verdictCounts.find((c) => c.verdict === v)?._count._all ?? 0}</p>
            <p className="text-xs text-slate-600">{VERDICT_LABELS[v]}</p>
          </Link>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top matches</CardTitle>
          </CardHeader>
          <CardContent>
            {top.length ? (
              <ul className="divide-y divide-slate-100">
                {top.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <Link href={`/jobs/${m.job.slug}`} className="font-medium text-navy-900 hover:underline">
                        {m.job.title}
                      </Link>
                      <p className="text-xs text-slate-500">{m.job.organization.name}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <MatchBadge verdict={m.verdict} score={m.score} />
                      <DeadlineText deadline={m.job.deadline} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-600">No matches yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Saved jobs — next deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            {saved.length ? (
              <ul className="divide-y divide-slate-100">
                {saved.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link href={`/jobs/${s.job.slug}`} className="font-medium text-navy-900 hover:underline">
                      {s.job.title}
                    </Link>
                    <span className="text-slate-500">{formatDhakaDate(s.job.deadline)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-600">Save jobs to get deadline reminders.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Applications</CardTitle>
          </CardHeader>
          <CardContent>
            {applications.length ? (
              <ul className="divide-y divide-slate-100">
                {applications.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link href={`/jobs/${a.job.slug}`} className="font-medium text-navy-900 hover:underline">
                      {a.job.title}
                    </Link>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{APPLICATION_STATUS_LABELS[a.status]}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-600">Track applications from any job page.</p>
            )}
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href="/applications">Open tracker</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent notifications</CardTitle>
          </CardHeader>
          <CardContent>
            {notifications.length ? (
              <ul className="divide-y divide-slate-100">
                {notifications.map((n) => (
                  <li key={n.id} className="py-2 text-sm">
                    <p className={n.readAt ? "text-slate-600" : "font-medium text-navy-900"}>{n.title}</p>
                    <p className="text-xs text-slate-500">{formatDhakaDateTime(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-600">No notifications yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
