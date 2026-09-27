/**
 * Seed: organisations, source configuration, admin + demo candidate accounts, and clearly-labelled DEMO jobs.
 * Safe to re-run: organisations/sources are upserted without overwriting admin changes; demo jobs are deduplicated.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { ingestOne } from "@/collectors/ingest";
import { ORGANIZATIONS } from "@/collectors/organizations";
import { SOURCES } from "@/collectors/sources";
import { prisma } from "@/lib/db";
import { recomputeMatchesForUser } from "@/lib/matching";
import { addDays, endOfDhakaDayFromKey, dhakaDateKey } from "@/lib/time";

const now = new Date();
const inDays = (d: number) => endOfDhakaDayFromKey(dhakaDateKey(addDays(now, d)));

export const DEMO_SOURCE = { id: null, key: "demo-seed", name: "Demo data (not a real vacancy)" };
const DEMO_PORTAL = { id: null, key: "demo-portal", name: "Demo job portal (not a real vacancy)" };

interface DemoJob {
  org: string;
  title: string;
  department?: string;
  deadlineInDays: number;
  location?: string;
  workMode?: "ONSITE" | "HYBRID" | "REMOTE";
  vacancies?: number;
  salary?: string;
  text: string;
  responsibilities?: string[];
  portal?: boolean;
}

const DEMO_JOBS: DemoJob[] = [
  {
    org: "dbbl",
    title: "Senior Officer - Software Development (Java/Angular)",
    department: "IT Division",
    deadlineInDays: 10,
    location: "Dhaka",
    vacancies: 3,
    text: `Educational requirements: BSc in CSE, CS or EEE from a recognised university. Minimum CGPA 3.00 out of 4.00.
Experience: 3 to 5 years of experience in enterprise software development. Banking experience will be an added advantage.
Skills: Java, Spring Boot, Angular, Oracle and PL/SQL. Knowledge of microservices is preferred.
Master's degree is not mandatory.`,
    responsibilities: ["Design and build internet banking features", "Maintain REST APIs used by Rocket and partner channels", "Participate in code reviews"],
  },
  {
    org: "brac-bank",
    title: "Officer, Application Support (Core Banking)",
    department: "Technology Division",
    deadlineInDays: 2,
    location: "Dhaka",
    text: `Bachelor's degree in CSE, IT or related discipline.
At least 2 years of experience in application support. Experience in a bank or financial institution is preferred.
Must know T24 or other core banking systems, PL/SQL and REST APIs. Incident management and ITIL knowledge is a plus.`,
    responsibilities: ["Provide L2 support for core banking and digital channels", "Coordinate releases with vendors", "Prepare MIS on incidents"],
  },
  {
    org: "city-bank",
    title: "Assistant Manager - API Integration Engineer",
    department: "Digital Banking",
    deadlineInDays: 14,
    location: "Dhaka",
    workMode: "HYBRID",
    text: `BSc in CSE or Software Engineering. Minimum 4 years of hands-on experience building integrations.
Required: Node.js, TypeScript, REST APIs, microservices, PostgreSQL. Kafka experience is preferred.
Hybrid work arrangement from Dhaka head office.`,
    responsibilities: ["Integrate fintech partners and payment gateways", "Own API documentation and monitoring"],
  },
  {
    org: "city-bank",
    title: "Asst. Manager – API Integration Engineer",
    department: "Digital Banking",
    deadlineInDays: 14,
    location: "Dhaka",
    workMode: "HYBRID",
    portal: true,
    text: `BSc in CSE or Software Engineering. Minimum 4 years of hands-on experience building integrations. Node.js, TypeScript, REST APIs.`,
  },
  {
    org: "ebl",
    title: "Senior Executive, Digital Banking Technology",
    department: "Digital Banking",
    deadlineInDays: 6,
    location: "Dhaka",
    text: `Graduate in CSE/EEE/IT. Master's degree will be an added advantage.
Minimum 3 years of experience in web or mobile banking products. Angular, TypeScript and REST APIs required. Experience with internet banking or mobile banking apps preferred.`,
  },
  {
    org: "bank-asia",
    title: "Principal Officer - Network Engineer",
    department: "IT Infrastructure",
    deadlineInDays: 12,
    location: "Dhaka",
    text: `BSc in CSE/EEE/ETE. Minimum 5 years of experience in enterprise networking (routing, switching, BGP, MPLS).
CCNA is required; CCNP preferred. Firewall (Fortigate/Palo Alto) administration.`,
  },
  {
    org: "sonali-bank",
    title: "Assistant Programmer",
    department: "ICT Division (via BSCS)",
    deadlineInDays: 20,
    location: "Anywhere in Bangladesh",
    vacancies: 25,
    salary: "Grade-9 national pay scale",
    text: `Education: 4-year Bachelor's degree in CSE, EEE, ICT or Computer Science. Candidates must not have any third division/class in any examination.
Age: maximum 30 years as on the circular date. Freshers are encouraged to apply.
Knowledge of programming (Java, PHP or .NET), SQL and Linux.`,
  },
  {
    org: "bangladesh-bank",
    title: "Assistant Director (ICT/Programmer)",
    department: "Information Systems Development and Support Department",
    deadlineInDays: 18,
    location: "Dhaka",
    text: `Bachelor's degree in CSE with minimum CGPA 3.00 out of 4.00. No third division/class in any examination.
Age limit: not more than 30 years. Freshers can apply.`,
  },
  {
    org: "bkash",
    title: "Software Engineer (Backend - Node.js/NestJS)",
    department: "Technology",
    deadlineInDays: 9,
    location: "Dhaka",
    workMode: "HYBRID",
    text: `BSc in CSE or related field from a reputed university.
2-4 years of experience in backend development.
Must have: Node.js, NestJS, TypeScript, PostgreSQL, MongoDB, REST APIs. Docker and CI/CD knowledge is preferred.`,
    responsibilities: ["Build high-throughput payment APIs", "Write automated tests", "Collaborate with product and QA"],
  },
  {
    org: "idlc",
    title: "Officer - MIS and Reporting Automation",
    department: "Finance & MIS",
    deadlineInDays: 4,
    location: "Dhaka",
    text: `Graduate from any discipline; CSE/Statistics preferred.
At least 2 years of experience in MIS reporting. SQL, Power BI and Excel required. Workflow automation (n8n or RPA) will be a plus.`,
  },
  {
    org: "scb",
    title: "Cyber Security Analyst - SOC",
    department: "Information Security",
    deadlineInDays: 15,
    location: "Dhaka",
    text: `BSc in CSE/EEE. Minimum 3 years of experience in a Security Operations Centre.
SIEM (QRadar/Splunk), incident response, ISO 27001 and PCI DSS knowledge required. CISSP preferred.`,
  },
  {
    org: "prime-bank",
    title: "Management Trainee Officer (MTO) - Technology",
    department: "IT",
    deadlineInDays: 25,
    location: "Dhaka",
    vacancies: 10,
    text: `Bachelor's degree in CSE/EEE with minimum CGPA 3.25 out of 4.00. Master's degree is not required.
Fresh graduates are encouraged to apply. Age: maximum 28 years. No third division/class in SSC and HSC.`,
  },
  {
    org: "trust-bank",
    title: "QA Engineer (SQA)",
    department: "IT Division",
    deadlineInDays: 7,
    location: "Dhaka",
    text: `BSc in CSE/IT. 2+ years of experience in software testing. Selenium, JMeter, SQL required. Banking experience is preferred.`,
  },
  {
    org: "nagad",
    title: "DevOps Engineer",
    department: "Platform Engineering",
    deadlineInDays: 11,
    location: "Dhaka",
    text: `BSc in CSE/EEE. Minimum 3 years of experience in DevOps. Kubernetes, Docker, AWS, CI/CD (Jenkins/GitLab CI), Linux required.`,
  },
  {
    org: "hsbc",
    title: "Data Analyst - Business Intelligence",
    department: "Data & Analytics",
    deadlineInDays: 13,
    location: "Dhaka",
    text: `Master's degree in Statistics, CSE or Economics is mandatory.
Minimum 3 years of experience in BI. Power BI, SQL and Python required. Tableau is a plus.`,
  },
  {
    org: "mtb",
    title: "Senior Officer - ATM & Card Systems",
    department: "Cards & Payments Technology",
    deadlineInDays: -3,
    location: "Dhaka",
    text: `BSc in CSE/EEE. 3 years of experience with ATM/POS switch and card management systems. ISO 8583 and EMV knowledge required.`,
  },
  {
    org: "lankabangla",
    title: "System Analyst",
    department: "IT",
    deadlineInDays: 8,
    location: "Dhaka",
    text: `BSc in CSE with minimum CGPA 2.75 out of 4.00. Minimum 4 years of experience in system analysis and API integration.
REST APIs, SQL, JavaScript. Experience in a financial institution is preferred.`,
  },
];

async function upsertUser(email: string, password: string | undefined, name: string, role: "ADMIN" | "USER") {
  const pw = password && password !== "change-me-admin-password" && password !== "change-me-demo-password" ? password : randomBytes(12).toString("base64url");
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { user: existing, password: null };
  const user = await prisma.user.create({ data: { email, name, role, passwordHash: await bcrypt.hash(pw, 12) } });
  return { user, password: password === pw ? null : pw };
}

async function main() {
  console.log("Seeding organisations…");
  for (const o of ORGANIZATIONS) {
    await prisma.organization.upsert({
      where: { slug: o.slug },
      update: { name: o.name, shortName: o.shortName, type: o.type, website: o.website, careersUrl: o.careersUrl },
      create: { slug: o.slug, name: o.name, shortName: o.shortName, type: o.type, website: o.website, careersUrl: o.careersUrl },
    });
  }

  console.log("Seeding sources…");
  for (const s of SOURCES) {
    const org = s.organizationSlug ? await prisma.organization.findUnique({ where: { slug: s.organizationSlug } }) : null;
    await prisma.source.upsert({
      where: { key: s.key },
      // Never overwrite admin-controlled fields (enabled, interval) on re-seed.
      update: { name: s.name, url: s.url, method: s.method, adapter: s.adapter, complianceNote: s.complianceNote, config: s.config as object | undefined, organizationId: org?.id ?? null },
      create: {
        key: s.key,
        name: s.name,
        url: s.url,
        method: s.method,
        adapter: s.adapter,
        enabled: s.enabledByDefault,
        fetchIntervalMinutes: s.fetchIntervalMinutes,
        complianceNote: s.complianceNote,
        config: s.config as object | undefined,
        organizationId: org?.id ?? null,
      },
    });
  }

  console.log("Seeding accounts…");
  const admin = await upsertUser(process.env.SEED_ADMIN_EMAIL ?? "admin@banktechjobs.local", process.env.SEED_ADMIN_PASSWORD, "Site Admin", "ADMIN");
  const demo = await upsertUser(process.env.SEED_DEMO_EMAIL ?? "rafi.demo@banktechjobs.local", process.env.SEED_DEMO_PASSWORD, "S. M. Rafi Alam", "USER");
  if (admin.password) console.log(`  Admin password generated (store it now): ${admin.password}`);
  if (demo.password) console.log(`  Demo user password generated (store it now): ${demo.password}`);

  const profileData = {
    fullName: "S. M. Rafi Alam",
    location: "Dhaka, Bangladesh",
    degree: "BSc",
    discipline: "Computer Science and Engineering",
    graduationYear: 2021,
    bachelorCgpa: 2.87,
    cgpaScale: 4,
    hasMasters: false,
    experienceYears: 4.5,
    bankingExperience: false,
    skills: ["Angular", "TypeScript", "JavaScript", "Node.js", "NestJS", "REST APIs", "PostgreSQL", "MongoDB", "WordPress", "n8n / Workflow automation", "Reporting and automation"],
    primaryFocus: "software",
    preferredRoles: [
      "Software Engineer",
      "Angular Developer",
      "Application Support",
      "API Integration",
      "Digital Banking Technology",
      "System Analyst",
      "MIS/Reporting",
      "Automation",
      "IT Officer - Application",
    ],
    preferredLocations: ["Dhaka"],
    openToRemote: true,
    currentEmployer: "AKIJ iBOS Limited (AKIJ Group)",
  };
  await prisma.candidateProfile.upsert({ where: { userId: demo.user.id }, update: {}, create: { userId: demo.user.id, ...profileData } });
  await prisma.notificationPreference.upsert({
    where: { userId: demo.user.id },
    update: {},
    create: { userId: demo.user.id, minMatchScore: 45, mode: "IMMEDIATE", locations: ["Dhaka"], academicOnly: true },
  });

  if (process.env.SEED_DEMO_JOBS !== "false") {
    console.log("Seeding DEMO jobs (clearly labelled, not real vacancies)…");
    for (const j of DEMO_JOBS) {
      const org = ORGANIZATIONS.find((o) => o.slug === j.org)!;
      const outcome = await ingestOne(
        {
          title: j.title,
          organizationSlug: j.org,
          department: j.department,
          description: `${j.title}\n${j.text}`,
          responsibilities: j.responsibilities,
          location: j.location,
          workMode: j.workMode,
          vacancies: j.vacancies,
          salary: j.salary,
          publishedAt: addDays(now, -2),
          deadline: inDays(j.deadlineInDays),
          applicationUrl: org.careersUrl ?? org.website ?? null,
          sourceUrl: org.careersUrl ?? org.website ?? "https://example.com",
          sourceJobId: `demo-${j.org}-${j.title}`.slice(0, 120),
        },
        j.portal ? DEMO_PORTAL : DEMO_SOURCE,
        { isDemo: true, now: addDays(now, j.deadlineInDays < 0 ? -30 : -1) },
      );
      console.log(`  ${outcome.action.padEnd(8)} ${j.title}${outcome.reason ? ` (${outcome.reason})` : ""}`);
    }
    // Demo activity for the sample candidate.
    const [support, bkash] = await Promise.all([
      prisma.job.findFirst({ where: { isDemo: true, title: { startsWith: "Officer, Application Support" } } }),
      prisma.job.findFirst({ where: { isDemo: true, title: { startsWith: "Software Engineer (Backend" } } }),
    ]);
    if (support) await prisma.savedJob.upsert({ where: { userId_jobId: { userId: demo.user.id, jobId: support.id } }, update: {}, create: { userId: demo.user.id, jobId: support.id } });
    if (bkash) {
      await prisma.application.upsert({
        where: { userId_jobId: { userId: demo.user.id, jobId: bkash.id } },
        update: {},
        create: { userId: demo.user.id, jobId: bkash.id, status: "APPLIED", appliedAt: addDays(now, -1), cvVersion: "CV-2026-09-backend.pdf", notes: "Demo application entry." },
      });
    }
  }

  // Refresh statuses for the seeded "now".
  const { refreshStatuses } = await import("@/tasks");
  await refreshStatuses();
  await recomputeMatchesForUser(demo.user.id);
  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(), 100));
