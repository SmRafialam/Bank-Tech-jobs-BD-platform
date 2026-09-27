import type { Source } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { errorMessage } from "@/lib/utils";
import { PoliteHttpClient } from "./http";
import { ingestOne } from "./ingest";
import { getAdapter } from "./registry";
import { sourceByKey } from "./sources";
import { AccessDeniedError, RobotsDisallowedError, type SourceContext } from "./types";

export interface SourceRunSummary {
  sourceKey: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED";
  itemsFound: number;
  created: number;
  updated: number;
  merged: number;
  skipped: number;
  parseErrors: number;
  message?: string;
  createdJobIds: string[];
  changedJobIds: string[];
}

export function createHttpClient() {
  const e = env();
  return new PoliteHttpClient({
    userAgent: e.COLLECTOR_USER_AGENT,
    minDelayMs: e.COLLECTOR_MIN_DELAY_MS,
    maxRetries: e.COLLECTOR_MAX_RETRIES,
    timeoutMs: e.COLLECTOR_TIMEOUT_MS,
  });
}

function isDue(source: Source, now: Date): boolean {
  if (!source.lastRunAt) return true;
  return source.lastRunAt.getTime() + source.fetchIntervalMinutes * 60_000 <= now.getTime() + 30_000;
}

async function runSource(source: Source & { organization: { slug: string } | null }, http: PoliteHttpClient, trigger: string): Promise<SourceRunSummary> {
  const started = Date.now();
  const summary: SourceRunSummary = {
    sourceKey: source.key,
    status: "SUCCESS",
    itemsFound: 0,
    created: 0,
    updated: 0,
    merged: 0,
    skipped: 0,
    parseErrors: 0,
    createdJobIds: [],
    changedJobIds: [],
  };
  const run = await prisma.sourceRun.create({ data: { sourceId: source.id, trigger } });
  const errors: string[] = [];
  const runStartedAt = new Date();

  try {
    const adapter = getAdapter(source.adapter);
    if (!adapter) throw new Error(`Unknown adapter '${source.adapter}'`);
    const def = sourceByKey(source.key);
    const ctx: SourceContext = {
      key: source.key,
      name: source.name,
      url: source.url,
      organizationSlug: source.organization?.slug,
      config: ((source.config as Record<string, unknown> | null) ?? def?.config ?? {}) as Record<string, unknown>,
      defaultOrgType: def?.defaultOrgType,
    };
    const rawItems = await adapter.fetchJobs({ source: ctx, http, log: (m) => errors.push(m) });
    summary.itemsFound = rawItems.length;

    for (const raw of rawItems) {
      try {
        const normalized = adapter.normalizeJob(raw, { source: ctx });
        if (!normalized) {
          summary.skipped++;
          continue;
        }
        const outcome = await ingestOne(normalized, {
          id: source.id,
          key: source.key,
          name: source.name,
          organizationSlug: ctx.organizationSlug,
          defaultOrgType: ctx.defaultOrgType,
        });
        if (outcome.action === "created") {
          summary.created++;
          summary.createdJobIds.push(outcome.jobId!);
        } else if (outcome.action === "updated") {
          summary.updated++;
          if (outcome.deadlineChanged) summary.changedJobIds.push(outcome.jobId!);
        } else if (outcome.action === "merged") {
          summary.merged++;
          if (outcome.deadlineChanged) summary.changedJobIds.push(outcome.jobId!);
        } else {
          summary.skipped++;
          if (outcome.reason?.startsWith("Invalid")) {
            summary.parseErrors++;
            errors.push(outcome.reason);
          }
        }
      } catch (error) {
        summary.parseErrors++;
        errors.push(errorMessage(error));
      }
    }

    // Jobs from this source that disappeared: count consecutive misses (REMOVED after 3).
    // An empty page is more likely a layout change than every job vanishing, so it is not counted.
    if (summary.itemsFound > 0) await prisma.job.updateMany({
      where: { links: { some: { sourceId: source.id, lastSeenAt: { lt: runStartedAt } } }, NOT: { links: { some: { sourceId: source.id, lastSeenAt: { gte: runStartedAt } } } }, status: { notIn: ["EXPIRED"] } },
      data: { missingRuns: { increment: 1 } },
    });

    summary.status = summary.parseErrors > 0 ? "PARTIAL" : "SUCCESS";
    summary.message = `${summary.itemsFound} items, ${summary.created} new, ${summary.updated} updated, ${summary.merged} merged, ${summary.skipped} skipped`;
    await prisma.source.update({
      where: { id: source.id },
      data: { lastRunAt: new Date(), lastSuccessAt: new Date(), lastError: errors[0] ?? null, consecutiveFailures: 0 },
    });
  } catch (error) {
    const message = errorMessage(error);
    summary.status = error instanceof RobotsDisallowedError || /disabled|not installed/.test(message) ? "SKIPPED" : "FAILED";
    summary.message = message;
    errors.push(message);
    await prisma.source.update({
      where: { id: source.id },
      data: {
        lastRunAt: new Date(),
        lastError: message,
        consecutiveFailures: summary.status === "FAILED" || error instanceof AccessDeniedError ? { increment: 1 } : undefined,
      },
    });
  }

  await prisma.sourceRun.update({
    where: { id: run.id },
    data: {
      status: summary.status,
      finishedAt: new Date(),
      durationMs: Date.now() - started,
      itemsFound: summary.itemsFound,
      jobsCreated: summary.created,
      jobsUpdated: summary.updated,
      jobsMerged: summary.merged,
      jobsSkipped: summary.skipped,
      parseErrors: summary.parseErrors,
      message: summary.message,
      errors: errors.length ? errors.slice(0, 50) : undefined,
    },
  });
  return summary;
}

/**
 * Run all enabled, automated sources that are due (or the given keys when forced).
 * Each source is isolated: a failure is recorded and never stops the others.
 */
export async function runSources(options: { keys?: string[]; force?: boolean; trigger?: string } = {}): Promise<SourceRunSummary[]> {
  const now = new Date();
  const sources = await prisma.source.findMany({
    where: {
      method: { not: "MANUAL" },
      ...(options.keys?.length ? { key: { in: options.keys } } : { enabled: true }),
    },
    include: { organization: { select: { slug: true } } },
  });
  const due = options.force || options.keys?.length ? sources : sources.filter((s) => isDue(s, now));
  const http = createHttpClient();
  const concurrency = Math.max(1, env().COLLECTOR_CONCURRENCY);
  const results: SourceRunSummary[] = [];
  let index = 0;

  async function worker() {
    while (index < due.length) {
      const source = due[index++];
      const outcome = await Promise.allSettled([runSource(source, http, options.trigger ?? "schedule")]);
      const first = outcome[0];
      if (first.status === "fulfilled") results.push(first.value);
      else {
        results.push({
          sourceKey: source.key,
          status: "FAILED",
          itemsFound: 0,
          created: 0,
          updated: 0,
          merged: 0,
          skipped: 0,
          parseErrors: 0,
          message: errorMessage(first.reason),
          createdJobIds: [],
          changedJobIds: [],
        });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, due.length) }, worker));
  return results;
}
