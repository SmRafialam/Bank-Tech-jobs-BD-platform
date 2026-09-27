import { BellRing, Briefcase, CalendarClock, Clock, Landmark, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { DeadlineText, MatchBadge } from "@/components/badges";
import { JobCard } from "@/components/job-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { ACTIVE_STATUSES } from "@/lib/jobs/status";
import { ALL_CATEGORIES, CATEGORY_DESCRIPTIONS, CATEGORY_LABELS } from "@/lib/jobs/taxonomy";
import { decorate, homeStats, jobListInclude } from "@/lib/queries/jobs";
import { currentUser } from "@/lib/session";
import { dhakaDateKey, formatDhakaDate } from "@/lib/time";

const activeWhere = { archivedAt: null, reviewStatus: "APPROVED" as const, status: { in: ACTIVE_STATUSES } };

function Stat({ icon: Icon, label, value, href }: { icon: typeof Briefcase; label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-xl border border-white/15 bg-white/5 p-4 transition hover:bg-white/10">
      <Icon aria-hidden className="size-5 text-blue-300" />
      <p className="mt-2 text-2xl font-bold">{value}</p>
      <p className="text-sm text-navy-100">{label}</p>
    </Link>
  );
}

export default async function HomePage() {
  const user = await currentUser();
  const [stats, latestRaw, categoryCounts, orgs, upcoming, bestMatches] = await Promise.all([
    homeStats(),
    prisma.job.findMany({ where: activeWhere, orderBy: { firstDiscoveredAt: "desc" }, take: 6, include: jobListInclude }),
    prisma.job.groupBy({ by: ["category"], where: activeWhere, _count: { _all: true } }),
    prisma.organization.findMany({
      where: { jobs: { some: activeWhere } },
      select: { slug: true, name: true, shortName: true, _count: { select: { jobs: { where: activeWhere } } } },
      orderBy: { name: "asc" },
    }),
    prisma.job.findMany({
      where: { ...activeWhere, deadline: { gte: new Date() } },
      orderBy: { deadline: "asc" },
      take: 8,
      select: { slug: true, title: true, deadline: true, organization: { select: { shortName: true, name: true } } },
    }),
    user
      ? prisma.matchResult.findMany({
          where: { userId: user.id, verdict: { in: ["STRONG", "POSSIBLE"] }, job: activeWhere },
          orderBy: { score: "desc" },
          take: 5,
          include: { job: { select: { slug: true, title: true, deadline: true, organization: { select: { name: true } } } } },
        })
      : Promise.resolve([]),
  ]);
  const latest = await decorate(latestRaw, user?.id);
  const countFor = (c: string) => categoryCounts.find((x) => x.category === c)?._count._all ?? 0;

  return (
    <>
      <section className="bg-gradient-to-b from-navy-900 to-navy-800 text-white">
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-10 sm:pt-16">
          <h1 className="max-w-3xl text-3xl font-bold leading-tight sm:text-5xl">Technology jobs at Bangladeshi banks, NBFIs and fintechs — in one place.</h1>
          <p className="mt-4 max-w-2xl text-lg text-navy-100">
            IT Officer, software, application support, network, security, data and digital banking roles, with deadlines in Bangladesh time and an
            honest eligibility check for your profile.
          </p>
          <form action="/jobs" method="get" role="search" className="mt-8 flex max-w-2xl flex-col gap-2 sm:flex-row">
            <label htmlFor="home-q" className="sr-only">
              Search jobs
            </label>
            <div className="relative flex-1">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
              <input
                id="home-q"
                name="q"
                placeholder="Try “Angular”, “IT Officer”, “core banking” or a bank name"
                className="h-12 w-full rounded-lg border-0 bg-white pl-10 pr-3 text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-400"
              />
            </div>
            <Button type="submit" size="lg" variant="primary">
              Search jobs
            </Button>
          </form>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={Briefcase} label="Open jobs" value={stats.open} href="/jobs" />
            <Stat icon={Sparkles} label="Added today" value={stats.today} href="/new-jobs" />
            <Stat icon={Clock} label="Closing soon" value={stats.closing} href="/closing-soon" />
            <Stat icon={Landmark} label="Organisations tracked" value={stats.orgs} href="/organizations" />
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-10">
          {user ? (
            <section aria-labelledby="best-heading">
              <div className="mb-3 flex items-end justify-between">
                <h2 id="best-heading" className="text-xl font-bold text-navy-900">
                  Best matches for you
                </h2>
                <Link href="/jobs?sort=match" className="text-sm font-medium text-blue-700 hover:underline">
                  See all
                </Link>
              </div>
              {bestMatches.length ? (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                  {bestMatches.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                      <div>
                        <Link href={`/jobs/${m.job.slug}`} className="font-medium text-navy-900 hover:underline">
                          {m.job.title}
                        </Link>
                        <p className="text-sm text-slate-600">{m.job.organization.name}</p>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <MatchBadge verdict={m.verdict} score={m.score} />
                        <DeadlineText deadline={m.job.deadline} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
                  No strong or possible matches yet.{" "}
                  <Link href="/settings/profile" className="font-medium text-blue-700 underline">
                    Complete your profile
                  </Link>{" "}
                  to get personalised matches.
                </p>
              )}
            </section>
          ) : null}

          <section aria-labelledby="latest-heading">
            <div className="mb-3 flex items-end justify-between">
              <h2 id="latest-heading" className="text-xl font-bold text-navy-900">
                Latest jobs
              </h2>
              <Link href="/new-jobs" className="text-sm font-medium text-blue-700 hover:underline">
                All new jobs
              </Link>
            </div>
            {latest.length ? (
              <ul className="grid gap-3 md:grid-cols-2">
                {latest.map((job) => (
                  <li key={job.id}>
                    <JobCard job={job} signedIn={Boolean(user)} path="/" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-600">No open jobs yet. Collectors run every few hours.</p>
            )}
          </section>

          <section aria-labelledby="categories-heading">
            <h2 id="categories-heading" className="mb-3 text-xl font-bold text-navy-900">
              Browse by category
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {ALL_CATEGORIES.map((c) => (
                <li key={c}>
                  <Link href={`/jobs?category=${c}`} className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-300">
                    <span className="flex items-center justify-between font-semibold text-navy-900">
                      {CATEGORY_LABELS[c]}
                      <span className="rounded-full bg-navy-50 px-2 text-xs text-navy-800">{countFor(c)}</span>
                    </span>
                    <span className="mt-1 text-sm text-slate-600">{CATEGORY_DESCRIPTIONS[c]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BellRing aria-hidden className="size-5 text-blue-700" /> Create a job alert
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-700">Email, Telegram or browser alerts for new matching jobs, plus reminders 7 days, 3 days, 24 hours and 6 hours before deadlines.</p>
              <Button asChild className="mt-4 w-full">
                <Link href={user ? "/settings/notifications" : "/register"}>{user ? "Manage alerts" : "Create free alert"}</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock aria-hidden className="size-5 text-red-600" /> Upcoming deadlines
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length ? (
                <ol className="relative flex flex-col gap-4 border-l border-slate-200 pl-4">
                  {upcoming.map((j) => (
                    <li key={j.slug}>
                      <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-white bg-red-500" aria-hidden />
                      <time dateTime={j.deadline ? dhakaDateKey(j.deadline) : undefined} className="text-xs font-semibold uppercase text-red-700">
                        {formatDhakaDate(j.deadline)}
                      </time>
                      <Link href={`/jobs/${j.slug}`} className="block text-sm font-medium text-navy-900 hover:underline">
                        {j.title}
                      </Link>
                      <span className="text-xs text-slate-500">{j.organization.shortName ?? j.organization.name}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-slate-600">No upcoming deadlines.</p>
              )}
              <Link href="/calendar" className="mt-4 inline-block text-sm font-medium text-blue-700 hover:underline">
                Open deadline calendar
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Banks &amp; organisations</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-wrap gap-2">
                {orgs.map((o) => (
                  <li key={o.slug}>
                    <Link href={`/jobs?org=${o.slug}`} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-sm hover:border-blue-300 hover:bg-blue-50">
                      {o.shortName ?? o.name}
                      <span className="text-xs text-slate-500">{o._count.jobs}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/organizations" className="mt-4 inline-block text-sm font-medium text-blue-700 hover:underline">
                All organisations
              </Link>
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
