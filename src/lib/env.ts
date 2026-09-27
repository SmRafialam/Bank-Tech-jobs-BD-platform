import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");
const int = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v && /^\d+$/.test(v) ? Number(v) : fallback));
const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: optionalString,
  APP_URL: z.string().default("http://localhost:3000"),
  CRON_SECRET: optionalString,
  CRON_COLLECT: z.string().default("*/15 * * * *"),
  CRON_REMINDERS: z.string().default("*/30 * * * *"),
  CRON_VERIFY_DEADLINES: z.string().default("30 0 * * *"),
  CRON_CLEANUP: z.string().default("0 3 * * *"),
  CRON_DIGEST: z.string().default("0 8 * * *"),
  INTERVAL_OFFICIAL_MINUTES: int(120),
  INTERVAL_FEED_MINUTES: int(60),
  INTERVAL_SLOW_MINUTES: int(360),
  COLLECTOR_USER_AGENT: z
    .string()
    .default("BankTechJobsBD/0.1 (+https://github.com/banktech-jobs-bd; job-alert aggregator)"),
  COLLECTOR_MIN_DELAY_MS: int(5000),
  COLLECTOR_MAX_RETRIES: int(3),
  COLLECTOR_TIMEOUT_MS: int(20000),
  COLLECTOR_CONCURRENCY: int(3),
  PLAYWRIGHT_ENABLED: bool,
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: z.string().default("BankTech Jobs BD <alerts@example.com>"),
  TELEGRAM_BOT_TOKEN: optionalString,
  TELEGRAM_BOT_USERNAME: optionalString,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optionalString,
  VAPID_PRIVATE_KEY: optionalString,
  VAPID_SUBJECT: z.string().default("mailto:admin@example.com"),
  UPSTASH_REDIS_REST_URL: optionalString,
  UPSTASH_REDIS_REST_TOKEN: optionalString,
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Validated server environment. Parsed lazily so `next build` works without runtime secrets. */
export function env(): Env {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}

export function appUrl(path = ""): string {
  return `${env().APP_URL.replace(/\/$/, "")}${path}`;
}
