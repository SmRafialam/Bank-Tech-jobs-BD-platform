# BankTech Jobs BD — Architecture

This document was written before implementation and is kept up to date with the code.

## 1. Goals and non-goals

**Goals**

- One place for CSE/IT professionals to find technology roles at Bangladeshi banks, NBFIs, fintechs and government recruiters.
- Detect new jobs shortly after publication, deduplicate across sources, track deadlines and status.
- Explain per-candidate eligibility with concrete reasons, never assuming eligibility when data is missing.
- Notify users (in-app, email, Telegram, Web Push) without repeating alerts for unchanged jobs.
- Stay legally compliant: robots.txt, rate limits, no bypassing of any protection, short summaries only.

**Non-goals (MVP)**

- Scraping any source that forbids crawling, requires login, or sits behind a WAF / CAPTCHA.
- Storing full copies of third-party job descriptions.
- AI-based categorisation (the hook exists, deterministic rules are the default).

## 2. High-level components

```
                ┌────────────────────────────────────────────────────────────┐
                │                    Next.js 16 (App Router)                 │
 Browser ─────▶ │  Public pages (SSR)   Candidate area    Admin dashboard     │
                │  /api/auth (Auth.js)  /api/push/*       /api/cron/[task]    │
                │  Server Actions (Zod-validated, CSRF-safe by origin check)  │
                └──────────────┬──────────────────────────────┬──────────────┘
                               │ Prisma 7 (adapter-pg)         │ same task functions
                               ▼                               ▼
                        ┌─────────────┐              ┌───────────────────────┐
                        │ PostgreSQL  │◀─────────────│ Worker (Node, croner) │
                        └─────────────┘              │  collectors (Cheerio, │
                                                     │  Playwright optional) │
                                                     │  notifications        │
                                                     └──────────┬────────────┘
                                                                │ polite HTTP
                                                                ▼
                                            Official career pages / RSS / JSON-LD
```

- **Web app** (`src/app`): server-rendered public pages, candidate pages, admin pages. All DB reads are on the server.
- **Domain library** (`src/lib`): pure, unit-tested modules — categorisation, requirement extraction, eligibility scoring, deduplication, status computation, Dhaka time helpers.
- **Collectors** (`src/collectors`): the source-adapter framework, polite HTTP client (robots.txt, per-domain rate limit, retries with exponential backoff), and the ingest pipeline.
- **Notifications** (`src/notifications`): audience matching, channel senders (email via Resend or dev log, Telegram Bot API, Web Push), digest and deadline reminders.
- **Tasks** (`src/tasks`): `collect`, `verify-deadlines`, `cleanup`, `digest`, `reminders`. Invoked by the worker's cron (`scripts/worker.ts`), by `/api/cron/[task]` (Vercel Cron / GitHub Actions), or by the CLI (`npm run task <name>`).

### Why no BullMQ/Redis in the MVP

The workload is a few dozen sources checked every 1–6 hours and a few thousand notifications per day. A single worker with
`croner` schedules plus PostgreSQL advisory locks (so two workers never run the same task concurrently) is simpler to operate and has no
extra infrastructure. The task functions are plain async functions, so moving them onto BullMQ later is a mechanical change.
Rate limiting uses an in-memory limiter by default and Upstash Redis (REST) when `UPSTASH_REDIS_REST_URL` is configured.

## 3. Data model (summary)

| Model | Purpose |
|---|---|
| `User` | Auth identity, role (`USER`/`ADMIN`), bcrypt password hash |
| `CandidateProfile` | Degree, discipline, CGPA, SSC/HSC, experience, skills, preferences |
| `NotificationPreference` | Categories, organisations, org types, min score, locations, levels, academic filter, immediate vs digest, channels |
| `Organization` | Bank / NBFI / fintech / government body with `OrgType` |
| `Source` | One configured collector: method, URL, interval, enabled, health fields |
| `SourceRun` | One execution of a source: counts, errors, duration |
| `Job` | Canonical job (all normalised fields, requirements, status, fingerprints) |
| `JobSourceLink` | Every source where the canonical job was seen (multi-source display) |
| `DuplicateCandidate` | Fuzzy matches awaiting admin merge/dismiss |
| `MatchResult` | Cached eligibility verdict + score + reasons per user/job |
| `SavedJob`, `Application` | Candidate bookmarks and application tracker |
| `Notification`, `NotificationDelivery` | In-app notifications (dedupe key) and per-channel delivery log |
| `PushSubscription` | Web Push endpoints |
| `JobReport` | User reports (expired, wrong info, …) |
| `AuditLog` | Admin and security-relevant actions |
| `TaskRun`, `Setting` | Scheduled task history and runtime overrides (schedules) |

## 4. Collection pipeline

1. **Scheduler** triggers `collect` every 15 minutes. It selects enabled sources whose `lastRunAt + fetchIntervalMinutes` has passed.
2. Each source runs **in isolation** (`Promise.allSettled` with bounded concurrency). A failing source records a failed `SourceRun`,
   increments `consecutiveFailures`, and never affects other sources.
3. The **adapter** fetches through `PoliteHttpClient`:
   - checks `robots.txt` (cached 6 h) for the configured user agent; disallowed → the run is `SKIPPED` with a compliance message;
   - per-domain minimum delay (default 5 s) and max 1 in-flight request per domain;
   - retries on 429/5xx/network errors with exponential backoff + jitter, honours `Retry-After`;
   - descriptive `User-Agent` with contact URL.
