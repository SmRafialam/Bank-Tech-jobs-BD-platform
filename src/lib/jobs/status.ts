import type { JobStatus, ReviewStatus } from "@/generated/prisma/enums";

export const NEW_WINDOW_HOURS = 48;
export const CLOSING_SOON_HOURS = 72;
export const UNVERIFIED_AFTER_DAYS = 14;
export const REMOVED_AFTER_MISSING_RUNS = 3;

export interface StatusInput {
  deadline: Date | null;
  firstDiscoveredAt: Date;
  lastVerifiedAt: Date;
  missingRuns: number;
  reviewStatus: ReviewStatus;
  /** Manually entered jobs without a machine-verifiable source. */
  manual?: boolean;
}

export function computeStatus(job: StatusInput, now: Date = new Date()): JobStatus {
  const hour = 60 * 60 * 1000;
  if (job.deadline && job.deadline.getTime() <= now.getTime()) return "EXPIRED";
  if (job.missingRuns >= REMOVED_AFTER_MISSING_RUNS) return "REMOVED";
  if (job.reviewStatus === "PENDING") return "UNVERIFIED";
  if (!job.deadline && !job.manual && now.getTime() - job.lastVerifiedAt.getTime() > UNVERIFIED_AFTER_DAYS * 24 * hour) {
    return "UNVERIFIED";
  }
  if (job.deadline && job.deadline.getTime() - now.getTime() <= CLOSING_SOON_HOURS * hour) return "CLOSING_SOON";
  if (now.getTime() - job.firstDiscoveredAt.getTime() <= NEW_WINDOW_HOURS * hour) return "NEW";
  return "OPEN";
}

export const ACTIVE_STATUSES: JobStatus[] = ["NEW", "OPEN", "CLOSING_SOON", "UNVERIFIED"];
