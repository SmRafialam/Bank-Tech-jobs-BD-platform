import { AlertTriangle, CheckCircle2, ExternalLink, Info, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { reportJobAction, saveApplicationAction } from "@/app/actions/candidate";
import { DeadlineText, DemoBadge, MatchBadge, OrgTypeBadge, StatusBadge } from "@/components/badges";
import { ActionForm, SubmitButton } from "@/components/forms";
import { SaveJobButton } from "@/components/job-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/form";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/env";
import type { Reason } from "@/lib/jobs/eligibility";
import { APPLICATION_STATUS_LABELS, ALL_APPLICATION_STATUSES, CATEGORY_LABELS, EMPLOYMENT_TYPE_LABELS, LEVEL_LABELS, WORK_MODE_LABELS } from "@/lib/jobs/taxonomy";
import { evaluate } from "@/lib/matching";
import { currentUser } from "@/lib/session";
import { dhakaDateKey, formatDhakaDate, formatDhakaDateTime } from "@/lib/time";

type Props = { params: Promise<{ slug: string }> };

const NOINDEX_AFTER_EXPIRY_DAYS = 14;

async function loadJob(slug: string) {
  return prisma.job.findUnique({
    where: { slug },
    include: { organization: true, links: { orderBy: { firstSeenAt: "asc" } } },
  });
}

function isIndexable(job: NonNullable<Awaited<ReturnType<typeof loadJob>>>) {
  if (job.isDemo || job.reviewStatus !== "APPROVED" || job.archivedAt) return false;
  if (job.status === "REMOVED") return false;
  if (job.deadline && job.deadline.getTime() < Date.now() - NOINDEX_AFTER_EXPIRY_DAYS * 86_400_000) return false;
  return true;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const job = await loadJob((await params).slug);
  if (!job) return { title: "Job not found", robots: { index: false } };
  const title = `${job.title} — ${job.organization.name}`;
  const description = `${job.summary.slice(0, 150)} Deadline: ${formatDhakaDate(job.deadline)}.`;
  return {
    title,
    description,
    alternates: { canonical: `/jobs/${job.slug}` },
    robots: isIndexable(job) ? undefined : { index: false, follow: true },
    openGraph: { type: "article", title, description, url: `/jobs/${job.slug}` },
  };
}

function jobPostingJsonLd(job: NonNullable<Awaited<ReturnType<typeof loadJob>>>) {
  const data = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: `<p>${job.summary.replace(/[<>&]/g, "")}</p>`,
    datePosted: (job.publishedAt ?? job.firstDiscoveredAt).toISOString(),
    ...(job.deadline ? { validThrough: job.deadline.toISOString() } : {}),
    employmentType: job.employmentType === "CONTRACT" ? "CONTRACTOR" : job.employmentType,
    hiringOrganization: { "@type": "Organization", name: job.organization.name, ...(job.organization.website ? { sameAs: job.organization.website } : {}) },
    jobLocation: {
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: job.location ?? "Dhaka", addressCountry: "BD" },
    },
    ...(job.workMode === "REMOTE" ? { jobLocationType: "TELECOMMUTE", applicantLocationRequirements: { "@type": "Country", name: "Bangladesh" } } : {}),
    ...(job.sourceJobId ? { identifier: { "@type": "PropertyValue", name: job.organization.name, value: job.sourceJobId } } : {}),
    ...(job.minExperienceYears != null ? { experienceRequirements: { "@type": "OccupationalExperienceRequirements", monthsOfExperience: Math.round(job.minExperienceYears * 12) } } : {}),
    ...(job.requiredSkills.length ? { skills: job.requiredSkills.join(", ") } : {}),
    ...(job.vacancies ? { totalJobOpenings: job.vacancies } : {}),
    directApply: false,
    url: appUrl(`/jobs/${job.slug}`),
  };
  // Escape "<" so the JSON cannot close the script element.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function Requirement({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,180px)_1fr] gap-3 py-2">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900">{value ?? <span className="text-slate-400">Not specified</span>}</dd>
    </div>
  );
}

const REASON_ICON: Record<Reason["kind"], { icon: typeof Info; className: string }> = {
  pass: { icon: CheckCircle2, className: "text-emerald-600" },
  fail: { icon: XCircle, className: "text-red-600" },
  warn: { icon: AlertTriangle, className: "text-amber-600" },
  info: { icon: Info, className: "text-slate-500" },
};

