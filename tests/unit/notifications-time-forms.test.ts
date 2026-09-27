import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/forms";
import { parseJobFilters } from "@/lib/queries/jobs";
import { dhakaDateKey, formatDhakaDateTime, parseDhakaDate, startOfDhakaDay, timeLeftLabel } from "@/lib/time";
import { isHighPriority, preferenceMatches, reminderWindow, type AudienceJob } from "@/notifications/audience";

const pref = {
  categories: [] as AudienceJob["category"][],
  organizationSlugs: [] as string[],
  orgTypes: [] as AudienceJob["organization"]["type"][],
  minMatchScore: 45,
  locations: [] as string[],
  levels: [] as NonNullable<AudienceJob["level"]>[],
  academicOnly: true,
};
const job: AudienceJob = {
  category: "SOFTWARE_DEVELOPMENT",
  secondaryCategories: ["APPLICATION_SUPPORT"],
  level: "MID",
  location: "Dhaka",
  workMode: "ONSITE",
  organization: { slug: "city-bank", type: "PRIVATE_BANK" },
};

describe("preferenceMatches", () => {
  it("empty filters match everything with a good score", () => {
    expect(preferenceMatches(pref, job, { verdict: "STRONG", score: 80 }).ok).toBe(true);
  });
  it("filters by category (incl. secondary), org, org type, level and location", () => {
    expect(preferenceMatches({ ...pref, categories: ["APPLICATION_SUPPORT"] }, job, null).ok).toBe(true);
    expect(preferenceMatches({ ...pref, categories: ["NETWORK"] }, job, null).reason).toBe("category");
    expect(preferenceMatches({ ...pref, organizationSlugs: ["bkash"] }, job, null).reason).toBe("organization");
    expect(preferenceMatches({ ...pref, orgTypes: ["PUBLIC_BANK"] }, job, null).reason).toBe("org type");
    expect(preferenceMatches({ ...pref, levels: ["TRAINEE"] }, job, null).reason).toBe("level");
    expect(preferenceMatches({ ...pref, locations: ["Chattogram"] }, job, null).reason).toBe("location");
    expect(preferenceMatches({ ...pref, locations: ["Chattogram"] }, { ...job, workMode: "REMOTE" }, null).ok).toBe(true);
  });
  it("respects academic filter and minimum score, but still announces manual-review jobs", () => {
    expect(preferenceMatches(pref, job, { verdict: "NOT_ELIGIBLE", score: 90 }).reason).toBe("not eligible");
    expect(preferenceMatches(pref, job, { verdict: "WEAK", score: 30 }).reason).toBe("score");
    expect(preferenceMatches(pref, job, { verdict: "MANUAL_REVIEW", score: 30 }).ok).toBe(true);
  });
});

describe("reminders and priority", () => {
  const now = new Date("2026-09-27T00:00:00Z");
  const inHours = (h: number) => new Date(now.getTime() + h * 3_600_000);
  it.each([
    [200, null],
    [150, "7d"],
    [70, "3d"],
    [20, "24h"],
    [5, "6h"],
    [-1, null],
  ])("deadline in %sh → %s", (hours, key) => {
    expect(reminderWindow(inHours(hours), now)?.key ?? null).toBe(key);
  });
  it("high priority only for strong matches closing within 72h", () => {
    expect(isHighPriority({ verdict: "STRONG", score: 90 }, inHours(48), now)).toBe(true);
    expect(isHighPriority({ verdict: "POSSIBLE", score: 60 }, inHours(48), now)).toBe(false);
    expect(isHighPriority({ verdict: "STRONG", score: 90 }, inHours(100), now)).toBe(false);
  });
});

describe("Asia/Dhaka time", () => {
  it("date-only deadlines end at 23:59:59 in Dhaka", () => {
    expect(parseDhakaDate("15 October 2026")?.toISOString()).toBe("2026-10-15T17:59:59.000Z");
    expect(parseDhakaDate("October 15, 2026")?.toISOString()).toBe("2026-10-15T17:59:59.000Z");
    expect(parseDhakaDate("15th Oct 2026")?.toISOString()).toBe("2026-10-15T17:59:59.000Z");
    expect(parseDhakaDate("2026-02-30")).toBeNull();
    expect(parseDhakaDate("soon")).toBeNull();
  });
  it("day keys and formatting use Dhaka, not UTC", () => {
    const lateUtc = new Date("2026-09-27T20:00:00Z"); // 02:00 on 28 Sep in Dhaka
    expect(dhakaDateKey(lateUtc)).toBe("2026-09-28");
    expect(startOfDhakaDay(lateUtc).toISOString()).toBe("2026-09-27T18:00:00.000Z");
    expect(formatDhakaDateTime(lateUtc)).toContain("28 Sept 2026");
  });
  it("time-left labels", () => {
    const now = new Date("2026-09-27T00:00:00Z");
    expect(timeLeftLabel(null, now)).toBe("No deadline stated");
    expect(timeLeftLabel(new Date("2026-09-27T06:30:00Z"), now)).toBe("6 hours left");
    expect(timeLeftLabel(new Date("2026-10-02T00:00:00Z"), now)).toBe("5 days left");
    expect(timeLeftLabel(new Date("2026-09-26T00:00:00Z"), now)).toBe("Expired");
  });
});

describe("forms and filters", () => {
  it("only allows same-site redirect paths", () => {
    expect(safeRedirectPath("/jobs/abc")).toBe("/jobs/abc");
    expect(safeRedirectPath("//evil.example")).toBe("/");
    expect(safeRedirectPath("https://evil.example")).toBe("/");
    expect(safeRedirectPath("/\\evil.example")).toBe("/");
  });
  it("parses and sanitises job filters from the URL", () => {
    const f = parseJobFilters({ q: "  angular ", category: ["SOFTWARE_DEVELOPMENT", "BOGUS"], orgType: "PRIVATE_BANK,FOREIGN_BANK", myCgpa: "2.87", sort: "match", page: "2" });
    expect(f).toMatchObject({ q: "angular", category: ["SOFTWARE_DEVELOPMENT"], orgType: ["PRIVATE_BANK", "FOREIGN_BANK"], myCgpa: 2.87, sort: "match", page: 2 });
    expect(parseJobFilters({ sort: "hack", masters: "x" })).toMatchObject({ sort: undefined, masters: undefined });
  });
});
