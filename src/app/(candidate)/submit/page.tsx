import type { Metadata } from "next";
import { submitJobAction } from "@/app/actions/candidate";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Submit a job link" };

export default async function SubmitJobPage() {
  const orgs = await prisma.organization.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit a job link</CardTitle>
        <CardDescription>
          Some sources (Bangladesh Bank e-Recruitment, Bdjobs, LinkedIn, firewall-protected career pages) cannot be collected automatically. Share the
          official public link and a short summary in your own words — an admin verifies it before publishing. Please don&apos;t paste the full circular.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ActionForm action={submitJobAction} className="grid gap-4 sm:grid-cols-2" resetOnSuccess>
          <Field label="Job title" htmlFor="title" className="sm:col-span-2">
            <Input id="title" name="title" required minLength={4} maxLength={200} />
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
          <Field label="Application deadline" htmlFor="deadline">
            <Input id="deadline" name="deadline" type="date" />
          </Field>
          <Field label="Official job / circular URL" htmlFor="applicationUrl" className="sm:col-span-2">
            <Input id="applicationUrl" name="applicationUrl" type="url" required placeholder="https://" />
          </Field>
          <Field label="Location" htmlFor="location">
            <Input id="location" name="location" placeholder="Dhaka" />
          </Field>
          <Field
            label="Short summary"
            htmlFor="summary"
            hint="Include degree, minimum CGPA, experience, age limit and key skills if stated."
            className="sm:col-span-2"
          >
            <Textarea id="summary" name="summary" required minLength={40} maxLength={3000} />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton>Submit for review</SubmitButton>
          </div>
        </ActionForm>
      </CardContent>
    </Card>
  );
}
