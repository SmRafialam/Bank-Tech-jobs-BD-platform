import { randomBytes } from "node:crypto";
import type { OrgType, ReviewStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { decideDuplicate, type ExistingJob } from "@/lib/jobs/dedupe";
import { normalizeUrl, sha256 } from "@/lib/jobs/normalize";
import { computeStatus } from "@/lib/jobs/status";
import { slugify } from "@/lib/utils";
import { enrichJob, type EnrichedJob } from "./enrich";
import { ORGANIZATIONS, findOrganizationByName } from "./organizations";
import { normalizedJobSchema, type NormalizedJobInput } from "./types";

export interface IngestSource {
  id: string | null;
  key: string;
  name: string;
  organizationSlug?: string | null;
  defaultOrgType?: OrgType;
}

export interface IngestOptions {
  reviewStatus?: ReviewStatus;
  submittedById?: string | null;
  isDemo?: boolean;
  skipRelevance?: boolean;
  /** Do not attach a source link when the job already exists (untrusted submissions). */
  skipLinkOnDuplicate?: boolean;
  now?: Date;
}

export type IngestAction = "created" | "updated" | "merged" | "skipped";

export interface IngestOutcome {
  action: IngestAction;
  jobId?: string;
  deadlineChanged?: boolean;
  reason?: string;
}

const CANDIDATE_WINDOW_DAYS = 120;

export function externalKeyFor(sourceKey: string, job: Pick<EnrichedJob, "sourceJobId" | "applicationUrl" | "sourceUrl" | "normalizedTitle">): string {
  if (job.sourceJobId) return `${sourceKey}:id:${job.sourceJobId}`;
  const url = normalizeUrl(job.applicationUrl) ?? normalizeUrl(job.sourceUrl) ?? job.sourceUrl;
  return `${sourceKey}:u:${sha256(`${url}|${job.normalizedTitle}`).slice(0, 32)}`;
}

async function resolveOrganization(input: NormalizedJobInput, source: IngestSource) {
  const slug = input.organizationSlug ?? source.organizationSlug ?? findOrganizationByName(input.organizationName)?.slug;
  if (slug) {
    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (existing) return existing;
    const def = ORGANIZATIONS.find((o) => o.slug === slug);
    if (def) {
      return prisma.organization.create({
        data: { slug: def.slug, name: def.name, shortName: def.shortName, type: def.type, website: def.website, careersUrl: def.careersUrl },
      });
    }
  }
  if (input.organizationName) {
    const newSlug = slugify(input.organizationName);
    return prisma.organization.upsert({
      where: { slug: newSlug },
      update: {},
      create: { slug: newSlug, name: input.organizationName, type: source.defaultOrgType ?? "GOVERNMENT" },
    });
  }
  return prisma.organization.upsert({
    where: { slug: "government-other" },
    update: {},
    create: { slug: "government-other", name: "Government organisations (various)", type: "GOVERNMENT" },
  });
}

function jobData(e: EnrichedJob) {
  const r = e.requirements;
  return {
    title: e.title,
    normalizedTitle: e.normalizedTitle,
    department: e.department,
    category: e.category,
    secondaryCategories: e.secondaryCategories,
    level: e.level,
    summary: e.summary,
    responsibilities: e.responsibilities,
    requiredSkills: r.requiredSkills,
    preferredSkills: r.preferredSkills,
    educationDisciplines: r.educationDisciplines,
    disciplineNote: r.disciplineNote,
    minCgpa: r.minCgpa,
    sscHscRequirement: r.sscHscRequirement,
    minSscGpa: r.minSscGpa,
    minHscGpa: r.minHscGpa,
    mastersRequired: r.mastersRequired,
    noThirdDivision: r.noThirdDivision,
    minExperienceYears: r.minExperienceYears,
    maxExperienceYears: r.maxExperienceYears,
    ageLimit: r.ageLimit,
    bankingExperiencePreferred: r.bankingExperiencePreferred,
    requirementsParsed: r.requirementsParsed,
    location: e.location,
    workMode: e.workMode,
    employmentType: e.employmentType,
    salary: e.salary,
    vacancies: e.vacancies,
    publishedAt: e.publishedAt,
    deadline: e.deadline,
    applicationUrl: e.applicationUrl,
    contentHash: e.contentHash,
    fingerprint: e.fingerprint,
  };
}

/** Ingest one normalised job: enrich, deduplicate, create or update the canonical job and its source link. */
export async function ingestOne(rawInput: NormalizedJobInput, source: IngestSource, options: IngestOptions = {}): Promise<IngestOutcome> {
  const parsed = normalizedJobSchema.safeParse(rawInput);
  if (!parsed.success) return { action: "skipped", reason: `Invalid job: ${parsed.error.issues[0]?.message ?? "validation failed"}` };
  const input = parsed.data;
  const now = options.now ?? new Date();

  const org = await resolveOrganization(input, source);
  const enriched = enrichJob(input, org.slug, { skipRelevance: options.skipRelevance });
  if (!enriched) return { action: "skipped", reason: "Not a technology role" };

  const externalKey = externalKeyFor(source.key, enriched);
  const since = new Date(now.getTime() - CANDIDATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const urlVariants = [enriched.applicationUrl, normalizeUrl(enriched.applicationUrl)].filter((u): u is string => Boolean(u));

  const candidates = await prisma.job.findMany({
    where: {
      archivedAt: null,
      OR: [
        { links: { some: { externalKey } } },
        { fingerprint: enriched.fingerprint },
        { contentHash: enriched.contentHash },
        ...(urlVariants.length ? [{ applicationUrl: { in: urlVariants } }] : []),
        { organizationId: org.id, createdAt: { gte: since } },
      ],
    },
    select: {
      id: true,
      organizationId: true,
      title: true,
      applicationUrl: true,
      deadline: true,
      fingerprint: true,
      contentHash: true,
      links: { select: { externalKey: true } },
    },
    take: 200,
  });

  const existing: ExistingJob[] = candidates.map((c) => ({ ...c, externalKeys: c.links.map((l) => l.externalKey) }));
  const decision = decideDuplicate(
    {
      externalKey,
      organizationId: org.id,
      title: enriched.title,
      applicationUrl: enriched.applicationUrl,
      deadline: enriched.deadline,
      fingerprint: enriched.fingerprint,
      contentHash: enriched.contentHash,
    },
    existing,
  );

  if (decision.action === "same-source" || decision.action === "merge") {
    if (options.skipLinkOnDuplicate) return { action: "skipped", jobId: decision.jobId, reason: "Already listed" };
    const current = await prisma.job.findUniqueOrThrow({ where: { id: decision.jobId } });
    const deadlineChanged = Boolean(enriched.deadline && current.deadline && enriched.deadline.getTime() !== current.deadline.getTime());
    const updates: Record<string, unknown> = { lastVerifiedAt: now, missingRuns: 0 };
    // Only the source that created the canonical job may overwrite its fields; secondary sources fill gaps.
    const ownsJob = decision.action === "same-source" && current.sourceName === source.name;
    if (ownsJob) {
      Object.assign(updates, jobData(enriched));
    } else {
      if (!current.deadline && enriched.deadline) updates.deadline = enriched.deadline;
      if (!current.applicationUrl && enriched.applicationUrl) updates.applicationUrl = enriched.applicationUrl;
      if (!current.salary && enriched.salary) updates.salary = enriched.salary;
      if (!current.vacancies && enriched.vacancies) updates.vacancies = enriched.vacancies;
      if (!current.requirementsParsed && enriched.requirements.requirementsParsed) {
        const data = jobData(enriched);
        Object.assign(updates, {
          educationDisciplines: data.educationDisciplines,
          minCgpa: data.minCgpa,
          mastersRequired: data.mastersRequired,
          noThirdDivision: data.noThirdDivision,
          minExperienceYears: data.minExperienceYears,
          maxExperienceYears: data.maxExperienceYears,
          ageLimit: data.ageLimit,
          requirementsParsed: true,
        });
      }
    }
    const nextDeadline = (updates.deadline as Date | null | undefined) ?? current.deadline;
    updates.status = computeStatus(
      { deadline: nextDeadline, firstDiscoveredAt: current.firstDiscoveredAt, lastVerifiedAt: now, missingRuns: 0, reviewStatus: current.reviewStatus },
      now,
    );
    await prisma.$transaction([
      prisma.job.update({ where: { id: current.id }, data: updates }),
      prisma.jobSourceLink.upsert({
        where: { externalKey },
        update: { lastSeenAt: now, sourceUrl: enriched.sourceUrl },
        create: {
          jobId: current.id,
          sourceId: source.id,
          sourceName: source.name,
          sourceUrl: enriched.sourceUrl,
          sourceJobId: enriched.sourceJobId,
          externalKey,
          firstSeenAt: now,
          lastSeenAt: now,
        },
      }),
    ]);
    return { action: decision.action === "same-source" ? "updated" : "merged", jobId: current.id, deadlineChanged };
  }

  const reviewStatus = options.reviewStatus ?? "APPROVED";
  const slug = `${slugify(`${org.shortName ?? org.name} ${enriched.title}`)}-${randomBytes(3).toString("hex")}`;
  const job = await prisma.job.create({
    data: {
      ...jobData(enriched),
      slug,
      organizationId: org.id,
      sourceName: source.name,
      sourceUrl: enriched.sourceUrl,
      sourceJobId: enriched.sourceJobId,
      firstDiscoveredAt: now,
      lastVerifiedAt: now,
      reviewStatus,
      isDemo: options.isDemo ?? false,
      submittedById: options.submittedById ?? null,
      status: computeStatus(
        { deadline: enriched.deadline, firstDiscoveredAt: now, lastVerifiedAt: now, missingRuns: 0, reviewStatus, manual: source.id == null },
        now,
      ),
      links: {
        create: {
          sourceId: source.id,
          sourceName: source.name,
          sourceUrl: enriched.sourceUrl,
          sourceJobId: enriched.sourceJobId,
          externalKey,
          firstSeenAt: now,
          lastSeenAt: now,
        },
      },
    },
  });

  if (decision.reviewCandidates.length) {
    await prisma.duplicateCandidate.createMany({
      data: decision.reviewCandidates.map((c) => ({ jobId: c.jobId, candidateJobId: job.id, score: c.score, reasons: c.reasons })),
      skipDuplicates: true,
    });
  }
  return { action: "created", jobId: job.id };
}
