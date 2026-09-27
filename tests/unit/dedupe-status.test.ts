import { describe, expect, it } from "vitest";
import { decideDuplicate, type ExistingJob, type IncomingJob } from "@/lib/jobs/dedupe";
import { contentHash, htmlToText, jobFingerprint, normalizeTitle, normalizeUrl, titleSimilarity } from "@/lib/jobs/normalize";
import { computeStatus } from "@/lib/jobs/status";

const deadline = new Date("2026-10-15T17:59:59Z");

function existing(overrides: Partial<ExistingJob> = {}): ExistingJob {
  return {
    id: "job-1",
    organizationId: "org-1",
    title: "Assistant Manager - API Integration Engineer",
    applicationUrl: "https://bank.example/careers/123",
    deadline,
    fingerprint: jobFingerprint("city-bank", "Assistant Manager - API Integration Engineer", deadline),
    contentHash: "hash-a",
    externalKeys: ["portal:id:123"],
    ...overrides,
  };
}

function incoming(overrides: Partial<IncomingJob> = {}): IncomingJob {
  return {
    externalKey: "other:id:9",
    organizationId: "org-1",
    title: "Asst. Manager – API Integration Engineer",
    applicationUrl: null,
    deadline,
    fingerprint: jobFingerprint("city-bank", "Asst. Manager – API Integration Engineer", deadline),
    contentHash: "hash-b",
    ...overrides,
  };
}

describe("normalisation", () => {
  it("expands abbreviations and strips punctuation/noise", () => {
    expect(normalizeTitle("Sr. Officer (ICT) - Urgent Hiring")).toBe("senior officer it");
    expect(normalizeTitle("Asst. Manager – API Integration Engineer")).toBe(normalizeTitle("Assistant Manager - API Integration Engineer"));
  });

  it("canonicalises URLs", () => {
    expect(normalizeUrl("http://WWW.Bank.example/careers/123/?utm_source=x&b=2&a=1#apply")).toBe("https://bank.example/careers/123?a=1&b=2");
    expect(normalizeUrl("not a url")).toBeNull();
  });

  it("strips HTML to text", () => {
    expect(htmlToText("<p>Hello&nbsp;<b>world</b></p><script>alert(1)</script><ul><li>A</li><li>B</li></ul>")).toBe("Hello world\nA\nB");
  });

  it("fingerprint depends on org, title and deadline day", () => {
    expect(jobFingerprint("a", "IT Officer", deadline)).toBe(jobFingerprint("a", "ICT officer (urgent)", deadline));
    expect(jobFingerprint("a", "IT Officer", deadline)).not.toBe(jobFingerprint("a", "IT Officer", null));
    expect(jobFingerprint("a", "IT Officer", deadline)).not.toBe(jobFingerprint("b", "IT Officer", deadline));
    expect(contentHash(["A", " b "])).toBe(contentHash(["a", "b"]));
  });

  it("title similarity", () => {
    expect(titleSimilarity("Senior Officer - Software Development", "Sr. Officer, Software Development")).toBeGreaterThan(0.92);
    expect(titleSimilarity("Network Engineer", "Software Engineer")).toBeLessThan(0.75);
  });
});

describe("decideDuplicate", () => {
  it("same source key → same-source update", () => {
    expect(decideDuplicate(incoming({ externalKey: "portal:id:123" }), [existing()]).action).toBe("same-source");
  });
  it("identical application URL → merge", () => {
    const d = decideDuplicate(incoming({ applicationUrl: "https://www.bank.example/careers/123/?utm_campaign=x", fingerprint: "x" }), [existing()]);
    expect(d).toMatchObject({ action: "merge", jobId: "job-1" });
  });
  it("same normalised org/title/deadline fingerprint → merge", () => {
    expect(decideDuplicate(incoming(), [existing()])).toMatchObject({ action: "merge", reasons: ["Same organisation, normalised title and deadline"] });
  });
  it("identical content hash → merge", () => {
    expect(decideDuplicate(incoming({ fingerprint: "x", contentHash: "hash-a" }), [existing()]).action).toBe("merge");
  });
  it("fuzzy near-duplicate goes to the review queue, different org never matches", () => {
    const similar = incoming({ title: "Assistant Manager, API & Integration Engineer (Digital)", fingerprint: "x" });
    const d = decideDuplicate(similar, [existing()]);
    expect(d.action).toBe("create");
    if (d.action === "create") expect(d.reviewCandidates[0]?.jobId).toBe("job-1");
    const otherOrg = decideDuplicate(incoming({ organizationId: "org-2", fingerprint: "x" }), [existing()]);
    expect(otherOrg).toEqual({ action: "create", reviewCandidates: [] });
  });
  it("far-apart deadlines are different postings", () => {
    const d = decideDuplicate(incoming({ fingerprint: "x", deadline: new Date("2026-12-31T00:00:00Z") }), [existing()]);
    expect(d).toEqual({ action: "create", reviewCandidates: [] });
  });
});

describe("computeStatus", () => {
  const now = new Date("2026-09-27T12:00:00Z");
  const base = { firstDiscoveredAt: new Date("2026-09-01T00:00:00Z"), lastVerifiedAt: now, missingRuns: 0, reviewStatus: "APPROVED" as const };
  it.each([
    ["expired", { deadline: new Date("2026-09-27T11:00:00Z") }, "EXPIRED"],
    ["closing soon", { deadline: new Date("2026-09-29T11:00:00Z") }, "CLOSING_SOON"],
    ["new", { deadline: new Date("2026-10-20T00:00:00Z"), firstDiscoveredAt: new Date("2026-09-26T13:00:00Z") }, "NEW"],
    ["open", { deadline: new Date("2026-10-20T00:00:00Z") }, "OPEN"],
    ["removed", { deadline: null, missingRuns: 3 }, "REMOVED"],
    ["unverified (stale, no deadline)", { deadline: null, lastVerifiedAt: new Date("2026-09-01T00:00:00Z") }, "UNVERIFIED"],
    ["pending review", { deadline: null, reviewStatus: "PENDING" as const }, "UNVERIFIED"],
  ])("%s", (_label, overrides, expected) => {
    expect(computeStatus({ ...base, ...overrides }, now)).toBe(expected);
  });
});
