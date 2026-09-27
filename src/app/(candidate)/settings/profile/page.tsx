import type { Metadata } from "next";
import { saveProfileAction } from "@/app/actions/candidate";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Profile and eligibility" };

export default async function ProfileSettingsPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireUser("/settings/profile");
  const welcome = (await searchParams).welcome === "1";
  const p = await prisma.candidateProfile.findUnique({ where: { userId: user.id } });
  const list = (v: string[] | undefined) => (v ?? []).join(", ");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Profile and eligibility</h1>
        <p className="text-slate-600">
          Used only to calculate your eligibility and match score. All fields are optional — anything you leave empty is shown as “manual review”
          rather than assumed.
        </p>
      </div>
      {welcome ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">Welcome! Fill in your academic details to see accurate eligibility.</p> : null}
      <ActionForm action={saveProfileAction} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>About you</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="fullName">
              <Input id="fullName" name="fullName" defaultValue={p?.fullName ?? ""} />
            </Field>
            <Field label="Location" htmlFor="location">
              <Input id="location" name="location" defaultValue={p?.location ?? ""} placeholder="Dhaka, Bangladesh" />
            </Field>
            <Field label="Age" htmlFor="age" hint="Needed for circulars with an age limit (common in public banks).">
              <Input id="age" name="age" type="number" min={16} max={80} defaultValue={p?.age ?? ""} />
            </Field>
            <Field label="Current employer" htmlFor="currentEmployer">
              <Input id="currentEmployer" name="currentEmployer" defaultValue={p?.currentEmployer ?? ""} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Academics</CardTitle>
            <CardDescription>Bangladesh bank circulars often set hard cut-offs on CGPA, SSC/HSC GPA and third division/class.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Degree" htmlFor="degree">
              <Input id="degree" name="degree" defaultValue={p?.degree ?? ""} placeholder="BSc" />
            </Field>
            <Field label="Discipline" htmlFor="discipline" hint="e.g. Computer Science and Engineering, EEE, IT">
              <Input id="discipline" name="discipline" defaultValue={p?.discipline ?? ""} />
            </Field>
            <Field label="University" htmlFor="university">
              <Input id="university" name="university" defaultValue={p?.university ?? ""} />
            </Field>
            <Field label="Graduation year" htmlFor="graduationYear">
              <Input id="graduationYear" name="graduationYear" type="number" min={1970} max={2040} defaultValue={p?.graduationYear ?? ""} />
            </Field>
            <Field label="Bachelor's CGPA" htmlFor="bachelorCgpa">
              <Input id="bachelorCgpa" name="bachelorCgpa" type="number" step="0.01" min={0} max={5} defaultValue={p?.bachelorCgpa ?? ""} />
            </Field>
            <Field label="CGPA scale" htmlFor="cgpaScale">
              <Select id="cgpaScale" name="cgpaScale" defaultValue={String(p?.cgpaScale ?? 4)}>
                <option value="4">out of 4.00</option>
                <option value="5">out of 5.00</option>
              </Select>
            </Field>
            <Field label="SSC GPA (out of 5)" htmlFor="sscGpa">
              <Input id="sscGpa" name="sscGpa" type="number" step="0.01" min={0} max={5} defaultValue={p?.sscGpa ?? ""} />
            </Field>
            <Field label="HSC GPA (out of 5)" htmlFor="hscGpa">
              <Input id="hscGpa" name="hscGpa" type="number" step="0.01" min={0} max={5} defaultValue={p?.hscGpa ?? ""} />
            </Field>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Checkbox name="hasMasters" defaultChecked={p?.hasMasters} label="I have a Master's degree" />
              <Checkbox name="hasThirdDivision" defaultChecked={p?.hasThirdDivision} label="I have a third division/class in any examination" />
            </div>
            <Field label="Master's discipline" htmlFor="mastersDiscipline">
              <Input id="mastersDiscipline" name="mastersDiscipline" defaultValue={p?.mastersDiscipline ?? ""} />
            </Field>
            <Field label="Master's CGPA" htmlFor="mastersCgpa">
              <Input id="mastersCgpa" name="mastersCgpa" type="number" step="0.01" min={0} max={5} defaultValue={p?.mastersCgpa ?? ""} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Experience and skills</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Total professional experience (years)" htmlFor="experienceYears">
              <Input id="experienceYears" name="experienceYears" type="number" step="0.5" min={0} max={50} defaultValue={p?.experienceYears ?? ""} />
            </Field>
            <Field label="Primary focus" htmlFor="primaryFocus">
              <Select id="primaryFocus" name="primaryFocus" defaultValue={p?.primaryFocus ?? ""}>
                <option value="">Not set</option>
                <option value="software">Software development</option>
                <option value="infrastructure">Infrastructure / network</option>
                <option value="security">Security / audit</option>
                <option value="data">Data / reporting</option>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Checkbox name="bankingExperience" defaultChecked={p?.bankingExperience} label="I have banking / financial-institution experience" />
            </div>
            <Field label="Skills" htmlFor="skills" hint="Comma separated" className="sm:col-span-2">
              <Textarea id="skills" name="skills" defaultValue={list(p?.skills)} />
            </Field>
            <Field label="Certifications" htmlFor="certifications" hint="Comma separated" className="sm:col-span-2">
              <Input id="certifications" name="certifications" defaultValue={list(p?.certifications)} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Preferred roles" htmlFor="preferredRoles" hint="Comma separated" className="sm:col-span-2">
              <Textarea id="preferredRoles" name="preferredRoles" defaultValue={list(p?.preferredRoles)} />
            </Field>
            <Field label="Preferred organisations" htmlFor="preferredOrgSlugs" hint="Organisation slugs, e.g. brac-bank, city-bank, bkash">
              <Input id="preferredOrgSlugs" name="preferredOrgSlugs" defaultValue={list(p?.preferredOrgSlugs)} />
            </Field>
            <Field label="Preferred locations" htmlFor="preferredLocations" hint="Comma separated">
              <Input id="preferredLocations" name="preferredLocations" defaultValue={list(p?.preferredLocations)} placeholder="Dhaka" />
            </Field>
            <Field label="Minimum expected salary (BDT / month)" htmlFor="minExpectedSalary">
              <Input id="minExpectedSalary" name="minExpectedSalary" type="number" min={0} defaultValue={p?.minExpectedSalary ?? ""} />
            </Field>
            <div className="flex items-end">
              <Checkbox name="openToRemote" defaultChecked={p?.openToRemote ?? true} label="Open to remote roles" />
            </div>
          </CardContent>
        </Card>
        <div>
          <SubmitButton pendingText="Saving and recalculating…">Save profile</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
