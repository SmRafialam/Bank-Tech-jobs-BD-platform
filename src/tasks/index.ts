import { randomUUID } from "node:crypto";
import { runSources } from "@/collectors/runner";
import { prisma } from "@/lib/db";
import { computeStatus } from "@/lib/jobs/status";
import { recomputeMatchesForJobs } from "@/lib/matching";
import { errorMessage } from "@/lib/utils";
import { notifyJobUpdates, notifyNewJobs, sendClosingSoonAlerts, sendDailyDigest, sendDeadlineReminders } from "@/notifications/dispatch";

export const TASK_NAMES = ["collect", "verify-deadlines", "cleanup", "digest", "reminders"] as const;
export type TaskName = (typeof TASK_NAMES)[number];

export function isTaskName(value: string): value is TaskName {
  return (TASK_NAMES as readonly string[]).includes(value);
}

const LOCK_MINUTES = 30;

/** Cross-process lease stored in the Setting table (atomic INSERT … ON CONFLICT … WHERE expired). */
async function acquireLock(task: string, owner: string): Promise<boolean> {
  const until = new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString();
  const value = JSON.stringify({ owner, until });
  const affected = await prisma.$executeRaw`
    INSERT INTO "Setting" ("key", "value", "updatedAt") VALUES (${`lock:${task}`}, ${value}::jsonb, now())
    ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = now()
    WHERE ("Setting"."value"->>'until')::timestamptz < now()`;
  return affected > 0;
}

async function releaseLock(task: string, owner: string) {
  await prisma.$executeRaw`DELETE FROM "Setting" WHERE "key" = ${`lock:${task}`} AND "value"->>'owner' = ${owner}`;
}

/** Recompute derived job statuses (NEW → OPEN → CLOSING_SOON → EXPIRED, REMOVED, UNVERIFIED). */
export async function refreshStatuses(filter: { onlyUpcoming?: boolean } = {}, now: Date = new Date()): Promise<number> {
  const jobs = await prisma.job.findMany({
    where: {
      archivedAt: null,
      ...(filter.onlyUpcoming
        ? { OR: [{ deadline: { lte: new Date(now.getTime() + 4 * 86_400_000) } }, { firstDiscoveredAt: { gte: new Date(now.getTime() - 3 * 86_400_000) } }], status: { not: "EXPIRED" } }
        : {}),
    },
    select: { id: true, status: true, deadline: true, firstDiscoveredAt: true, lastVerifiedAt: true, missingRuns: true, reviewStatus: true, links: { select: { sourceId: true } } },
  });
  let changed = 0;
  for (const job of jobs) {
    const next = computeStatus({ ...job, manual: job.links.every((l) => l.sourceId == null) }, now);
    if (next !== job.status) {
      await prisma.job.update({ where: { id: job.id }, data: { status: next } });
      changed++;
    }
  }
  return changed;
}

async function collect(trigger: string) {
  const results = await runSources({ trigger });
  const created = results.flatMap((r) => r.createdJobIds);
  const changed = results.flatMap((r) => r.changedJobIds);
  await recomputeMatchesForJobs([...created, ...changed]);
  const notified = await notifyNewJobs(created);
  const updates = await notifyJobUpdates(changed);
  const failed = results.filter((r) => r.status === "FAILED").length;
  return `${results.length} source(s) run, ${failed} failed, ${created.length} new job(s), ${notified} alert(s), ${updates} update alert(s)`;
}

async function verifyDeadlines() {
  const changed = await refreshStatuses();
  const closing = await sendClosingSoonAlerts();
  return `${changed} status change(s), ${closing} closing-soon alert(s)`;
}

async function cleanup(now = new Date()) {
  const day = 86_400_000;
  const archived = await prisma.job.updateMany({
    where: { archivedAt: null, OR: [{ status: "EXPIRED", deadline: { lt: new Date(now.getTime() - 90 * day) } }, { status: "REMOVED", updatedAt: { lt: new Date(now.getTime() - 30 * day) } }] },
    data: { archivedAt: now },
  });
  const runs = await prisma.sourceRun.deleteMany({ where: { startedAt: { lt: new Date(now.getTime() - 90 * day) } } });
  const deliveries = await prisma.notificationDelivery.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 180 * day) } } });
  const tasks = await prisma.taskRun.deleteMany({ where: { startedAt: { lt: new Date(now.getTime() - 90 * day) } } });
  return `${archived.count} job(s) archived; pruned ${runs.count} source runs, ${deliveries.count} deliveries, ${tasks.count} task runs`;
}

async function reminders() {
  const changed = await refreshStatuses({ onlyUpcoming: true });
  const sent = await sendDeadlineReminders();
  const closing = await sendClosingSoonAlerts();
  return `${changed} status change(s), ${sent} reminder(s), ${closing} closing-soon alert(s)`;
}

async function digest() {
  const sent = await sendDailyDigest();
  return `${sent} digest(s) sent`;
}

const HANDLERS: Record<TaskName, (trigger: string) => Promise<string>> = {
  collect,
  "verify-deadlines": verifyDeadlines,
  cleanup: () => cleanup(),
  digest,
  reminders,
};

/** Run a scheduled task with a cross-process lock and a TaskRun log entry. */
export async function runTask(name: TaskName, trigger: string): Promise<{ status: string; message: string }> {
  const owner = randomUUID();
  if (!(await acquireLock(name, owner))) {
    await prisma.taskRun.create({ data: { task: name, trigger, status: "SKIPPED", finishedAt: new Date(), message: "Another run holds the lock" } });
    return { status: "SKIPPED", message: "Another run of this task is in progress" };
  }
  const run = await prisma.taskRun.create({ data: { task: name, trigger } });
  try {
    const message = await HANDLERS[name](trigger);
    await prisma.taskRun.update({ where: { id: run.id }, data: { status: "SUCCESS", finishedAt: new Date(), message } });
    return { status: "SUCCESS", message };
  } catch (error) {
    const message = errorMessage(error);
    await prisma.taskRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt: new Date(), message } });
    return { status: "FAILED", message };
  } finally {
    await releaseLock(name, owner);
  }
}
