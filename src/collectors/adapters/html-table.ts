import * as cheerio from "cheerio";
import { parseDhakaDate } from "@/lib/time";
import type { NormalizedJobInput, SourceAdapter, SourceContext } from "../types";
import { absoluteUrl, cleanText, configString, isNonJobNotice } from "./shared";

export interface TableRowRaw {
  cells: string[];
  links: (string | null)[];
  rowId: string | null;
  pageUrl: string;
}

interface Columns {
  title: number;
  department?: number;
  publishedAt?: number;
  deadline?: number;
  summary?: number;
  link?: number;
}

function columns(source: SourceContext): Columns {
  const cols = source.config.columns as Columns | undefined;
  if (!cols || typeof cols.title !== "number") throw new Error(`Source ${source.key}: config.columns.title is required`);
  return cols;
}

/** Parse every data row of the first table whose header contains `headerMatch`. HTML comments are ignored by the parser. */
export function parseTable(html: string, source: SourceContext, pageUrl: string): TableRowRaw[] {
  const $ = cheerio.load(html);
  const headerMatch = configString(source.config, "headerMatch")?.toLowerCase();
  const tableSelector = configString(source.config, "tableSelector", "table")!;
  const table = $(tableSelector)
    .filter((_, t) => !headerMatch || $(t).find("tr").first().text().toLowerCase().includes(headerMatch))
    .first();
  if (!table.length) return [];
  const rows: TableRowRaw[] = [];
  table.find("tr").each((_, tr) => {
    const row = $(tr);
    if (row.find("th").length && !row.find("td").length) return; // header row
    const cells = row.children("td, th");
    if (!cells.length) return;
    rows.push({
      cells: cells.toArray().map((c) => cleanText($(c).text())),
      links: cells.toArray().map((c) => absoluteUrl($(c).find("a[href]").first().attr("href"), pageUrl)),
      rowId: row.find("[id]").first().attr("id") ?? null,
      pageUrl,
    });
  });
  return rows;
}

export const htmlTableAdapter: SourceAdapter<TableRowRaw> = {
  id: "html-table",
  method: "HTML",
  description: "Static HTML table on an official career page (Cheerio).",
  async fetchJobs(ctx) {
    const res = await ctx.http.get(ctx.source.url);
    return parseTable(res.text, ctx.source, res.url);
  },
  normalizeJob(raw, { source }): NormalizedJobInput | null {
    const cols = columns(source);
    const at = (i?: number) => (i == null ? null : raw.cells[i] || null);
    const title = at(cols.title);
    if (!title || isNonJobNotice(title)) return null;
    const link = cols.link != null ? raw.links[cols.link] : raw.links[cols.title];
    const summary = at(cols.summary);
    const deadlineText = at(cols.deadline);
    return {
      sourceJobId: raw.rowId,
      title,
      organizationSlug: source.organizationSlug ?? null,
      department: at(cols.department),
      description: [title, at(cols.department), summary, deadlineText ? `Deadline: ${deadlineText}` : null].filter(Boolean).join("\n"),
      publishedAt: parseDhakaDate(at(cols.publishedAt)),
      deadline: parseDhakaDate(deadlineText),
      applicationUrl: link ?? null,
      sourceUrl: raw.pageUrl,
    };
  },
};
