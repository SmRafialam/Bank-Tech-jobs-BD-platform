import type { Metadata } from "next";
import { JobListing } from "@/components/job-listing";

export const metadata: Metadata = {
  title: "Closing soon",
  description: "Jobs whose application deadline is within the next 3 days (Bangladesh time).",
  alternates: { canonical: "/closing-soon" },
};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <JobListing
      path="/closing-soon"
      searchParams={await searchParams}
      title="Closing soon"
      description="Jobs whose application deadline is within the next 3 days (Bangladesh time)."
      preset={{ deadline: "3d", sort: "deadline" }}
      locked={["deadline"]}
    />
  );
}
