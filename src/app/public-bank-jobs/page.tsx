import type { Metadata } from "next";
import { JobListing } from "@/components/job-listing";

export const metadata: Metadata = {
  title: "Public bank & government IT jobs",
  description: "IT roles at state-owned banks, Bangladesh Bank and government recruiters (BSCS and others).",
  alternates: { canonical: "/public-bank-jobs" },
};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <JobListing
      path="/public-bank-jobs"
      searchParams={await searchParams}
      title="Public bank & government IT jobs"
      description="IT roles at state-owned banks, Bangladesh Bank and government recruiters (BSCS and others)."
      preset={{ orgType: ["PUBLIC_BANK", "GOVERNMENT"] }}
      locked={["orgType"]}
    />
  );
}
