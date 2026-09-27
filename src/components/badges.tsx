import { AlertTriangle, CheckCircle2, CircleHelp, Clock, XCircle } from "lucide-react";
import type { JobStatus, OrgType, Verdict } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { ORG_TYPE_LABELS, STATUS_LABELS, VERDICT_LABELS } from "@/lib/jobs/taxonomy";
import { hoursUntil, timeLeftLabel } from "@/lib/time";

const VERDICT_VARIANT: Record<Verdict, "success" | "warning" | "muted" | "danger" | "info"> = {
  STRONG: "success",
  POSSIBLE: "warning",
  WEAK: "muted",
  NOT_ELIGIBLE: "danger",
  MANUAL_REVIEW: "info",
};

const VERDICT_ICON = {
  STRONG: CheckCircle2,
  POSSIBLE: AlertTriangle,
  WEAK: CircleHelp,
  NOT_ELIGIBLE: XCircle,
  MANUAL_REVIEW: CircleHelp,
} as const;

export function MatchBadge({ verdict, score }: { verdict: Verdict | string; score?: number }) {
  const v = verdict as Verdict;
  const Icon = VERDICT_ICON[v];
  return (
    <Badge variant={VERDICT_VARIANT[v]} title={score != null ? `Match score ${score}/100` : undefined}>
      <Icon aria-hidden className="size-3.5" />
      {VERDICT_LABELS[v]}
      {score != null ? <span className="font-semibold">· {score}</span> : null}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: JobStatus }) {
  const variant = status === "NEW" ? "info" : status === "CLOSING_SOON" ? "danger" : status === "OPEN" ? "success" : status === "UNVERIFIED" ? "warning" : "muted";
  return <Badge variant={variant}>{STATUS_LABELS[status]}</Badge>;
}

export function OrgTypeBadge({ type }: { type: OrgType }) {
  return <Badge variant="outline">{ORG_TYPE_LABELS[type]}</Badge>;
}

export function DeadlineText({ deadline }: { deadline: Date | null }) {
  const hours = deadline ? hoursUntil(deadline) : null;
  const urgent = hours != null && hours > 0 && hours <= 72;
  const expired = hours != null && hours <= 0;
  return (
    <span className={urgent || expired ? "inline-flex items-center gap-1 font-medium text-red-700" : "inline-flex items-center gap-1 text-slate-600"}>
      <Clock aria-hidden className="size-3.5" />
      {timeLeftLabel(deadline)}
    </span>
  );
}

export function DemoBadge() {
  return (
    <Badge variant="demo" title="Demo data for illustration — not a real vacancy">
      Demo data
    </Badge>
  );
}
