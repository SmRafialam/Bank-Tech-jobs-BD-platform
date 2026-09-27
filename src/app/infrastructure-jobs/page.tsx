import type { Metadata } from "next";
import { JobListing } from "@/components/job-listing";
import { CATEGORY_GROUPS } from "@/lib/jobs/taxonomy";

export const metadata: Metadata = {
  title: "Infrastructure jobs",
  description: "IT infrastructure, network, database, cloud/DevOps and card/payment systems roles.",
  alternates: { canonical: "/infrastructure-jobs" },
};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <JobListing
      path="/infrastructure-jobs"
      searchParams={await searchParams}
      title="Infrastructure jobs"
      description="IT infrastructure, network, database, cloud/DevOps and card/payment systems roles."
      preset={{ category: [...CATEGORY_GROUPS.infrastructure] }}
      locked={["category"]}
    />
  );
}
