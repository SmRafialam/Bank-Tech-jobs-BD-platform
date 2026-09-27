# BankTech Jobs BD

IT and software jobs from Bangladeshi public, private and foreign banks, NBFIs, fintechs and government recruiters. The app collects them
automatically where it is allowed, deduplicates them, tracks deadlines in Bangladesh time, checks each candidate's eligibility with
explicit reasons, and sends alerts.

> **Status (27 Sep 2026):** working MVP. Two official bank career pages are collected live (verified that day), three generic adapters (JSON-LD, RSS, Playwright) are
> implemented and tested on fixtures, and the other sources are configured as "manual/API required" with documented reasons. The
> listings in the seed are **demo data**, clearly labelled in the UI, and are not real vacancies.

---

## Contents

1. [Product overview](#product-overview)
2. [System architecture](#system-architecture)
3. [Local setup](#local-setup)
4. [Database setup](#database-setup)
5. [Environment variables](#environment-variables)
6. [Source-adapter guide](#source-adapter-guide)
7. [Adding a new bank](#adding-a-new-bank)
8. [Notification configuration](#notification-configuration)
9. [Cron setup](#cron-setup)
10. [Docker deployment](#docker-deployment)
11. [Production deployment](#production-deployment)
12. [Legal and scraping-compliance notes](#legal-and-scraping-compliance-notes)
13. [Known limitations](#known-limitations)
14. [Troubleshooting](#troubleshooting)

---

## Product overview

| Area | What you get |
|---|---|
| Public site | Home (search, live stats, latest jobs, category cards, bank filters, deadline timeline, alert CTA), all jobs with 15+ filters and 6 sort orders, job details with JobPosting JSON-LD, organisations, deadline calendar, New / Closing soon / Public bank / Private bank / Software / Infrastructure / Security landing pages, About & disclaimer, Privacy, Terms |
| Candidate | Registration/sign-in, profile & eligibility settings, dashboard, saved jobs, application tracker (10 statuses, application, exam and interview dates, CV version, cover letter, notes, follow-up date), notification centre (read/unread, history), alert settings, submitting job links for restricted sources |
| Eligibility | Strong / Possible / Weak / Not eligible / Manual review, a 0–100 match score, and reasons such as *"Not eligible because minimum CGPA 3.00 is explicitly required"*. A missing requirement is shown as *Not specified*; it never counts as met |
| Collection | Modular adapters (HTML table, HTML list, JSON-LD, RSS, Playwright, manual). Every adapter respects robots.txt and uses per-domain rate limits and retries with exponential backoff. Sources are isolated from each other, and runs and health are recorded |
| Dedup | Matching by source ID, application URL, fingerprint (org + normalised title + deadline day), content hash, then fuzzy title match. Duplicates merge into one canonical job listing all its sources; near-matches go to an admin merge queue |
| Notifications | In-app, email (Resend, or a console log in development), Telegram, Web Push; immediate or 08:00 daily digest; high-priority alerts; deadline reminders at 7 d / 3 d / 24 h / 6 h; closing-soon alerts. A per-event dedupe key means unchanged jobs never trigger a second alert |
| Admin | Source health (colour indicator), run history and parse errors, enable/disable, fetch intervals, run/retry now, schedules, review queue, manual job entry, edit/archive/delete, duplicate queue, user reports, notification log, audit log |

The seeded sample candidate is **S. M. Rafi Alam**: BSc CSE 2021, CGPA 2.87/4.00, 4+ years of experience, AKIJ iBOS Limited. Their
profile shows the engine at work. Examples: *Not eligible* for a job requiring CGPA 3.00; *Strong match* for the System Analyst
role (CGPA ≥ 2.75); *Manual review* for a public-bank role with an age limit (no age on the profile); a network role is flagged as
outside their software focus.

## System architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design (data model, pipeline, eligibility engine, security).

```
Next.js 16 App Router (SSR pages, Server Actions, /api/*) ─┐
                                                           ├─ Prisma 7 (@prisma/adapter-pg) ─ PostgreSQL
Worker (scripts/worker.ts, croner, Asia/Dhaka) ────────────┘
   └─ collectors → PoliteHttpClient (robots.txt, rate limit, retries) → official pages / feeds
```

**Stack:** Next.js 16.3 · React 19.3 · TypeScript 5.9 · Tailwind CSS 4 · shadcn/ui-style components (Radix Slot + CVA) ·
PostgreSQL · Prisma 7.10 · Auth.js v5 (next-auth 5 beta) · Zod 4 · Cheerio · Playwright (optional) · croner · Resend · Telegram Bot API ·
web-push · Vitest 5 · Playwright Test · Docker.

**Deliberate MVP simplifications**

- **No BullMQ/Redis.** A handful of sources checked every 1–6 hours doesn't need a queue. One worker with `croner` plus a PostgreSQL
  lease (so the same task never runs twice at once) is simpler and has fewer moving parts. The tasks are plain async functions, so they
  can move to BullMQ later without redesign. Redis is used only if you set Upstash for shared rate limits.
- **Credentials auth only.** Email + password with bcrypt (cost 12) and JWT session cookies. OAuth providers can be added in `src/auth.ts`.
- **shadcn/ui components were written in-repo** (same API and styling conventions, `components.json` included) rather than generated
  by the CLI, to keep the build offline-friendly.
- **Prisma 7.10** (latest stable). `8.0.0-rc` is tagged `latest` on npm but is a release candidate.

## Local setup

Requirements: Node.js ≥ 20.19 (developed on 24), PostgreSQL 15+ (or Docker).

```bash
git clone <your-repo> banktech-jobs-bd && cd banktech-jobs-bd
cp .env.example .env            # set AUTH_SECRET, CRON_SECRET, seed passwords, DATABASE_URL
npm install                     # also runs prisma generate
docker compose up -d db         # or use your own PostgreSQL
npm run db:deploy               # apply migrations
npm run db:seed                 # organisations, sources, admin + demo candidate, demo jobs
npm run dev                     # http://localhost:3000
```

Sign in with the `SEED_ADMIN_*` or `SEED_DEMO_*` credentials from `.env`. If you leave the placeholder passwords, the seed generates random ones
and prints them once.

Useful commands:

| Command | Purpose |
|---|---|
| `npm run lint` / `npm run typecheck` / `npm test` | ESLint, TypeScript, Vitest unit tests |
| `npm run build` && `npm start` | Production build and server |
| `npm run test:e2e` | Playwright smoke tests (needs a seeded DB; runs `npm start` automatically) |
| `npm run worker` | Long-running scheduler (collect, reminders, deadlines, cleanup, digest) |
| `npm run task <name>` | Run one task now: `collect`, `reminders`, `verify-deadlines`, `cleanup`, `digest` |
| `npm run task collect -- --source bcbl-career nrb-bank-career` | Force-run specific sources |
| `npm run vapid` | Generate Web Push VAPID keys |

## Database setup

- Schema: [prisma/schema.prisma](prisma/schema.prisma); migrations: `prisma/migrations/`; config: [prisma.config.ts](prisma.config.ts).
- Prisma 7 no longer reads `.env` itself; `prisma.config.ts` loads it via `dotenv/config`.
- New migration after a schema change: `npm run db:migrate -- --name <change>` (needs a database that can create a shadow DB).
- Reset everything locally: `npm run db:reset` (drops data, reapplies migrations, reseeds).
- To skip demo jobs (for production), set `SEED_DEMO_JOBS=false`, or archive them in `/admin/jobs?view=demo`.

## Environment variables

All variables are documented in [.env.example](.env.example). The important ones:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `AUTH_SECRET` | yes | `npx auth secret` or `openssl rand -base64 32` |
| `APP_URL` | yes | Public base URL (canonical URLs, sitemap, email links) |
| `AUTH_TRUST_HOST` | Docker/VPS | `true` behind your own reverse proxy |
| `CRON_SECRET` | for HTTP cron | Bearer token for `/api/cron/*` |
| `CRON_*` | no | Cron expressions (Asia/Dhaka) for the worker; admin can override |
| `COLLECTOR_*` | no | User agent, per-domain delay (default 5 s), retries, timeout, concurrency |
| `PLAYWRIGHT_ENABLED` | no | `true` only on a host with Chromium (worker image) |
| `RESEND_API_KEY`, `EMAIL_FROM` | no | Without a key, emails are logged and recorded as `LOGGED` |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` | no | Enables Telegram alerts |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | no | Enables browser push |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | no | Shared rate limiting across instances (otherwise in-memory) |
| `SEED_*` | seed only | Admin / demo accounts, demo jobs toggle |

Never commit `.env`; it is git-ignored.

## Source-adapter guide

```
src/collectors/
  types.ts          SourceAdapter interface, NormalizedJob schema (Zod), error types
  http.ts           PoliteHttpClient: robots.txt, per-domain queue + delay, retries/backoff, Retry-After, no 401/403 retries
  robots.ts         RFC 9309 robots.txt parser
  adapters/         html-table, html-list, json-ld, rss, playwright-list (+ shared helpers)
  registry.ts       adapter id → implementation (incl. `manual`)
  sources.ts        configuration of every source (method, URL, interval, compliance note, selectors)
  organizations.ts  banks / NBFIs / fintechs / government bodies
  enrich.ts         relevance filter, categorisation, requirement extraction, short summary, fingerprints
  ingest.ts         dedupe decision + canonical job upsert + source links + duplicate queue
  runner.ts         runs due sources in isolation and records SourceRun + health
```

Every adapter implements:

```ts
interface SourceAdapter<Raw> {
  id: string;                       // registry id used in sources.ts
  method: CollectionMethod;         // HTML | RSS | JSON_API | JSON_LD | PLAYWRIGHT | MANUAL
  fetchJobs(ctx): Promise<Raw[]>;   // all network access through ctx.http (polite client)
  normalizeJob(raw, ctx): NormalizedJobInput | null;   // pure → unit-testable with fixtures
}
```

Name, URL, enabled flag, method, interval, last run, last success, last error and consecutive failures live on the `Source` row and appear
in `/admin/sources`. A thrown error marks that run `FAILED` and never affects other sources. A robots.txt refusal is recorded as `SKIPPED`
with a message.

**Sources verified on 27 Sep 2026**

| Source | Method | Result |
|---|---|---|
| Bengal Commercial Bank — career | `html-table` | ✅ Live. robots.txt absent (404). 16 rows parsed; all were notices or non-IT on that day, so correctly filtered |
| NRB Bank — career | `html-list` | ✅ Live. robots.txt only blocks /courier and /e-signature. The old job table is commented out in the HTML (ignored); 2 result notices filtered |
| Alljobs by Teletalk (govt portal) | `playwright-list` | ⚠️ Configured but **disabled**: the portal is a React SPA and its selectors are placeholders until verified against the rendered DOM |
| Bangladesh Bank e-Recruitment, BSCS | manual | ❌ robots.txt: `User-agent: * / Disallow: /` |
| Bdjobs (and Bdjobs-hosted pages such as EBL) | manual | ❌ robots.txt disallows generic crawlers; links only |
| LinkedIn | manual | ❌ Terms prohibit scraping; links only |
| City Bank | manual | Client-rendered; its data API path is disallowed in robots.txt |
| bKash, Nagad, Pubali Bank, LankaBangla | manual | Web application firewall / HTTP 403 for automated requests; never bypassed |
| BRAC Bank, MTB, Prime, IFIC, Standard Bank, Shimanto, NRBC, Bank Asia, IBBL, IDLC, IPDC, SCB, HSBC, DBBL, UCB, Southeast, SJIBL, Community Bank, Trust Bank | manual | Reachable pages without a machine-readable listing, or career URL 404/timeout. Candidates for `html-list`/`json-ld` once selectors are verified |

The **JSON-LD** and **RSS** adapters are generic and fully tested on fixtures. Point a source at any page that publishes schema.org
`JobPosting` data, or at any RSS/Atom feed.

## Adding a new bank

1. **Check permissions first.** Read the site's terms and `https://<host>/robots.txt`, and confirm the career page is public (no login,
   no CAPTCHA). If it isn't collectable, add it as `manual(...)` with a reason and stop.
2. Add the organisation to `src/collectors/organizations.ts` (`slug`, `name`, `type`, `website`, `careersUrl`, `aliases`).
3. Pick an adapter and add a source to `src/collectors/sources.ts`:

   ```ts
   {
     key: "example-bank-career",
     name: "Example Bank — Career",
     organizationSlug: "example-bank",
     url: "https://www.examplebank.com.bd/career",
     method: "HTML",
     adapter: "html-list",                    // or html-table / json-ld / rss / playwright-list
     enabledByDefault: true,
     fetchIntervalMinutes: 120,
     complianceNote: "robots.txt allows /career (checked 2026-10-01). Static HTML cards.",
     config: { itemSelector: ".job-card", titleSelector: "h3", linkSelector: "a.apply", deadlineSelector: ".deadline" },
   }
   ```

   `html-table` uses `{ headerMatch, columns: { title, department?, publishedAt?, deadline?, summary?, link? } }`.
   `json-ld` optionally takes `followLinkSelector` and `maxDetailPages`; `rss` takes an optional `titleFilter` regex.
4. Save a trimmed copy of the page as `tests/fixtures/<bank>.html` and add a parsing test in `tests/unit/adapters.test.ts`.
5. `npm run db:seed` (creates the source without touching existing admin settings), then run it once with
   `npm run task collect -- --source example-bank-career` and check `/admin/sources/<id>`.
6. A site that needs custom logic gets its own adapter file implementing `SourceAdapter`, registered in `registry.ts`. The core pipeline doesn't change.

## Notification configuration

- **In-app:** always on; the bell icon shows the unread count; history is at `/notifications`.
- **Email (Resend):** set `RESEND_API_KEY` and a verified `EMAIL_FROM` domain. Without a key the full message is printed to the server log
  and recorded as a `LOGGED` delivery, which is handy in development.
- **Telegram:** create a bot with @BotFather and set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME`. Users send `/start` to the bot and
  paste their numeric chat ID into alert settings.
- **Web Push:** run `npm run vapid`, set the keys, and serve over HTTPS (localhost is fine). Users click "Enable browser notifications" on
  the alert settings page. `public/sw.js` displays the notifications.
- **Rules:** every notification has a unique dedupe key (`new:user:job`, `deadline:24h:user:job`, `update:user:job:<deadline>`,
  `digest:user:<dhaka-date>`), so re-runs never notify twice. Digest users receive an in-app notice immediately and one email at 08:00 Dhaka.
  Strong matches closing within 72 h always go out immediately.

## Cron setup

| Task | Default (Asia/Dhaka) | What it does |
|---|---|---|
| `collect` | every 15 min | Runs sources whose own interval has elapsed (official pages 120 min, feeds 60, slow 360), then matches and notifies |
| `reminders` | every 30 min | Refreshes near-deadline statuses and sends 7 d/3 d/24 h/6 h reminders and closing-soon alerts |
| `verify-deadlines` | 00:30 daily | Recomputes every job status (expired, removed, unverified…) |
| `cleanup` | 03:00 daily | Archives jobs expired for 90+ days and prunes old logs |
| `digest` | 08:00 daily | Sends daily digest emails |

Three ways to run these:

1. **Worker (recommended on a VPS/Docker):** `npm run worker`. It reads `CRON_*`, merges overrides saved in `/admin/sources`, and reloads
   them every 5 minutes.
2. **Vercel Cron:** [vercel.json](vercel.json) calls `/api/cron/<task>` once a day each (Hobby-plan compatible; schedules are UTC,
   already converted from Dhaka). For hourly collection and 30-minute reminders add option 3, or tighten the schedules on a Pro plan.
   `npm run vercel-build` applies pending migrations before each build.
3. **GitHub Actions:** [.github/workflows/scheduled-tasks.yml](.github/workflows/scheduled-tasks.yml) calls the same endpoints. Set
   repository secrets `APP_URL` and `CRON_SECRET`.

Manual trigger:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-app.example/api/cron/collect
```

## Docker deployment

```bash
cp .env.example .env    # set AUTH_SECRET, CRON_SECRET, APP_URL, seed passwords, optional Resend/Telegram/VAPID
docker compose up -d --build
```

Services: `db` (PostgreSQL 17), `migrate` (runs once: `prisma migrate deploy` + seed), `web` (Next.js standalone, port 3000, health
check `/api/health`) and `worker` (the Playwright image with Chromium, scheduler and collectors). Put a TLS reverse proxy such as Caddy or
Nginx in front of `web`.

## Production deployment

**Option A: Vercel + Neon (recommended)**

1. Push the repo to GitHub, then in Vercel: **Add New → Project → Import** the repository (framework: Next.js; build command comes from vercel.json).
2. In the project: **Storage → Create Database → Neon** (or connect an existing Neon project). The integration sets
    (pooled — used by the app) and  (direct — used by Prisma migrations) automatically.
   Using Neon without the integration? Set  to the **pooled** string (host contains , )
   and  to the direct string.
3. **Settings → Environment Variables:** , ,  (your https://…vercel.app URL),
   , , , , and for the first deploy .
   Optional: , , Telegram and VAPID keys, Upstash.
4. **Deploy.**  runs , seeds when , then .
   After the first successful deploy you can set  (re-seeding is harmless: it never overwrites admin changes).
5. Crons in [vercel.json](vercel.json) run daily (Hobby limit). For hourly collection and 30-minute reminders enable
   [.github/workflows/scheduled-tasks.yml](.github/workflows/scheduled-tasks.yml) with repository secrets  and .
6. **Playwright sources must not run on Vercel** — keep  there and run the worker image on a VPS if needed.

**Option B: a single VPS with Docker Compose** (above). Back up the `pgdata` volume, and put TLS and HTTP/2 in front.

Checklist: strong `AUTH_SECRET`, `APP_URL` set to the real domain, change or remove the seeded passwords, set `SEED_DEMO_JOBS=false` or
archive demo jobs, verified Resend sender domain, HTTPS (required for Web Push and secure cookies), and database backups.

## Legal and scraping-compliance notes

- Official APIs, feeds, structured data and official career pages come first. Aggregators with restrictive terms (Bdjobs, LinkedIn)
  are **never scraped**; only manually submitted public links are stored.
- robots.txt is checked before every fetch and cached for 6 hours. If robots.txt itself returns 401/403/5xx or can't be reached, access is
  treated as disallowed (conservative). The site's `Crawl-delay` is honoured when it is larger than our default delay.
- No login, CAPTCHA solving, Cloudflare/WAF evasion, stealth plugins or rotating proxies. A 401/403 is recorded and the source is flagged
  for manual handling.
- A descriptive `User-Agent` with a contact URL, at most one request in flight per domain, a 5 s minimum delay, retries with exponential
  backoff and jitter, and `Retry-After` support.
- Only a short normalised summary (≤ 600 characters) and structured requirements are stored, with the source URL and a prominent
  **Apply on Official Site** button. All collected HTML is stripped to plain text before storage.
- Any source can be disabled instantly in `/admin/sources`, and removal requests from site owners should be honoured promptly.
- Demo jobs are flagged (`isDemo`), shown with a "Demo data" banner, excluded from the sitemap and set to `noindex`.
- This is engineering guidance, not legal advice. Review the terms of each site before enabling it.

## Known limitations

- On 27 Sep 2026 the two live automated sources had **no open IT vacancies**, so a fresh install shows only demo data until
  real jobs are published or added manually.
- Most Bangladeshi bank circulars are PDFs or images hosted behind Bdjobs or the BB e-Recruitment portal. Those need manual entry;
  PDF text extraction is not implemented.
- Requirement extraction is rule-based English regex. Bangla circulars and unusual phrasing may yield "Not specified" (the engine then
  asks for manual review rather than guessing). The AI fallback hook (`setCategoryFallback`) is not wired to a model.
- The Teletalk Playwright selectors are placeholders and need verifying against the live DOM before enabling.
- The in-memory rate limiter is per instance; use Upstash on multi-instance or serverless deployments.
- Account deletion and self-service password reset are not built yet; contact the admin.
- Telegram linking is manual (chat ID); a bot webhook for automatic linking is a planned improvement.
- The "Relevant for EEE/ECE" judgement uses discipline codes plus "related discipline" wording; edge cases may need admin edits.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `DATABASE_URL is not set` | Copy `.env.example` to `.env`; Prisma 7 CLI loads it through `prisma.config.ts` |
| `P1001 Can't reach database` | Start PostgreSQL (`docker compose up -d db`) and check host/port |
| `prisma migrate dev` fails creating a shadow DB | Use `npm run db:deploy` for existing migrations, or give the DB user `CREATEDB` |
| Sign-in loops or "UntrustedHost" | Set `AUTH_TRUST_HOST=true` behind a proxy and make sure `APP_URL` matches the public URL |
| Source shows **Failing** | Open `/admin/sources/<id>`. `robots.txt disallows` → switch to manual; `HTTP 403` → WAF, switch to manual; selector changes → update `config` and the fixture test |
| Playwright source **Skipped** | Set `PLAYWRIGHT_ENABLED=true` on a host with Chromium (worker image) |
| No emails | Without `RESEND_API_KEY` they are only logged; check `/admin/notifications` for `FAILED` rows and errors |
| Push button says unsupported | VAPID keys missing, browser lacks Push API, or the site isn't served over HTTPS |
| Times look off by 6 hours | All display uses Asia/Dhaka; date-only deadlines mean 23:59:59 Dhaka. Don't change `TZ` on the server |
| Tasks skipped with "lock" | Another worker or the HTTP cron is running the same task; locks expire after 30 minutes |
