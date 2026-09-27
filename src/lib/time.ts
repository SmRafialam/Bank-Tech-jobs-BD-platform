/**
 * Asia/Dhaka helpers. Bangladesh Standard Time is UTC+6 with no daylight saving time,
 * so a fixed offset is exact. All timestamps are stored in UTC.
 */
export const DHAKA_TZ = "Asia/Dhaka";
export const DHAKA_OFFSET_MINUTES = 6 * 60;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const dateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: DHAKA_TZ, day: "2-digit", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: DHAKA_TZ,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});
const isoDateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: DHAKA_TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export function formatDhakaDate(date: Date | string | null | undefined): string {
  if (!date) return "Not specified";
  return dateFmt.format(new Date(date));
}

export function formatDhakaDateTime(date: Date | string | null | undefined): string {
  if (!date) return "Not specified";
  return `${dateTimeFmt.format(new Date(date))} BST`;
}

/** YYYY-MM-DD of the given instant in Dhaka. */
export function dhakaDateKey(date: Date | string): string {
  return isoDateFmt.format(new Date(date));
}

/** Start of the Dhaka calendar day containing `date`, as a UTC instant. */
export function startOfDhakaDay(date: Date = new Date()): Date {
  const key = dhakaDateKey(date);
  return new Date(`${key}T00:00:00+06:00`);
}

/** A date-only deadline ("2026-10-15") means end of that day in Dhaka. */
export function endOfDhakaDayFromKey(key: string): Date {
  return new Date(`${key}T23:59:59+06:00`);
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * HOUR);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY);
}

/** Instant `hours` before now (keeps impure clock reads out of React render bodies). */
export function hoursAgo(hours: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - hours * HOUR);
}

export function hoursUntil(target: Date, now: Date = new Date()): number {
  return (target.getTime() - now.getTime()) / HOUR;
}

/** Human "3 days left" / "6 hours left" / "Expired". */
export function timeLeftLabel(deadline: Date | null | undefined, now: Date = new Date()): string {
  if (!deadline) return "No deadline stated";
  const hours = hoursUntil(new Date(deadline), now);
  if (hours <= 0) return "Expired";
  if (hours < 1) return "Less than 1 hour left";
  if (hours < 48) return `${Math.floor(hours)} hour${Math.floor(hours) === 1 ? "" : "s"} left`;
  const days = Math.floor(hours / 24);
  return `${days} days left`;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Parse the date formats commonly used in Bangladeshi job circulars and return the end of that day in Dhaka.
 * Supports: 2026-10-15, 15/10/2026, 15-10-2026, 15.10.2026, "15 October 2026", "October 15, 2026", "15th Oct 2026", "Oct 15 2026".
 * Returns null when the input can't be parsed unambiguously.
 */
export function parseDhakaDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const text = input
    .trim()
    .toLowerCase()
    .replace(/(\d+)(st|nd|rd|th)\b/g, "$1")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    // "10-Oct-2026" / "10.Oct.2026" → "10 oct 2026"
    .replace(/\b(\d{1,2})[-./]([a-z]{3,9})[-./](\d{4})\b/g, "$1 $2 $3");

  // ISO with time → trust it as-is.
  if (/^\d{4}-\d{2}-\d{2}t\d{2}:\d{2}/.test(text)) {
    const d = new Date(input.trim());
    return Number.isNaN(d.getTime()) ? null : d;
  }

  let y: number | undefined, m: number | undefined, d: number | undefined;
  let match = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (!y && (match = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/))) {
    // Bangladesh uses day-first ordering.
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  }
  if (!y && (match = text.match(/\b(\d{1,2}) ([a-z]{3,9}) (\d{4})\b/)) && MONTHS[match[2]]) {
    [d, m, y] = [Number(match[1]), MONTHS[match[2]], Number(match[3])];
  }
  if (!y && (match = text.match(/\b([a-z]{3,9}) (\d{1,2}) (\d{4})\b/)) && MONTHS[match[1]]) {
    [m, d, y] = [MONTHS[match[1]], Number(match[2]), Number(match[3])];
  }
  if (!y || !m || !d || m > 12 || d > 31 || y < 2000 || y > 2100) return null;
  const result = endOfDhakaDayFromKey(`${y}-${pad(m)}-${pad(d)}`);
  if (Number.isNaN(result.getTime()) || dhakaDateKey(result) !== `${y}-${pad(m)}-${pad(d)}`) return null;
  return result;
}
