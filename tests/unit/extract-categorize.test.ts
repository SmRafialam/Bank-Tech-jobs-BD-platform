import { describe, expect, it } from "vitest";
import { categorizeJob, detectLevel, isTechJob } from "@/lib/jobs/categorize";
import { canonicalDiscipline, extractCgpa, extractRequirements } from "@/lib/jobs/extract";

describe("extractRequirements", () => {
  it("reads CGPA, disciplines, experience range and Master's preference", () => {
    const r = extractRequirements(
      "BSc in CSE, CS or EEE from a recognised university. Minimum CGPA 3.00 out of 4.00. Experience: 3 to 5 years of experience in software development. Master's degree will be an added advantage.",
    );
    expect(r.minCgpa).toBe(3);
    expect(r.educationDisciplines).toEqual(expect.arrayContaining(["CSE", "CS", "EEE"]));
    expect(r.minExperienceYears).toBe(3);
    expect(r.maxExperienceYears).toBe(5);
    expect(r.mastersRequired).toBe(false);
    expect(r.requirementsParsed).toBe(true);
  });

  it("detects mandatory Master's but not negated wording", () => {
    expect(extractRequirements("Master's degree in CSE is mandatory.").mastersRequired).toBe(true);
    expect(extractRequirements("Master's degree is not mandatory.").mastersRequired).toBe(false);
    expect(extractRequirements("Good communication skills.").mastersRequired).toBeNull();
  });

  it("reads age limit, third division rule, SSC/HSC GPA and freshers", () => {
    const r = extractRequirements(
      "Candidates must not have any third division/class in any examination. Minimum GPA 4.00 in both SSC and HSC. Age: maximum 30 years. Freshers are encouraged to apply.",
    );
    expect(r.noThirdDivision).toBe(true);
    expect(r.minSscGpa).toBe(4);
    expect(r.minHscGpa).toBe(4);
    expect(r.ageLimit).toBe(30);
    expect(r.minExperienceYears).toBe(0);
  });

  it("leaves unspecified requirements as null (never assumes)", () => {
    const r = extractRequirements("We are hiring a Senior Officer for our IT division.");
    expect(r.minCgpa).toBeNull();
    expect(r.minExperienceYears).toBeNull();
    expect(r.ageLimit).toBeNull();
    expect(r.requirementsParsed).toBe(false);
  });

  it("splits required and preferred skills, and banking preference", () => {
    const r = extractRequirements("Must know Java, Spring Boot and Oracle. Kubernetes experience is preferred. Experience in a bank will be an added advantage.");
    expect(r.requiredSkills).toEqual(expect.arrayContaining(["Java", "Spring Boot", "Oracle"]));
    expect(r.preferredSkills).toContain("Kubernetes");
    expect(r.bankingExperiencePreferred).toBe(true);
  });

  it("parses deadlines in Dhaka time", () => {
    expect(extractRequirements("Application deadline: 15 October 2026").deadline?.toISOString()).toBe("2026-10-15T17:59:59.000Z");
    expect(extractRequirements("Last date of submission: 05/11/2026").deadline?.toISOString()).toBe("2026-11-05T17:59:59.000Z");
  });

  it("CGPA patterns", () => {
    expect(extractCgpa("CGPA of at least 2.75 (out of 4.00)")).toBe(2.75);
    expect(extractCgpa("minimum CGPA 3.25")).toBe(3.25);
    expect(extractCgpa("GPA 5.00 out of 5.00 in SSC")).toBeNull();
  });

  it("canonical disciplines", () => {
    expect(canonicalDiscipline("Computer Science and Engineering")).toBe("CSE");
    expect(canonicalDiscipline("B.Sc. in EEE")).toBe("EEE");
    expect(canonicalDiscipline("Information Technology")).toBe("IT");
  });
});

describe("categorizeJob", () => {
  it.each([
    ["Senior Officer - Software Development (Java/Angular)", "SOFTWARE_DEVELOPMENT"],
    ["Officer, Application Support (Core Banking)", "APPLICATION_SUPPORT"],
    ["Principal Officer - Network Engineer", "NETWORK"],
    ["Database Administrator (Oracle)", "DATABASE"],
    ["Cyber Security Analyst - SOC", "CYBERSECURITY"],
    ["Data Analyst - Business Intelligence", "DATA_BI"],
    ["QA Engineer (SQA)", "QA_TESTING"],
    ["DevOps Engineer", "CLOUD_DEVOPS"],
    ["Senior Executive, Digital Banking Technology", "DIGITAL_BANKING"],
    ["Officer - ATM & Card Systems", "CARDS_PAYMENTS"],
    ["Manager, IT Audit", "IT_AUDIT_GOVERNANCE"],
    ["Officer - MIS and Reporting", "MIS_REPORTING"],
    ["Assistant Officer - IT", "GENERAL_IT_OFFICER"],
    ["Management Trainee Officer (MTO) - Technology", "MANAGEMENT_TRAINEE_TECH"],
    ["System Administrator (Linux)", "IT_INFRASTRUCTURE"],
  ])("%s → %s", (title, category) => {
    expect(categorizeJob(title).category).toBe(category);
  });
});

describe("isTechJob", () => {
  it.each([
    ["Assistant Programmer", "", true],
    ["IT Officer", "", true],
    ["Head of Treasury", "Treasury Department", false],
    ["Manager, Anti-Money Laundering", "AML Division", false],
    ["Relationship Manager", "Cards Division", false],
    ["Senior Officer", "Information Technology Division", true],
    ["Civil Engineer", "Engineering", false],
  ])("%s (%s) → %s", (title, dept, expected) => {
    expect(isTechJob(title, dept)).toBe(expected);
  });
});

describe("detectLevel", () => {
  it.each([
    ["Management Trainee Officer", "TRAINEE"],
    ["Assistant Officer - IT", "ENTRY"],
    ["Senior Officer - IT", "MID"],
    ["Principal Officer - Network", "SENIOR"],
    ["Head of IT Infrastructure", "EXECUTIVE"],
    ["Software Engineer", "MID"],
  ])("%s → %s", (title, level) => {
    expect(detectLevel(title)).toBe(level);
  });
});
