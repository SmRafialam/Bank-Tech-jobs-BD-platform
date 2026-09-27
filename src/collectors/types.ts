import { z } from "zod";
import type { CollectionMethod, OrgType } from "@/generated/prisma/enums";
import type { PoliteHttpClient } from "./http";

/** Static definition of a source (src/collectors/sources.ts). Runtime state lives in the `Source` table. */
export interface SourceDefinition {
  key: string;
  name: string;
  /** Organisation this source belongs to; portals that list many employers leave it empty. */
  organizationSlug?: string;
  url: string;
  method: CollectionMethod;
  /** Adapter id in the registry (src/collectors/registry.ts). */
  adapter: string;
  enabledByDefault: boolean;
  fetchIntervalMinutes: number;
  /** Why the method was chosen, what was verified and when. Shown in the admin panel. */
  complianceNote: string;
  /** Adapter-specific configuration (selectors etc.). */
  config?: Record<string, unknown>;
  /** Default org type for employers discovered on multi-employer portals. */
  defaultOrgType?: OrgType;
}

/** Runtime view passed to adapters. */
export interface SourceContext {
  key: string;
  name: string;
  url: string;
  organizationSlug?: string;
  config: Record<string, unknown>;
  defaultOrgType?: OrgType;
}

export interface AdapterContext {
  source: SourceContext;
  http: PoliteHttpClient;
  log: (message: string) => void;
}

/** Output of `normalizeJob` — validated before ingest. */
export const normalizedJobSchema = z.object({
  sourceJobId: z.string().trim().max(200).nullish(),
  title: z.string().trim().min(3).max(250),
  organizationSlug: z.string().trim().max(80).nullish(),
  organizationName: z.string().trim().max(200).nullish(),
  department: z.string().trim().max(200).nullish(),
  /** Plain text used for requirement extraction; only a short summary is persisted. */
  description: z.string().max(50_000).nullish(),
  responsibilities: z.array(z.string().max(500)).max(30).optional(),
  location: z.string().trim().max(200).nullish(),
  employmentType: z.enum(["FULL_TIME", "CONTRACT", "PART_TIME", "INTERNSHIP"]).nullish(),
  workMode: z.enum(["ONSITE", "HYBRID", "REMOTE"]).nullish(),
  salary: z.string().trim().max(200).nullish(),
  vacancies: z.number().int().positive().max(10_000).nullish(),
  publishedAt: z.date().nullish(),
  deadline: z.date().nullish(),
  applicationUrl: z.url().max(2000).nullish(),
  sourceUrl: z.url().max(2000),
  /** Structured requirement data (e.g. from JSON-LD) that overrides text extraction. */
  hints: z
    .object({
      minCgpa: z.number().nullish(),
      minExperienceYears: z.number().nullish(),
      educationDisciplines: z.array(z.string()).optional(),
      requiredSkills: z.array(z.string()).optional(),
    })
    .optional(),
});

export type NormalizedJobInput = z.infer<typeof normalizedJobSchema>;

/**
 * Common interface implemented by every source adapter.
 * - `fetchJobs` performs all network access through the polite HTTP client (robots.txt, rate limits, retries).
 * - `normalizeJob` is pure: raw item → NormalizedJobInput (or null to skip), so it can be unit-tested with fixtures.
 */
export interface SourceAdapter<Raw = unknown> {
  id: string;
  method: CollectionMethod;
  description: string;
  fetchJobs(ctx: AdapterContext): Promise<Raw[]>;
  normalizeJob(raw: Raw, ctx: Pick<AdapterContext, "source">): NormalizedJobInput | null;
}

export class RobotsDisallowedError extends Error {
  constructor(url: string) {
    super(`robots.txt disallows ${url} for our user agent — not collected.`);
    this.name = "RobotsDisallowedError";
  }
}

export class AccessDeniedError extends Error {
  constructor(url: string, status: number) {
    super(`HTTP ${status} for ${url}. The site blocks automated access; mark this source as manual. Protections are never bypassed.`);
    this.name = "AccessDeniedError";
  }
}
