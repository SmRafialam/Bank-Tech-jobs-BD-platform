import type { EmploymentType, JobCategory, JobLevel, WorkMode } from "@/generated/prisma/enums";
import { categorizeJob, detectLevel, isTechJob } from "@/lib/jobs/categorize";
import { extractRequirements, type ExtractedRequirements } from "@/lib/jobs/extract";
import { contentHash, htmlToText, jobFingerprint, normalizeTitle } from "@/lib/jobs/normalize";
import { truncate, unique } from "@/lib/utils";
import type { NormalizedJobInput } from "./types";

export const SUMMARY_MAX_CHARS = 600;

export interface EnrichedJob {
  title: string;
  normalizedTitle: string;
  department: string | null;
  category: JobCategory;
  secondaryCategories: JobCategory[];
  level: JobLevel | null;
  summary: string;
  responsibilities: string[];
  requirements: ExtractedRequirements;
  location: string | null;
  workMode: WorkMode;
  employmentType: EmploymentType;
  salary: string | null;
  vacancies: number | null;
  publishedAt: Date | null;
  deadline: Date | null;
  applicationUrl: string | null;
  sourceUrl: string;
  sourceJobId: string | null;
  fingerprint: string;
  contentHash: string;
}

/** Relevance check + categorisation + requirement extraction. Returns null for non-technology roles. */
export function enrichJob(input: NormalizedJobInput, orgSlug: string, options: { skipRelevance?: boolean } = {}): EnrichedJob | null {
  const title = input.title.replace(/\s+/g, " ").trim();
  const text = htmlToText(input.description ?? "");
  if (!options.skipRelevance && !isTechJob(title, input.department ?? "", text)) return null;

  const requirements = extractRequirements(`${title}\n${text}`);
  if (input.hints) {
    if (input.hints.minCgpa != null) requirements.minCgpa = input.hints.minCgpa;
    if (input.hints.minExperienceYears != null) requirements.minExperienceYears = input.hints.minExperienceYears;
    if (input.hints.educationDisciplines?.length) requirements.educationDisciplines = input.hints.educationDisciplines;
    if (input.hints.requiredSkills?.length) requirements.requiredSkills = unique([...input.hints.requiredSkills, ...requirements.requiredSkills]);
  }

  const { category, secondary } = categorizeJob(title, text, input.department ?? "");
  const deadline = input.deadline ?? requirements.deadline;
  // Only a short, normalised summary is stored — never a full copy of the source text.
  const summaryBody = text.startsWith(title) ? text.slice(title.length).trim() : text;
  const summary = summaryBody ? truncate(summaryBody.replace(/\n+/g, " "), SUMMARY_MAX_CHARS) : `${title}. See the official circular for full details.`;

  return {
    title,
    normalizedTitle: normalizeTitle(title),
    department: input.department ?? null,
    category,
    secondaryCategories: secondary,
    level: detectLevel(title),
    summary,
    responsibilities: (input.responsibilities ?? []).slice(0, 12).map((r) => truncate(r, 200)),
    requirements,
    location: input.location ?? requirements.location,
    workMode: input.workMode ?? requirements.workMode ?? "ONSITE",
    employmentType: input.employmentType ?? (/\bcontract(ual)?\b/i.test(title) ? "CONTRACT" : /\bintern/i.test(title) ? "INTERNSHIP" : "FULL_TIME"),
    salary: input.salary ?? requirements.salary,
    vacancies: input.vacancies ?? requirements.vacancies,
    publishedAt: input.publishedAt ?? null,
    deadline,
    applicationUrl: input.applicationUrl ?? null,
    sourceUrl: input.sourceUrl,
    sourceJobId: input.sourceJobId ?? null,
    fingerprint: jobFingerprint(orgSlug, title, deadline),
    contentHash: contentHash([orgSlug, title, input.department, summary, deadline?.toISOString()]),
  };
}
