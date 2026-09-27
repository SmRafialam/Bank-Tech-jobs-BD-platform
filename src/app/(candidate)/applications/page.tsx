import type { Metadata } from "next";
import Link from "next/link";
import { deleteApplicationAction, saveApplicationAction } from "@/app/actions/candidate";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/forms";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { prisma } from "@/lib/db";
import { ALL_APPLICATION_STATUSES, APPLICATION_STATUS_LABELS } from "@/lib/jobs/taxonomy";
import { requireUser } from "@/lib/session";
import { dhakaDateKey, formatDhakaDate } from "@/lib/time";

export const metadata: Metadata = { title: "Application tracker" };

const dateValue = (d: Date | null) => (d ? dhakaDateKey(d) : "");

export default async function ApplicationsPage() {
  const user = await requireUser("/applications");
  const applications = await prisma.application.findMany({
    where: { userId: user.id },
    include: { job: { select: { slug: true, title: true, deadline: true, organization: { select: { name: true } } } } },
    orderBy: { updatedAt: "desc" },
  });
  const counts = ALL_APPLICATION_STATUSES.map((s) => ({ s, n: applications.filter((a) => a.status === s).length })).filter((x) => x.n > 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy-900">Application tracker</h1>
      <p className="text-slate-600">Track status, exam and interview dates, CV versions and follow-ups. Add jobs from any job page.</p>
      {counts.length ? (
        <p className="mt-3 flex flex-wrap gap-2 text-sm">
          {counts.map(({ s, n }) => (
            <span key={s} className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
              {APPLICATION_STATUS_LABELS[s]}: <strong>{n}</strong>
            </span>
          ))}
        </p>
      ) : null}
      {applications.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
          Nothing tracked yet. Open a job and use “Track application”.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {applications.map((a) => (
            <li key={a.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/jobs/${a.job.slug}`} className="font-semibold text-navy-900 hover:underline">
                    {a.job.title}
                  </Link>
                  <p className="text-sm text-slate-600">
                    {a.job.organization.name} · deadline {formatDhakaDate(a.job.deadline)}
                  </p>
                </div>
                <form action={deleteApplicationAction}>
                  <input type="hidden" name="applicationId" value={a.id} />
                  <ConfirmSubmit variant="ghost" size="sm" message="Remove this job from your tracker?">
                    Remove
                  </ConfirmSubmit>
                </form>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-blue-700">
                  {APPLICATION_STATUS_LABELS[a.status]} — edit details
                </summary>
                <ActionForm action={saveApplicationAction} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="jobId" value={a.jobId} />
                  <Field label="Status" htmlFor={`st-${a.id}`}>
                    <Select id={`st-${a.id}`} name="status" defaultValue={a.status}>
                      {ALL_APPLICATION_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {APPLICATION_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Application date" htmlFor={`ad-${a.id}`}>
                    <Input id={`ad-${a.id}`} name="appliedAt" type="date" defaultValue={dateValue(a.appliedAt)} />
                  </Field>
                  <Field label="Exam date" htmlFor={`ed-${a.id}`}>
                    <Input id={`ed-${a.id}`} name="examDate" type="date" defaultValue={dateValue(a.examDate)} />
                  </Field>
                  <Field label="Interview date" htmlFor={`id-${a.id}`}>
                    <Input id={`id-${a.id}`} name="interviewDate" type="date" defaultValue={dateValue(a.interviewDate)} />
                  </Field>
                  <Field label="Follow-up reminder" htmlFor={`fu-${a.id}`}>
                    <Input id={`fu-${a.id}`} name="followUpAt" type="date" defaultValue={dateValue(a.followUpAt)} />
                  </Field>
                  <Field label="CV version used" htmlFor={`cv-${a.id}`} hint="File name or label — files are not uploaded.">
                    <Input id={`cv-${a.id}`} name="cvVersion" defaultValue={a.cvVersion ?? ""} maxLength={200} />
                  </Field>
                  <Field label="Cover letter" htmlFor={`cl-${a.id}`} className="sm:col-span-2">
                    <Textarea id={`cl-${a.id}`} name="coverLetter" defaultValue={a.coverLetter ?? ""} maxLength={5000} />
                  </Field>
                  <Field label="Notes" htmlFor={`nt-${a.id}`} className="sm:col-span-2">
                    <Textarea id={`nt-${a.id}`} name="notes" defaultValue={a.notes ?? ""} maxLength={5000} />
                  </Field>
                  <div className="sm:col-span-2">
                    <SubmitButton>Save</SubmitButton>
                  </div>
                </ActionForm>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
