import { memoryCache, redis } from "@/server/redis/client";

export async function rateLimit(input: {
  key: string;
  limit: number;
  windowSeconds: number;
}) {
  try {
    const count = await redis.incr(input.key);

    if (count === 1) {
      await redis.expire(input.key, input.windowSeconds);
    }

    if (count > input.limit) {
      const retryAfter = await redis.ttl(input.key);

      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.max(retryAfter, 1)
      };
    }

    return {
      allowed: true,
      remaining: input.limit - count,
      retryAfter: 0
    };
  } catch {
    if (process.env.NODE_ENV === "production") {
      return { allowed: false, remaining: 0, retryAfter: input.windowSeconds };
    }

    return memoryRateLimit(input);
  }
}

function memoryRateLimit(input: {
  key: string;
  limit: number;
  windowSeconds: number;
}) {
  const now = Date.now();
  const current = memoryCache.get(input.key);
  const expiresAt = current && current.expiresAt > now
    ? current.expiresAt
    : now + input.windowSeconds * 1000;
  const value = current && current.expiresAt > now ? current.value + 1 : 1;

  memoryCache.set(input.key, { value, expiresAt });

  if (value > input.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(Math.ceil((expiresAt - now) / 1000), 1)
    };
  }

  return {
    allowed: true,
    remaining: input.limit - value,
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
