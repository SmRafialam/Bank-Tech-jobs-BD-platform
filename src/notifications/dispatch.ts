import type { NotificationPreference, User } from "@/generated/prisma/client";
import type { Channel, NotificationType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { VERDICT_LABELS } from "@/lib/jobs/taxonomy";
import { ACTIVE_STATUSES } from "@/lib/jobs/status";
import { dhakaDateKey, formatDhakaDate, formatDhakaDateTime } from "@/lib/time";
import { isHighPriority, preferenceMatches, reminderWindow } from "./audience";
import { sendEmail, sendPush, sendTelegram, type DeliveryResult } from "./channels";

interface NewNotification {
  userId: string;
  jobId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  url?: string | null;
  priority?: boolean;
  dedupeKey: string;
  /** Deliver on channels now (false = in-app only, email later in the digest). */
  deliverNow: boolean;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function emailHtml(title: string, body: string, url?: string | null) {
  const link = url ? `<p><a href="${escapeHtml(url)}" style="background:#1e3a8a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">View job</a></p>` : "";
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a">
<h2 style="color:#0b1f4d">${escapeHtml(title)}</h2>
<p style="white-space:pre-line">${escapeHtml(body)}</p>${link}
<hr/><p style="font-size:12px;color:#64748b">BankTech Jobs BD · Always verify details on the official source. Manage alerts: ${escapeHtml(appUrl("/settings/notifications"))}</p></div>`;
}

async function logDelivery(notificationId: string | null, userId: string, channel: Channel, result: DeliveryResult) {
  await prisma.notificationDelivery.create({
    data: { notificationId, userId, channel, status: result.status, target: result.target, error: result.error?.slice(0, 500) },
  });
}

/** Deliver an existing notification on the user's enabled external channels. */
export async function deliver(
  notification: { id: string; title: string; body: string; url: string | null },
  user: Pick<User, "id" | "email">,
  pref: NotificationPreference | null,
) {
  const url = notification.url ? appUrl(notification.url) : null;
  if (!pref || pref.emailEnabled) {
    await logDelivery(notification.id, user.id, "EMAIL", await sendEmail(user.email, notification.title, emailHtml(notification.title, notification.body, url), `${notification.body}\n${url ?? ""}`));
  }
  if (pref?.telegramEnabled && pref.telegramChatId) {
    const text = `<b>${escapeHtml(notification.title)}</b>\n${escapeHtml(notification.body)}${url ? `\n${escapeHtml(url)}` : ""}`;
    await logDelivery(notification.id, user.id, "TELEGRAM", await sendTelegram(pref.telegramChatId, text));
  }
  if (pref?.pushEnabled) {
    await logDelivery(notification.id, user.id, "PUSH", await sendPush(user.id, { title: notification.title, body: notification.body, url: url ?? undefined }));
  }
}

/**
 * Create an in-app notification exactly once (unique dedupe key) and optionally deliver it.
 * Returns false when the notification already existed — re-runs never notify twice.
 */
export async function notify(n: NewNotification): Promise<boolean> {
  const existing = await prisma.notification.findUnique({ where: { dedupeKey: n.dedupeKey }, select: { id: true } });
  if (existing) return false;
  let created;
  try {
    created = await prisma.notification.create({
      data: {
        userId: n.userId,
        jobId: n.jobId ?? null,
        type: n.type,
        title: n.title,
        body: n.body,
        url: n.url ?? null,
        priority: n.priority ?? false,
        dedupeKey: n.dedupeKey,
        digestPending: !n.deliverNow,
      },
    });
  } catch {
    return false; // lost a race on the unique key
  }
  await logDelivery(created.id, n.userId, "IN_APP", { status: "SENT" });
  if (n.deliverNow) {
    const user = await prisma.user.findUnique({ where: { id: n.userId }, include: { preference: true } });
    if (user) await deliver(created, user, user.preference);
  }
  return true;
}

const jobInclude = { organization: { select: { slug: true, type: true, name: true, shortName: true } } } as const;

/** New jobs → matching users. Immediate users get channel delivery; digest users get it at 08:00 Dhaka. */
export async function notifyNewJobs(jobIds: string[], now: Date = new Date()): Promise<number> {
  if (!jobIds.length) return 0;
  const jobs = await prisma.job.findMany({
    where: { id: { in: jobIds }, reviewStatus: "APPROVED", status: { in: ACTIVE_STATUSES } },
    include: jobInclude,
  });
  const users = await prisma.user.findMany({ where: { preference: { isNot: null } }, include: { preference: true } });
  let count = 0;
  for (const job of jobs) {
    const matches = await prisma.matchResult.findMany({ where: { jobId: job.id } });
    for (const user of users) {
      const pref = user.preference!;
      const match = matches.find((m) => m.userId === user.id) ?? null;
      if (!preferenceMatches(pref, job, match).ok) continue;
      const priority = isHighPriority(match, job.deadline, now);
      const org = job.organization.shortName ?? job.organization.name;
      const verdict = match ? `${VERDICT_LABELS[match.verdict]} (${match.score}/100)` : "Complete your profile to see your match";
      const sent = await notify({
        userId: user.id,
        jobId: job.id,
        type: priority ? "HIGH_PRIORITY" : "NEW_JOB",
        title: `${priority ? "Closing soon: " : "New: "}${job.title} — ${org}`,
        body: `${verdict}. Deadline: ${formatDhakaDate(job.deadline)}.`,
        url: `/jobs/${job.slug}`,
        priority,
        dedupeKey: `new:${user.id}:${job.id}`,
        deliverNow: pref.mode === "IMMEDIATE" || priority,
      });
      if (sent) count++;
    }
  }
  return count;
}

/** Deadline changes → users who saved or track the job. The key includes the new deadline so unchanged jobs never re-notify. */
export async function notifyJobUpdates(jobIds: string[]): Promise<number> {
  if (!jobIds.length) return 0;
  let count = 0;
  const jobs = await prisma.job.findMany({ where: { id: { in: jobIds } }, include: { savedBy: true, applications: true } });
  for (const job of jobs) {
    const userIds = new Set([...job.savedBy.map((s) => s.userId), ...job.applications.map((a) => a.userId)]);
    for (const userId of userIds) {
      if (
        await notify({
          userId,
          jobId: job.id,
          type: "JOB_UPDATED",
          title: `Deadline updated: ${job.title}`,
          body: `The deadline is now ${formatDhakaDateTime(job.deadline)}.`,
          url: `/jobs/${job.slug}`,
          dedupeKey: `update:${userId}:${job.id}:${job.deadline?.toISOString() ?? "none"}`,
          deliverNow: true,
        })
      )
        count++;
    }
  }
  return count;
}

/** 7 d / 3 d / 24 h / 6 h reminders for saved and tracked jobs (only the smallest reached window per run). */
export async function sendDeadlineReminders(now: Date = new Date()): Promise<number> {
  const horizon = new Date(now.getTime() + 7 * 24 * 3_600_000);
  const jobs = await prisma.job.findMany({
    where: { deadline: { gt: now, lte: horizon }, archivedAt: null, status: { in: ACTIVE_STATUSES } },
    include: {
      savedBy: { include: { user: { include: { preference: true } } } },
      applications: { where: { status: { in: ["NOT_APPLIED", "PLANNING"] } }, include: { user: { include: { preference: true } } } },
    },
  });
  let count = 0;
  for (const job of jobs) {
    const window = reminderWindow(job.deadline!, now);
    if (!window) continue;
    const users = new Map<string, NotificationPreference | null>();
    for (const s of job.savedBy) users.set(s.userId, s.user.preference);
    for (const a of job.applications) users.set(a.userId, a.user.preference);
    for (const [userId, pref] of users) {
      if (pref && !pref.deadlineReminders) continue;
      if (
        await notify({
          userId,
          jobId: job.id,
          type: "DEADLINE_REMINDER",
          title: `${window.label} left: ${job.title}`,
          body: `Application deadline: ${formatDhakaDateTime(job.deadline)}. Apply on the official site.`,
          url: `/jobs/${job.slug}`,
          priority: window.hours <= 24,
          dedupeKey: `deadline:${window.key}:${userId}:${job.id}`,
          deliverNow: true,
        })
      )
        count++;
    }
  }
  return count;
}

/** Closing-soon alerts for matching (strong/possible) jobs the user has not saved. */
export async function sendClosingSoonAlerts(): Promise<number> {
  const jobs = await prisma.job.findMany({
    where: { status: "CLOSING_SOON", reviewStatus: "APPROVED", archivedAt: null },
    include: { ...jobInclude, matches: { where: { verdict: { in: ["STRONG", "POSSIBLE"] } } }, savedBy: { select: { userId: true } } },
  });
  let count = 0;
  for (const job of jobs) {
    const saved = new Set(job.savedBy.map((s) => s.userId));
    for (const match of job.matches) {
      if (saved.has(match.userId)) continue; // covered by deadline reminders
      const pref = await prisma.notificationPreference.findUnique({ where: { userId: match.userId } });
      if (!pref || !pref.closingSoonAlerts || !preferenceMatches(pref, job, match).ok) continue;
      if (
        await notify({
          userId: match.userId,
          jobId: job.id,
          type: "CLOSING_SOON",
          title: `Closing soon: ${job.title} — ${job.organization.shortName ?? job.organization.name}`,
          body: `${VERDICT_LABELS[match.verdict]} (${match.score}/100). Deadline ${formatDhakaDateTime(job.deadline)}.`,
          url: `/jobs/${job.slug}`,
          priority: match.verdict === "STRONG",
          dedupeKey: `closing:${match.userId}:${job.id}`,
          deliverNow: pref.mode === "IMMEDIATE" || match.verdict === "STRONG",
        })
      )
        count++;
    }
  }
  return count;
}

/** One email per digest user with every pending in-app notification since the last digest. */
export async function sendDailyDigest(now: Date = new Date()): Promise<number> {
  const pending = await prisma.notification.findMany({
    where: { digestPending: true },
    orderBy: { createdAt: "asc" },
    include: { user: { include: { preference: true } } },
  });
  const byUser = new Map<string, typeof pending>();
  for (const n of pending) byUser.set(n.userId, [...(byUser.get(n.userId) ?? []), n]);
  let count = 0;
  for (const [userId, items] of byUser) {
    const user = items[0].user;
    const lines = items.map((n) => `• ${n.title}\n  ${n.body}${n.url ? `\n  ${appUrl(n.url)}` : ""}`);
    const title = `Your BankTech Jobs digest — ${items.length} new job${items.length === 1 ? "" : "s"} (${formatDhakaDate(now)})`;
    const digest = await prisma.notification.create({
      data: { userId, type: "DIGEST", title, body: lines.join("\n\n").slice(0, 8000), url: "/notifications", dedupeKey: `digest:${userId}:${dhakaDateKey(now)}` },
    }).catch(() => null);
    if (!digest) continue; // today's digest already sent
    await deliver(digest, user, user.preference);
    await prisma.notification.updateMany({ where: { id: { in: items.map((i) => i.id) } }, data: { digestPending: false } });
    count++;
  }
  return count;
}
