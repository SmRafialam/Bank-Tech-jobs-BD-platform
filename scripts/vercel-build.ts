/**
 * Vercel build: prisma generate → migrate deploy → optional seed → next build.
 * Fails early with an actionable message when no database is connected, instead of an opaque P1001.
 */
import "dotenv/config";
import { execSync } from "node:child_process";

function run(cmd: string) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

const appUrl = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;
const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || appUrl;
// Make the resolved URL visible to child processes (prisma, seed) that read DATABASE_URL.
if (appUrl) process.env.DATABASE_URL = appUrl;

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
