import { notFound } from "next/navigation";
import { runSourceNowAction, toggleSourceAction } from "@/app/actions/admin";
import { SubmitButton } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { HEALTH_COLOR, HEALTH_LABEL, sourceHealth } from "@/lib/source-health";
import { formatDhakaDateTime } from "@/lib/time";

export default async function AdminSourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const source = await prisma.source.findUnique({
    where: { id },
    include: { organization: true, runs: { orderBy: { startedAt: "desc" }, take: 30 } },
  });
  if (!source) notFound();
  const h = sourceHealth(source);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{source.name}</h1>
          <p className="text-sm text-slate-600">
            <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
              {source.url}
            </a>
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className={`size-3 rounded-full ${HEALTH_COLOR[h]}`} aria-hidden /> {HEALTH_LABEL[h]}
            <Badge variant="outline">{source.method}</Badge>
            <Badge variant="outline">adapter: {source.adapter}</Badge>
            <Badge variant={source.enabled ? "success" : "muted"}>{source.enabled ? "Enabled" : "Disabled"}</Badge>
            <span className="text-slate-500">every {source.fetchIntervalMinutes} min</span>
          </p>
        </div>
        <div className="flex gap-2">
          <form action={toggleSourceAction}>
            <input type="hidden" name="sourceId" value={source.id} />
            <SubmitButton variant="outline">{source.enabled ? "Disable" : "Enable"}</SubmitButton>
          </form>
          {source.method !== "MANUAL" ? (
            <form action={runSourceNowAction}>
              <input type="hidden" name="sourceId" value={source.id} />
              <SubmitButton pendingText="Running…">Run now</SubmitButton>
            </form>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compliance note</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-800">{source.complianceNote ?? "—"}</p>
          {source.lastError ? <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">Last error: {source.lastError}</p> : null}
          {source.config ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium">Adapter configuration</summary>
              <pre className="mt-2 overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">{JSON.stringify(source.config, null, 2)}</pre>
            </details>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
        </CardHeader>
        <CardContent>
          {source.runs.length === 0 ? (
            <p className="text-sm text-slate-600">{source.method === "MANUAL" ? "Manual sources are never run." : "No runs yet."}</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Started</TH>
                  <TH>Status</TH>
                  <TH>Trigger</TH>
                  <TH>Found</TH>
                  <TH>New</TH>
                  <TH>Upd.</TH>
                  <TH>Merged</TH>
                  <TH>Skipped</TH>
                  <TH>Parse err.</TH>
                  <TH>Duration</TH>
                  <TH>Message</TH>
                </TR>
              </THead>
              <TBody>
                {source.runs.map((r) => (
                  <TR key={r.id}>
                    <TD className="whitespace-nowrap">{formatDhakaDateTime(r.startedAt)}</TD>
                    <TD>
                      <Badge variant={r.status === "SUCCESS" ? "success" : r.status === "FAILED" ? "danger" : r.status === "PARTIAL" ? "warning" : "muted"}>{r.status}</Badge>
                    </TD>
                    <TD>{r.trigger}</TD>
                    <TD>{r.itemsFound}</TD>
                    <TD>{r.jobsCreated}</TD>
                    <TD>{r.jobsUpdated}</TD>
                    <TD>{r.jobsMerged}</TD>
                    <TD>{r.jobsSkipped}</TD>
                    <TD>{r.parseErrors}</TD>
                    <TD>{r.durationMs != null ? `${(r.durationMs / 1000).toFixed(1)} s` : "—"}</TD>
                    <TD className="max-w-md text-xs text-slate-600">
                      {r.message}
                      {Array.isArray(r.errors) && r.errors.length ? (
                        <details>
                          <summary className="cursor-pointer text-red-700">{r.errors.length} error(s)</summary>
                          <ul className="mt-1 list-disc pl-4">
                            {(r.errors as string[]).map((e, i) => (
                              <li key={i}>{e}</li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
