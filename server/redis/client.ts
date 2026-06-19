import Redis from "ioredis";
import { env } from "@/lib/env";

const globalForRedis = globalThis as unknown as {
  redis?: Redis;
  memoryCache?: Map<string, { value: number; expiresAt: number }>;
};

const redisClient =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true
  });

redisClient.on("error", (error) => {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[PureChat Redis] Falling back to memory when Redis is unavailable: ${error.message}`);
  }
});

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redisClient;
  globalForRedis.memoryCache ??= new Map();
}

export const redis = redisClient;
export const memoryCache = globalForRedis.memoryCache ?? new Map<string, { value: number; expiresAt: number }>();
