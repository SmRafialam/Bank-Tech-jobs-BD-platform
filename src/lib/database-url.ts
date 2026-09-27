/**
 * Resolve database URLs from the environment. Accepts DATABASE_URL, the POSTGRES_* names used by some Vercel storage
 * integrations, and integration prefixes such as STORAGE_DATABASE_URL. No imports so prisma.config.ts can use it.
 */
function bySuffix(env: NodeJS.ProcessEnv, suffixes: string[]): string | undefined {
  const keys = Object.keys(env);
  for (const s of suffixes) {
    if (env[s]) return env[s];
    const key = keys.find((k) => k.endsWith(`_${s}`) && env[k]);
    if (key) return env[key];
  }
  return undefined;
}

/** Pooled URL used by the running app. */
export function pooledDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return bySuffix(env, ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL"]);
}

/** Direct (unpooled) URL for Prisma migrations/seed; falls back to the pooled URL. */
export function directDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.DIRECT_URL || bySuffix(env, ["DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"]) || pooledDatabaseUrl(env);
}
