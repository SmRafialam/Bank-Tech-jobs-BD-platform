import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/prose";

export const metadata: Metadata = {
  title: "About and disclaimer",
  description: "How BankTech Jobs BD collects jobs, checks eligibility and respects source websites.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <Prose title="About BankTech Jobs BD" updated="27 September 2026">
      <p>
        BankTech Jobs BD helps CSE, IT, SWE, EEE and ECE graduates find technology roles at Bangladeshi public, private and foreign banks, NBFIs,
        fintechs and government recruiters — IT Officer, software engineering, application support, infrastructure, network, security, data, MIS,
        digital banking and payment technology.
      </p>
      <h2>How jobs are collected</h2>
      <ul>
        <li>We prefer official APIs, RSS feeds, structured data (schema.org JobPosting) and official career pages.</li>
        <li>Every automated request checks the site&apos;s robots.txt first, identifies itself with a descriptive user agent, and is rate-limited per domain with retries and exponential backoff.</li>
        <li>We never log in, never bypass CAPTCHA, Cloudflare, firewalls or other access controls, and never scrape private LinkedIn or Bdjobs account data.</li>
        <li>Sources that cannot be collected automatically are marked “manual/API required”; jobs from them are added by verified manual submission with a link to the official page.</li>
        <li>We store a short normalised summary and a link to the source — not a copy of the full circular.</li>
      </ul>
      <h2>Eligibility checks</h2>
      <p>
        The eligibility result compares your profile with the requirements we could read (degree, CGPA, Master&apos;s, SSC/HSC, third division/class,
        experience, age). When a requirement is missing we say “Not specified” or “Manual review required” — we never assume you are eligible. The
        check is guidance only; the official circular is always authoritative.
      </p>
      <h2>Disclaimer</h2>
      <p>
        BankTech Jobs BD is independent and is not affiliated with Bangladesh Bank, BSCS or any listed organisation. Organisation names are used only
        to identify the employer of a job. Details can change or contain extraction errors: always verify on the official site and apply only through
        the official channel. Never pay anyone for a job application outside the official process.
      </p>
      <p>
        Some listings are marked <strong>Demo data</strong>. They illustrate the platform and are not real vacancies.
      </p>
      <p>
        Found a mistake? Use “Report a problem” on the job page, or <Link href="/submit">submit a missing job link</Link>.
      </p>
    </Prose>
  );
}
