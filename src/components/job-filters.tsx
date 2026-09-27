import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Select } from "@/components/ui/form";
import { prisma } from "@/lib/db";
import {
  ALL_CATEGORIES,
  ALL_LEVELS,
  ALL_ORG_TYPES,
  ALL_VERDICTS,
  ALL_WORK_MODES,
  CATEGORY_LABELS,
  LEVEL_LABELS,
  ORG_TYPE_LABELS,
  VERDICT_LABELS,
  WORK_MODE_LABELS,
} from "@/lib/jobs/taxonomy";
import type { JobFilters } from "@/lib/queries/jobs";

function Group({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-sm font-medium text-slate-800">{legend}</legend>
      {children}
    </fieldset>
  );
}

/** Plain GET form — works without JavaScript and keeps filters in the URL (shareable, crawlable). */
export async function JobFiltersForm({
  filters,
  action,
  signedIn,
  locked = [],
  idPrefix = "f",
}: {
  filters: JobFilters;
  action: string;
  signedIn: boolean;
  locked?: (keyof JobFilters)[];
  idPrefix?: string;
}) {
  const orgs = await prisma.organization.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } });
  const show = (key: keyof JobFilters) => !locked.includes(key);
  return (
    <form action={action} method="get" className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4" aria-label="Job filters">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-q`}>Keyword</Label>
        <Input id={`${idPrefix}-q`} name="q" defaultValue={filters.q} placeholder="Title, skill or bank" />
      </div>
      {show("org") ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-org`}>Bank / organisation</Label>
          <Select id={`${idPrefix}-org`} name="org" defaultValue={filters.org ?? ""}>
            <option value="">All organisations</option>
            {orgs.map((o) => (
              <option key={o.slug} value={o.slug}>
                {o.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      {show("orgType") ? (
        <Group legend="Organisation type">
          {ALL_ORG_TYPES.map((t) => (
            <Checkbox key={t} name="orgType" value={t} defaultChecked={filters.orgType.includes(t)} label={ORG_TYPE_LABELS[t]} />
          ))}
        </Group>
      ) : null}
      {show("category") ? (
        <details open={filters.category.length > 0}>
          <summary className="cursor-pointer text-sm font-medium text-slate-800">IT category</summary>
          <div className="mt-2 flex flex-col gap-1.5">
            {ALL_CATEGORIES.map((c) => (
              <Checkbox key={c} name="category" value={c} defaultChecked={filters.category.includes(c)} label={CATEGORY_LABELS[c]} />
            ))}
          </div>
        </details>
      ) : null}
      <details open={filters.level.length > 0}>
        <summary className="cursor-pointer text-sm font-medium text-slate-800">Job level</summary>
        <div className="mt-2 flex flex-col gap-1.5">
          {ALL_LEVELS.map((l) => (
            <Checkbox key={l} name="level" value={l} defaultChecked={filters.level.includes(l)} label={LEVEL_LABELS[l]} />
          ))}
        </div>
      </details>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-loc`}>Location</Label>
          <Input id={`${idPrefix}-loc`} name="location" defaultValue={filters.location} placeholder="Dhaka" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-exp`}>My experience (yrs)</Label>
          <Input id={`${idPrefix}-exp`} name="maxExperience" type="number" min={0} max={40} step="0.5" defaultValue={filters.maxExperience} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-cgpa`}>My CGPA (of 4)</Label>
          <Input id={`${idPrefix}-cgpa`} name="myCgpa" type="number" min={0} max={4} step="0.01" defaultValue={filters.myCgpa} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-masters`}>Master&apos;s</Label>
          <Select id={`${idPrefix}-masters`} name="masters" defaultValue={filters.masters ?? "any"}>
            <option value="any">Any</option>
            <option value="not-required">Not required</option>
            <option value="required">Required</option>
          </Select>
        </div>
      </div>
      <Group legend="Work mode">
        <div className="flex flex-wrap gap-3">
          {ALL_WORK_MODES.map((m) => (
            <Checkbox key={m} name="workMode" value={m} defaultChecked={filters.workMode.includes(m)} label={WORK_MODE_LABELS[m]} />
          ))}
        </div>
      </Group>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-pub`}>Published</Label>
          <Select id={`${idPrefix}-pub`} name="published" defaultValue={filters.published ?? ""}>
            <option value="">Any time</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-dl`}>Deadline</Label>
          <Select id={`${idPrefix}-dl`} name="deadline" defaultValue={filters.deadline ?? ""}>
            <option value="">Any</option>
            <option value="3d">Within 3 days</option>
            <option value="7d">Within 7 days</option>
            <option value="30d">Within 30 days</option>
          </Select>
        </div>
      </div>
      {signedIn ? (
        <>
          <details open={filters.verdict.length > 0}>
            <summary className="cursor-pointer text-sm font-medium text-slate-800">My eligibility</summary>
            <div className="mt-2 flex flex-col gap-1.5">
              {ALL_VERDICTS.map((v) => (
                <Checkbox key={v} name="verdict" value={v} defaultChecked={filters.verdict.includes(v)} label={VERDICT_LABELS[v]} />
              ))}
            </div>
          </details>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-score`}>Minimum match score</Label>
            <Input id={`${idPrefix}-score`} name="minScore" type="number" min={0} max={100} defaultValue={filters.minScore} placeholder="e.g. 60" />
          </div>
        </>
      ) : (
        <p className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
          <Link href="/login" className="font-medium text-blue-700 underline">
            Sign in
          </Link>{" "}
          to filter by your eligibility and match score.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-status`}>Status</Label>
          <Select id={`${idPrefix}-status`} name="status" defaultValue={filters.status ?? "active"}>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="all">All</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-sort`}>Sort by</Label>
          <Select id={`${idPrefix}-sort`} name="sort" defaultValue={filters.sort ?? "newest"}>
            <option value="newest">Newest</option>
            <option value="deadline">Deadline</option>
            {signedIn ? <option value="match">Best match</option> : null}
            <option value="experience">Experience</option>
            <option value="organization">Organisation</option>
            <option value="verified">Recently verified</option>
          </Select>
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          Apply filters
        </Button>
        <Button asChild variant="outline">
          <Link href={action}>Reset</Link>
        </Button>
      </div>
    </form>
  );
}
