import Link from "next/link";
import { runSourceNowAction, toggleSourceAction, updateSchedulesAction, updateSourceIntervalAction } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { HEALTH_COLOR, HEALTH_LABEL, sourceHealth } from "@/lib/source-health";
import { TASK_NAMES } from "@/tasks";
import { defaultSchedules, getSchedules, nextRun, SCHEDULE_TIMEZONE } from "@/tasks/schedules";
import { formatDhakaDateTime } from "@/lib/time";

export default async function AdminSourcesPage() {
  const [sources, counts, schedules] = await Promise.all([
    prisma.source.findMany({ orderBy: [{ method: "asc" }, { name: "asc" }], include: { organization: { select: { name: true } } } }),
    prisma.jobSourceLink.groupBy({ by: ["sourceId"], _count: { _all: true } }),
    getSchedules(),
  ]);
  const defaults = defaultSchedules();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Sources</h1>
        <p className="text-slate-600">
          Disable a source immediately if its owner objects or its terms change. Manual sources are never fetched; add their jobs via{" "}
          <Link href="/admin/jobs/new" className="text-blue-700 underline">
            manual entry
          </Link>
          .
        </p>
      </div>
      <Table>
        <THead>
          <TR>
            <TH>Health</TH>
            <TH>Source</TH>
            <TH>Method</TH>
            <TH>Interval (min)</TH>
            <TH>Last run / success</TH>
            <TH>Jobs</TH>
            <TH>Actions</TH>
          </TR>
        </THead>
        <TBody>
          {sources.map((s) => {
            const h = sourceHealth(s);
            return (
              <TR key={s.id}>
                <TD>
                  <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs">
                    <span className={`size-3 rounded-full ${HEALTH_COLOR[h]}`} aria-hidden />
                    {HEALTH_LABEL[h]}
                  </span>
                </TD>
                <TD className="max-w-sm">
                  <Link href={`/admin/sources/${s.id}`} className="font-medium text-navy-900 hover:underline">
                    {s.name}
                  </Link>
                  <p className="truncate text-xs text-slate-500" title={s.url}>
                    {s.url}
                  </p>
                  {s.lastError ? <p className="mt-1 line-clamp-2 text-xs text-red-700">{s.lastError}</p> : null}
                </TD>
                <TD>
                  <Badge variant={s.method === "MANUAL" ? "outline" : "info"}>{s.method === "MANUAL" ? "Manual/API required" : `${s.method} · ${s.adapter}`}</Badge>
                </TD>
                <TD>
                  {s.method === "MANUAL" ? (
                    "—"
                  ) : (
                    <form action={updateSourceIntervalAction} className="flex items-center gap-1">
                      <input type="hidden" name="sourceId" value={s.id} />
                      <label htmlFor={`int-${s.id}`} className="sr-only">
                        Interval for {s.name}
                      </label>
                      <Input id={`int-${s.id}`} name="minutes" type="number" min={15} max={10080} defaultValue={s.fetchIntervalMinutes} className="h-8 w-20" />
                      <Button type="submit" variant="ghost" size="sm">
                        Set
                      </Button>
                    </form>
                  )}
                </TD>
                <TD className="whitespace-nowrap text-xs text-slate-600">
                  {s.lastRunAt ? formatDhakaDateTime(s.lastRunAt) : "never"}
                  <br />
                  {s.lastSuccessAt ? formatDhakaDateTime(s.lastSuccessAt) : "—"}
                </TD>
                <TD>{counts.find((c) => c.sourceId === s.id)?._count._all ?? 0}</TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    <form action={toggleSourceAction}>
                      <input type="hidden" name="sourceId" value={s.id} />
                      <SubmitButton size="sm" variant={s.enabled ? "outline" : "success"}>
                        {s.enabled ? "Disable" : "Enable"}
                      </SubmitButton>
                    </form>
                    {s.method !== "MANUAL" ? (
                      <form action={runSourceNowAction}>
                        <input type="hidden" name="sourceId" value={s.id} />
                        <SubmitButton size="sm" pendingText="Running…">
                          {s.consecutiveFailures ? "Retry" : "Run now"}
                        </SubmitButton>
                      </form>
                    ) : null}
                  </div>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>

      <Card>
        <CardHeader>
          <CardTitle>Schedules</CardTitle>
          <CardDescription>
            Cron expressions evaluated in {SCHEDULE_TIMEZONE}. Defaults come from environment variables; values saved here override them. The worker
            reloads every 5 minutes. On Vercel, platform cron schedules are defined in vercel.json.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={updateSchedulesAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TASK_NAMES.map((t) => (
              <Field key={t} label={t} htmlFor={`cron-${t}`} hint={`Default ${defaults[t]} · next ${formatDhakaDateTime(nextRun(schedules[t]))}`}>
                <Input id={`cron-${t}`} name={t} defaultValue={schedules[t]} className="font-mono" />
              </Field>
            ))}
            <div className="sm:col-span-2 lg:col-span-3">
              <SubmitButton>Save schedules</SubmitButton>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
