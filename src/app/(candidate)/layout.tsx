import Link from "next/link";
import { requireUser } from "@/lib/session";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/saved", label: "Saved jobs" },
  { href: "/applications", label: "Application tracker" },
  { href: "/notifications", label: "Notifications" },
  { href: "/settings/profile", label: "Profile & eligibility" },
  { href: "/settings/notifications", label: "Alert settings" },
  { href: "/submit", label: "Submit a job link" },
];

export const metadata = { robots: { index: false } };

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Account" className="flex gap-1 overflow-x-auto lg:flex-col">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="whitespace-nowrap rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-white hover:text-navy-900">
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
