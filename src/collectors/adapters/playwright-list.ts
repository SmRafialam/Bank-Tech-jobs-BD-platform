import * as cheerio from "cheerio";
import { env } from "@/lib/env";
import type { SourceAdapter } from "../types";
import { configNumber, configString, normalizeListItem, parseList, type ListItemRaw } from "./shared";

/**
 * Renders a JavaScript single-page app with headless Chromium, then parses the rendered DOM like `html-list`.
 * - robots.txt is checked before navigation;
 * - images, fonts and media are blocked to keep the footprint small;
 * - no login, no CAPTCHA solving, no stealth plugins: if the page is gated, the run fails and the admin marks the source manual.
 * Playwright is an optional dependency; enable with PLAYWRIGHT_ENABLED=true on a worker that has Chromium installed.
 */
export const playwrightListAdapter: SourceAdapter<ListItemRaw> = {
  id: "playwright-list",
  method: "PLAYWRIGHT",
  description: "JavaScript-rendered public listing (headless Chromium via Playwright), parsed with configured selectors.",
  async fetchJobs(ctx) {
    if (!env().PLAYWRIGHT_ENABLED) {
      throw new Error("Playwright collectors are disabled (set PLAYWRIGHT_ENABLED=true on a worker with Chromium installed).");
    }
    await ctx.http.assertAllowed(ctx.source.url);
    let playwright: typeof import("playwright");
    try {
      playwright = await import("playwright");
    } catch {
      throw new Error("The optional 'playwright' package is not installed on this host.");
    }
    const browser = await playwright.chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ userAgent: env().COLLECTOR_USER_AGENT, locale: "en-US", timezoneId: "Asia/Dhaka" });
      const page = await context.newPage();
      await page.route("**/*", (route) => {
        const type = route.request().resourceType();
        return ["image", "font", "media"].includes(type) ? route.abort() : route.continue();
      });
      const timeout = configNumber(ctx.source.config, "timeoutMs") ?? env().COLLECTOR_TIMEOUT_MS * 2;
      await page.goto(ctx.source.url, { waitUntil: "domcontentloaded", timeout });
      const waitFor = configString(ctx.source.config, "waitForSelector") ?? configString(ctx.source.config, "itemSelector");
      if (waitFor) await page.waitForSelector(waitFor, { timeout });
      const html = await page.content();
      return parseList(cheerio.load(html), ctx.source, page.url());
    } finally {
      await browser.close();
    }
  },
  normalizeJob(raw, { source }) {
    return normalizeListItem(raw, source);
  },
};
