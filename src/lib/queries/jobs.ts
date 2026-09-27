import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { ALL_CATEGORIES, ALL_LEVELS, ALL_ORG_TYPES, ALL_VERDICTS, ALL_WORK_MODES } from "@/lib/jobs/taxonomy";
import { ACTIVE_STATUSES } from "@/lib/jobs/status";

export const PAGE_SIZE = 20;
export const SORTS = ["newest", "deadline", "match", "experience", "organization", "verified"] as const;
export type SortKey = (typeof SORTS)[number];

const list = <T extends string>(values: readonly T[]) =>
  z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v == null ? [] : (Array.isArray(v) ? v : v.split(","))).filter((x): x is T => (values as readonly string[]).includes(x)));

const num = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined));

export const jobFiltersSchema = z.object({
  q: z.string().max(100).optional().transform((v) => v?.trim() || undefined),
  org: z.string().max(80).optional().transform((v) => v || undefined),
  orgType: list(ALL_ORG_TYPES),
  category: list(ALL_CATEGORIES),
  level: list(ALL_LEVELS),
  location: z.string().max(60).optional().transform((v) => v?.trim() || undefined),
  workMode: list(ALL_WORK_MODES),
  maxExperience: num,
  myCgpa: num,
  masters: z.enum(["any", "not-required", "required"]).optional().catch(undefined),
  published: z.enum(["24h", "7d", "30d"]).optional().catch(undefined),
  deadline: z.enum(["3d", "7d", "30d"]).optional().catch(undefined),
  verdict: list(ALL_VERDICTS),
  minScore: num,
  status: z.enum(["active", "expired", "all"]).optional().catch(undefined),
  sort: z.enum(SORTS).optional().catch(undefined),
  page: num,
});

export type JobFilters = z.infer<typeof jobFiltersSchema>;

export function parseJobFilters(searchParams: Record<string, string | string[] | undefined>): JobFilters {
  const parsed = jobFiltersSchema.safeParse(searchParams);
  return parsed.success ? parsed.data : jobFiltersSchema.parse({});
}

export function buildJobWhere(f: JobFilters, userId?: string | null, now: Date = new Date()): Prisma.JobWhereInput {
  const and: Prisma.JobWhereInput[] = [{ archivedAt: null, reviewStatus: "APPROVED" }];
  const status = f.status ?? "active";
  if (status === "active") and.push({ status: { in: ACTIVE_STATUSES } });
  if (status === "expired") and.push({ status: { in: ["EXPIRED", "REMOVED"] } });

  if (f.q) {
    const q = f.q;
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { summary: { contains: q, mode: "insensitive" } },
        { department: { contains: q, mode: "insensitive" } },
        { organization: { name: { contains: q, mode: "insensitive" } } },
        { organization: { shortName: { contains: q, mode: "insensitive" } } },
        { requiredSkills: { has: q } },
      ],
    });
  }
  if (f.org) and.push({ organization: { slug: f.org } });
  if (f.orgType.length) and.push({ organization: { type: { in: f.orgType } } });
  if (f.category.length) and.push({ OR: [{ category: { in: f.category } }, { secondaryCategories: { hasSome: f.category } }] });
  if (f.level.length) and.push({ level: { in: f.level } });
  if (f.location) and.push({ OR: [{ location: { contains: f.location, mode: "insensitive" } }, { location: { contains: "anywhere", mode: "insensitive" } }, { workMode: "REMOTE" }] });
  if (f.workMode.length) and.push({ workMode: { in: f.workMode } });
  if (f.maxExperience != null) and.push({ OR: [{ minExperienceYears: null }, { minExperienceYears: { lte: f.maxExperience } }] });
  if (f.myCgpa != null) and.push({ OR: [{ minCgpa: null }, { minCgpa: { lte: f.myCgpa } }] });
  if (f.masters === "not-required") and.push({ OR: [{ mastersRequired: false }, { mastersRequired: null }] });
  if (f.masters === "required") and.push({ mastersRequired: true });
  if (f.published) {
    const hours = { "24h": 24, "7d": 168, "30d": 720 }[f.published];
    and.push({ firstDiscoveredAt: { gte: new Date(now.getTime() - hours * 3_600_000) } });
  }
  if (f.deadline) {
    const days = { "3d": 3, "7d": 7, "30d": 30 }[f.deadline];
    and.push({ deadline: { gte: now, lte: new Date(now.getTime() + days * 86_400_000) } });
  }
  if (userId && (f.verdict.length || f.minScore != null)) {
    and.push({
      matches: {
        some: {
          userId,
          ...(f.verdict.length ? { verdict: { in: f.verdict } } : {}),
          ...(f.minScore != null ? { score: { gte: f.minScore } } : {}),
        },
      },
    });
  }
  return { AND: and };
}

