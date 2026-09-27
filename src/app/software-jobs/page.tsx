import type { Metadata } from "next";
import { JobListing } from "@/components/job-listing";
import { CATEGORY_GROUPS } from "@/lib/jobs/taxonomy";

export const metadata: Metadata = {
  title: "Software jobs",
  description: "Software development, application support, QA, digital banking, data and MIS roles.",
  alternates: { canonical: "/software-jobs" },
};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <JobListing
      path="/software-jobs"
      searchParams={await searchParams}
      title="Software jobs"
      description="Software development, application support, QA, digital banking, data and MIS roles."
      preset={{ category: [...CATEGORY_GROUPS.software] }}
      locked={["category"]}
    />
  );
}
