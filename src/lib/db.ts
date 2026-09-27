import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { pooledDatabaseUrl } from "@/lib/database-url";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = pooledDatabaseUrl();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and configure PostgreSQL.");
  }
  // Small pool per instance: on serverless (Vercel) each function instance holds its own pool,
  // and Neon's pooler (PgBouncer) multiplexes them.
  const adapter = new PrismaPg({ connectionString, max: process.env.VERCEL ? 3 : 10 });
  return new PrismaClient({ adapter, log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });
}

/** Lazily-created singleton so importing this module never requires a database (e.g. at build time). */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    if (!globalForPrisma.prisma) globalForPrisma.prisma = createClient();
    const value = Reflect.get(globalForPrisma.prisma, prop, receiver);
    return typeof value === "function" ? value.bind(globalForPrisma.prisma) : value;
  },
});
