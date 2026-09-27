/**
 * Build-time hook for Vercel: seeds organisations, sources and accounts when SEED_ON_BUILD=true.
 * The seed is idempotent (it never overwrites admin changes), but set real SEED_* passwords first —
 * otherwise generated passwords would only appear in the build log.
 */
import "dotenv/config";
import { execSync } from "node:child_process";

if (process.env.SEED_ON_BUILD === "true") {
  const placeholder = /^change-me/;
  if (!process.env.SEED_ADMIN_PASSWORD || placeholder.test(process.env.SEED_ADMIN_PASSWORD)) {
    console.error("SEED_ON_BUILD=true but SEED_ADMIN_PASSWORD is not set to a real password — skipping seed.");
  } else {
    console.log("SEED_ON_BUILD=true → running prisma db seed");
    execSync("npx prisma db seed", { stdio: "inherit" });
  }
} else {
  console.log("Skipping seed (set SEED_ON_BUILD=true to seed during the build).");
}
