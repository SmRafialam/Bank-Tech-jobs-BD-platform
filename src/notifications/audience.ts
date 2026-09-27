import type { NotificationPreference } from "@/generated/prisma/client";
import type { JobCategory, JobLevel, OrgType, Verdict } from "@/generated/prisma/enums";

export interface AudienceJob {
  category: JobCategory;
  secondaryCategories: JobCategory[];
  level: JobLevel | null;
  location: string | null;
  workMode: "ONSITE" | "HYBRID" | "REMOTE";
  organization: { slug: string; type: OrgType };
}

export interface AudienceMatch {
  verdict: Verdict;
  score: number;
}

type Pref = Pick<
  NotificationPreference,
  "categories" | "organizationSlugs" | "orgTypes" | "minMatchScore" | "locations" | "levels" | "academicOnly"
>;

/** Whether a job passes a user's alert filters. Empty filter lists mean "any". */
export function preferenceMatches(pref: Pref, job: AudienceJob, match: AudienceMatch | null): { ok: boolean; reason?: string } {
  if (pref.categories.length && !pref.categories.includes(job.category) && !job.secondaryCategories.some((c) => pref.categories.includes(c))) {
    return { ok: false, reason: "category" };
  }
  if (pref.organizationSlugs.length && !pref.organizationSlugs.includes(job.organization.slug)) return { ok: false, reason: "organization" };
  if (pref.orgTypes.length && !pref.orgTypes.includes(job.organization.type)) return { ok: false, reason: "org type" };
  if (pref.levels.length && job.level && !pref.levels.includes(job.level)) return { ok: false, reason: "level" };
  if (pref.locations.length && job.location && job.workMode !== "REMOTE") {
    const loc = job.location.toLowerCase();
    if (!loc.includes("anywhere") && !pref.locations.some((l) => loc.includes(l.toLowerCase()))) return { ok: false, reason: "location" };
  }
  if (match) {
    if (pref.academicOnly && match.verdict === "NOT_ELIGIBLE") return { ok: false, reason: "not eligible" };
    // Manual-review jobs are still announced — the user decides after reading the circular.
    if (match.verdict !== "MANUAL_REVIEW" && match.score < pref.minMatchScore) return { ok: false, reason: "score" };
  }
  return { ok: true };
}

/** High priority: strong match closing within 72 hours — bypasses the daily digest. */
export function isHighPriority(match: AudienceMatch | null, deadline: Date | null, now: Date = new Date()): boolean {
  if (!match || match.verdict !== "STRONG" || !deadline) return false;
  const hours = (deadline.getTime() - now.getTime()) / 3_600_000;
  return hours > 0 && hours <= 72;
}

export const REMINDER_WINDOWS = [
  { key: "6h", hours: 6, label: "6 hours" },
  { key: "24h", hours: 24, label: "24 hours" },
  { key: "3d", hours: 72, label: "3 days" },
  { key: "7d", hours: 168, label: "7 days" },
] as const;

/** Smallest reminder window the deadline currently falls into (only that one is sent per run). */
export function reminderWindow(deadline: Date, now: Date = new Date()) {
  const hours = (deadline.getTime() - now.getTime()) / 3_600_000;
  if (hours <= 0) return null;
  return REMINDER_WINDOWS.find((w) => hours <= w.hours) ?? null;
}
