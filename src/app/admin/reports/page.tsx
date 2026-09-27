import Link from "next/link";
import { resolveReportAction } from "@/app/actions/admin";
import { SubmitButton } from "@/components/forms";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { formatDhakaDateTime } from "@/lib/time";

export default async function AdminReportsPage() {
  const reports = await prisma.jobReport.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: { job: { select: { id: true, title: true } }, user: { select: { email: true } } },
  });
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-navy-900">User reports</h1>
      <Table>
        <THead>
          <TR>
            <TH>Received</TH>
            <TH>Job</TH>
            <TH>Reason</TH>
            <TH>Details</TH>
            <TH>Status</TH>
            <TH>Actions</TH>
          </TR>
        </THead>
        <TBody>
          {reports.map((r) => (
            <TR key={r.id}>
              <TD className="whitespace-nowrap text-xs">{formatDhakaDateTime(r.createdAt)}</TD>
              <TD>
                <Link href={`/admin/jobs/${r.job.id}`} className="text-blue-700 underline">
                  {r.job.title}
                </Link>
                <p className="text-xs text-slate-500">{r.user?.email ?? "anonymous"}</p>
              </TD>
              <TD>{r.reason}</TD>
              <TD className="max-w-sm text-sm">{r.details ?? "—"}</TD>
              <TD>{r.status}</TD>
              <TD>
                {r.status === "OPEN" ? (
                  <div className="flex gap-1">
                    <form action={resolveReportAction}>
                      <input type="hidden" name="reportId" value={r.id} />
                      <input type="hidden" name="status" value="RESOLVED" />
                      <SubmitButton size="sm">Resolved</SubmitButton>
                    </form>
                    <form action={resolveReportAction}>
                      <input type="hidden" name="reportId" value={r.id} />
                      <input type="hidden" name="status" value="DISMISSED" />
                      <SubmitButton size="sm" variant="outline">
                        Dismiss
                      </SubmitButton>
                    </form>
                  </div>
                ) : null}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {reports.length === 0 ? <p className="text-sm text-slate-600">No reports.</p> : null}
    </div>
  );
}
