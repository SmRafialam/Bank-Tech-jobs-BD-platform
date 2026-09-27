import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { ACTIVE_STATUSES } from "@/lib/jobs/status";

export const dynamic = "force-dynamic";

const STATIC = ["/", "/jobs", "/new-jobs", "/closing-soon", "/public-bank-jobs", "/private-bank-jobs", "/software-jobs", "/infrastructure-jobs", "/security-jobs", "/organizations", "/calendar", "/about", "/privacy", "/terms"];

/** Only active, approved, non-demo jobs are listed — expired jobs drop out of the sitemap. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [jobs, orgs] = await Promise.all([
    prisma.job.findMany({
      where: { archivedAt: null, reviewStatus: "APPROVED", isDemo: false, status: { in: ACTIVE_STATUSES } },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    }),
    prisma.organization.findMany({ select: { slug: true, updatedAt: true } }),
  ]);
  return [
    ...STATIC.map((path) => ({ url: appUrl(path), changeFrequency: "hourly" as const, priority: path === "/" ? 1 : 0.7 })),
    ...orgs.map((o) => ({ url: appUrl(`/organizations/${o.slug}`), lastModified: o.updatedAt, changeFrequency: "daily" as const, priority: 0.5 })),
    ...jobs.map((j) => ({ url: appUrl(`/jobs/${j.slug}`), lastModified: j.updatedAt, changeFrequency: "daily" as const, priority: 0.8 })),
  ];
}
