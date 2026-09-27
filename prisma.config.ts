import "dotenv/config";
import { defineConfig } from "prisma/config";
import { directDatabaseUrl } from "./src/lib/database-url";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Prisma CLI (migrate/seed) uses the direct, unpooled connection (Neon: DATABASE_URL_UNPOOLED / DIRECT_URL);
    // the app uses the pooled one. `prisma generate` (run by `npm install`) never connects, so a placeholder
    // keeps fresh clones installable before .env exists.
    url: directDatabaseUrl() ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
