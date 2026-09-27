"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ingestOne } from "@/collectors/ingest";
import { ALL_APPLICATION_STATUSES, ALL_CATEGORIES, ALL_LEVELS, ALL_ORG_TYPES } from "@/lib/jobs/taxonomy";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { checkbox, csvList, firstIssue, formObject, optionalNumber, optionalText, safeRedirectPath, type ActionState } from "@/lib/forms";
import { recomputeMatchesForUser } from "@/lib/matching";
import { rateLimit } from "@/lib/rate-limit";
import { requestIp, requireUser } from "@/lib/session";
import { endOfDhakaDayFromKey } from "@/lib/time";

const id = z.string().min(1).max(40);

export async function toggleSaveAction(formData: FormData) {
  const user = await requireUser();
  const jobId = id.parse(formData.get("jobId"));
  const existing = await prisma.savedJob.findUnique({ where: { userId_jobId: { userId: user.id, jobId } } });
  if (existing) await prisma.savedJob.delete({ where: { id: existing.id } });
  else await prisma.savedJob.create({ data: { userId: user.id, jobId } });
  revalidatePath(safeRedirectPath(formData.get("path")?.toString(), "/saved"));
  revalidatePath("/saved");
}

const dateField = z
  .string()
  .optional()
  .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T09:00:00+06:00`) : null));

const applicationSchema = z.object({
  jobId: id,
  status: z.enum(ALL_APPLICATION_STATUSES as [string, ...string[]]),
  appliedAt: dateField,
  examDate: dateField,
  interviewDate: dateField,
  followUpAt: dateField,
  cvVersion: optionalText(200),
  coverLetter: optionalText(5000),
  notes: optionalText(5000),
});

export async function saveApplicationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = applicationSchema.safeParse(formObject(formData));
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const { jobId, status, ...rest } = parsed.data;
  const data = {
    status: status as (typeof ALL_APPLICATION_STATUSES)[number],
    appliedAt: rest.appliedAt,
    examDate: rest.examDate,
    interviewDate: rest.interviewDate,
    followUpAt: rest.followUpAt,
    cvVersion: rest.cvVersion ?? null,
    coverLetter: rest.coverLetter ?? null,
    notes: rest.notes ?? null,
  };
  await prisma.application.upsert({
    where: { userId_jobId: { userId: user.id, jobId } },
    update: data,
    create: { userId: user.id, jobId, ...data },
  });
  revalidatePath("/applications");
  return { ok: true, message: "Application tracker updated." };
}

export async function deleteApplicationAction(formData: FormData) {
  const user = await requireUser();
  const applicationId = id.parse(formData.get("applicationId"));
  await prisma.application.deleteMany({ where: { id: applicationId, userId: user.id } });
  revalidatePath("/applications");
}

const profileSchema = z.object({
  fullName: optionalText(120),
  location: optionalText(120),
  degree: optionalText(60),
  discipline: optionalText(120),
  university: optionalText(160),
  graduationYear: optionalNumber(1970, 2040),
  bachelorCgpa: optionalNumber(0, 5),
  cgpaScale: z.enum(["4", "5"]).default("4").transform(Number),
  hasMasters: checkbox,
  mastersDiscipline: optionalText(120),
  mastersCgpa: optionalNumber(0, 5),
  sscGpa: optionalNumber(0, 5),
  hscGpa: optionalNumber(0, 5),
  hasThirdDivision: checkbox,
  experienceYears: optionalNumber(0, 50),
  bankingExperience: checkbox,
  skills: csvList(),
  primaryFocus: z.enum(["", "software", "infrastructure", "security", "data"]).optional().transform((v) => v || undefined),
  preferredRoles: csvList(),
  preferredOrgSlugs: csvList(),
  preferredLocations: csvList(10),
  openToRemote: checkbox,
  minExpectedSalary: optionalNumber(0, 10_000_000),
  age: optionalNumber(16, 80),
  certifications: csvList(),
  currentEmployer: optionalText(160),
});

export async function saveProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(formObject(formData));
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const p = parsed.data;
  const data = {
    fullName: p.fullName ?? null,
    location: p.location ?? null,
    degree: p.degree ?? null,
    discipline: p.discipline ?? null,
    university: p.university ?? null,
    graduationYear: p.graduationYear ?? null,
    bachelorCgpa: p.bachelorCgpa ?? null,
    cgpaScale: p.cgpaScale,
    hasMasters: p.hasMasters,
    mastersDiscipline: p.mastersDiscipline ?? null,
    mastersCgpa: p.mastersCgpa ?? null,
    sscGpa: p.sscGpa ?? null,
    hscGpa: p.hscGpa ?? null,
    hasThirdDivision: p.hasThirdDivision,
    experienceYears: p.experienceYears ?? null,
    bankingExperience: p.bankingExperience,
    skills: p.skills,
    primaryFocus: p.primaryFocus ?? null,
    preferredRoles: p.preferredRoles,
    preferredOrgSlugs: p.preferredOrgSlugs,
    preferredLocations: p.preferredLocations,
    openToRemote: p.openToRemote,
    minExpectedSalary: p.minExpectedSalary ?? null,
    age: p.age ?? null,
    certifications: p.certifications,
    currentEmployer: p.currentEmployer ?? null,
  };
  await prisma.candidateProfile.upsert({ where: { userId: user.id }, update: data, create: { userId: user.id, ...data } });
  await recomputeMatchesForUser(user.id);
  revalidatePath("/", "layout");
  return { ok: true, message: "Profile saved. Eligibility for all open jobs has been recalculated." };
}

const enumList = <T extends string>(values: readonly T[]) =>
  z
    .string()
    .optional()
    .transform((v) => (v ?? "").split(",").filter((x): x is T => (values as readonly string[]).includes(x)));

const preferenceSchema = z.object({
  categories: enumList(ALL_CATEGORIES),
  orgTypes: enumList(ALL_ORG_TYPES),
  levels: enumList(ALL_LEVELS),
  organizationSlugs: csvList(60),
  locations: csvList(10),
  minMatchScore: optionalNumber(0, 100),
  academicOnly: checkbox,
  mode: z.enum(["IMMEDIATE", "DAILY_DIGEST"]),
  emailEnabled: checkbox,
  telegramEnabled: checkbox,
  telegramChatId: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined)
    .refine((v) => v == null || /^-?\d{3,20}$/.test(v), "Telegram chat ID must be numeric"),
  pushEnabled: checkbox,
  deadlineReminders: checkbox,
  closingSoonAlerts: checkbox,
});

export async function savePreferencesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = preferenceSchema.safeParse(formObject(formData));
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const p = parsed.data;
  if (p.telegramEnabled && !p.telegramChatId) return { ok: false, message: "Enter your Telegram chat ID to enable Telegram alerts." };
  const data = { ...p, minMatchScore: p.minMatchScore ?? 45, telegramChatId: p.telegramChatId ?? null };
  await prisma.notificationPreference.upsert({ where: { userId: user.id }, update: data, create: { userId: user.id, ...data } });
  revalidatePath("/settings/notifications");
  return { ok: true, message: "Notification settings saved." };
}

export async function markNotificationReadAction(formData: FormData) {
  const user = await requireUser();
  const notificationId = id.parse(formData.get("notificationId"));
  await prisma.notification.updateMany({ where: { id: notificationId, userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/notifications");
}

export async function markAllReadAction() {
  const user = await requireUser();
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/notifications");
}

const reportSchema = z.object({
  jobId: id,
  reason: z.enum(["expired", "wrong-information", "duplicate", "broken-link", "not-it-role", "other"]),
  details: optionalText(1000),
});

export async function reportJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const limited = await rateLimit(`report:${user.id}`, 10, 60 * 60);
  if (!limited.ok) return { ok: false, message: "Too many reports. Please try again later." };
  const parsed = reportSchema.safeParse(formObject(formData));
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  await prisma.jobReport.create({ data: { jobId: parsed.data.jobId, userId: user.id, reason: parsed.data.reason, details: parsed.data.details } });
  return { ok: true, message: "Thanks — an admin will review this report." };
}

const submitSchema = z.object({
  title: z.string().trim().min(4).max(200),
  organizationSlug: z.string().trim().min(1, "Choose the organisation").max(80),
  applicationUrl: z.url("Enter the official job/circular URL").max(2000),
  deadline: z
    .string()
    .optional()
    .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? endOfDhakaDayFromKey(v) : null)),
  location: optionalText(120),
  summary: z.string().trim().min(40, "Add a short summary including education and experience requirements").max(3000),
});

/** Manual submission for restricted sources (Bdjobs, LinkedIn, BB e-Recruitment…). Goes to the admin review queue. */
export async function submitJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/submit");
  const ip = await requestIp();
  const limited = await rateLimit(`submit:${user.id}`, 5, 60 * 60);
  if (!limited.ok) return { ok: false, message: "You can submit up to 5 jobs per hour." };
  const parsed = submitSchema.safeParse(formObject(formData));
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const d = parsed.data;
  const outcome = await ingestOne(
    {
      title: d.title,
      organizationSlug: d.organizationSlug,
      description: `${d.title}\n${d.summary}`,
      location: d.location,
      deadline: d.deadline,
      applicationUrl: d.applicationUrl,
      sourceUrl: d.applicationUrl,
    },
    { id: null, key: "user-submission", name: "Community submission (verified by admin)" },
    { reviewStatus: "PENDING", submittedById: user.id, skipLinkOnDuplicate: true },
  );
  await audit({ actorId: user.id, action: "job.submitted", entity: "Job", entityId: outcome.jobId, meta: { outcome: outcome.action }, ip });
  if (outcome.reason === "Already listed") return { ok: true, message: "This job is already listed — thank you!" };
  if (outcome.action !== "created") return { ok: false, message: `Not added: ${outcome.reason}. Only technology roles are listed.` };
  return { ok: true, message: "Submitted for review. An admin will verify it against the official source before it is published." };
}
