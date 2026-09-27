import { normalizeUrl, titleSimilarity } from "./normalize";

export const AUTO_MERGE_THRESHOLD = 0.92;
export const REVIEW_THRESHOLD = 0.75;
const DEADLINE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export interface IncomingJob {
  externalKey: string;
  organizationId: string;
  title: string;
  applicationUrl: string | null;
  deadline: Date | null;
  fingerprint: string;
  contentHash: string;
}

export interface ExistingJob {
  id: string;
  organizationId: string;
  title: string;
  applicationUrl: string | null;
  deadline: Date | null;
  fingerprint: string;
  contentHash: string;
  externalKeys: string[];
}

export type DedupeDecision =
  | { action: "same-source"; jobId: string; reasons: string[] }
  | { action: "merge"; jobId: string; score: number; reasons: string[] }
  | { action: "create"; reviewCandidates: { jobId: string; score: number; reasons: string[] }[] };

function deadlinesCompatible(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return true;
  return Math.abs(a.getTime() - b.getTime()) <= DEADLINE_WINDOW_MS;
}

/**
 * Decide whether an incoming job is already known.
 * Order of evidence: source link → application URL → fingerprint → content hash → fuzzy title (same org, compatible deadline).
 */
export function decideDuplicate(incoming: IncomingJob, candidates: ExistingJob[]): DedupeDecision {
  const bySource = candidates.find((c) => c.externalKeys.includes(incoming.externalKey));
  if (bySource) return { action: "same-source", jobId: bySource.id, reasons: ["Same source job ID / URL"] };

  const url = normalizeUrl(incoming.applicationUrl);
  if (url) {
    const byUrl = candidates.find((c) => normalizeUrl(c.applicationUrl) === url);
    if (byUrl) return { action: "merge", jobId: byUrl.id, score: 1, reasons: ["Identical application URL"] };
  }

  const byFingerprint = candidates.find((c) => c.fingerprint === incoming.fingerprint);
  if (byFingerprint) {
    return { action: "merge", jobId: byFingerprint.id, score: 1, reasons: ["Same organisation, normalised title and deadline"] };
  }

  const byHash = candidates.find((c) => c.contentHash === incoming.contentHash);
  if (byHash) return { action: "merge", jobId: byHash.id, score: 1, reasons: ["Identical content hash"] };

  const reviewCandidates: { jobId: string; score: number; reasons: string[] }[] = [];
  let best: { jobId: string; score: number; reasons: string[] } | null = null;
  for (const c of candidates) {
    if (c.organizationId !== incoming.organizationId) continue;
    if (!deadlinesCompatible(c.deadline, incoming.deadline)) continue;
    const score = titleSimilarity(c.title, incoming.title);
    if (score < REVIEW_THRESHOLD) continue;
    const reasons = [`Title similarity ${(score * 100).toFixed(0)}%`, "Same organisation"];
    if (c.deadline && incoming.deadline) reasons.push("Deadlines within 3 days");
    const entry = { jobId: c.id, score, reasons };
    if (!best || score > best.score) best = entry;
    reviewCandidates.push(entry);
  }

  if (best && best.score >= AUTO_MERGE_THRESHOLD && incoming.deadline && candidates.find((c) => c.id === best.jobId)?.deadline) {
    return { action: "merge", jobId: best.jobId, score: best.score, reasons: best.reasons };
  }
  return { action: "create", reviewCandidates: reviewCandidates.sort((a, b) => b.score - a.score).slice(0, 3) };
}
