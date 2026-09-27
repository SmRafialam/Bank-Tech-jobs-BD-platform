import { describe, expect, it, vi } from "vitest";
import { PoliteHttpClient } from "@/collectors/http";
import { parseRobots } from "@/collectors/robots";
import { AccessDeniedError, RobotsDisallowedError } from "@/collectors/types";

describe("parseRobots", () => {
  it("blocks everything for Bangladesh Bank e-Recruitment style robots.txt", () => {
    const p = parseRobots("User-agent: *\nDisallow: /", "BankTechJobsBD");
    expect(p.isAllowed("/")).toBe(false);
    expect(p.isAllowed("/onlineapp/joblist.php")).toBe(false);
  });

  it("merges multiple '*' groups (Bdjobs style) and lets named crawlers through", () => {
    const txt = "User-agent: *\nDisallow: /apps/\n\nUser-agent: Googlebot\nDisallow:\n\nUser-agent: *\nDisallow: /";
    expect(parseRobots(txt, "BankTechJobsBD").isAllowed("/jobdetails.asp")).toBe(false);
    expect(parseRobots(txt, "Googlebot").isAllowed("/jobdetails.asp")).toBe(true);
  });

  it("longest match wins, Allow wins ties, wildcards and $ anchors", () => {
    const p = parseRobots("User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\nDisallow: /*.pdf$\nCrawl-delay: 10", "Bot");
    expect(p.isAllowed("/wp-admin/options.php")).toBe(false);
    expect(p.isAllowed("/wp-admin/admin-ajax.php")).toBe(true);
    expect(p.isAllowed("/files/circular.pdf")).toBe(false);
    expect(p.isAllowed("/files/circular.pdf?x=1")).toBe(true);
    expect(p.isAllowed("/career/")).toBe(true);
    expect(p.crawlDelaySeconds).toBe(10);
  });
});

function response(status: number, body = "", headers: Record<string, string> = {}) {
  return new Response(body, { status, headers: { "content-type": "text/plain", ...headers } });
}

function client(fetchImpl: typeof fetch, extra: Partial<ConstructorParameters<typeof PoliteHttpClient>[0]> = {}) {
  let clock = 0;
  const sleeps: number[] = [];
  const c = new PoliteHttpClient({
    userAgent: "BankTechJobsBD/0.1 (+test)",
    minDelayMs: 5000,
    maxRetries: 2,
    timeoutMs: 1000,
    backoffBaseMs: 100,
    fetchImpl,
    now: () => clock,
    sleepImpl: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    ...extra,
  });
  return { c, sleeps };
}

describe("PoliteHttpClient", () => {
  it("refuses URLs disallowed by robots.txt without fetching them", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => (String(url).endsWith("/robots.txt") ? response(200, "User-agent: *\nDisallow: /") : response(200, "page")));
    const { c } = client(fetchImpl as unknown as typeof fetch);
    await expect(c.get("https://erecruitment.example/")).rejects.toBeInstanceOf(RobotsDisallowedError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries 503 with backoff, and enforces the per-domain delay between requests", async () => {
    let pageCalls = 0;
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith("/robots.txt")) return response(404);
      pageCalls++;
      return pageCalls === 1 ? response(503) : response(200, "ok");
    });
    const { c, sleeps } = client(fetchImpl as unknown as typeof fetch);
    const res = await c.get("https://bank.example/career");
    expect(res.text).toBe("ok");
    expect(pageCalls).toBe(2);
    // 1st sleep: per-domain delay after robots.txt; 2nd: backoff before retry.
    expect(sleeps[0]).toBe(5000);
    expect(sleeps[1]).toBeGreaterThanOrEqual(100);
  });

  it("honours Retry-After on 429", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith("/robots.txt")) return response(404);
      calls++;
      return calls === 1 ? response(429, "", { "retry-after": "30" }) : response(200, "ok");
    });
    const { c, sleeps } = client(fetchImpl as unknown as typeof fetch);
    await c.get("https://bank.example/career");
    expect(sleeps).toContain(30_000);
  });

  it("never retries or works around 403", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith("/robots.txt")) return response(404);
      calls++;
      return response(403, "Request Rejected");
    });
    const { c } = client(fetchImpl as unknown as typeof fetch);
    await expect(c.get("https://waf.example/career")).rejects.toBeInstanceOf(AccessDeniedError);
    expect(calls).toBe(1);
  });

  it("treats an HTML SPA shell served at /robots.txt as 'no robots.txt'", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      String(url).endsWith("/robots.txt") ? new Response("<!doctype html><html><body><div id=root></div></body></html>", { status: 200, headers: { "content-type": "text/html" } }) : response(200, "ok"),
    );
    const { c } = client(fetchImpl as unknown as typeof fetch);
    await expect(c.get("https://spa.example/jobs")).resolves.toMatchObject({ text: "ok" });
  });

  it("sends a descriptive user agent", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)["User-Agent"]).toBe("BankTechJobsBD/0.1 (+test)");
      return response(404);
    });
    const { c } = client(fetchImpl as unknown as typeof fetch);
    await c.get("https://bank.example/").catch(() => undefined);
    expect(fetchImpl).toHaveBeenCalled();
  });
});
