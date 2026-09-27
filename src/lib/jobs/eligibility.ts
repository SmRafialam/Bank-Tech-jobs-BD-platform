import type { JobCategory, JobLevel, Verdict, WorkMode } from "@/generated/prisma/enums";
import { categorizeJob } from "./categorize";
import { TECH_DISCIPLINES, canonicalDiscipline } from "./extract";
import { titleSimilarity } from "./normalize";

export type ReasonKind = "pass" | "fail" | "warn" | "info";
export interface Reason {
  kind: ReasonKind;
  text: string;
}

export interface EligibilityResult {
  verdict: Verdict;
  score: number;
  reasons: Reason[];
}

export interface ProfileInput {
  discipline: string | null;
  hasMasters: boolean;
  bachelorCgpa: number | null;
  cgpaScale: number;
  sscGpa: number | null;
  hscGpa: number | null;
  hasThirdDivision: boolean;
  experienceYears: number | null;
  bankingExperience: boolean;
  skills: string[];
  primaryFocus: string | null;
  preferredRoles: string[];
  preferredOrgSlugs: string[];
  preferredLocations: string[];
  openToRemote: boolean;
  age: number | null;
}

export interface JobInput {
  title: string;
  category: JobCategory;
  secondaryCategories: JobCategory[];
  level: JobLevel | null;
  organizationSlug: string;
  educationDisciplines: string[];
  minCgpa: number | null;
  minSscGpa: number | null;
  minHscGpa: number | null;
  mastersRequired: boolean | null;
  noThirdDivision: boolean | null;
  minExperienceYears: number | null;
  maxExperienceYears: number | null;
  ageLimit: number | null;
  bankingExperiencePreferred: boolean;
  requiredSkills: string[];
  preferredSkills: string[];
  location: string | null;
  workMode: WorkMode;
  requirementsParsed: boolean;
}

const NO_CGPA_POSSIBLE = "Possible match because no minimum CGPA was stated.";

/** Third class on a 4.00 scale in Bangladesh is conventionally below 2.25. */
export const THIRD_CLASS_CGPA_4 = 2.25;

const DISCIPLINE_EQUIVALENTS: Record<string, string[]> = {
  CSE: ["CSE", "CS"],
  CS: ["CS", "CSE"],
  SWE: ["SWE"],
  IT: ["IT", "ICT"],
  ICT: ["ICT", "IT"],
  EEE: ["EEE"],
  ECE: ["ECE", "ETE"],
  ETE: ["ETE", "ECE"],
};

const FOCUS_CATEGORIES: Record<string, { fit: JobCategory[]; conflict: JobCategory[]; label: string }> = {
  software: {
    fit: ["SOFTWARE_DEVELOPMENT", "APPLICATION_SUPPORT", "QA_TESTING", "DIGITAL_BANKING", "MIS_REPORTING", "DATA_BI", "GENERAL_IT_OFFICER", "MANAGEMENT_TRAINEE_TECH"],
    conflict: ["IT_INFRASTRUCTURE", "NETWORK", "CYBERSECURITY"],
    label: "software development",
  },
  infrastructure: {
    fit: ["IT_INFRASTRUCTURE", "NETWORK", "DATABASE", "CLOUD_DEVOPS", "CARDS_PAYMENTS", "GENERAL_IT_OFFICER"],
    conflict: ["SOFTWARE_DEVELOPMENT", "QA_TESTING"],
    label: "infrastructure",
  },
  security: {
    fit: ["CYBERSECURITY", "IT_AUDIT_GOVERNANCE", "NETWORK"],
    conflict: ["SOFTWARE_DEVELOPMENT", "QA_TESTING", "MIS_REPORTING"],
    label: "security",
  },
  data: {
    fit: ["DATA_BI", "MIS_REPORTING", "DATABASE"],
    conflict: ["NETWORK", "IT_INFRASTRUCTURE"],
    label: "data and reporting",
  },
};

