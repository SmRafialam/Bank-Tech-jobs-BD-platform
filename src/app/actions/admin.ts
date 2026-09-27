"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ingestOne } from "@/collectors/ingest";
import { runSources } from "@/collectors/runner";
import { ALL_CATEGORIES, ALL_LEVELS, ALL_WORK_MODES } from "@/lib/jobs/taxonomy";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { csvList, firstIssue, formObject, optionalNumber, optionalText, type ActionState } from "@/lib/forms";
import { jobFingerprint, normalizeTitle } from "@/lib/jobs/normalize";
import { computeStatus } from "@/lib/jobs/status";
import { recomputeMatchesForJobs } from "@/lib/matching";
import { requestIp, requireAdmin } from "@/lib/session";
import { endOfDhakaDayFromKey } from "@/lib/time";
import { notifyNewJobs } from "@/notifications/dispatch";
import { isTaskName, runTask, TASK_NAMES } from "@/tasks";
import { isValidCron, SCHEDULES_SETTING_KEY } from "@/tasks/schedules";

const id = z.string().min(1).max(40);

async function adminContext() {
  const user = await requireAdmin();
  return { actorId: user.id, ip: await requestIp() };
}

// ── Sources ────────────────────────────────────────────────────────────

export async function toggleSourceAction(formData: FormData) {
  const ctx = await adminContext();
  const sourceId = id.parse(formData.get("sourceId"));
  const source = await prisma.source.findUniqueOrThrow({ where: { id: sourceId } });
  await prisma.source.update({ where: { id: sourceId }, data: { enabled: !source.enabled } });
  await audit({ ...ctx, action: source.enabled ? "source.disabled" : "source.enabled", entity: "Source", entityId: sourceId, meta: { key: source.key } });
  revalidatePath("/admin/sources");
  revalidatePath("/admin");
}

export async function updateSourceIntervalAction(formData: FormData) {
  const ctx = await adminContext();
  const sourceId = id.parse(formData.get("sourceId"));
  const minutes = z.coerce.number().int().min(15).max(10_080).parse(formData.get("minutes"));
  await prisma.source.update({ where: { id: sourceId }, data: { fetchIntervalMinutes: minutes } });
  await audit({ ...ctx, action: "source.interval_changed", entity: "Source", entityId: sourceId, meta: { minutes } });
  revalidatePath("/admin/sources");
}

export async function runSourceNowAction(formData: FormData) {
  const ctx = await adminContext();
  const sourceId = id.parse(formData.get("sourceId"));
  const source = await prisma.source.findUniqueOrThrow({ where: { id: sourceId } });
  await audit({ ...ctx, action: "source.run_now", entity: "Source", entityId: sourceId, meta: { key: source.key } });
  const [result] = await runSources({ keys: [source.key], force: true, trigger: "admin" });
  if (result?.createdJobIds.length) {
    await recomputeMatchesForJobs(result.createdJobIds);
    await notifyNewJobs(result.createdJobIds);
  }
  revalidatePath("/admin/sources");
  revalidatePath(`/admin/sources/${sourceId}`);
}

// ── Jobs ───────────────────────────────────────────────────────────────

async function refreshJob(jobId: string) {
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId }, include: { links: { select: { sourceId: true } }, organization: { select: { slug: true } } } });
  const status = computeStatus({ ...job, manual: job.links.every((l) => l.sourceId == null) });
  await prisma.job.update({
    where: { id: jobId },
    data: { status, fingerprint: jobFingerprint(job.organization.slug, job.title, job.deadline), normalizedTitle: normalizeTitle(job.title) },
  });
  await recomputeMatchesForJobs([jobId]);
}

export async function reviewJobAction(formData: FormData) {
  const ctx = await adminContext();
  const jobId = id.parse(formData.get("jobId"));
  const decision = z.enum(["approve", "reject"]).parse(formData.get("decision"));
  await prisma.job.update({ where: { id: jobId }, data: { reviewStatus: decision === "approve" ? "APPROVED" : "REJECTED", lastVerifiedAt: new Date() } });
  await audit({ ...ctx, action: `job.${decision}d`, entity: "Job", entityId: jobId });
  if (decision === "approve") {
    await refreshJob(jobId);
    await notifyNewJobs([jobId]);
  }
  revalidatePath("/admin/jobs");
}

export async function archiveJobAction(formData: FormData) {
  const ctx = await adminContext();
  const jobId = id.parse(formData.get("jobId"));
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
  await prisma.job.update({ where: { id: jobId }, data: { archivedAt: job.archivedAt ? null : new Date() } });
  await audit({ ...ctx, action: job.archivedAt ? "job.unarchived" : "job.archived", entity: "Job", entityId: jobId });
  revalidatePath("/admin/jobs");
}

