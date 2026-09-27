import { Bookmark, BookmarkCheck, Building2, MapPin } from "lucide-react";
import Link from "next/link";
import { toggleSaveAction } from "@/app/actions/candidate";
import { DeadlineText, DemoBadge, MatchBadge, OrgTypeBadge, StatusBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, LEVEL_LABELS, WORK_MODE_LABELS } from "@/lib/jobs/taxonomy";
import type { JobListItem } from "@/lib/queries/jobs";
import { formatDhakaDate } from "@/lib/time";

export function SaveJobButton({ jobId, saved, path }: { jobId: string; saved: boolean; path: string }) {
  return (
    <form action={toggleSaveAction}>
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="path" value={path} />
      <Button type="submit" variant="ghost" size="icon" aria-pressed={saved} aria-label={saved ? "Remove from saved jobs" : "Save job"} title={saved ? "Saved" : "Save job"}>
        {saved ? <BookmarkCheck className="text-blue-700" /> : <Bookmark />}
      </Button>
    </form>
  );
}

export function JobCard({ job, signedIn, path }: { job: JobListItem; signedIn: boolean; path: string }) {
  const org = job.organization.shortName ?? job.organization.name;
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 sm:p-5">
      <div className="flex items-start gap-3">
        <div aria-hidden className="grid size-11 shrink-0 place-items-center rounded-lg bg-navy-50 text-sm font-bold text-navy-800">
          {org.slice(0, 3).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-snug text-navy-900">
            <Link href={`/jobs/${job.slug}`} className="hover:underline">
              {job.title}
            </Link>
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1">
              <Building2 aria-hidden className="size-3.5" />
              <Link href={`/organizations/${job.organization.slug}`} className="hover:underline">
                {job.organization.name}
              </Link>
            </span>
            {job.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin aria-hidden className="size-3.5" />
                {job.location}
                {job.workMode !== "ONSITE" ? ` · ${WORK_MODE_LABELS[job.workMode]}` : ""}
              </span>
            ) : null}
          </p>
        </div>
        {signedIn ? <SaveJobButton jobId={job.id} saved={job.saved} path={path} /> : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <StatusBadge status={job.status} />
        <Badge>{CATEGORY_LABELS[job.category]}</Badge>
        {job.level ? <Badge variant="outline">{LEVEL_LABELS[job.level]}</Badge> : null}
        <OrgTypeBadge type={job.organization.type} />
        {job.match ? <MatchBadge verdict={job.match.verdict} score={job.match.score} /> : null}
        {job.isDemo ? <DemoBadge /> : null}
        {job._count.links > 1 ? <Badge variant="muted">{job._count.links} sources</Badge> : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <DeadlineText deadline={job.deadline} />
        <span className="text-slate-500">
          {job.minExperienceYears != null ? `${job.minExperienceYears}+ yrs exp · ` : ""}
          {job.minCgpa != null ? `CGPA ≥ ${job.minCgpa.toFixed(2)} · ` : ""}
          Deadline {formatDhakaDate(job.deadline)}
        </span>
      </div>
    </article>
  );
}