4. `adapter.fetchJobs()` returns raw items, `adapter.normalizeJob()` converts them into `NormalizedJobInput` (Zod-validated).
5. **Relevance filter** drops non-technology roles (e.g. "Head of Treasury").
6. **Enrichment**: categorisation, level detection, requirement extraction (CGPA, Master's, experience, age, SSC/HSC, third-division rule, disciplines), summary truncation, HTML sanitisation.
7. **Deduplication** (in order): source link (`sourceKey` + `sourceJobId`/URL) → normalised application URL → fingerprint
   (`org + normalised title + deadline date`) → content hash → fuzzy title similarity within the same organisation and ±3 days of deadline.
   Similarity ≥ 0.92 auto-merges; 0.75–0.92 goes to the `DuplicateCandidate` queue.
8. **Upsert** canonical `Job`, add/refresh `JobSourceLink`, update `lastVerifiedAt`.
9. **Post-ingest**: compute `MatchResult` for all candidate profiles and dispatch new-job notifications.

Sources that are not machine-collectable are configured with method `MANUAL`: they appear in the admin panel as
"manual/API required", and admins (or users via `/submit`, moderated) add jobs by hand.

## 5. Eligibility engine

`evaluateEligibility(profile, job)` is a pure function returning `{ verdict, score, reasons[] }`.

- Hard rules (explicit requirement not met) → `NOT_ELIGIBLE`: min CGPA, mandatory Master's, discipline list, SSC/HSC GPA,
  third-division rule (a CGPA below 2.25/4.00 counts as third class), age limit, experience shortfall greater than one year.
- Missing requirement → reason "Not specified". When two or more of the critical fields (discipline, CGPA, experience) are unstated, or
  the candidate is up to one year short on experience, or only a "related discipline" clause applies, the verdict is capped at `POSSIBLE`.
- Missing profile data for a stated requirement → `MANUAL_REVIEW`.
- A job with no parsed requirement data at all → `MANUAL_REVIEW`.
- Score (0–100) = skills overlap 35, role preference 20, experience fit 15, category fit vs. primary experience 15, location 10, organisation preference 5.
- `STRONG` ≥ 70 with no caps, `POSSIBLE` ≥ 45, otherwise `WEAK`.

## 6. Job status

`computeStatus()` derives `NEW` (discovered < 48 h), `OPEN`, `CLOSING_SOON` (deadline < 72 h), `EXPIRED` (deadline passed),
`UNVERIFIED` (no deadline and not re-verified for 14 days, or manually submitted and not yet verified) and `REMOVED`
(no longer found at the source for 3 consecutive successful runs). The daily `verify-deadlines` task recomputes all statuses.

## 7. Notifications

- Audience = users whose `NotificationPreference` filters match the job and whose `MatchResult.score ≥ minMatchScore`.
- Every notification has a unique `dedupeKey` (e.g. `new:{user}:{job}`, `deadline:24h:{user}:{job}`), so re-runs and unchanged jobs never
  notify twice. A changed deadline produces a new key (`update:{job}:{deadline}`).
- `IMMEDIATE` users get channel delivery at once; `DAILY_DIGEST` users get an in-app notification immediately and a single email at
  08:00 Asia/Dhaka. Strong matches closing within 72 h are high priority and bypass the digest.
- Deadline reminders for saved/tracked jobs at 7 d, 3 d, 24 h and 6 h (only the smallest reached window is sent per run).
- Each channel delivery is logged in `NotificationDelivery` (`SENT`, `FAILED`, `SKIPPED`, `LOGGED` in development).

## 8. Security

- Auth.js v5 credentials provider, bcrypt (cost 12), JWT session in an `HttpOnly`, `Secure` (prod), `SameSite=Lax` cookie.
- RBAC: `requireUser()` / `requireAdmin()` in every protected layout, page and server action (defence in depth — no reliance on edge middleware).
- All inputs validated with Zod on the server. Prisma parameterises every query (no raw string SQL).
- Server Actions are protected against CSRF by Next.js origin checks; the only custom POST endpoints (`/api/push/*`, `/api/cron/*`)
  require a session or bearer secret respectively.
- Scraped text is stripped of all HTML (`sanitize-html` with no allowed tags) and rendered as text; JSON-LD is escaped.
- Rate limiting on login, registration, job submission and reports.
- Security headers (CSP, frame-ancestors none, nosniff, referrer policy, permissions policy).
- Audit log for admin actions and security events.
- Minimal PII: no phone/NID collected; profile fields are optional.

## 9. Time zone

All scheduling and display uses `Asia/Dhaka` (UTC+6, no DST). Dates are stored in UTC. Deadlines published as a date only are
interpreted as the end of that day in Dhaka (23:59:59 +06:00).

## 10. Deployment topologies

1. **Vercel + managed Postgres (Neon/Supabase)**: web app on Vercel, Vercel Cron → `/api/cron/*` for HTTP-only collectors,
   notifications, deadlines, digest. Playwright sources run from GitHub Actions or a small VPS worker.
2. **Docker Compose on a VPS**: `db`, `migrate`, `web`, `worker` (Playwright image). Everything including browser collectors.
