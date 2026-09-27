import { Cron } from "croner";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import type { TaskName } from "./index";

export const SCHEDULE_TIMEZONE = "Asia/Dhaka";
export const SCHEDULES_SETTING_KEY = "schedules";

export function defaultSchedules(): Record<TaskName, string> {
  const e = env();
  return {
    collect: e.CRON_COLLECT,
    reminders: e.CRON_REMINDERS,
    "verify-deadlines": e.CRON_VERIFY_DEADLINES,
    cleanup: e.CRON_CLEANUP,
    digest: e.CRON_DIGEST,
  };
}

export function isValidCron(expression: string): boolean {
  try {
    new Cron(expression, { paused: true, timezone: SCHEDULE_TIMEZONE }).stop();
    return true;
  } catch {
    return false;
  }
}

/** Environment defaults overridden by values saved from the admin dashboard. */
export async function getSchedules(): Promise<Record<TaskName, string>> {
  const saved = await prisma.setting.findUnique({ where: { key: SCHEDULES_SETTING_KEY } });
  const overrides = (saved?.value ?? {}) as Partial<Record<TaskName, string>>;
  const merged = { ...defaultSchedules() };
  for (const [task, cron] of Object.entries(overrides)) {
    if (task in merged && typeof cron === "string" && isValidCron(cron)) merged[task as TaskName] = cron;
  }
  return merged;
}

export function nextRun(expression: string): Date | null {
  try {
    return new Cron(expression, { paused: true, timezone: SCHEDULE_TIMEZONE }).nextRun();
  } catch {
    return null;
  }
}
