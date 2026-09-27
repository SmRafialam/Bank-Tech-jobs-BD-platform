import type { Metadata } from "next";
import { JobListing } from "@/components/job-listing";

export const metadata: Metadata = {
  title: "Private & foreign bank IT jobs",
  description: "IT roles at private commercial and foreign banks operating in Bangladesh.",
  alternates: { canonical: "/private-bank-jobs" },
};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <JobListing
      path="/private-bank-jobs"
      searchParams={await searchParams}
      title="Private & foreign bank IT jobs"
      description="IT roles at private commercial and foreign banks operating in Bangladesh."
      preset={{ orgType: ["PRIVATE_BANK", "FOREIGN_BANK"] }}
      locked={["orgType"]}
    />
  );
}
