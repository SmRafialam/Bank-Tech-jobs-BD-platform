/**
 * Vercel build: prisma generate → migrate deploy → optional seed → next build.
 * Fails early with an actionable message when no database is connected, instead of an opaque P1001.
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import { directDatabaseUrl, pooledDatabaseUrl } from "../src/lib/database-url";

function run(cmd: string) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

const appUrl = pooledDatabaseUrl();
const directUrl = directDatabaseUrl();
// Child processes (prisma, seed) read the canonical names.
if (appUrl) process.env.DATABASE_URL = appUrl;
if (directUrl) process.env.DIRECT_URL = directUrl;

// Diagnostics: names of non-empty variables only, never values.
const present = Object.keys(process.env)
  .filter((k) => process.env[k] && /(DATABASE|POSTGRES)|^PG|^AUTH_SECRET$|^SEED_|^APP_URL$|^CRON_SECRET$/.test(k))
  .sort();
console.log(`Vercel environment: ${process.env.VERCEL_ENV ?? "local"}`);
console.log(`Relevant variables present (names only): ${present.length ? present.join(", ") : "none"}`);

const missing: string[] = [];
if (!appUrl) missing.push("DATABASE_URL (Neon pooled connection string)");
if (!process.env.AUTH_SECRET) missing.push("AUTH_SECRET");
if (missing.length) {
  console.error(
    [
      "",
      "✖ Build stopped: required environment variables are missing:",
      ...missing.map((m) => `   - ${m}`),
      "",
      `This build runs in the "${process.env.VERCEL_ENV ?? "local"}" environment — variables must be enabled for it (tick Production AND Preview).`,
      "Fix in Vercel → your project:",
      "  1. Storage → Create Database → Neon → connect it to this project (adds DATABASE_URL and DATABASE_URL_UNPOOLED).",
      "  2. Settings → Environment Variables → add AUTH_SECRET, CRON_SECRET, APP_URL and the SEED_* variables.",
      "  3. Deployments → ⋯ → Redeploy.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

console.log(`Database host for migrations: ${new URL(directUrl!).host}`);
run("npx prisma generate");
run("npx prisma migrate deploy");
run("npx tsx scripts/maybe-seed.ts");
run("npx next build");
