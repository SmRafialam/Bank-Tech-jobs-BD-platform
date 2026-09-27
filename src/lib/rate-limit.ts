import { env } from "@/lib/env";

/**
 * Fixed-window rate limiter. Uses Upstash Redis (REST) when configured so limits are shared across instances,
 * otherwise an in-memory map (fine for a single server / development).
 */
const memory = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
}

export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = env();
  if (url && token) {
    try {
      const res = await fetch(`${url}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify([
          ["INCR", `rl:${key}`],
          ["EXPIRE", `rl:${key}`, String(windowSeconds), "NX"],
        ]),
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { result: number }[];
        const count = Number(data[0]?.result ?? 0);
        return { ok: count <= limit, remaining: Math.max(0, limit - count) };
      }
    } catch {
      // fall through to memory limiter
    }
  }
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    if (memory.size > 10_000) for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
    return { ok: true, remaining: limit - 1 };
  }
  entry.count++;
  return { ok: entry.count <= limit, remaining: Math.max(0, limit - entry.count) };
}

export function clientIpFromHeaders(headers: Headers | Record<string, string> | undefined | null): string {
  if (!headers) return "unknown";
  const get = (name: string) => (headers instanceof Headers ? headers.get(name) : (headers as Record<string, string>)[name]);
  return get("x-forwarded-for")?.split(",")[0]?.trim() || get("x-real-ip") || "unknown";
}