function orderBy(sort: SortKey): Prisma.JobOrderByWithRelationInput[] {
  switch (sort) {
    case "deadline":
      return [{ deadline: { sort: "asc", nulls: "last" } }, { firstDiscoveredAt: "desc" }];
    case "experience":
      return [{ minExperienceYears: { sort: "asc", nulls: "last" } }, { firstDiscoveredAt: "desc" }];
    case "organization":
      return [{ organization: { name: "asc" } }, { title: "asc" }];
    case "verified":
      return [{ lastVerifiedAt: "desc" }];
    default:
      return [{ firstDiscoveredAt: "desc" }, { id: "desc" }];
  }
}

export const jobListInclude = {
  organization: { select: { slug: true, name: true, shortName: true, type: true } },
  _count: { select: { links: true } },
} satisfies Prisma.JobInclude;

export type JobListItem = Prisma.JobGetPayload<{ include: typeof jobListInclude }> & {
  match: { verdict: string; score: number } | null;
  saved: boolean;
};

export async function searchJobs(filters: JobFilters, userId?: string | null) {
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const where = buildJobWhere(filters, userId);
  const sort: SortKey = filters.sort ?? "newest";
  let jobs: Prisma.JobGetPayload<{ include: typeof jobListInclude }>[];
  let total: number;

  if (sort === "match" && userId) {
    const matchWhere = { userId, job: where };
    [total, jobs] = await Promise.all([
      prisma.matchResult.count({ where: matchWhere }),
      prisma.matchResult
        .findMany({ where: matchWhere, orderBy: [{ score: "desc" }, { computedAt: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { job: { include: jobListInclude } } })
        .then((rows) => rows.map((r) => r.job)),
    ]);
  } else {
    [total, jobs] = await Promise.all([
      prisma.job.count({ where }),
      prisma.job.findMany({ where, orderBy: orderBy(sort), skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: jobListInclude }),
    ]);
  }
  const items = await decorate(jobs, userId);
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Attach the viewer's match and saved state to job rows. */
export async function decorate(jobs: Prisma.JobGetPayload<{ include: typeof jobListInclude }>[], userId?: string | null): Promise<JobListItem[]> {
  if (!userId || !jobs.length) return jobs.map((j) => ({ ...j, match: null, saved: false }));
  const ids = jobs.map((j) => j.id);
  const [matches, saved] = await Promise.all([
    prisma.matchResult.findMany({ where: { userId, jobId: { in: ids } }, select: { jobId: true, verdict: true, score: true } }),
    prisma.savedJob.findMany({ where: { userId, jobId: { in: ids } }, select: { jobId: true } }),
  ]);
  const savedSet = new Set(saved.map((s) => s.jobId));
  return jobs.map((j) => {
    const m = matches.find((x) => x.jobId === j.id);
    return { ...j, match: m ? { verdict: m.verdict, score: m.score } : null, saved: savedSet.has(j.id) };
  });
}

export async function homeStats(now: Date = new Date()) {
  const startOfDay = new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(now)}T00:00:00+06:00`);
  const base = { archivedAt: null, reviewStatus: "APPROVED" as const };
  const [open, today, closing, orgs] = await Promise.all([
    prisma.job.count({ where: { ...base, status: { in: ACTIVE_STATUSES } } }),
    prisma.job.count({ where: { ...base, firstDiscoveredAt: { gte: startOfDay } } }),
    prisma.job.count({ where: { ...base, status: "CLOSING_SOON" } }),
    prisma.organization.count({ where: { OR: [{ jobs: { some: { ...base } } }, { sources: { some: {} } }] } }),
  ]);
  return { open, today, closing, orgs };
}
