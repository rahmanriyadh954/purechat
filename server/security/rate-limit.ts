import { cacheDel, cacheIncrWithTtl } from "@/server/redis/client";

export async function rateLimit(input: {
  key: string;
  limit: number;
  windowSeconds: number;
}) {
  const { count, ttl } = await cacheIncrWithTtl(input.key, input.windowSeconds);

  if (count > input.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(ttl, 1)
    };
  }

  return {
    allowed: true,
    remaining: input.limit - count,
    retryAfter: 0
  };
}

export function getClientIp(headers: Headers) {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function resetRateLimit(key: string) {
  await cacheDel(key);
}

export function normalizeRateLimitIdentifier(value: string) {
  return value.trim().toLowerCase();
}
