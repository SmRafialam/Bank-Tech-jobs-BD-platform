import type { Source } from "@/generated/prisma/client";

export type Health = "healthy" | "warning" | "failing" | "manual" | "disabled" | "pending";

export const HEALTH_LABEL: Record<Health, string> = {
  healthy: "Healthy",
  warning: "Warning",
  failing: "Failing",
  manual: "Manual/API required",
  disabled: "Disabled",
  pending: "Not run yet",
};

export const HEALTH_COLOR: Record<Health, string> = {
  healthy: "bg-emerald-500",
  warning: "bg-amber-500",
  failing: "bg-red-600",
  manual: "bg-slate-400",
  disabled: "bg-slate-300",
  pending: "bg-blue-400",
};

export function sourceHealth(s: Pick<Source, "method" | "enabled" | "lastRunAt" | "lastSuccessAt" | "consecutiveFailures" | "fetchIntervalMinutes">, now = new Date()): Health {
  if (s.method === "MANUAL") return "manual";
  if (!s.enabled) return "disabled";
  if (!s.lastRunAt) return "pending";
  if (s.consecutiveFailures >= 3) return "failing";
  if (s.consecutiveFailures > 0) return "warning";
  if (!s.lastSuccessAt) return "warning";
  const stale = now.getTime() - s.lastSuccessAt.getTime() > s.fetchIntervalMinutes * 60_000 * 3;
  return stale ? "warning" : "healthy";
}
