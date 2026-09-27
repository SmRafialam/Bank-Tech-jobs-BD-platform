import type { SourceDefinition } from "./types";

/**
 * Source configuration. Every entry records *how* the source may be collected and *why*.
 * Compliance notes reflect checks made on 2026-09-27 (robots.txt, HTTP status, page structure) —
 * re-verify before enabling a source and whenever a site changes.
 *
 * Runtime state (enabled flag, interval, health) is stored in the database and editable from /admin/sources.
 * Running `npm run db:seed` creates missing sources but never overwrites admin changes.
 */
const OFFICIAL = 120; // official bank career pages and government portals: every 2 hours
const SLOW = 360; // rarely updated pages: every 6 hours

const manual = (
  key: string,
  name: string,
  organizationSlug: string | undefined,
  url: string,
  complianceNote: string,
  fetchIntervalMinutes = SLOW,
): SourceDefinition => ({
  key,
  name,
  organizationSlug,
  url,
  method: "MANUAL",
  adapter: "manual",
  enabledByDefault: true,
  fetchIntervalMinutes,
  complianceNote,
});

export const SOURCES: SourceDefinition[] = [
  // ── Automated, verified ────────────────────────────────────────────────────
  {
    key: "bcbl-career",
    name: "Bengal Commercial Bank — Career",
    organizationSlug: "bcbl",
    url: "https://www.bcblbd.com/career",
    method: "HTML",
    adapter: "html-table",
    enabledByDefault: true,
    fetchIntervalMinutes: OFFICIAL,
    complianceNote:
      "Official career page, static HTML table (Job Title / Starting Date / Ending Date / Summary). No robots.txt (HTTP 404) — crawling permitted. Verified 2026-09-27. Notices (results, viva, joining) are filtered out.",
    config: { headerMatch: "job title", columns: { title: 1, publishedAt: 2, deadline: 3, summary: 4 } },
  },
  {
    key: "nrb-bank-career",
    name: "NRB Bank — Career",
    organizationSlug: "nrb-bank",
    url: "https://nrbbankbd.com/career/",
    method: "HTML",
    adapter: "html-list",
    enabledByDefault: true,
    fetchIntervalMinutes: OFFICIAL,
    complianceNote:
      "Official career page, static HTML blocks (h3.job-offer-head + Apply link). robots.txt only disallows /courier and /e-signature. Verified 2026-09-27. Apply links that point to Bdjobs are stored as links only — Bdjobs is never fetched.",
    config: { itemSelector: "div:has(> h3.job-offer-head)", titleSelector: "h3.job-offer-head", linkSelector: "a.nrb-apply-tab[href]", linkPosition: "last" },
  },

  // ── Automated, needs selector verification (disabled by default) ─────────
  {
    key: "teletalk-alljobs",
    name: "Alljobs by Teletalk (government portal)",
    url: "https://alljobs.teletalk.com.bd/",
    method: "PLAYWRIGHT",
    adapter: "playwright-list",
    enabledByDefault: false,
    fetchIntervalMinutes: OFFICIAL,
    defaultOrgType: "GOVERNMENT",
    complianceNote:
      "Government job portal rendered client-side (React SPA). No robots.txt restrictions (the path serves the SPA shell). Requires PLAYWRIGHT_ENABLED=true on a worker. Selectors below are placeholders — verify them against the rendered DOM before enabling. Only IT roles at banks/financial institutions are kept.",
    config: {
      waitForSelector: "a[href*='job']",
      itemSelector: "[class*='job-card'], [class*='JobCard'], li:has(a[href*='job'])",
      titleSelector: "h2, h3, h4, a",
      linkSelector: "a[href]",
      linkPosition: "first",
      deadlineSelector: "[class*='deadline'], [class*='date']",
    },
  },

  // ── Manual / API required ─────────────────────────────────────────────────
  manual(
    "bb-erecruitment",
    "Bangladesh Bank e-Recruitment",
    "bangladesh-bank",
    "https://erecruitment.bb.org.bd/",
    "robots.txt is 'User-agent: * / Disallow: /' (verified 2026-09-27). Automated collection is not permitted — add Bangladesh Bank circulars manually with the official link.",
    OFFICIAL,
  ),
  manual(
    "bscs-notices",
    "Bankers' Selection Committee notices",
    "bscs",
    "https://erecruitment.bb.org.bd/",
    "BSCS circulars for state-owned banks are published on the Bangladesh Bank e-Recruitment portal, whose robots.txt disallows all crawlers. Manual entry only.",
    OFFICIAL,
  ),
  manual(
    "bb-website-notices",
    "Bangladesh Bank website notices",
    "bangladesh-bank",
    "https://www.bb.org.bd/",
    "No stable public career listing URL found (/en/index.php/career/index returned 404 on 2026-09-27). Circulars link to the e-Recruitment portal. Manual entry.",
    OFFICIAL,
  ),
  manual("bdjobs-links", "Bdjobs (links only)", undefined, "https://jobs.bdjobs.com/", "robots.txt disallows all generic crawlers (User-agent: * / Disallow: /). Never scraped. Store only manually submitted public job links."),
  manual("linkedin-links", "LinkedIn (links only)", undefined, "https://www.linkedin.com/jobs/", "LinkedIn terms prohibit scraping. Never collected automatically; manual links only. Private account data is never accessed."),
  manual("ebl-career", "Eastern Bank — Career (Bdjobs-hosted)", "ebl", "https://www.ebl.com.bd/career", "Career page redirects to ebl.bdjobs.com (Bdjobs-hosted portal; Bdjobs robots.txt disallows generic crawlers). Manual entry."),
  manual("city-bank-career", "City Bank — Careers", "city-bank", "https://www.citybankplc.com/p/careers", "Client-rendered Next.js page whose data comes from /api, which robots.txt disallows. Manual entry until an official feed/API is available."),
  manual("brac-bank-career", "BRAC Bank — Career", "brac-bank", "https://www.bracbank.com/en/career", "robots.txt allows crawling, but no job listing is present in the server-rendered HTML (verified 2026-09-27). Candidate for json-ld/html-list once the listing location is confirmed."),
  manual("mtb-career", "Mutual Trust Bank — Career", "mtb", "https://www.mutualtrustbank.com/about-us/career/", "Career page has no job listing markup (verified 2026-09-27); WordPress REST API returns 401. Vacancies are advertised externally. Manual entry."),
  manual("bkash-career", "bKash — Career", "bkash", "https://www.bkash.com/en/career", "Requests are rejected by a web application firewall (robots.txt also returns 'Request Rejected'). Never bypassed. Manual entry."),
  manual("nagad-career", "Nagad — Career", "nagad", "https://www.nagad.com.bd/career/", "HTTP 403 for automated requests (2026-09-27). Manual entry."),
  manual("pubali-career", "Pubali Bank — Career", "pubali-bank", "https://www.pubalibangla.com/career", "HTTP 403 for automated requests (2026-09-27). Manual entry."),
  manual("lankabangla-career", "LankaBangla Finance — Career", "lankabangla", "https://www.lankabangla.com/career/", "HTTP 403 for automated requests (2026-09-27). Manual entry."),
  manual("dbbl-career", "Dutch-Bangla Bank / Rocket — Career", "dbbl", "https://www.dutchbanglabank.com/", "Known career paths returned 404 (2026-09-27). Configure the correct URL and verify robots.txt before automating. Rocket (DBBL MFS) roles are listed under DBBL."),
  manual("ucb-career", "United Commercial Bank — Career", "ucb", "https://www.ucb.com.bd/", "/career returned 404 (2026-09-27). Manual entry."),
  manual("southeast-career", "Southeast Bank — Career", "southeast-bank", "https://www.southeastbank.com.bd/", "/career returned 404 (2026-09-27). Manual entry."),
  manual("sjibl-career", "Shahjalal Islami Bank — Career", "sjibl", "https://www.sjiblbd.com/", "/career returned 404 (2026-09-27). Manual entry."),
  manual("community-bank-career", "Community Bank — Career", "community-bank", "https://www.cbbl.com.bd/", "/career returned 404 (2026-09-27). Manual entry."),
  manual("trust-bank-career", "Trust Bank — Career", "trust-bank", "https://www.tblbd.com/career/", "Career URL returned 404 (2026-09-27). Manual entry."),
  manual("prime-bank-career", "Prime Bank — Career", "prime-bank", "https://www.primebank.com.bd/career", "Reachable, but no machine-readable listing found in the HTML (2026-09-27). Candidate for html-list once selectors are verified."),
  manual("ific-career", "IFIC Bank — Career", "ific", "https://ificbank.com.bd/career", "Reachable, but no job listing markup found (2026-09-27). Candidate for html-list after verification."),
  manual("standard-bank-career", "Standard Bank — Career", "standard-bank", "https://www.standardbankbd.com/career", "Reachable; listing structure not yet verified (2026-09-27). Candidate for html-list/html-table."),
  manual("shimanto-career", "Shimanto Bank — Career", "shimanto-bank", "https://www.shimantobank.com/career", "Reachable; listing structure not yet verified (2026-09-27)."),
  manual("nrbc-career", "NRBC Bank — Career", "nrbc-bank", "https://www.nrbcommercialbank.com/career", "Reachable; listing structure not yet verified (2026-09-27)."),
  manual("bank-asia-career", "Bank Asia — Career", "bank-asia", "https://www.bankasia-bd.com/about/career", "Reachable; listing structure not yet verified (2026-09-27)."),
  manual("ibbl-career", "Islami Bank — Career portal", "ibbl", "https://career.islamibankbd.com/", "Separate career portal (client-rendered). Not verified — possible Playwright candidate if robots.txt allows."),
  manual("idlc-career", "IDLC Finance — Career", "idlc", "https://apps.idlc.com/career", "Career app (client-rendered). Not verified — manual entry for now."),
  manual("ipdc-career", "IPDC Finance — Career", "ipdc", "https://www.ipdcbd.com/career/", "Connection timed out during verification (2026-09-27). Manual entry."),
  manual("scb-career", "Standard Chartered — Careers", "scb", "https://www.sc.com/bd/", "Global careers platform; Bangladesh careers path returned 404 (2026-09-27). Use official links manually."),
  manual("hsbc-career", "HSBC — Careers", "hsbc", "https://www.hsbc.com/careers", "Global careers platform (not reachable during verification, 2026-09-27). Use official links manually."),
  manual("public-banks-notices", "State-owned bank notices (Sonali, Janata, Agrani, Rupali, BDBL, BKB)", undefined, "https://erecruitment.bb.org.bd/", "Recruitment for state-owned banks runs through BSCS on the Bangladesh Bank e-Recruitment portal (crawling disallowed). Manual entry."),
];

export function sourceByKey(key: string) {
  return SOURCES.find((s) => s.key === key);
}
