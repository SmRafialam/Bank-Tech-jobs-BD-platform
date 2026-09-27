import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { ACTIVE_STATUSES } from "@/lib/jobs/status";
import { ALL_ORG_TYPES, ORG_TYPE_LABELS } from "@/lib/jobs/taxonomy";

export const metadata: Metadata = {
  title: "Banks and organisations",
  description: "Banks, NBFIs, fintechs and government recruiters tracked by BankTech Jobs BD, with their open technology jobs and collection method.",
  alternates: { canonical: "/organizations" },
};

export default async function OrganizationsPage() {
  const orgs = await prisma.organization.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { jobs: { where: { archivedAt: null, reviewStatus: "APPROVED", status: { in: ACTIVE_STATUSES } } } } },
      sources: { select: { method: true, enabled: true } },
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">Banks and organisations</h1>
      <p className="mt-1 max-w-3xl text-slate-600">
        “Automated” means we collect from the official career page within its robots.txt rules. “Manual” means the source cannot be collected
        automatically (crawling disallowed, login or firewall) — jobs are added by verified manual submission.
      </p>
      {ALL_ORG_TYPES.map((type) => {
        const group = orgs.filter((o) => o.type === type);
        if (!group.length) return null;
        return (
          <section key={type} className="mt-8" aria-labelledby={`h-${type}`}>
            <h2 id={`h-${type}`} className="mb-3 text-lg font-semibold text-navy-900">
              {ORG_TYPE_LABELS[type]}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.map((o) => {
                const automated = o.sources.some((s) => s.method !== "MANUAL" && s.enabled);
                return (
                  <li key={o.slug}>
                    <Link href={`/organizations/${o.slug}`} className="flex h-full flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-300">
                      <span className="font-semibold text-navy-900">{o.name}</span>
                      <span className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                        <Badge variant={o._count.jobs ? "success" : "muted"}>{o._count.jobs} open</Badge>
                        {o.sources.length ? <Badge variant={automated ? "info" : "outline"}>{automated ? "Automated" : "Manual"}</Badge> : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
