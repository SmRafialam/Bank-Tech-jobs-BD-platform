import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JobListing } from "@/components/job-listing";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { ORG_TYPE_LABELS } from "@/lib/jobs/taxonomy";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const org = await prisma.organization.findUnique({ where: { slug: (await params).slug } });
  if (!org) return { title: "Organisation not found" };
  return {
    title: `${org.name} IT jobs`,
    description: `Technology jobs at ${org.name} — IT officer, software, infrastructure and security roles with deadlines and eligibility.`,
    alternates: { canonical: `/organizations/${org.slug}` },
  };
}

export default async function OrganizationPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const org = await prisma.organization.findUnique({ where: { slug }, include: { sources: { select: { name: true, url: true, method: true, complianceNote: true } } } });
  if (!org) notFound();
  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pt-8">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{ORG_TYPE_LABELS[org.type]}</Badge>
            {org.website ? (
              <a href={org.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline">
                Official website <ExternalLink className="size-3.5" aria-hidden />
              </a>
            ) : null}
            {org.careersUrl ? (
              <a href={org.careersUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline">
                Official careers page <ExternalLink className="size-3.5" aria-hidden />
              </a>
            ) : null}
          </div>
          {org.sources.length ? (
            <ul className="mt-3 flex flex-col gap-1 text-sm text-slate-600">
              {org.sources.map((s) => (
                <li key={s.url + s.name}>
                  <span className="font-medium text-slate-800">{s.name}</span> — {s.method === "MANUAL" ? "manual/API required" : `automated (${s.method.toLowerCase()})`}
                  {s.complianceNote ? <span className="block text-xs text-slate-500">{s.complianceNote}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      <JobListing
        path={`/organizations/${org.slug}`}
        searchParams={await searchParams}
        title={`${org.name} — technology jobs`}
        description={`Open IT and technology positions at ${org.name}.`}
        preset={{ org: org.slug }}
        locked={["org"]}
      />
    </>
  );
}