const CATEGORY_FOCUS_WORD: Partial<Record<JobCategory, string>> = {
  IT_INFRASTRUCTURE: "infrastructure-focused",
  NETWORK: "network-focused",
  CYBERSECURITY: "security-focused",
  SOFTWARE_DEVELOPMENT: "software-development-focused",
  QA_TESTING: "testing-focused",
  MIS_REPORTING: "reporting-focused",
};

function normSkill(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9#+]/g, "");
}

function skillMatches(profileSkills: string[], jobSkill: string): boolean {
  const target = normSkill(jobSkill);
  return profileSkills.some((p) => {
    const mine = normSkill(p);
    if (!mine || !target) return false;
    return mine === target || (mine.length >= 3 && target.includes(mine)) || (target.length >= 3 && mine.includes(target));
  });
}

function fmtYears(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function fmtCgpa(n: number): string {
  return n.toFixed(2);
}

export function evaluateEligibility(profile: ProfileInput, job: JobInput): EligibilityResult {
  const reasons: Reason[] = [];
  let hardFail = false;
  let manual = false;
  let cap = false; // cap verdict at POSSIBLE
  const missingCritical: string[] = [];

  // ── Education discipline ──
  const myCode = canonicalDiscipline(profile.discipline);
  const codes = job.educationDisciplines.filter((c) => c !== "RELATED");
  const allowsRelated = job.educationDisciplines.includes("RELATED");
  if (codes.length === 0) {
    reasons.push({ kind: "info", text: "Education discipline: Not specified in the circular." });
    missingCritical.push("discipline");
  } else if (!myCode) {
    manual = true;
    reasons.push({ kind: "warn", text: "Add your degree discipline to check the education requirement." });
  } else if (codes.includes("ANY")) {
    reasons.push({ kind: "pass", text: "Graduates from any discipline are accepted." });
  } else {
    const accepted = DISCIPLINE_EQUIVALENTS[myCode] ?? [myCode];
    if (codes.some((c) => accepted.includes(c))) {
      reasons.push({ kind: "pass", text: `You meet the ${myCode} degree requirement.` });
    } else if (allowsRelated && TECH_DISCIPLINES.includes(myCode) && codes.some((c) => TECH_DISCIPLINES.includes(c))) {
      cap = true;
      reasons.push({ kind: "warn", text: `Your ${myCode} degree likely counts as a related discipline — confirm on the official circular.` });
    } else {
      hardFail = true;
      reasons.push({ kind: "fail", text: `Not eligible because the circular requires ${codes.join("/")} and your discipline is ${myCode}.` });
    }
  }

  // ── CGPA ──
  const myCgpa4 = profile.bachelorCgpa != null ? (profile.cgpaScale === 5 ? (profile.bachelorCgpa * 4) / 5 : profile.bachelorCgpa) : null;
  if (job.minCgpa == null) {
    missingCritical.push("cgpa");
    reasons.push({ kind: "info", text: NO_CGPA_POSSIBLE });
  } else if (myCgpa4 == null) {
    manual = true;
    reasons.push({ kind: "warn", text: `A minimum CGPA of ${fmtCgpa(job.minCgpa)} is required — add your CGPA to your profile.` });
  } else if (myCgpa4 + 1e-9 < job.minCgpa) {
    hardFail = true;
    reasons.push({ kind: "fail", text: `Not eligible because minimum CGPA ${fmtCgpa(job.minCgpa)} is explicitly required (yours: ${fmtCgpa(myCgpa4)}).` });
  } else {
    reasons.push({ kind: "pass", text: `Your CGPA ${fmtCgpa(myCgpa4)} meets the minimum ${fmtCgpa(job.minCgpa)}.` });
  }

  // ── Master's ──
  if (job.mastersRequired === true) {
    if (profile.hasMasters) reasons.push({ kind: "pass", text: "You hold the mandatory Master's degree." });
    else {
      hardFail = true;
      reasons.push({ kind: "fail", text: "Not eligible because a Master's degree is mandatory." });
    }
  } else if (job.mastersRequired === false) {
    reasons.push({ kind: "pass", text: "A Master's degree is not mandatory." });
  } else {
    reasons.push({ kind: "info", text: "Master's requirement: Not specified." });
  }

  // ── SSC / HSC ──
  for (const [label, min, mine] of [
    ["SSC", job.minSscGpa, profile.sscGpa],
    ["HSC", job.minHscGpa, profile.hscGpa],
  ] as const) {
    if (min == null) continue;
    if (mine == null) {
      manual = true;
      reasons.push({ kind: "warn", text: `${label} GPA ${min.toFixed(2)} is required — add your ${label} GPA to your profile.` });
    } else if (mine + 1e-9 < min) {
      hardFail = true;
      reasons.push({ kind: "fail", text: `Not eligible because ${label} GPA ${min.toFixed(2)} is required (yours: ${mine.toFixed(2)}).` });
    } else {
      reasons.push({ kind: "pass", text: `Your ${label} GPA ${mine.toFixed(2)} meets the ${min.toFixed(2)} requirement.` });
    }
  }

  // ── Third division / class rule ──
  const thirdClass = profile.hasThirdDivision || (myCgpa4 != null && myCgpa4 < THIRD_CLASS_CGPA_4);
  if (job.noThirdDivision) {
    if (thirdClass) {
      hardFail = true;
      reasons.push({ kind: "fail", text: "Not eligible because third division/class is not accepted in any examination." });
    } else {
      reasons.push({ kind: "pass", text: "No third division/class — you meet this rule." });
    }
  }

  // ── Age ──
  if (job.ageLimit != null) {
    if (profile.age == null) {
      manual = true;
      reasons.push({ kind: "warn", text: `Age limit is ${job.ageLimit} years — add your age to your profile.` });
    } else if (profile.age > job.ageLimit) {
      hardFail = true;
      reasons.push({ kind: "fail", text: `Not eligible because the age limit is ${job.ageLimit} years (yours: ${profile.age}).` });
    } else {
      reasons.push({ kind: "pass", text: `You are within the ${job.ageLimit}-year age limit.` });
    }
  }

  // ── Experience ──
  let expScore = 8;
  const exp = profile.experienceYears;
  if (job.minExperienceYears == null) {
    missingCritical.push("experience");
    reasons.push({ kind: "info", text: "Experience requirement: Not specified." });
  } else if (exp == null) {
    manual = true;
    expScore = 0;
    reasons.push({ kind: "warn", text: `${fmtYears(job.minExperienceYears)} years of experience required — add your experience to your profile.` });
  } else if (exp >= job.minExperienceYears) {
    expScore = 15;
    const mine = exp >= 1 && !Number.isInteger(exp) ? `${Math.floor(exp)}+` : fmtYears(exp);
    reasons.push({
      kind: "pass",
      text:
        job.minExperienceYears === 0
          ? "No prior experience is required."
          : `Your ${mine} years of experience meet the ${fmtYears(job.minExperienceYears)}-year requirement.`,
    });
    if (job.maxExperienceYears != null && exp > job.maxExperienceYears + 2) {
      expScore = 8;
      reasons.push({ kind: "warn", text: `The role targets up to ${fmtYears(job.maxExperienceYears)} years of experience — you may be over-qualified.` });
    }
  } else if (job.minExperienceYears - exp <= 1) {
    expScore = 6;
    cap = true;
    reasons.push({ kind: "warn", text: `You are slightly below the ${fmtYears(job.minExperienceYears)}-year experience requirement.` });
  } else {
    hardFail = true;
    expScore = 0;
    reasons.push({ kind: "fail", text: `Not eligible because ${fmtYears(job.minExperienceYears)} years of experience are required (yours: ${fmtYears(exp)}).` });
  }

  // ── Skills ──
  let skillScore = 17;
  const required = job.requiredSkills;
  const preferred = job.preferredSkills;
  const matchedReq = required.filter((s) => skillMatches(profile.skills, s));
  const matchedPref = preferred.filter((s) => skillMatches(profile.skills, s));
  if (required.length + preferred.length > 0) {
    const reqPart = required.length ? matchedReq.length / required.length : null;
    const prefPart = preferred.length ? matchedPref.length / preferred.length : null;
    if (reqPart != null && prefPart != null) skillScore = reqPart * 28 + prefPart * 7;
    else skillScore = (reqPart ?? prefPart ?? 0) * 35;
    const matched = [...matchedReq, ...matchedPref];
    if (matched.length) reasons.push({ kind: "pass", text: `Skills match: ${matched.slice(0, 6).join(", ")}.` });
    const missing = required.filter((s) => !matchedReq.includes(s));
    if (missing.length) reasons.push({ kind: "warn", text: `Skills to highlight or learn: ${missing.slice(0, 5).join(", ")}.` });
  } else {
    reasons.push({ kind: "info", text: "Required skills: Not specified." });
  }

  if (job.bankingExperiencePreferred && !profile.bankingExperience) {
    reasons.push({
      kind: "warn",
      text: matchedReq.length || matchedPref.length ? "Skills match, but banking experience is preferred." : "Banking experience is preferred.",
    });
  }

  // ── Category vs primary focus ──
  let categoryScore = 8;
  const focus = profile.primaryFocus ? FOCUS_CATEGORIES[profile.primaryFocus] : undefined;
  if (focus) {
    if (focus.fit.includes(job.category)) categoryScore = 15;
    else if (focus.conflict.includes(job.category)) {
      categoryScore = 0;
      const word = CATEGORY_FOCUS_WORD[job.category] ?? "outside your focus area";
      reasons.push({ kind: "warn", text: `Role is ${word} while your primary experience is ${focus.label}.` });
    }
  }

  // ── Role preference ──
  let roleScore = 0;
  if (profile.preferredRoles.length) {
    const bestSim = Math.max(...profile.preferredRoles.map((r) => titleSimilarity(r, job.title)));
    const categoryHit = profile.preferredRoles.some((r) => {
      const c = categorizeJob(r).category;
      return c === job.category || job.secondaryCategories.includes(c);
    });
    if (bestSim >= 0.6) roleScore = 20;
    else if (categoryHit) roleScore = 14;
    else if (bestSim >= 0.4) roleScore = 8;
    if (roleScore >= 14) reasons.push({ kind: "pass", text: "Matches one of your preferred roles." });
  } else {
    roleScore = 10;
  }

  // ── Location ──
  let locationScore = 5;
  if (job.workMode === "REMOTE" && profile.openToRemote) {
    locationScore = 10;
    reasons.push({ kind: "pass", text: "Remote role — matches your preference." });
  } else if (job.location) {
    const loc = job.location.toLowerCase();
    if (profile.preferredLocations.some((p) => loc.includes(p.toLowerCase()))) locationScore = 10;
    else if (loc.includes("anywhere")) {
      locationScore = 5;
      reasons.push({ kind: "info", text: "Posting may be anywhere in Bangladesh." });
    } else if (profile.preferredLocations.length) {
      locationScore = 0;
      reasons.push({ kind: "warn", text: `Location (${job.location}) is outside your preferred locations.` });
    }
  }

  // ── Organisation preference ──
  const orgScore = profile.preferredOrgSlugs.length === 0 ? 3 : profile.preferredOrgSlugs.includes(job.organizationSlug) ? 5 : 0;

  const score = Math.round(Math.min(100, Math.max(0, skillScore + roleScore + expScore + categoryScore + locationScore + orgScore)));

  if (!job.requirementsParsed) {
    manual = true;
    reasons.push({ kind: "warn", text: "Eligibility criteria could not be read from the source — manual review required." });
  }
  if (missingCritical.length >= 2) cap = true;

  let verdict: Verdict;
  if (hardFail) verdict = "NOT_ELIGIBLE";
  else if (manual) verdict = "MANUAL_REVIEW";
  else if (score >= 70 && !cap) verdict = "STRONG";
  else if (score >= 45 || (score >= 70 && cap)) verdict = "POSSIBLE";
  else verdict = "WEAK";

  if (verdict !== "POSSIBLE") {
    const cgpaReason = reasons.find((r) => r.text === NO_CGPA_POSSIBLE);
    if (cgpaReason) cgpaReason.text = "Minimum CGPA: Not specified — confirm on the official circular.";
  }
  return { verdict, score, reasons };
}
