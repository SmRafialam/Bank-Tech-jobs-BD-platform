import { readFileSync } from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";
import { htmlTableAdapter, parseTable } from "@/collectors/adapters/html-table";
import { extractJobPostings, jsonLdAdapter } from "@/collectors/adapters/json-ld";
import { parseFeed, rssAdapter } from "@/collectors/adapters/rss";
import { isNonJobNotice, normalizeListItem, parseList } from "@/collectors/adapters/shared";
import { enrichJob } from "@/collectors/enrich";
import { sourceByKey } from "@/collectors/sources";
import type { SourceContext } from "@/collectors/types";

const fixture = (name: string) => readFileSync(path.join(__dirname, "..", "fixtures", name), "utf8");

function ctxFor(key: string): SourceContext {
  const def = sourceByKey(key)!;
  return { key: def.key, name: def.name, url: def.url, organizationSlug: def.organizationSlug, config: def.config ?? {} };
}

describe("html-table adapter (Bengal Commercial Bank career page)", () => {
  const source = ctxFor("bcbl-career");
  const rows = parseTable(fixture("bcbl-career.html"), source, source.url);

  it("parses every data row of the live table layout and skips the header", () => {
    expect(rows).toHaveLength(4);
    expect(rows[0].cells[1]).toMatch(/^Notice Regarding 3rd Phase Appointment Letter/);
    expect(rows[0].cells[2]).toBe("07-Jul-2026");
    expect(rows[0].rowId).toBe("107");
  });

  it("filters out notices (appointment letters, viva, results)", () => {
    const normalized = rows.slice(0, 3).map((r) => htmlTableAdapter.normalizeJob(r, { source }));
    expect(normalized).toEqual([null, null, null]);
  });

  it("normalises a job row with dates in Asia/Dhaka and keeps the source page as sourceUrl", () => {
    const job = htmlTableAdapter.normalizeJob(rows[3], { source })!;
    expect(job.title).toBe("Senior Officer - IT (Core Banking Application Support)");
    expect(job.sourceJobId).toBe("999");
    expect(job.deadline?.toISOString()).toBe("2026-10-10T17:59:59.000Z");
    expect(job.publishedAt?.toISOString()).toBe("2026-09-20T17:59:59.000Z");
    expect(job.sourceUrl).toBe(source.url);
    const enriched = enrichJob(job, "bcbl")!;
    expect(enriched.category).toBe("APPLICATION_SUPPORT");
    expect(enriched.requirements.minExperienceYears).toBe(3);
    expect(enriched.requirements.educationDisciplines).toEqual(expect.arrayContaining(["CSE", "EEE"]));
  });
});

describe("html-list adapter (NRB Bank career page)", () => {
  const source = ctxFor("nrb-bank-career");
  const items = parseList(cheerio.load(fixture("nrb-bank-career.html")), source, source.url);

  it("ignores commented-out legacy markup and finds the visible blocks", () => {
    expect(items.map((i) => i.title)).toEqual([
      "Result of written test for the position of Trainee Assistant Officer (TAO)",
      "Result of written test for the position of Trainee Banking officer (TBO)",
      "Senior Officer - Software Development (IT Division)",
    ]);
  });

  it("skips result notices and keeps the apply link of real vacancies", () => {
    const normalized = items.map((i) => normalizeListItem(i, source));
    expect(normalized[0]).toBeNull();
    expect(normalized[1]).toBeNull();
    expect(normalized[2]).toMatchObject({
      title: "Senior Officer - Software Development (IT Division)",
      applicationUrl: "https://career.nrbbankbd.com/apply/so-software-2026",
      sourceUrl: "https://www.nrbbankbd.com/wp-content/uploads/2026/09/so-software-circular.pdf",
      organizationSlug: "nrb-bank",
    });
  });
});

describe("json-ld adapter", () => {
  const source: SourceContext = { key: "example-jsonld", name: "Example", url: "https://bank.example/careers", config: {} };

  it("extracts JobPosting from @graph and ignores malformed blocks", () => {
    expect(extractJobPostings(fixture("jsonld-career.html"))).toHaveLength(1);
  });

  it("normalises structured fields", () => {
    const [posting] = extractJobPostings(fixture("jsonld-career.html"));
    const job = jsonLdAdapter.normalizeJob({ posting, pageUrl: source.url }, { source })!;
    expect(job).toMatchObject({
      title: "Senior Officer - Application Support (Core Banking)",
      sourceJobId: "EB-IT-2026-014",
      organizationName: "Example Bank PLC",
      location: "Dhaka",
      employmentType: "FULL_TIME",
      applicationUrl: "https://bank.example/careers/eb-it-2026-014",
      hints: { minExperienceYears: 3 },
    });
    expect(job.salary).toBe("BDT 80,000–110,000 per month");
    expect(job.deadline?.toISOString()).toBe("2026-10-10T17:59:59.000Z");
    expect(job.description).toContain("minimum CGPA 3.00 out of 4.00");
    expect(job.description).not.toContain("<p>");
  });
});

describe("rss adapter", () => {
  const source: SourceContext = { key: "example-rss", name: "Example feed", url: "https://jobs.example/feed", config: {}, defaultOrgType: "PUBLIC_BANK" };
  const items = parseFeed(fixture("jobs-feed.xml"), source.url);

  it("parses items", () => {
    expect(items).toHaveLength(2);
    expect(items[0].guid).toBe("circular-1001");
    expect(items[0].categories).toEqual(["ICT"]);
  });

  it("splits employer from title, skips result notices and extracts the deadline downstream", () => {
    const job = rssAdapter.normalizeJob(items[0], { source })!;
    expect(job.title).toBe("Assistant Programmer");
    expect(job.organizationName).toBe("Example State Bank PLC");
    expect(rssAdapter.normalizeJob(items[1], { source })).toBeNull();
    const enriched = enrichJob(job, "example-state-bank")!;
    expect(enriched.deadline?.toISOString()).toBe("2026-10-15T17:59:59.000Z");
    expect(enriched.requirements.ageLimit).toBe(30);
    expect(enriched.requirements.noThirdDivision).toBe(true);
  });
});

describe("notice filter", () => {
  it.each([
    ["Result of written test for the position of TAO", true],
    ["Notice for Rescheduled Viva Voce – Probationary Officer–2025", true],
    ["Recruitment notice: Senior Officer (IT)", false],
    ["Assistant Programmer", false],
  ])("%s → %s", (title, expected) => {
    expect(isNonJobNotice(title)).toBe(expected);
  });
});
