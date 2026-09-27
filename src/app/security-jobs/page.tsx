import type { Metadata } from "next";
import { JobListing } from "@/components/job-listing";
import { CATEGORY_GROUPS } from "@/lib/jobs/taxonomy";

export const metadata: Metadata = {
  title: "Security jobs",
  description: "Cybersecurity, SOC, information security, IT audit, risk and compliance roles.",
  alternates: { canonical: "/security-jobs" },
};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <JobListing
      path="/security-jobs"
      searchParams={await searchParams}
      title="Security jobs"
      description="Cybersecurity, SOC, information security, IT audit, risk and compliance roles."
      preset={{ category: [...CATEGORY_GROUPS.security] }}
      locked={["category"]}
    />
  );
}
