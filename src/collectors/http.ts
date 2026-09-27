import { sleep } from "@/lib/utils";
import { ALLOW_ALL, DISALLOW_ALL, parseRobots, type RobotsPolicy } from "./robots";
import { AccessDeniedError, RobotsDisallowedError } from "./types";

export interface HttpClientOptions {
  userAgent: string;
  minDelayMs: number;
  maxRetries: number;
  timeoutMs: number;
  /** Base for exponential backoff. */
  backoffBaseMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleepImpl?: (ms: number) => Promise<void>;
}

export interface HttpResponse {
  url: string;
  status: number;
  contentType: string;
  text: string;
}

const ROBOTS_TTL_MS = 6 * 60 * 60 * 1000;
const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * Polite HTTP client used by every adapter:
 * - robots.txt is fetched (cached 6 h) and enforced for our user-agent token;
 * - one request at a time per host with a minimum delay (or the site's Crawl-delay, whichever is larger);
 * - retries with exponential backoff + jitter on 408/425/429/5xx and network errors, honouring Retry-After;
 * - 401/403 are never retried or worked around — they surface as AccessDeniedError.
 */
export class PoliteHttpClient {
  private readonly opts: Required<Omit<HttpClientOptions, "fetchImpl" | "now" | "sleepImpl">>;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly robotsCache = new Map<string, { policy: RobotsPolicy; expires: number }>();
  private readonly hostQueues = new Map<string, Promise<unknown>>();
  private readonly lastRequestAt = new Map<string, number>();
  readonly userAgentToken: string;

  constructor(options: HttpClientOptions) {
    this.opts = { backoffBaseMs: 1000, ...options } as PoliteHttpClient["opts"];
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleepImpl ?? sleep;
    this.userAgentToken = options.userAgent.split(/[\s/]/)[0];
  }

  async get(url: string, accept = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"): Promise<HttpResponse> {
    const target = new URL(url);
    const policy = await this.robotsFor(target);
    if (!policy.isAllowed(`${target.pathname}${target.search}`)) throw new RobotsDisallowedError(url);
    const delay = Math.max(this.opts.minDelayMs, (policy.crawlDelaySeconds ?? 0) * 1000);
    return this.enqueue(target.host, delay, () => this.fetchWithRetry(url, accept));
  }

  /** Check robots.txt without fetching the page (used by the Playwright adapter before navigating). */
  async assertAllowed(url: string): Promise<void> {
    const target = new URL(url);
    const policy = await this.robotsFor(target);
    if (!policy.isAllowed(`${target.pathname}${target.search}`)) throw new RobotsDisallowedError(url);
  }

  private async robotsFor(target: URL): Promise<RobotsPolicy> {
    const origin = target.origin;
    const cached = this.robotsCache.get(origin);
    if (cached && cached.expires > this.now()) return cached.policy;

    let policy: RobotsPolicy;
    try {
      const res = await this.enqueue(target.host, this.opts.minDelayMs, () => this.fetchOnce(`${origin}/robots.txt`, "text/plain"));
      if (res.status >= 200 && res.status < 300) {
        // Some SPAs answer every path with their HTML shell — that is not a robots.txt.
        const looksLikeHtml = res.contentType.includes("html") && /<html|<!doctype/i.test(res.text.slice(0, 500));
        policy = looksLikeHtml ? ALLOW_ALL : parseRobots(res.text, this.userAgentToken);
      } else if (res.status === 401 || res.status === 403 || res.status >= 500) {
        // Conservative: treat an inaccessible robots.txt as a full disallow.
        policy = DISALLOW_ALL;
      } else {
        policy = ALLOW_ALL; // 404 and other 4xx: no robots.txt
      }
    } catch {
      policy = DISALLOW_ALL;
    }
    this.robotsCache.set(origin, { policy, expires: this.now() + ROBOTS_TTL_MS });
    return policy;
  }

  private enqueue<T>(host: string, delayMs: number, task: () => Promise<T>): Promise<T> {
    const previous = this.hostQueues.get(host) ?? Promise.resolve();
    const run = previous
      .catch(() => undefined)
      .then(async () => {
        const last = this.lastRequestAt.get(host);
        if (last != null) {
          const wait = last + delayMs - this.now();
          if (wait > 0) await this.sleep(wait);
        }
        try {
          return await task();
        } finally {
          this.lastRequestAt.set(host, this.now());
        }
      });
    this.hostQueues.set(host, run);
    return run;
  }

  private async fetchWithRetry(url: string, accept: string): Promise<HttpResponse> {
    let attempt = 0;
    for (;;) {
      try {
        const res = await this.fetchOnce(url, accept);
        if (res.status === 401 || res.status === 403) throw new AccessDeniedError(url, res.status);
        if (RETRYABLE.has(res.status) && attempt < this.opts.maxRetries) {
          await this.sleep(this.backoff(attempt, res.retryAfterMs));
          attempt++;
          continue;
        }
        if (res.status >= 400) throw new Error(`HTTP ${res.status} for ${url}`);
        return res;
      } catch (error) {
        if (error instanceof AccessDeniedError || (error instanceof Error && error.message.startsWith("HTTP "))) throw error;
        if (attempt >= this.opts.maxRetries) throw error;
        await this.sleep(this.backoff(attempt));
        attempt++;
      }
    }
  }

  private backoff(attempt: number, retryAfterMs?: number | null): number {
    const exp = this.opts.backoffBaseMs * 2 ** attempt;
    const jitter = Math.random() * this.opts.backoffBaseMs;
    return Math.min(Math.max(exp + jitter, retryAfterMs ?? 0), 5 * 60 * 1000);
  }

  private async fetchOnce(url: string, accept: string): Promise<HttpResponse & { retryAfterMs: number | null }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
    try {
      const res = await this.fetchImpl(url, {
        headers: { "User-Agent": this.opts.userAgent, Accept: accept, "Accept-Language": "en;q=0.9,bn;q=0.8" },
        redirect: "follow",
        signal: controller.signal,
      });
      const text = await res.text();
      const retryAfter = res.headers.get("retry-after");
      let retryAfterMs: number | null = null;
      if (retryAfter) {
        const seconds = Number(retryAfter);
        retryAfterMs = Number.isFinite(seconds) ? seconds * 1000 : Math.max(0, new Date(retryAfter).getTime() - this.now());
      }
      return { url: res.url || url, status: res.status, contentType: res.headers.get("content-type") ?? "", text, retryAfterMs };
    } finally {
      clearTimeout(timer);
    }
  }
}