export async function deleteJobAction(formData: FormData) {
  const ctx = await adminContext();
  const jobId = id.parse(formData.get("jobId"));
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId }, select: { title: true } });
  await prisma.job.delete({ where: { id: jobId } });
  await audit({ ...ctx, action: "job.deleted", entity: "Job", entityId: jobId, meta: { title: job.title } });
  revalidatePath("/admin/jobs");
  redirect("/admin/jobs");
}

const triState = z
  .enum(["", "yes", "no"])
  .optional()
  .transform((v) => (v === "yes" ? true : v === "no" ? false : null));

const dateKey = z
  .string()
  .optional()
  .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? endOfDhakaDayFromKey(v) : null));

const jobEditSchema = z.object({
  title: z.string().trim().min(3).max(250),
  department: optionalText(200),
  category: z.enum(ALL_CATEGORIES as [string, ...string[]]),
  level: z.enum(["", ...ALL_LEVELS] as [string, ...string[]]).optional(),
  summary: z.string().trim().min(10).max(2000),
  location: optionalText(200),
  workMode: z.enum(ALL_WORK_MODES as [string, ...string[]]),
  salary: optionalText(200),
  vacancies: optionalNumber(1, 10_000),
  deadline: dateKey,
  applicationUrl: z.union([z.url().max(2000), z.literal("")]).optional(),
  educationDisciplines: csvList(20, 30),
  minCgpa: optionalNumber(0, 5),
  mastersRequired: triState,
  noThirdDivision: triState,
  minExperienceYears: optionalNumber(0, 40),
  maxExperienceYears: optionalNumber(0, 40),
  ageLimit: optionalNumber(18, 70),
  requiredSkills: csvList(),
  preferredSkills: csvList(),
});

function jobEditData(d: z.infer<typeof jobEditSchema>) {
  return {
    title: d.title,
    department: d.department ?? null,
    category: d.category as (typeof ALL_CATEGORIES)[number],
    level: (d.level || null) as (typeof ALL_LEVELS)[number] | null,
    summary: d.summary,
    location: d.location ?? null,
    workMode: d.workMode as (typeof ALL_WORK_MODES)[number],
    salary: d.salary ?? null,
    vacancies: d.vacancies ?? null,
    deadline: d.deadline,
    applicationUrl: d.applicationUrl || null,
    educationDisciplines: d.educationDisciplines.map((x) => x.toUpperCase()),
    minCgpa: d.minCgpa ?? null,
    mastersRequired: d.mastersRequired,
    noThirdDivision: d.noThirdDivision,
    minExperienceYears: d.minExperienceYears ?? null,
    maxExperienceYears: d.maxExperienceYears ?? null,
    ageLimit: d.ageLimit ?? null,
    requiredSkills: d.requiredSkills,
    preferredSkills: d.preferredSkills,
    requirementsParsed:
      d.educationDisciplines.length > 0 || d.minCgpa != null || d.mastersRequired != null || d.minExperienceYears != null || d.ageLimit != null || d.noThirdDivision != null,
  };
}

export async function updateJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await adminContext();
  const jobId = id.parse(formData.get("jobId"));
  const parsed = jobEditSchema.safeParse(formObject(formData));
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  await prisma.job.update({ where: { id: jobId }, data: { ...jobEditData(parsed.data), lastVerifiedAt: new Date() } });
  await refreshJob(jobId);
  await audit({ ...ctx, action: "job.edited", entity: "Job", entityId: jobId });
  revalidatePath("/admin/jobs");
  return { ok: true, message: "Job updated and eligibility recalculated." };
}

const manualJobSchema = z.object({
  title: z.string().trim().min(3).max(250),
  organizationSlug: z.string().min(1).max(80),
  sourceId: z.string().max(40).optional(),
  department: optionalText(200),
  applicationUrl: z.url().max(2000),
  sourceUrl: z.union([z.url().max(2000), z.literal("")]).optional(),
  deadline: dateKey,
  publishedAt: dateKey,
  location: optionalText(200),
  description: z.string().trim().min(20).max(20_000),
  vacancies: optionalNumber(1, 10_000),
  salary: optionalText(200),
});

