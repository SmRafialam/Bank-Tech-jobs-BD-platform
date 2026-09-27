import type { CheerioAPI } from "cheerio";
import { parseDhakaDate } from "@/lib/time";
import type { NormalizedJobInput, SourceContext } from "../types";

/** Announcements that are not job postings (results, viva schedules, joining notices…). */
const NOTICE = /\b(result|results|viva|admit card|appointment letters?|postponed|rescheduled|seat plan|exam schedule|interview schedule|joining formalities|merit list|corrigendum)\b/i;
const HIRING = /\b(recruitment|circular|vacanc(y|ies)|hiring|job opening|apply)\b/i;

export function isNonJobNotice(title: string): boolean {
  return NOTICE.test(title) && !HIRING.test(title.replace(NOTICE, ""));
}

export function cleanText(value: string | undefined | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function absoluteUrl(href: string | undefined | null, base: string): string | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("javascript:") || trimmed.startsWith("mailto:") || trimmed === "#") return null;
  try {
    const url = new URL(trimmed, base);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function configString(config: Record<string, unknown>, key: string, fallback?: string): string | undefined {
  const value = config[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export function configNumber(config: Record<string, unknown>, key: string): number | undefined {
  const value = config[key];
  return typeof value === "number" ? value : undefined;
}

export interface ListItemRaw {
  title: string;
  link: string | null;
  detailLink: string | null;
  deadlineText: string | null;
  publishedText: string | null;
  department: string | null;
  summary: string | null;
  sourceJobId: string | null;
  pageUrl: string;
}

/** Parse a repeated-block listing (cards, list items, headings with links) using configured selectors. */
export function parseList($: CheerioAPI, source: SourceContext, pageUrl: string): ListItemRaw[] {
  const cfg = source.config;
  const itemSelector = configString(cfg, "itemSelector");
  if (!itemSelector) throw new Error(`Source ${source.key}: config.itemSelector is required`);
  const titleSelector = configString(cfg, "titleSelector", "h1, h2, h3, h4, a")!;
  const linkSelector = configString(cfg, "linkSelector", "a[href]")!;
  const linkPosition = configString(cfg, "linkPosition", "last");
  const detailSel = configString(cfg, "detailLinkSelector");
  const idAttribute = configString(cfg, "idAttribute");
  const items: ListItemRaw[] = [];

  $(itemSelector).each((_, el) => {
    const item = $(el);
    const title = cleanText(item.find(titleSelector).first().text());
    if (!title) return;
    const links = item
      .find(linkSelector)
      .toArray()
      .map((a) => absoluteUrl($(a).attr("href"), pageUrl))
      .filter((u): u is string => Boolean(u));
    const pick = (sel: string | undefined) => (sel ? cleanText(item.find(sel).first().text()) || null : null);
    items.push({
      title,
      link: (linkPosition === "first" ? links[0] : links[links.length - 1]) ?? null,
      detailLink: detailSel ? absoluteUrl(item.find(detailSel).first().attr("href"), pageUrl) : links.length > 1 ? links[0] : null,
      deadlineText: pick(configString(cfg, "deadlineSelector")),
      publishedText: pick(configString(cfg, "publishedSelector")),
      department: pick(configString(cfg, "departmentSelector")),
      summary: pick(configString(cfg, "summarySelector")),
      sourceJobId: idAttribute ? (item.attr(idAttribute) ?? null) : null,
      pageUrl,
    });
  });
  return items;
}

export function normalizeListItem(raw: ListItemRaw, source: SourceContext): NormalizedJobInput | null {
  if (isNonJobNotice(raw.title)) return null;
  return {
    sourceJobId: raw.sourceJobId,
    title: raw.title,
    organizationSlug: source.organizationSlug ?? null,
    department: raw.department,
    description: [raw.title, raw.department, raw.summary, raw.deadlineText ? `Deadline: ${raw.deadlineText}` : null].filter(Boolean).join("\n"),
    deadline: parseDhakaDate(raw.deadlineText),
    publishedAt: parseDhakaDate(raw.publishedText),
    applicationUrl: raw.link,
    sourceUrl: raw.detailLink ?? raw.link ?? raw.pageUrl,
  };
}
