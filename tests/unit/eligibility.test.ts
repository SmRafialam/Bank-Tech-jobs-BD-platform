import { describe, expect, it } from "vitest";
import { evaluateEligibility, type JobInput, type ProfileInput } from "@/lib/jobs/eligibility";

/** Sample candidate from the product brief: S. M. Rafi Alam. */
const rafi: ProfileInput = {
  discipline: "Computer Science and Engineering",
  hasMasters: false,
  bachelorCgpa: 2.87,
  cgpaScale: 4,
  sscGpa: null,
  hscGpa: null,
  hasThirdDivision: false,
  experienceYears: 4.5,
  bankingExperience: false,
  skills: ["Angular", "TypeScript", "JavaScript", "Node.js", "NestJS", "REST APIs", "PostgreSQL", "MongoDB", "WordPress", "n8n / Workflow automation"],
  primaryFocus: "software",
  preferredRoles: ["Software Engineer", "Angular Developer", "Application Support", "API Integration", "Digital Banking Technology", "System Analyst"],
  preferredOrgSlugs: [],
  preferredLocations: ["Dhaka"],
  openToRemote: true,
  age: null,
};

const baseJob: JobInput = {
  title: "Software Engineer",
  category: "SOFTWARE_DEVELOPMENT",
  secondaryCategories: [],
  level: "MID",
  organizationSlug: "example-bank",
  educationDisciplines: ["CSE", "EEE"],
  minCgpa: null,
  minSscGpa: null,
  minHscGpa: null,
  mastersRequired: false,
  noThirdDivision: null,
  minExperienceYears: 3,
  maxExperienceYears: null,
  ageLimit: null,
  bankingExperiencePreferred: false,
  requiredSkills: ["Angular", "TypeScript", "REST APIs"],
  preferredSkills: [],
  location: "Dhaka",
  workMode: "ONSITE",
  requirementsParsed: true,
};

const job = (overrides: Partial<JobInput>): JobInput => ({ ...baseJob, ...overrides });
const texts = (r: ReturnType<typeof evaluateEligibility>) => r.reasons.map((x) => x.text);

describe("evaluateEligibility", () => {
  it("strong match when degree, experience and skills fit", () => {
    const r = evaluateEligibility(rafi, job({ minCgpa: 2.5 }));
    expect(r.verdict).toBe("STRONG");
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(texts(r)).toContain("You meet the CSE degree requirement.");
    expect(texts(r)).toContain("Your 4+ years of experience meet the 3-year requirement.");
  });

  it("not eligible when an explicit minimum CGPA is not met", () => {
    const r = evaluateEligibility(rafi, job({ minCgpa: 3 }));
    expect(r.verdict).toBe("NOT_ELIGIBLE");
    expect(texts(r)).toContain("Not eligible because minimum CGPA 3.00 is explicitly required (yours: 2.87).");
  });

  it("not eligible when a Master's degree is mandatory", () => {
    const r = evaluateEligibility(rafi, job({ mastersRequired: true }));
    expect(r.verdict).toBe("NOT_ELIGIBLE");
    expect(texts(r)).toContain("Not eligible because a Master's degree is mandatory.");
  });

  it("never assumes eligibility: missing CGPA and experience cap the verdict at possible", () => {
    const r = evaluateEligibility(rafi, job({ minCgpa: null, minExperienceYears: null }));
    expect(r.verdict).toBe("POSSIBLE");
    expect(texts(r)).toContain("Possible match because no minimum CGPA was stated.");
    expect(texts(r)).toContain("Experience requirement: Not specified.");
  });

  it("manual review when the job has an age limit but the profile has no age", () => {
    const r = evaluateEligibility(rafi, job({ ageLimit: 30 }));
    expect(r.verdict).toBe("MANUAL_REVIEW");
    expect(texts(r)).toContain("Age limit is 30 years — add your age to your profile.");
  });

  it("manual review when requirements could not be parsed", () => {
    const r = evaluateEligibility(rafi, job({ requirementsParsed: false, educationDisciplines: [], minExperienceYears: null }));
    expect(r.verdict).toBe("MANUAL_REVIEW");
  });

  it("flags banking-experience preference and infrastructure focus", () => {
    const r = evaluateEligibility(rafi, job({ bankingExperiencePreferred: true }));
    expect(texts(r)).toContain("Skills match, but banking experience is preferred.");
    const infra = evaluateEligibility(rafi, job({ title: "Network Engineer", category: "NETWORK", requiredSkills: ["CCNA"] }));
    expect(texts(infra)).toContain("Role is network-focused while your primary experience is software development.");
    expect(infra.score).toBeLessThan(evaluateEligibility(rafi, job({})).score);
  });

  it("third division rule, CS/CSE equivalence and discipline mismatch", () => {
    expect(evaluateEligibility({ ...rafi, bachelorCgpa: 2.1 }, job({ noThirdDivision: true })).verdict).toBe("NOT_ELIGIBLE");
    expect(evaluateEligibility({ ...rafi, discipline: "Computer Science" }, job({ educationDisciplines: ["CSE"] })).reasons[0].kind).toBe("pass");
    const mismatch = evaluateEligibility({ ...rafi, discipline: "Statistics" }, job({ educationDisciplines: ["CSE", "EEE"] }));
    expect(mismatch.verdict).toBe("NOT_ELIGIBLE");
  });

  it("experience slightly short is possible, far short is not eligible", () => {
    expect(evaluateEligibility({ ...rafi, experienceYears: 2.5 }, job({ minExperienceYears: 3, minCgpa: 2.5 })).verdict).not.toBe("NOT_ELIGIBLE");
    expect(evaluateEligibility({ ...rafi, experienceYears: 1 }, job({ minExperienceYears: 5 })).verdict).toBe("NOT_ELIGIBLE");
  });

  it("converts a 5-point CGPA scale", () => {
    const r = evaluateEligibility({ ...rafi, bachelorCgpa: 4.0, cgpaScale: 5 }, job({ minCgpa: 3.25 }));
    expect(texts(r)).toContain("Not eligible because minimum CGPA 3.25 is explicitly required (yours: 3.20).");
  });
});
