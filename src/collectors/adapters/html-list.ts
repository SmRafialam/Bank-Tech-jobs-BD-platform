import * as cheerio from "cheerio";
import type { SourceAdapter } from "../types";
import { normalizeListItem, parseList, type ListItemRaw } from "./shared";

export const htmlListAdapter: SourceAdapter<ListItemRaw> = {
  id: "html-list",
  method: "HTML",
  description: "Repeated job blocks (cards / headings with links) on a static HTML page (Cheerio).",
  async fetchJobs(ctx) {
    const res = await ctx.http.get(ctx.source.url);
    return parseList(cheerio.load(res.text), ctx.source, res.url);
  },
  normalizeJob(raw, { source }) {
    return normalizeListItem(raw, source);
  },
};
