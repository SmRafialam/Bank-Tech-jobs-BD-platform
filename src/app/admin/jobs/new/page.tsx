import { createManualJobAction } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { prisma } from "@/lib/db";

export default async function AdminNewJobPage() {
  const [orgs, manualSources] = await Promise.all([
    prisma.organization.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } }),
    prisma.source.findMany({ where: { method: "MANUAL" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a job manually</CardTitle>
        <CardDescription>
          For sources marked “manual/API required”. Paste the relevant requirement text from the official circular — only a short summary is stored,
          and CGPA, Master&apos;s, experience, age, discipline and skills are extracted automatically (review them on the edit page afterwards).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ActionForm action={createManualJobAction} className="grid gap-4 md:grid-cols-2" resetOnSuccess>
          <Field label="Job title" htmlFor="title" className="md:col-span-2">
            <Input id="title" name="title" required maxLength={250} />
          </Field>
          <Field label="Organisation" htmlFor="organizationSlug">
            <Select id="organizationSlug" name="organizationSlug" required defaultValue="">
              <option value="" disabled>
                Choose…
              </option>
              {orgs.map((o) => (
                <option key={o.slug} value={o.slug}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Source" htmlFor="sourceId" hint="Where you found it">
            <Select id="sourceId" name="sourceId" defaultValue="">
              <option value="">Other / direct</option>
              {manualSources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Department" htmlFor="department">
            <Input id="department" name="department" />
          </Field>
          <Field label="Location" htmlFor="location">
            <Input id="location" name="location" placeholder="Dhaka" />
          </Field>
          <Field label="Official application URL" htmlFor="applicationUrl">
            <Input id="applicationUrl" name="applicationUrl" type="url" required />
          </Field>
          <Field label="Circular / source URL" htmlFor="sourceUrl" hint="Defaults to the application URL">
            <Input id="sourceUrl" name="sourceUrl" type="url" />
          </Field>
          <Field label="Published" htmlFor="publishedAt">
            <Input id="publishedAt" name="publishedAt" type="date" />
          </Field>
          <Field label="Deadline" htmlFor="deadline" hint="Interpreted as 11:59 PM Bangladesh time">
            <Input id="deadline" name="deadline" type="date" />
          </Field>
          <Field label="Vacancies" htmlFor="vacancies">
            <Input id="vacancies" name="vacancies" type="number" min={1} />
          </Field>
          <Field label="Salary" htmlFor="salary">
            <Input id="salary" name="salary" />
          </Field>
          <Field label="Requirements and summary text" htmlFor="description" className="md:col-span-2">
            <Textarea id="description" name="description" required minLength={20} rows={10} />
          </Field>
          <div className="md:col-span-2">
            <SubmitButton pendingText="Saving…">Create and publish</SubmitButton>
          </div>
        </ActionForm>
      </CardContent>
    </Card>
  );
}