/** Admin manual entry — used for sources marked "manual/API required". Requirements are extracted from the pasted text. */
export async function createManualJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await adminContext();
  const parsed = manualJobSchema.safeParse(formObject(formData));
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const d = parsed.data;
  const source = d.sourceId ? await prisma.source.findUnique({ where: { id: d.sourceId } }) : null;
  const outcome = await ingestOne(
    {
      title: d.title,
      organizationSlug: d.organizationSlug,
      department: d.department,
      description: `${d.title}\n${d.description}`,
      location: d.location,
      deadline: d.deadline,
      publishedAt: d.publishedAt,
      applicationUrl: d.applicationUrl,
      sourceUrl: d.sourceUrl || d.applicationUrl,
      vacancies: d.vacancies,
      salary: d.salary,
    },
    source ? { id: source.id, key: source.key, name: source.name } : { id: null, key: "admin-manual", name: "Manual entry (verified by admin)" },
    { reviewStatus: "APPROVED", skipRelevance: true },
  );
  await audit({ ...ctx, action: "job.manual_created", entity: "Job", entityId: outcome.jobId, meta: { outcome: outcome.action } });
  if (outcome.jobId) {
    await recomputeMatchesForJobs([outcome.jobId]);
    if (outcome.action === "created") await notifyNewJobs([outcome.jobId]);
  }
  revalidatePath("/admin/jobs");
  if (outcome.action === "created") return { ok: true, message: "Job created and published. Review the extracted requirements on its edit page." };
  if (outcome.action === "skipped") return { ok: false, message: `Not created: ${outcome.reason}` };
  return { ok: true, message: `Matched an existing job (${outcome.action}); the source link was added.` };
}

// ── Duplicates ─────────────────────────────────────────────────────────

export async function resolveDuplicateAction(formData: FormData) {
  const ctx = await adminContext();
  const dupId = id.parse(formData.get("duplicateId"));
  const decision = z.enum(["merge", "dismiss"]).parse(formData.get("decision"));
  const dup = await prisma.duplicateCandidate.findUniqueOrThrow({ where: { id: dupId } });
  if (decision === "merge") {
    const keep = dup.jobId;
    const drop = dup.candidateJobId;
    await prisma.$transaction(async (tx) => {
      await tx.jobSourceLink.updateMany({ where: { jobId: drop }, data: { jobId: keep } });
      for (const s of await tx.savedJob.findMany({ where: { jobId: drop } })) {
        await tx.savedJob.upsert({ where: { userId_jobId: { userId: s.userId, jobId: keep } }, update: {}, create: { userId: s.userId, jobId: keep } });
      }
      for (const a of await tx.application.findMany({ where: { jobId: drop } })) {
        const exists = await tx.application.findUnique({ where: { userId_jobId: { userId: a.userId, jobId: keep } } });
        if (!exists) await tx.application.update({ where: { id: a.id }, data: { jobId: keep } });
      }
      await tx.duplicateCandidate.update({ where: { id: dupId }, data: { status: "MERGED", resolvedAt: new Date() } });
      await tx.job.delete({ where: { id: drop } });
    });
  } else {
    await prisma.duplicateCandidate.update({ where: { id: dupId }, data: { status: "DISMISSED", resolvedAt: new Date() } });
  }
  await audit({ ...ctx, action: `duplicate.${decision}`, entity: "DuplicateCandidate", entityId: dupId });
  revalidatePath("/admin/duplicates");
}

// ── Reports, schedules, tasks ──────────────────────────────────────────

export async function resolveReportAction(formData: FormData) {
  const ctx = await adminContext();
  const reportId = id.parse(formData.get("reportId"));
  const status = z.enum(["RESOLVED", "DISMISSED"]).parse(formData.get("status"));
  await prisma.jobReport.update({ where: { id: reportId }, data: { status } });
  await audit({ ...ctx, action: `report.${status.toLowerCase()}`, entity: "JobReport", entityId: reportId });
  revalidatePath("/admin/reports");
}

export async function updateSchedulesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await adminContext();
  const values: Record<string, string> = {};
  for (const task of TASK_NAMES) {
    const expr = formData.get(task)?.toString().trim();
    if (!expr) continue;
    if (!isValidCron(expr)) return { ok: false, message: `Invalid cron expression for ${task}: "${expr}"` };
    values[task] = expr;
  }
  await prisma.setting.upsert({ where: { key: SCHEDULES_SETTING_KEY }, update: { value: values }, create: { key: SCHEDULES_SETTING_KEY, value: values } });
  await audit({ ...ctx, action: "schedules.updated", entity: "Setting", entityId: SCHEDULES_SETTING_KEY, meta: values });
  revalidatePath("/admin/sources");
  return { ok: true, message: "Schedules saved. The worker picks up changes within 5 minutes." };
}

export async function runTaskAction(formData: FormData) {
  const ctx = await adminContext();
  const task = String(formData.get("task"));
  if (!isTaskName(task)) throw new Error("Unknown task");
  await audit({ ...ctx, action: "task.run_now", entity: "Task", entityId: task });
  await runTask(task, "admin");
  revalidatePath("/admin");
  revalidatePath("/admin/sources");
}
