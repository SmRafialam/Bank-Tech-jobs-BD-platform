import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { dhakaDateKey } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Deadline calendar",
  description: "Application deadlines of technology jobs at Bangladeshi banks and financial institutions, in Bangladesh time.",
  alternates: { canonical: "/calendar" },
};

const WEEKDAYS = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"]; // Bangladesh week starts on Saturday

function monthParam(value: string | undefined, today: string) {
  return value && /^\d{4}-\d{2}$/.test(value) ? value : today.slice(0, 7);
}

function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const today = dhakaDateKey(new Date());
  const ym = monthParam((await searchParams).month, today);
  const [year, month] = ym.split("-").map(Number);
  const start = new Date(`${ym}-01T00:00:00+06:00`);
  const end = new Date(`${shiftMonth(ym, 1)}-01T00:00:00+06:00`);

  const jobs = await prisma.job.findMany({
    where: { archivedAt: null, reviewStatus: "APPROVED", deadline: { gte: start, lt: end } },
    orderBy: { deadline: "asc" },
    select: { slug: true, title: true, deadline: true, status: true, organization: { select: { shortName: true, name: true } } },
  });
  const byDay = new Map<string, typeof jobs>();
  for (const j of jobs) {
    const key = dhakaDateKey(j.deadline!);
    byDay.set(key, [...(byDay.get(key) ?? []), j]);
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0 = Sunday
  const offset = (firstWeekday + 1) % 7; // Saturday-first grid
  const cells: (string | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);
  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">Deadline calendar</h1>
          <p className="text-slate-600">All deadlines are shown in Bangladesh Standard Time (UTC+6).</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon">
            <Link href={`/calendar?month=${shiftMonth(ym, -1)}`} aria-label="Previous month">
              <ChevronLeft />
            </Link>
          </Button>
          <span className="min-w-36 text-center font-semibold" aria-live="polite">
            {monthLabel}
          </span>
          <Button asChild variant="outline" size="icon">
            <Link href={`/calendar?month=${shiftMonth(ym, 1)}`} aria-label="Next month">
              <ChevronRight />
            </Link>
          </Button>
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold uppercase text-slate-500">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((key, i) => (
            <div key={key ?? `empty-${i}`} className={cn("min-h-28 border-b border-r border-slate-100 p-1.5", !key && "bg-slate-50/60", key === today && "bg-blue-50")}>
              {key ? (
                <>
                  <p className={cn("text-xs font-semibold text-slate-500", key === today && "text-blue-700")}>{Number(key.slice(-2))}</p>
                  <ul className="mt-1 flex flex-col gap-1">
                    {(byDay.get(key) ?? []).map((j) => (
                      <li key={j.slug}>
                        <Link
                          href={`/jobs/${j.slug}`}
                          className={cn(
                            "block truncate rounded px-1.5 py-0.5 text-xs",
                            j.status === "EXPIRED" ? "bg-slate-100 text-slate-500 line-through" : j.status === "CLOSING_SOON" ? "bg-red-50 text-red-800" : "bg-navy-50 text-navy-800",
                          )}
                          title={`${j.title} — ${j.organization.name}`}
                        >
                          {j.organization.shortName ?? j.organization.name}: {j.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <section className="md:hidden" aria-label="Deadlines this month">
        {jobs.length === 0 ? <p className="text-slate-600">No deadlines this month.</p> : null}
        <ol className="flex flex-col gap-3">
          {[...byDay.entries()].map(([day, list]) => (
            <li key={day} className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-sm font-semibold text-red-700">{new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`))}</p>
              <ul className="mt-1 flex flex-col gap-1">
                {list.map((j) => (
                  <li key={j.slug}>
                    <Link href={`/jobs/${j.slug}`} className="text-sm text-navy-900 hover:underline">
                      {j.title} — {j.organization.shortName ?? j.organization.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
