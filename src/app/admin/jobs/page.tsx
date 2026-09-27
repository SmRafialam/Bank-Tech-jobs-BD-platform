import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { archiveJobAction, reviewJobAction } from "@/app/actions/admin";
import { StatusBadge } from "@/components/badges";
import { SubmitButton } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { CATEGORY_LABELS } from "@/lib/jobs/taxonomy";
import { formatDhakaDate } from "@/lib/time";

const VIEWS = { pending: "Pending review", active: "Published", archived: "Archived", demo: "Demo data", all: "All" } as const;
type View = keyof typeof VIEWS;

export default async function AdminJobsPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string }> }) {
  const sp = await searchParams;
  const view: View = sp.view && sp.view in VIEWS ? (sp.view as View) : "pending";
  const q = sp.q?.trim().slice(0, 100);
  const where: Prisma.JobWhereInput = {
    ...(view === "pending" ? { reviewStatus: "PENDING", archivedAt: null } : {}),
    ...(view === "active" ? { reviewStatus: "APPROVED", archivedAt: null } : {}),
    ...(view === "archived" ? { archivedAt: { not: null } } : {}),
    ...(view === "demo" ? { isDemo: true } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { organization: { name: { contains: q, mode: "insensitive" } } }] } : {}),
  };
  const jobs = await prisma.job.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { organization: { select: { name: true } }, submittedBy: { select: { email: true } }, _count: { select: { links: true, reports: true } } },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-navy-900">Jobs</h1>
        <Button asChild>
          <Link href="/admin/jobs/new">Add job manually</Link>
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(VIEWS) as View[]).map((v) => (
          <Button key={v} asChild size="sm" variant={v === view ? "default" : "outline"}>
            <Link href={`/admin/jobs?view=${v}`}>{VIEWS[v]}</Link>
          </Button>
        ))}
        <form className="ml-auto flex gap-2" action="/admin/jobs">
          <input type="hidden" name="view" value={view} />
          <label htmlFor="admin-q" className="sr-only">
            Search jobs
          </label>
          <Input id="admin-q" name="q" defaultValue={q} placeholder="Search title or organisation" className="h-8 w-64" />
          <Button type="submit" size="sm" variant="outline">
            Search
          </Button>
        </form>
      </div>
      <Table>
        <THead>
          <TR>
            <TH>Job</TH>
            <TH>Category</TH>
            <TH>Status</TH>
            <TH>Deadline</TH>
            <TH>Sources</TH>
            <TH>Actions</TH>
          </TR>
        </THead>
        <TBody>
          {jobs.map((j) => (
            <TR key={j.id}>
              <TD className="max-w-md">
                <Link href={`/admin/jobs/${j.id}`} className="font-medium text-navy-900 hover:underline">
                  {j.title}
                </Link>
                <p className="text-xs text-slate-500">
                  {j.organization.name}
                  {j.submittedBy ? ` · submitted by ${j.submittedBy.email}` : ""}
                </p>
                <p className="mt-1 flex flex-wrap gap-1">
                  {j.reviewStatus !== "APPROVED" ? <Badge variant="warning">{j.reviewStatus}</Badge> : null}
                  {j.isDemo ? <Badge variant="demo">Demo</Badge> : null}
                  {j.archivedAt ? <Badge variant="muted">Archived</Badge> : null}
                  {j._count.reports ? <Badge variant="danger">{j._count.reports} report(s)</Badge> : null}
                </p>
              </TD>
              <TD className="text-xs">{CATEGORY_LABELS[j.category]}</TD>
              <TD>
                <StatusBadge status={j.status} />
              </TD>
              <TD className="whitespace-nowrap text-xs">{formatDhakaDate(j.deadline)}</TD>
              <TD>
                <a href={j.applicationUrl ?? j.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-700 underline">
                  {j._count.links} link(s)
                </a>
              </TD>
              <TD>
                <div className="flex flex-wrap gap-1">
                  {j.reviewStatus === "PENDING" ? (
                    <>
                      <form action={reviewJobAction}>
                        <input type="hidden" name="jobId" value={j.id} />
                        <input type="hidden" name="decision" value="approve" />
                        <SubmitButton size="sm" variant="success">
                          Approve
                        </SubmitButton>
                      </form>
                      <form action={reviewJobAction}>
                        <input type="hidden" name="jobId" value={j.id} />
                        <input type="hidden" name="decision" value="reject" />
                        <SubmitButton size="sm" variant="outline">
                          Reject
                        </SubmitButton>
                      </form>
                    </>
                  ) : null}
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/jobs/${j.id}`}>Edit</Link>
                  </Button>
                  <form action={archiveJobAction}>
                    <input type="hidden" name="jobId" value={j.id} />
                    <SubmitButton size="sm" variant="ghost">
                      {j.archivedAt ? "Unarchive" : "Archive"}
                    </SubmitButton>
                  </form>
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {jobs.length === 0 ? <p className="text-sm text-slate-600">Nothing here.</p> : null}
    </div>
  );
}
