import Link from "next/link";
import { runTaskAction } from "@/app/actions/admin";
import { SubmitButton } from "@/components/forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { ACTIVE_STATUSES } from "@/lib/jobs/status";
import { HEALTH_COLOR, HEALTH_LABEL, sourceHealth, type Health } from "@/lib/source-health";
import { TASK_NAMES } from "@/tasks";
import { formatDhakaDateTime, hoursAgo } from "@/lib/time";

function Stat({ label, value, href, tone }: { label: string; value: number | string; href?: string; tone?: "red" | "amber" }) {
  const body = (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className={tone === "red" ? "text-2xl font-bold text-red-700" : tone === "amber" ? "text-2xl font-bold text-amber-700" : "text-2xl font-bold text-navy-900"}>{value}</p>
      <p className="text-sm text-slate-600">{label}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function AdminOverviewPage() {
  const since = hoursAgo(24);
  const [sources, runs24, pending, dupes, reports, openJobs, perSource, tasks, lastRun] = await Promise.all([
    prisma.source.findMany({ orderBy: { name: "asc" } }),
    prisma.sourceRun.groupBy({ by: ["status"], where: { startedAt: { gte: since } }, _count: { _all: true } }),
    prisma.job.count({ where: { reviewStatus: "PENDING", archivedAt: null } }),
    prisma.duplicateCandidate.count({ where: { status: "PENDING" } }),
    prisma.jobReport.count({ where: { status: "OPEN" } }),
    prisma.job.count({ where: { archivedAt: null, reviewStatus: "APPROVED", status: { in: ACTIVE_STATUSES } } }),
    prisma.jobSourceLink.groupBy({ by: ["sourceId"], _count: { _all: true } }),
    prisma.taskRun.findMany({ orderBy: { startedAt: "desc" }, take: 10 }),
    prisma.sourceRun.findFirst({ orderBy: { startedAt: "desc" }, select: { startedAt: true } }),
  ]);
  const health = sources.map((s) => ({ s, h: sourceHealth(s) }));
  const count = (h: Health) => health.filter((x) => x.h === h).length;
  const runCount = (status: string) => runs24.find((r) => r.status === status)?._count._all ?? 0;
  const parseErrors = await prisma.sourceRun.aggregate({ where: { startedAt: { gte: since } }, _sum: { parseErrors: true } });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-navy-900">Admin overview</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Stat label="Total sources" value={sources.length} href="/admin/sources" />
        <Stat label="Healthy automated" value={count("healthy")} />
        <Stat label="Failing / warning" value={`${count("failing")} / ${count("warning")}`} tone={count("failing") ? "red" : count("warning") ? "amber" : undefined} />
        <Stat label="Manual/API required" value={count("manual")} />
        <Stat label="Runs OK (24 h)" value={runCount("SUCCESS") + runCount("PARTIAL")} />
        <Stat label="Runs failed (24 h)" value={runCount("FAILED")} tone={runCount("FAILED") ? "red" : undefined} />
        <Stat label="Parse errors (24 h)" value={parseErrors._sum.parseErrors ?? 0} />
        <Stat label="Last scrape" value={lastRun ? formatDhakaDateTime(lastRun.startedAt) : "never"} />
        <Stat label="Open jobs" value={openJobs} href="/admin/jobs" />
        <Stat label="Pending review" value={pending} href="/admin/jobs?view=pending" tone={pending ? "amber" : undefined} />
        <Stat label="Duplicate queue" value={dupes} href="/admin/duplicates" tone={dupes ? "amber" : undefined} />
        <Stat label="Open reports" value={reports} href="/admin/reports" tone={reports ? "amber" : undefined} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Source health</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-wrap gap-2">
            {health.map(({ s, h }) => (
              <li key={s.id}>
                <Link href={`/admin/sources/${s.id}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs hover:border-blue-300" title={`${HEALTH_LABEL[h]}${s.lastError ? ` — ${s.lastError}` : ""}`}>
                  <span className={`size-2.5 rounded-full ${HEALTH_COLOR[h]}`} aria-hidden />
                  {s.name}
                  <span className="sr-only">: {HEALTH_LABEL[h]}</span>
                  <span className="text-slate-400">{perSource.find((p) => p.sourceId === s.id)?._count._all ?? 0}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
            {(Object.keys(HEALTH_LABEL) as Health[]).map((h) => (
              <span key={h} className="inline-flex items-center gap-1">
                <span className={`size-2.5 rounded-full ${HEALTH_COLOR[h]}`} aria-hidden /> {HEALTH_LABEL[h]}
              </span>
            ))}
            <span>Number = jobs collected from the source.</span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scheduled tasks</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {TASK_NAMES.map((t) => (
              <form key={t} action={runTaskAction}>
                <input type="hidden" name="task" value={t} />
                <SubmitButton variant="outline" size="sm" pendingText={`Running ${t}…`}>
                  Run {t}
                </SubmitButton>
              </form>
            ))}
          </div>
          <Table>
            <THead>
              <TR>
                <TH>Task</TH>
                <TH>Trigger</TH>
                <TH>Status</TH>
                <TH>Started</TH>
                <TH>Result</TH>
              </TR>
            </THead>
            <TBody>
              {tasks.map((t) => (
                <TR key={t.id}>
                  <TD className="font-medium">{t.task}</TD>
                  <TD>{t.trigger}</TD>
                  <TD>{t.status}</TD>
                  <TD className="whitespace-nowrap">{formatDhakaDateTime(t.startedAt)}</TD>
                  <TD className="text-slate-600">{t.message}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
