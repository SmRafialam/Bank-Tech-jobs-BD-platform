import type { CandidateProfile, Job, Organization } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { evaluateEligibility, type EligibilityResult, type JobInput, type ProfileInput } from "@/lib/jobs/eligibility";
import { ACTIVE_STATUSES } from "@/lib/jobs/status";

export function toProfileInput(p: CandidateProfile): ProfileInput {
  return {
    discipline: p.discipline,
    hasMasters: p.hasMasters,
    bachelorCgpa: p.bachelorCgpa,
    cgpaScale: p.cgpaScale,
    sscGpa: p.sscGpa,
    hscGpa: p.hscGpa,
    hasThirdDivision: p.hasThirdDivision,
    experienceYears: p.experienceYears,
    bankingExperience: p.bankingExperience,
    skills: p.skills,
    primaryFocus: p.primaryFocus,
    preferredRoles: p.preferredRoles,
    preferredOrgSlugs: p.preferredOrgSlugs,
    preferredLocations: p.preferredLocations,
    openToRemote: p.openToRemote,
    age: p.age,
  };
}

export function toJobInput(job: Job & { organization: Pick<Organization, "slug"> }): JobInput {
  return {
    title: job.title,
    category: job.category,
    secondaryCategories: job.secondaryCategories,
    level: job.level,
    organizationSlug: job.organization.slug,
    educationDisciplines: job.educationDisciplines,
    minCgpa: job.minCgpa,
    minSscGpa: job.minSscGpa,
    minHscGpa: job.minHscGpa,
    mastersRequired: job.mastersRequired,
    noThirdDivision: job.noThirdDivision,
    minExperienceYears: job.minExperienceYears,
    maxExperienceYears: job.maxExperienceYears,
    ageLimit: job.ageLimit,
    bankingExperiencePreferred: job.bankingExperiencePreferred,
    requiredSkills: job.requiredSkills,
    preferredSkills: job.preferredSkills,
    location: job.location,
    workMode: job.workMode,
    requirementsParsed: job.requirementsParsed,
  };
}

export function evaluate(profile: CandidateProfile, job: Job & { organization: Pick<Organization, "slug"> }): EligibilityResult {
  return evaluateEligibility(toProfileInput(profile), toJobInput(job));
}

async function upsertMatch(userId: string, jobId: string, result: EligibilityResult) {
  await prisma.matchResult.upsert({
    where: { userId_jobId: { userId, jobId } },
    update: { verdict: result.verdict, score: result.score, reasons: result.reasons as object[], computedAt: new Date() },
    create: { userId, jobId, verdict: result.verdict, score: result.score, reasons: result.reasons as object[] },
  });
}

/** Recompute cached matches of the given jobs for every candidate profile. */
export async function recomputeMatchesForJobs(jobIds: string[]) {
  if (!jobIds.length) return;
  const [profiles, jobs] = await Promise.all([
    prisma.candidateProfile.findMany(),
    prisma.job.findMany({ where: { id: { in: jobIds } }, include: { organization: { select: { slug: true } } } }),
  ]);
  for (const job of jobs) {
    for (const profile of profiles) await upsertMatch(profile.userId, job.id, evaluate(profile, job));
  }
}

/** Recompute cached matches of one user against all active jobs (after a profile change). */
export async function recomputeMatchesForUser(userId: string) {
  const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
  if (!profile) return;
  const jobs = await prisma.job.findMany({
    where: { status: { in: ACTIVE_STATUSES }, archivedAt: null, reviewStatus: "APPROVED" },
    include: { organization: { select: { slug: true } } },
  });
  for (const job of jobs) await upsertMatch(userId, job.id, evaluate(profile, job));
}
