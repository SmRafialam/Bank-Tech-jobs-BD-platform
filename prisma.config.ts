import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Prisma CLI (migrate/seed) should use a direct, unpooled connection. On Neon that is DATABASE_URL_UNPOOLED
    // (set by the Vercel ↔ Neon integration) or DIRECT_URL; the app itself uses the pooled DATABASE_URL.
    // `prisma generate` (run by `npm install`) never connects, so a placeholder keeps fresh clones installable.
    url:
      process.env.DIRECT_URL ||
      process.env.DATABASE_URL_UNPOOLED ||
      process.env.DATABASE_URL ||
      "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