export default async function JobPage({ params }: Props) {
  const { slug } = await params;
  const job = await loadJob(slug);
  const user = await currentUser();
  if (!job || job.archivedAt) notFound();
  if (job.reviewStatus !== "APPROVED" && user?.role !== "ADMIN") notFound();

  const [profile, saved, application] = user
    ? await Promise.all([
        prisma.candidateProfile.findUnique({ where: { userId: user.id } }),
        prisma.savedJob.findUnique({ where: { userId_jobId: { userId: user.id, jobId: job.id } } }),
        prisma.application.findUnique({ where: { userId_jobId: { userId: user.id, jobId: job.id } } }),
      ])
    : [null, null, null];
  const eligibility = profile ? evaluate(profile, job) : null;
  const applyUrl = job.applicationUrl ?? job.sourceUrl;
  const expired = job.status === "EXPIRED" || job.status === "REMOVED";
  const yesNo = (v: boolean | null, yes: string, no: string) => (v == null ? null : v ? yes : no);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {isIndexable(job) && !expired ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jobPostingJsonLd(job) }} /> : null}

      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-slate-500">
        <Link href="/jobs" className="hover:underline">
          Jobs
        </Link>{" "}
        /{" "}
        <Link href={`/organizations/${job.organization.slug}`} className="hover:underline">
          {job.organization.shortName ?? job.organization.name}
        </Link>
      </nav>

      {job.isDemo ? (
        <div role="note" className="mb-4 rounded-lg border border-fuchsia-300 bg-fuchsia-50 p-3 text-sm text-fuchsia-900">
          <strong>Demo data.</strong> This listing was generated to demonstrate the platform. It is <strong>not a real vacancy</strong> and the link points
          to the organisation&apos;s general website.
        </div>
      ) : null}
      {expired ? (
        <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          <strong>This position is {job.status === "EXPIRED" ? "expired" : "no longer listed at the source"}.</strong> The application deadline was{" "}
          {formatDhakaDateTime(job.deadline)}.
        </div>
      ) : null}
      {job.reviewStatus !== "APPROVED" ? (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Pending admin review — not visible to the public.</div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <header className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">{job.title}</h1>
                <p className="mt-1 text-slate-700">
                  <Link href={`/organizations/${job.organization.slug}`} className="font-medium hover:underline">
                    {job.organization.name}
                  </Link>
                  {job.department ? ` · ${job.department}` : ""}
                </p>
              </div>
              {user ? <SaveJobButton jobId={job.id} saved={Boolean(saved)} path={`/jobs/${job.slug}`} /> : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <StatusBadge status={job.status} />
              <Badge>{CATEGORY_LABELS[job.category]}</Badge>
              {job.secondaryCategories.map((c) => (
                <Badge key={c} variant="outline">
                  {CATEGORY_LABELS[c]}
                </Badge>
              ))}
              <OrgTypeBadge type={job.organization.type} />
              {eligibility ? <MatchBadge verdict={eligibility.verdict} score={eligibility.score} /> : null}
              {job.isDemo ? <DemoBadge /> : null}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" variant={expired ? "outline" : "primary"}>
                <a href={applyUrl} target="_blank" rel="noopener noreferrer nofollow">
                  Apply on Official Site <ExternalLink />
                </a>
              </Button>
              <DeadlineText deadline={job.deadline} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              You will leave BankTech Jobs BD. Always verify the circular on the official source before applying.
            </p>
          </header>

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-slate-800">{job.summary}</p>
              {job.responsibilities.length ? (
                <>
                  <h3 className="mt-4 font-semibold text-navy-900">Key responsibilities</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-800">
                    {job.responsibilities.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              <p className="mt-4 text-xs text-slate-500">This is a short normalised summary. The complete circular is available on the official source.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Requirements</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-slate-100">
                <Requirement label="Education" value={job.educationDisciplines.length ? job.educationDisciplines.map((d) => (d === "RELATED" ? "or related" : d === "ANY" ? "Any discipline" : d)).join(", ") : null} />
                <Requirement label="Minimum CGPA" value={job.minCgpa != null ? `${job.minCgpa.toFixed(2)} (out of 4.00)` : null} />
                <Requirement label="SSC / HSC" value={job.sscHscRequirement} />
                <Requirement label="Master's degree" value={yesNo(job.mastersRequired, "Mandatory", "Not mandatory")} />
                <Requirement label="Third division/class" value={job.noThirdDivision ? "Not accepted in any examination" : null} />
                <Requirement
                  label="Experience"
                  value={job.minExperienceYears != null ? `${job.minExperienceYears}${job.maxExperienceYears != null ? `–${job.maxExperienceYears}` : "+"} years` : null}
                />
                <Requirement label="Age limit" value={job.ageLimit ? `Maximum ${job.ageLimit} years` : null} />
                <Requirement label="Required skills" value={job.requiredSkills.length ? job.requiredSkills.join(", ") : null} />
                <Requirement label="Preferred skills" value={job.preferredSkills.length ? job.preferredSkills.join(", ") : null} />
                <Requirement label="Banking experience" value={job.bankingExperiencePreferred ? "Preferred" : null} />
              </dl>
              {!job.requirementsParsed ? (
                <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">Requirements could not be read from the source. Check the official circular.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2 text-sm">
                {job.links.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-2">
                    <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline">
                      {l.sourceName} <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                    <span className="text-slate-500">
                      first seen {formatDhakaDate(l.firstSeenAt)} · last seen {formatDhakaDate(l.lastSeenAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Key facts</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-slate-100">
                <Requirement label="Deadline" value={job.deadline ? <time dateTime={dhakaDateKey(job.deadline)}>{formatDhakaDateTime(job.deadline)}</time> : null} />
                <Requirement label="Published" value={job.publishedAt ? formatDhakaDate(job.publishedAt) : null} />
                <Requirement label="Level" value={job.level ? LEVEL_LABELS[job.level] : null} />
                <Requirement label="Location" value={job.location} />
                <Requirement label="Work mode" value={WORK_MODE_LABELS[job.workMode]} />
                <Requirement label="Employment" value={EMPLOYMENT_TYPE_LABELS[job.employmentType]} />
                <Requirement label="Salary" value={job.salary} />
                <Requirement label="Vacancies" value={job.vacancies} />
                <Requirement label="First discovered" value={formatDhakaDateTime(job.firstDiscoveredAt)} />
                <Requirement label="Last verified" value={formatDhakaDateTime(job.lastVerifiedAt)} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your eligibility</CardTitle>
            </CardHeader>
            <CardContent>
              {eligibility ? (
                <>
                  <MatchBadge verdict={eligibility.verdict} score={eligibility.score} />
                  <ul className="mt-3 flex flex-col gap-2">
                    {eligibility.reasons.map((r, i) => {
                      const { icon: Icon, className } = REASON_ICON[r.kind];
                      return (
                        <li key={i} className="flex gap-2 text-sm text-slate-800">
                          <Icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${className}`} />
                          <span>{r.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-3 text-xs text-slate-500">
                    Automated check based on your <Link href="/settings/profile" className="underline">profile</Link> and the requirements we could read. It is guidance, not a decision — the circular is authoritative.
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-700">
                  <Link href={user ? "/settings/profile" : `/login?callbackUrl=/jobs/${job.slug}`} className="font-medium text-blue-700 underline">
                    {user ? "Complete your profile" : "Sign in"}
                  </Link>{" "}
                  to see whether you meet the CGPA, degree, experience and age requirements.
                </p>
              )}
            </CardContent>
          </Card>

          {user ? (
            <Card>
              <CardHeader>
                <CardTitle>Track application</CardTitle>
              </CardHeader>
              <CardContent>
                <ActionForm action={saveApplicationAction} className="flex flex-col gap-3">
                  <input type="hidden" name="jobId" value={job.id} />
                  <label htmlFor="app-status" className="text-sm font-medium">
                    Status
                  </label>
                  <Select id="app-status" name="status" defaultValue={application?.status ?? "PLANNING"}>
                    {ALL_APPLICATION_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {APPLICATION_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </Select>
                  <SubmitButton variant="outline">Save to tracker</SubmitButton>
                  <Link href="/applications" className="text-xs text-blue-700 underline">
                    Add dates, notes and CV version in the tracker
                  </Link>
                </ActionForm>
              </CardContent>
            </Card>
          ) : null}

          {user ? (
            <details className="rounded-xl border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">Report a problem with this listing</summary>
              <ActionForm action={reportJobAction} className="mt-3 flex flex-col gap-2">
                <input type="hidden" name="jobId" value={job.id} />
                <label htmlFor="report-reason" className="text-sm">
                  Reason
                </label>
                <Select id="report-reason" name="reason" defaultValue="wrong-information">
                  <option value="expired">Expired / filled</option>
                  <option value="wrong-information">Wrong information</option>
                  <option value="duplicate">Duplicate</option>
                  <option value="broken-link">Broken link</option>
                  <option value="not-it-role">Not a technology role</option>
                  <option value="other">Other</option>
                </Select>
                <label htmlFor="report-details" className="text-sm">
                  Details (optional)
                </label>
                <Textarea id="report-details" name="details" maxLength={1000} />
                <SubmitButton variant="outline" size="sm">
                  Send report
                </SubmitButton>
              </ActionForm>
            </details>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
