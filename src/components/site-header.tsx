import { Bell, Landmark, LogOut, Menu, Shield, UserRound } from "lucide-react";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";

const NAV = [
  { href: "/jobs", label: "All jobs" },
  { href: "/new-jobs", label: "New" },
  { href: "/closing-soon", label: "Closing soon" },
  { href: "/software-jobs", label: "Software" },
  { href: "/organizations", label: "Banks" },
  { href: "/calendar", label: "Calendar" },
];

export async function SiteHeader() {
  const user = await currentUser();
  const unread = user ? await prisma.notification.count({ where: { userId: user.id, readAt: null } }) : 0;

  const account = user ? (
    <div className="flex items-center gap-1">
      <Button asChild variant="ghost" size="icon" className="relative text-white hover:bg-white/10">
        <Link href="/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
          <Bell />
          {unread ? (
            <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-5 text-white">{unread > 99 ? "99+" : unread}</span>
          ) : null}
        </Link>
      </Button>
      {user.role === "ADMIN" ? (
        <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/10">
          <Link href="/admin">
            <Shield /> Admin
          </Link>
        </Button>
      ) : null}
      <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/10">
        <Link href="/dashboard">
          <UserRound /> Dashboard
        </Link>
      </Button>
      <form action={logoutAction}>
        <Button type="submit" variant="ghost" size="icon" className="text-white hover:bg-white/10" aria-label="Sign out" title="Sign out">
          <LogOut />
        </Button>
      </form>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/10">
        <Link href="/login">Sign in</Link>
      </Button>
      <Button asChild size="sm" className="bg-white text-navy-900 hover:bg-navy-50">
        <Link href="/register">Create alert</Link>
      </Button>
    </div>
  );

  return (
    <header className="bg-navy-900 text-white">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="grid size-8 place-items-center rounded-md bg-blue-600">
            <Landmark className="size-5" aria-hidden />
          </span>
          <span>
            BankTech <span className="text-blue-300">Jobs BD</span>
          </span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-md px-3 py-2 text-sm text-navy-100 hover:bg-white/10 hover:text-white">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden sm:block">{account}</div>
        <details className="relative sm:hidden">
          <summary className="list-none rounded-md p-2 hover:bg-white/10" aria-label="Open menu">
            <Menu aria-hidden />
          </summary>
          <div className="absolute right-0 z-40 mt-2 w-64 rounded-lg bg-navy-950 p-3 shadow-xl">
            <nav aria-label="Mobile" className="flex flex-col">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-md px-3 py-2 text-sm hover:bg-white/10">
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="mt-3 border-t border-white/10 pt-3">{account}</div>
          </div>
        </details>
      </div>
      <nav aria-label="Main (compact)" className="flex gap-1 overflow-x-auto border-t border-white/10 px-4 py-1 sm:flex lg:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-md px-2 py-1 text-xs text-navy-100 hover:bg-white/10">
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm text-slate-600 sm:grid-cols-3">
        <div>
          <p className="font-semibold text-navy-900">BankTech Jobs BD</p>
          <p className="mt-2">
            An independent aggregator of technology jobs at banks, NBFIs, fintechs and government recruiters in Bangladesh. Always apply on the
            official site and verify every detail against the original circular.
          </p>
        </div>
        <div>
          <p className="font-semibold text-navy-900">Browse</p>
          <ul className="mt-2 grid grid-cols-2 gap-1">
            <li><Link href="/public-bank-jobs" className="hover:underline">Public bank jobs</Link></li>
            <li><Link href="/private-bank-jobs" className="hover:underline">Private bank jobs</Link></li>
            <li><Link href="/software-jobs" className="hover:underline">Software</Link></li>
            <li><Link href="/infrastructure-jobs" className="hover:underline">Infrastructure</Link></li>
            <li><Link href="/security-jobs" className="hover:underline">Security</Link></li>
            <li><Link href="/calendar" className="hover:underline">Deadline calendar</Link></li>
            <li><Link href="/submit" className="hover:underline">Submit a job link</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-navy-900">About</p>
          <ul className="mt-2 flex flex-col gap-1">
            <li><Link href="/about" className="hover:underline">About &amp; disclaimer</Link></li>
            <li><Link href="/privacy" className="hover:underline">Privacy policy</Link></li>
            <li><Link href="/terms" className="hover:underline">Terms of use</Link></li>
          </ul>
          <p className="mt-3 text-xs">All times are Bangladesh Standard Time (Asia/Dhaka, UTC+6).</p>
        </div>
      </div>
    </footer>
  );
}
