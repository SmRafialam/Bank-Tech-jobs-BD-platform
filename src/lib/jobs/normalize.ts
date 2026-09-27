import { createHash } from "node:crypto";
import sanitizeHtml from "sanitize-html";
import { dhakaDateKey } from "@/lib/time";

const TITLE_EXPANSIONS: [RegExp, string][] = [
  [/\bsr\.?(?=\s|$)/g, "senior"],
  [/\bjr\.?(?=\s|$)/g, "junior"],
  [/\basst\.?(?=\s|$)/g, "assistant"],
  [/\bmgr\.?(?=\s|$)/g, "manager"],
  [/\bexec\.?(?=\s|$)/g, "executive"],
  [/\bengr\.?(?=\s|$)/g, "engineer"],
  [/\bdev\b/g, "developer"],
  [/\bmto\b/g, "management trainee officer"],
  [/\bict\b/g, "it"],
  [/\binformation technology\b/g, "it"],
  [/\bsqa\b/g, "qa"],
  [/\bavp\b/g, "assistant vice president"],
  [/\bvp\b/g, "vice president"],
];

const TITLE_NOISE = /\b(urgent|hiring|job|circular|vacancy|position|post|recruitment|required|wanted|for|the|of|and|in|at)\b/g;

/** Lowercase, expand abbreviations, strip punctuation and noise words. */
export function normalizeTitle(title: string): string {
  let t = title.toLowerCase().replace(/&/g, " and ");
  for (const [re, replacement] of TITLE_EXPANSIONS) t = t.replace(re, replacement);
  return t
    .replace(/[()[\]{}\-–—_/,.:;|'"!?]+/g, " ")
    .replace(TITLE_NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeOrgName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(plc|ltd|limited|pvt|private|bangladesh|bd|the|company)\b/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const TRACKING_PARAMS = /^(utm_|fbclid|gclid|ref$|source$|mc_)/i;

/** Canonical URL used for duplicate detection: lowercase host, no hash, no tracking params, sorted query. */
export function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    u.protocol = "https:";
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
    const params = [...u.searchParams.entries()].filter(([k]) => !TRACKING_PARAMS.test(k)).sort(([a], [b]) => a.localeCompare(b));
    u.search = params.length ? `?${params.map(([k, v]) => `${encodeURIComponent(k.toLowerCase())}=${encodeURIComponent(v)}`).join("&")}` : "";
    let out = u.toString();
    if (out.endsWith("/") && u.pathname !== "/") out = out.slice(0, -1);
    return out;
  } catch {
    return null;
  }
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** `org|title|deadline-day` — same posting published on several platforms collapses to one fingerprint. */
export function jobFingerprint(orgSlug: string, title: string, deadline: Date | null): string {
  const deadlineKey = deadline ? dhakaDateKey(deadline) : "none";
  return sha256(`${orgSlug}|${normalizeTitle(title)}|${deadlineKey}`).slice(0, 40);
}

export function contentHash(parts: (string | null | undefined)[]): string {
  return sha256(parts.map((p) => (p ?? "").toLowerCase().replace(/\s+/g, " ").trim()).join("\u0001"));
}

/** Strip every HTML tag and collapse whitespace — collected text is always stored as plain text. */
export function htmlToText(html: string): string {
  const withBreaks = html.replace(/<(br|\/p|\/li|\/div|\/h[1-6]|\/tr)[^>]*>/gi, "\n");
  const text = sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} });
  return text
    .replace(/&nbsp;| /g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

// ─── Similarity ───────────────────────────────────────────────────────

function bigrams(s: string): Map<string, number> {
  const map = new Map<string, number>();
  const clean = s.replace(/\s+/g, " ");
  for (let i = 0; i < clean.length - 1; i++) {
    const bg = clean.slice(i, i + 2);
    map.set(bg, (map.get(bg) ?? 0) + 1);
  }
  return map;
}

/** Sørensen–Dice coefficient on character bigrams (0..1). */
export function diceSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const A = bigrams(a);
  const B = bigrams(b);
  let overlap = 0;
  for (const [bg, count] of A) overlap += Math.min(count, B.get(bg) ?? 0);
  const total = [...A.values()].reduce((x, y) => x + y, 0) + [...B.values()].reduce((x, y) => x + y, 0);
  return (2 * overlap) / total;
}

/** Jaccard similarity on word sets (0..1). */
export function tokenSimilarity(a: string, b: string): number {
  const A = new Set(a.split(" ").filter(Boolean));
  const B = new Set(b.split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Fuzzy title similarity used by the deduplicator (0..1), on normalised titles. */
export function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  return Math.max(diceSimilarity(na, nb), tokenSimilarity(na, nb));
}
