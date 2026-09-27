import type { Metadata } from "next";
import { JobCard } from "@/components/job-card";
import { prisma } from "@/lib/db";
import { decorate, jobListInclude } from "@/lib/queries/jobs";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Saved jobs" };

export default async function SavedPage() {
  const user = await requireUser("/saved");
  const saved = await prisma.savedJob.findMany({
    where: { userId: user.id, job: { archivedAt: null } },
    include: { job: { include: jobListInclude } },
    orderBy: [{ job: { deadline: { sort: "asc", nulls: "last" } } }],
  });
  const jobs = await decorate(saved.map((s) => s.job), user.id);
  return (
    <div>
      <h1 className="text-2xl font-bold text-navy-900">Saved jobs</h1>
      <p className="mb-4 text-slate-600">Sorted by deadline. You get reminders 7 days, 3 days, 24 hours and 6 hours before each deadline (configurable).</p>
      {jobs.length ? (
        <ul className="flex flex-col gap-3">
          {jobs.map((j) => (
            <li key={j.id}>
              <JobCard job={j} signedIn path="/saved" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">No saved jobs yet. Use the bookmark icon on any job.</p>
      )}
    </div>
  );
}
