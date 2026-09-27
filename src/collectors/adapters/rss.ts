import * as cheerio from "cheerio";
import { htmlToText } from "@/lib/jobs/normalize";
import { parseDhakaDate } from "@/lib/time";
import type { SourceAdapter } from "../types";
import { absoluteUrl, cleanText, configString, isNonJobNotice } from "./shared";

export interface FeedItemRaw {
  title: string;
  link: string | null;
  guid: string | null;
  description: string;
  published: string | null;
  categories: string[];
  feedUrl: string;
}

/** Parse RSS 2.0 and Atom feeds. */
export function parseFeed(xml: string, feedUrl: string): FeedItemRaw[] {
  const $ = cheerio.load(xml, { xml: true });
  const items: FeedItemRaw[] = [];
  $("item").each((_, el) => {
    const item = $(el);
    items.push({
      title: cleanText(item.children("title").text()),
      link: absoluteUrl(cleanText(item.children("link").text()), feedUrl),
      guid: cleanText(item.children("guid").text()) || null,
      description: item.children("description").text() || item.children("content\\:encoded").text(),
      published: cleanText(item.children("pubDate").text()) || null,
      categories: item.children("category").toArray().map((c) => cleanText($(c).text())),
      feedUrl,
    });
  });
  $("entry").each((_, el) => {
    const entry = $(el);
    const link = entry.children("link[rel='alternate']").attr("href") ?? entry.children("link").first().attr("href");
    items.push({
      title: cleanText(entry.children("title").text()),
      link: absoluteUrl(link, feedUrl),
      guid: cleanText(entry.children("id").text()) || null,
      description: entry.children("summary").text() || entry.children("content").text(),
      published: cleanText(entry.children("published").text() || entry.children("updated").text()) || null,
      categories: entry.children("category").toArray().map((c) => $(c).attr("term") ?? ""),
      feedUrl,
    });
  });
  return items.filter((i) => i.title);
}

export const rssAdapter: SourceAdapter<FeedItemRaw> = {
  id: "rss",
  method: "RSS",
  description: "Public RSS/Atom feed of job circulars.",
  async fetchJobs(ctx) {
    const res = await ctx.http.get(ctx.source.url, "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8");
    const items = parseFeed(res.text, res.url);
    const filter = configString(ctx.source.config, "titleFilter");
    return filter ? items.filter((i) => new RegExp(filter, "i").test(i.title)) : items;
  },
  normalizeJob(raw, { source }) {
    if (isNonJobNotice(raw.title)) return null;
    const text = htmlToText(raw.description);
    // Many BD feeds put the employer in the title: "Senior Officer (IT) — Example Bank PLC".
    const split = raw.title.split(/\s+[-–—|]\s+|\s+at\s+/i);
    const orgFromTitle = !source.organizationSlug && split.length > 1 ? split[split.length - 1] : null;
    const title = orgFromTitle ? split.slice(0, -1).join(" - ") : raw.title;
    return {
      sourceJobId: raw.guid,
      title,
      organizationSlug: source.organizationSlug ?? null,
      organizationName: orgFromTitle,
      department: raw.categories[0] ?? null,
      description: `${title}\n${text}`,
      publishedAt: parseDhakaDate(raw.published) ?? (raw.published ? safeDate(raw.published) : null),
      deadline: null, // extracted from text by the ingest pipeline
      applicationUrl: raw.link,
      sourceUrl: raw.link ?? raw.feedUrl,
    };
  },
};

function safeDate(value: string): Date | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
