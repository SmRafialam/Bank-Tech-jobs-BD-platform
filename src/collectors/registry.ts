import { htmlListAdapter } from "./adapters/html-list";
import { htmlTableAdapter } from "./adapters/html-table";
import { jsonLdAdapter } from "./adapters/json-ld";
import { playwrightListAdapter } from "./adapters/playwright-list";
import { rssAdapter } from "./adapters/rss";
import type { SourceAdapter } from "./types";

/** Manual sources are never fetched; jobs are added through the admin panel or the public submission form. */
export const manualAdapter: SourceAdapter<never> = {
  id: "manual",
  method: "MANUAL",
  description: "Manual/API required — the source cannot be collected automatically (robots.txt, login, WAF, or no public listing).",
  async fetchJobs() {
    return [];
  },
  normalizeJob() {
    return null;
  },
};

const ADAPTERS: SourceAdapter<unknown>[] = [
  htmlTableAdapter as SourceAdapter<unknown>,
  htmlListAdapter as SourceAdapter<unknown>,
  jsonLdAdapter as SourceAdapter<unknown>,
  rssAdapter as SourceAdapter<unknown>,
  playwrightListAdapter as SourceAdapter<unknown>,
  manualAdapter as SourceAdapter<unknown>,
];

export function getAdapter(id: string): SourceAdapter<unknown> | undefined {
  return ADAPTERS.find((a) => a.id === id);
}

export function listAdapters() {
  return ADAPTERS.map(({ id, method, description }) => ({ id, method, description }));
}
