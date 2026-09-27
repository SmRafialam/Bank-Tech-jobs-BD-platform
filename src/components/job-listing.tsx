import Link from "next/link";
import { JobCard } from "@/components/job-card";
import { JobFiltersForm } from "@/components/job-filters";
import { Button } from "@/components/ui/button";
import { parseJobFilters, searchJobs, type JobFilters } from "@/lib/queries/jobs";
import { currentUser } from "@/lib/session";

type SearchParams = Record<string, string | string[] | undefined>;

function pageHref(path: string, params: SearchParams, page: number) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === "page" || v == null) continue;
    for (const item of Array.isArray(v) ? v : [v]) usp.append(k, item);
  }
  if (page > 1) usp.set("page", String(page));
  const qs = usp.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Shared server-rendered listing used by /jobs and every preset landing page. */
export async function JobListing({
  path,
  searchParams,
  preset = {},
  locked = [],
  title,
  description,
}: {
  path: string;
  searchParams: SearchParams;
  preset?: Partial<JobFilters>;
  locked?: (keyof JobFilters)[];
  title: string;
  description: string;
}) {
  const user = await currentUser();
  const parsed = parseJobFilters(searchParams);
  const filters: JobFilters = { ...parsed };
  for (const [key, value] of Object.entries(preset) as [keyof JobFilters, never][]) {
    const current = filters[key];
    const isEmpty = current == null || (Array.isArray(current) && current.length === 0);
    if (locked.includes(key) || isEmpty) (filters as Record<string, unknown>)[key] = value;
  }
  const { items, total, page, pageCount } = await searchJobs(filters, user?.id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">{title}</h1>
        <p className="mt-1 max-w-3xl text-slate-600">{description}</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside>
          <details className="lg:hidden">
            <summary className="mb-3 cursor-pointer rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium">Show filters</summary>
            <JobFiltersForm filters={filters} action={path} signedIn={Boolean(user)} locked={locked} idPrefix="fm" />
          </details>
          <div className="hidden lg:block">
            <JobFiltersForm filters={filters} action={path} signedIn={Boolean(user)} locked={locked} />
          </div>
        </aside>
        <section aria-label="Results">
          <p className="mb-3 text-sm text-slate-600" aria-live="polite">
            {total} job{total === 1 ? "" : "s"} found
          </p>
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
              <p className="font-medium">No jobs match these filters.</p>
              <p className="mt-1 text-sm">Try removing a filter, or create a job alert to be notified when one is published.</p>
              <Button asChild className="mt-4">
                <Link href="/settings/notifications">Create job alert</Link>
              </Button>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((job) => (
                <li key={job.id}>
                  <JobCard job={job} signedIn={Boolean(user)} path={path} />
                </li>
              ))}
            </ul>
          )}
          {pageCount > 1 ? (
            <nav className="mt-6 flex items-center justify-between" aria-label="Pagination">
              {page > 1 ? (
                <Button asChild variant="outline">
                  <Link href={pageHref(path, searchParams, page - 1)} rel="prev">
                    Previous
                  </Link>
                </Button>
              ) : (
                <span />
              )}
              <span className="text-sm text-slate-600">
                Page {page} of {pageCount}
              </span>
              {page < pageCount ? (
                <Button asChild variant="outline">
                  <Link href={pageHref(path, searchParams, page + 1)} rel="next">
                    Next
                  </Link>
                </Button>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </section>
      </div>
    </div>
  );
}
