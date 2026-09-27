import type { Metadata } from "next";
import { JobListing } from "@/components/job-listing";

export const metadata: Metadata = {
  title: "New jobs",
  description: "Technology jobs discovered in the last 7 days.",
  alternates: { canonical: "/new-jobs" },
};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <JobListing
      path="/new-jobs"
      searchParams={await searchParams}
      title="New jobs"
      description="Technology jobs discovered in the last 7 days."
      preset={{ published: "7d", sort: "newest" }}
      locked={["published"]}
    />
  );
}
