import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteJobAction, updateJobAction } from "@/app/actions/admin";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { prisma } from "@/lib/db";
import { ALL_CATEGORIES, ALL_LEVELS, ALL_WORK_MODES, CATEGORY_LABELS, LEVEL_LABELS, WORK_MODE_LABELS } from "@/lib/jobs/taxonomy";
import { dhakaDateKey, formatDhakaDateTime } from "@/lib/time";

const tri = (v: boolean | null) => (v == null ? "" : v ? "yes" : "no");

export default async function AdminEditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id }, include: { organization: true, links: true, reports: { orderBy: { createdAt: "desc" } } } });
  if (!job) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Edit job</h1>
          <p className="text-sm text-slate-600">
            {job.organization.name} · status {job.status} · review {job.reviewStatus} · last verified {formatDhakaDateTime(job.lastVerifiedAt)} ·{" "}
            <Link href={`/jobs/${job.slug}`} className="text-blue-700 underline">
              view public page
            </Link>
          </p>
        </div>
        <form action={deleteJobAction}>
          <input type="hidden" name="jobId" value={job.id} />
          <ConfirmSubmit variant="destructive" message="Permanently delete this job, its links, saves and tracker entries? Prefer Archive unless the listing is spam.">
            Delete permanently
          </ConfirmSubmit>
        </form>
      </div>

      <Card>
        <CardContent className="pt-5">
          <ActionForm action={updateJobAction} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="jobId" value={job.id} />
            <Field label="Title" htmlFor="title" className="md:col-span-2">
              <Input id="title" name="title" defaultValue={job.title} required />
            </Field>
            <Field label="Department" htmlFor="department">
              <Input id="department" name="department" defaultValue={job.department ?? ""} />
            </Field>
            <Field label="Category" htmlFor="category">
              <Select id="category" name="category" defaultValue={job.category}>
                {ALL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Level" htmlFor="level">
              <Select id="level" name="level" defaultValue={job.level ?? ""}>
                <option value="">Not specified</option>
                {ALL_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {LEVEL_LABELS[l]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Work mode" htmlFor="workMode">
              <Select id="workMode" name="workMode" defaultValue={job.workMode}>
                {ALL_WORK_MODES.map((m) => (
                  <option key={m} value={m}>
                    {WORK_MODE_LABELS[m]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Location" htmlFor="location">
              <Input id="location" name="location" defaultValue={job.location ?? ""} />
            </Field>
            <Field label="Deadline (Dhaka date)" htmlFor="deadline">
              <Input id="deadline" name="deadline" type="date" defaultValue={job.deadline ? dhakaDateKey(job.deadline) : ""} />
            </Field>
            <Field label="Application URL" htmlFor="applicationUrl" className="md:col-span-2">
              <Input id="applicationUrl" name="applicationUrl" type="url" defaultValue={job.applicationUrl ?? ""} />
            </Field>
            <Field label="Salary" htmlFor="salary">
              <Input id="salary" name="salary" defaultValue={job.salary ?? ""} />
            </Field>
            <Field label="Vacancies" htmlFor="vacancies">
              <Input id="vacancies" name="vacancies" type="number" min={1} defaultValue={job.vacancies ?? ""} />
            </Field>
            <Field label="Summary (short, normalised)" htmlFor="summary" className="md:col-span-2">
              <Textarea id="summary" name="summary" defaultValue={job.summary} rows={5} maxLength={2000} />
            </Field>
            <h2 className="mt-2 font-semibold text-navy-900 md:col-span-2">Requirements (leave empty = not specified)</h2>
            <Field label="Education disciplines" htmlFor="educationDisciplines" hint="Codes: CSE, CS, IT, SWE, EEE, ECE, ETE, ICT, MIS, STATISTICS, ANY, RELATED">
              <Input id="educationDisciplines" name="educationDisciplines" defaultValue={job.educationDisciplines.join(", ")} />
            </Field>
            <Field label="Minimum CGPA (of 4)" htmlFor="minCgpa">
              <Input id="minCgpa" name="minCgpa" type="number" step="0.01" min={0} max={5} defaultValue={job.minCgpa ?? ""} />
            </Field>
            <Field label="Master's mandatory" htmlFor="mastersRequired">
              <Select id="mastersRequired" name="mastersRequired" defaultValue={tri(job.mastersRequired)}>
                <option value="">Not specified</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </Select>
            </Field>
            <Field label="No third division/class rule" htmlFor="noThirdDivision">
              <Select id="noThirdDivision" name="noThirdDivision" defaultValue={tri(job.noThirdDivision)}>
                <option value="">Not specified</option>
                <option value="yes">Yes — third division not accepted</option>
                <option value="no">No</option>
              </Select>
            </Field>
            <Field label="Min experience (years)" htmlFor="minExperienceYears">
              <Input id="minExperienceYears" name="minExperienceYears" type="number" step="0.5" min={0} defaultValue={job.minExperienceYears ?? ""} />
            </Field>
            <Field label="Max experience (years)" htmlFor="maxExperienceYears">
              <Input id="maxExperienceYears" name="maxExperienceYears" type="number" step="0.5" min={0} defaultValue={job.maxExperienceYears ?? ""} />
            </Field>
            <Field label="Age limit" htmlFor="ageLimit">
              <Input id="ageLimit" name="ageLimit" type="number" min={18} max={70} defaultValue={job.ageLimit ?? ""} />
            </Field>
            <Field label="Required skills" htmlFor="requiredSkills" hint="Comma separated">
              <Input id="requiredSkills" name="requiredSkills" defaultValue={job.requiredSkills.join(", ")} />
            </Field>
            <Field label="Preferred skills" htmlFor="preferredSkills" hint="Comma separated" className="md:col-span-2">
              <Input id="preferredSkills" name="preferredSkills" defaultValue={job.preferredSkills.join(", ")} />
            </Field>
            <div className="md:col-span-2">
              <SubmitButton>Save changes</SubmitButton>
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Source links</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-1 text-sm">
            {job.links.map((l) => (
              <li key={l.id}>
                <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
                  {l.sourceName}
                </a>{" "}
                <span className="text-xs text-slate-500">({l.externalKey})</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {job.reports.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {job.reports.map((r) => (
                <li key={r.id}>
                  <strong>{r.reason}</strong> ({r.status}) — {r.details ?? "no details"}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
