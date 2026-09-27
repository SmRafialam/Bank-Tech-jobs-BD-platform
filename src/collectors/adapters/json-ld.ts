import * as cheerio from "cheerio";
import { htmlToText } from "@/lib/jobs/normalize";
import { parseDhakaDate } from "@/lib/time";
import type { NormalizedJobInput, SourceAdapter } from "../types";
import { absoluteUrl, configNumber, configString } from "./shared";

type Json = Record<string, unknown>;

export interface JsonLdJobRaw {
  posting: Json;
  pageUrl: string;
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function str(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object" && "name" in value) return str((value as Json).name);
  if (value && typeof value === "object" && "value" in value) return str((value as Json).value);
  return null;
}

function isJobPosting(node: Json): boolean {
  return asArray(node["@type"] as string | string[]).some((t) => String(t).toLowerCase() === "jobposting");
}

function collect(node: unknown, out: Json[]) {
  if (Array.isArray(node)) {
    for (const n of node) collect(n, out);
    return;
  }
  if (!node || typeof node !== "object") return;
  const obj = node as Json;
  if (isJobPosting(obj)) out.push(obj);
  if (obj["@graph"]) collect(obj["@graph"], out);
}

/** Extract every schema.org JobPosting from the JSON-LD blocks of a page. Invalid JSON blocks are skipped. */
export function extractJobPostings(html: string): Json[] {
  const $ = cheerio.load(html);
  const postings: Json[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).contents().text();
    try {
      collect(JSON.parse(text), postings);
    } catch {
      // Malformed JSON-LD — ignore this block.
    }
  });
  return postings;
}

const EMPLOYMENT: Record<string, NonNullable<NormalizedJobInput["employmentType"]>> = {
  FULL_TIME: "FULL_TIME",
  PART_TIME: "PART_TIME",
  CONTRACTOR: "CONTRACT",
  TEMPORARY: "CONTRACT",
  INTERN: "INTERNSHIP",
};

function formatSalary(base: unknown): string | null {
  if (!base || typeof base !== "object") return str(base);
  const b = base as Json;
  const currency = str(b.currency) ?? "BDT";
  const value = b.value as Json | number | undefined;
  if (typeof value === "number") return `${currency} ${value.toLocaleString("en-US")}`;
  if (value && typeof value === "object") {
    const min = value.minValue as number | undefined;
    const max = value.maxValue as number | undefined;
    const unit = str(value.unitText)?.toLowerCase();
    const range = min && max ? `${min.toLocaleString("en-US")}–${max.toLocaleString("en-US")}` : (min ?? max ?? str(value.value))?.toLocaleString();
    return range ? `${currency} ${range}${unit ? ` per ${unit}` : ""}` : null;
  }
  return null;
}

export const jsonLdAdapter: SourceAdapter<JsonLdJobRaw> = {
  id: "json-ld",
  method: "JSON_LD",
  description: "schema.org JobPosting structured data embedded in public pages (preferred over HTML scraping).",
  async fetchJobs(ctx) {
    const res = await ctx.http.get(ctx.source.url);
    const out: JsonLdJobRaw[] = extractJobPostings(res.text).map((posting) => ({ posting, pageUrl: res.url }));
    // Optionally follow links to detail pages that carry their own JobPosting markup.
    const follow = configString(ctx.source.config, "followLinkSelector");
    if (follow) {
      const $ = cheerio.load(res.text);
      const max = configNumber(ctx.source.config, "maxDetailPages") ?? 20;
      const links = [...new Set($(follow).toArray().map((a) => absoluteUrl($(a).attr("href"), res.url)).filter(Boolean) as string[])].slice(0, max);
      for (const link of links) {
        try {
          const detail = await ctx.http.get(link);
          for (const posting of extractJobPostings(detail.text)) out.push({ posting, pageUrl: detail.url });
        } catch (error) {
          ctx.log(`detail page failed ${link}: ${(error as Error).message}`);
        }
      }
    }
    return out;
  },
  normalizeJob({ posting, pageUrl }, { source }) {
    const title = str(posting.title);
    if (!title) return null;
    const description = htmlToText(str(posting.description) ?? "");
    const org = posting.hiringOrganization as Json | undefined;
    const locations = asArray(posting.jobLocation as Json | Json[]).map((l) => {
      const address = (l?.address ?? {}) as Json;
      return [str(address.addressLocality), str(address.addressRegion)].filter(Boolean).join(", ");
    });
    const remote = str(posting.jobLocationType)?.toUpperCase() === "TELECOMMUTE";
    const months = (posting.experienceRequirements as Json | undefined)?.monthsOfExperience;
    const identifier = posting.identifier as Json | string | undefined;
    const education = asArray(posting.educationRequirements as unknown).map((e) => str(e)).filter(Boolean).join("; ");
    const applyUrl = absoluteUrl(str(posting.url) ?? pageUrl, pageUrl);
    const employment = asArray(posting.employmentType as string | string[])[0];
    return {
      sourceJobId: typeof identifier === "object" ? str(identifier?.value) : str(identifier),
      title,
      organizationSlug: source.organizationSlug ?? null,
      organizationName: str(org?.name),
      department: str(posting.occupationalCategory) ?? str(posting.industry),
      description: [description, education ? `Education: ${education}` : null, str(posting.qualifications), str(posting.skills)].filter(Boolean).join("\n"),
      location: locations.filter(Boolean).join(" / ") || null,
      workMode: remote ? "REMOTE" : null,
      employmentType: employment ? (EMPLOYMENT[String(employment).toUpperCase()] ?? null) : null,
      salary: formatSalary(posting.baseSalary),
      vacancies: typeof posting.totalJobOpenings === "number" ? posting.totalJobOpenings : null,
      publishedAt: parseDhakaDate(str(posting.datePosted)),
      deadline: parseDhakaDate(str(posting.validThrough)),
      applicationUrl: applyUrl,
      sourceUrl: pageUrl,
      hints: typeof months === "number" ? { minExperienceYears: Math.round((months / 12) * 10) / 10 } : undefined,
    };
  },
};
