import type { Metadata } from "next";
import { JobListing } from "@/components/job-listing";

export const metadata: Metadata = {
  title: "All IT jobs",
  description: "All open technology jobs at banks, NBFIs, fintechs and government recruiters in Bangladesh.",
  alternates: { canonical: "/jobs" },
};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <JobListing
      path="/jobs"
      searchParams={await searchParams}
      title="All IT jobs"
      description="All open technology jobs at banks, NBFIs, fintechs and government recruiters in Bangladesh."
      preset={{}}
      locked={[]}
    />
  );
}
