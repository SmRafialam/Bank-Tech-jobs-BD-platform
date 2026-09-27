import Link from "next/link";
import { requireAdmin } from "@/lib/session";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/sources", label: "Sources & schedules" },
  { href: "/admin/jobs", label: "Jobs & review" },
  { href: "/admin/jobs/new", label: "Add job manually" },
  { href: "/admin/duplicates", label: "Duplicate queue" },
  { href: "/admin/reports", label: "User reports" },
  { href: "/admin/notifications", label: "Notification log" },
  { href: "/admin/audit", label: "Audit log" },
];

export const metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-8 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Admin" className="flex gap-1 overflow-x-auto lg:flex-col">
        <p className="hidden px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:block">Administration</p>
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
