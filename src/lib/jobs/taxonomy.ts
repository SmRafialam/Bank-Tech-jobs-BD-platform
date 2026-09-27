import type {
  ApplicationStatus,
  EmploymentType,
  JobCategory,
  JobLevel,
  JobStatus,
  OrgType,
  Verdict,
  WorkMode,
} from "@/generated/prisma/enums";

export const CATEGORY_LABELS: Record<JobCategory, string> = {
  SOFTWARE_DEVELOPMENT: "Software Development",
  APPLICATION_SUPPORT: "Application Support",
  IT_INFRASTRUCTURE: "IT Infrastructure",
  NETWORK: "Network",
  DATABASE: "Database",
  CYBERSECURITY: "Cybersecurity",
  DATA_BI: "Data and BI",
  QA_TESTING: "QA and Testing",
  CLOUD_DEVOPS: "Cloud and DevOps",
  DIGITAL_BANKING: "Digital Banking",
  CARDS_PAYMENTS: "Cards, ATM and Payments",
  IT_AUDIT_GOVERNANCE: "IT Audit and Governance",
  MIS_REPORTING: "MIS and Reporting",
  GENERAL_IT_OFFICER: "General IT Officer",
  MANAGEMENT_TRAINEE_TECH: "Management Trainee - Technology",
};

export const CATEGORY_DESCRIPTIONS: Record<JobCategory, string> = {
  SOFTWARE_DEVELOPMENT: "Developers, software engineers, programmers and architects",
  APPLICATION_SUPPORT: "Core banking and application support, L2/L3 support",
  IT_INFRASTRUCTURE: "System administration, data centre, servers and virtualisation",
  NETWORK: "Network engineers, WAN/LAN, routing and switching",
  DATABASE: "Database administrators, Oracle, SQL Server, PostgreSQL",
  CYBERSECURITY: "Information security, SOC, VAPT and security operations",
  DATA_BI: "Data analysts, data engineers, BI and analytics",
  QA_TESTING: "QA/SQA engineers, test automation, UAT",
  CLOUD_DEVOPS: "DevOps, CI/CD, containers and cloud platforms",
  DIGITAL_BANKING: "Internet/mobile banking, digital channels, product technology",
  CARDS_PAYMENTS: "ATM, cards, POS, switch and payment systems",
  IT_AUDIT_GOVERNANCE: "IT audit, risk, compliance and governance",
  MIS_REPORTING: "MIS, regulatory reporting and automation",
  GENERAL_IT_OFFICER: "IT Officer / Assistant Officer - IT and general technology roles",
  MANAGEMENT_TRAINEE_TECH: "Management trainee programmes for technology graduates",
};

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  PUBLIC_BANK: "Public bank",
  PRIVATE_BANK: "Private bank",
  FOREIGN_BANK: "Foreign bank",
  NBFI: "NBFI",
  FINTECH: "Fintech",
  GOVERNMENT: "Government",
};

export const LEVEL_LABELS: Record<JobLevel, string> = {
  TRAINEE: "Trainee",
  ENTRY: "Entry / Officer",
  MID: "Mid-level",
  SENIOR: "Senior",
  LEAD: "Lead / Head of unit",
  EXECUTIVE: "Executive",
};

export const STATUS_LABELS: Record<JobStatus, string> = {
  NEW: "New",
  OPEN: "Open",
  CLOSING_SOON: "Closing soon",
  EXPIRED: "Expired",
  REMOVED: "Removed at source",
  UNVERIFIED: "Unverified",
};

export const VERDICT_LABELS: Record<Verdict, string> = {
  STRONG: "Strong match",
  POSSIBLE: "Possible match",
  WEAK: "Weak match",
  NOT_ELIGIBLE: "Not eligible",
  MANUAL_REVIEW: "Manual review required",
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  NOT_APPLIED: "Not Applied",
  PLANNING: "Planning to Apply",
  APPLIED: "Applied",
  ASSESSMENT: "Assessment",
  WRITTEN_TEST: "Written Test",
  INTERVIEW: "Interview",
  FINAL_INTERVIEW: "Final Interview",
  OFFERED: "Offered",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  ONSITE: "On-site",
  HYBRID: "Hybrid",
  REMOTE: "Remote",
};

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: "Full-time",
  CONTRACT: "Contract",
  PART_TIME: "Part-time",
  INTERNSHIP: "Internship",
};

/** Category groups used by the Software / Infrastructure / Security landing pages. */
export const CATEGORY_GROUPS = {
  software: ["SOFTWARE_DEVELOPMENT", "APPLICATION_SUPPORT", "QA_TESTING", "DIGITAL_BANKING", "DATA_BI", "MIS_REPORTING"],
  infrastructure: ["IT_INFRASTRUCTURE", "NETWORK", "DATABASE", "CLOUD_DEVOPS", "CARDS_PAYMENTS"],
  security: ["CYBERSECURITY", "IT_AUDIT_GOVERNANCE"],
} as const satisfies Record<string, readonly JobCategory[]>;

export const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as JobCategory[];
export const ALL_ORG_TYPES = Object.keys(ORG_TYPE_LABELS) as OrgType[];
export const ALL_LEVELS = Object.keys(LEVEL_LABELS) as JobLevel[];
export const ALL_VERDICTS = Object.keys(VERDICT_LABELS) as Verdict[];
export const ALL_APPLICATION_STATUSES = Object.keys(APPLICATION_STATUS_LABELS) as ApplicationStatus[];
export const ALL_WORK_MODES = Object.keys(WORK_MODE_LABELS) as WorkMode[];
