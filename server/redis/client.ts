import Redis from "ioredis";
import { env } from "@/lib/env";

type MemoryEntry = {
  value: string;
  expiresAt: number | null;
};

type CounterEntry = {
  value: number;
  expiresAt: number;
};

type SetEntry = {
  values: Set<string>;
  expiresAt: number | null;
};

const globalForRedis = globalThis as unknown as {
  redis?: Redis | null;
  redisDisabled?: boolean;
  memoryStore?: Map<string, MemoryEntry>;
  memoryCounters?: Map<string, CounterEntry>;
  memorySets?: Map<string, SetEntry>;
  warnedRedisFallback?: boolean;
};

const redisDisabled = process.env.DISABLE_REDIS === "true";
globalForRedis.memoryStore ??= new Map();
globalForRedis.memoryCounters ??= new Map();
globalForRedis.memorySets ??= new Map();

function warnFallback(message: string) {
  if (process.env.NODE_ENV === "production" || globalForRedis.warnedRedisFallback) return;
  globalForRedis.warnedRedisFallback = true;
  console.warn(`[PureChat Redis] ${message}. Using in-memory cache.`);
}

function getRedis() {
  if (redisDisabled || globalForRedis.redisDisabled) return null;

  if (globalForRedis.redis !== undefined) {
    return globalForRedis.redis;
  }

  const client = new Redis(env.REDIS_URL, {
    connectTimeout: 400,
    commandTimeout: 400,
    enableOfflineQueue: false,
    enableReadyCheck: false,
    lazyConnect: true,
    maxRetriesPerRequest: null,
    retryStrategy: () => null
  });

  client.on("error", (error) => {
    globalForRedis.redisDisabled = true;
    warnFallback(`Redis unavailable: ${error.message}`);
  });

  if (process.env.NODE_ENV !== "production") {
    globalForRedis.redis = client;
  }

  return client;
}

function pruneMemory() {
  const now = Date.now();

  for (const [key, entry] of globalForRedis.memoryStore!) {
    if (entry.expiresAt && entry.expiresAt <= now) {
      globalForRedis.memoryStore!.delete(key);
    }
  }

  for (const [key, entry] of globalForRedis.memoryCounters!) {
    if (entry.expiresAt <= now) {
      globalForRedis.memoryCounters!.delete(key);
    }
  }

  for (const [key, entry] of globalForRedis.memorySets!) {
    if (entry.expiresAt && entry.expiresAt <= now) {
      globalForRedis.memorySets!.delete(key);
    }
  }
}

async function withRedis<T>(operation: (client: Redis) => Promise<T>, fallback: () => T) {
  if (redisDisabled) {
    warnFallback("DISABLE_REDIS=true");
    return fallback();
  }

  const client = getRedis();
  if (!client) return fallback();

  try {
    return await operation(client);
  } catch (error) {
    globalForRedis.redisDisabled = true;
    warnFallback(error instanceof Error ? `Redis unavailable: ${error.message}` : "Redis unavailable");
    return fallback();
  }
}

export const memoryCache = globalForRedis.memoryCounters;

export async function cacheSetEx(key: string, seconds: number, value: string) {
  return withRedis(
    (client) => client.set(key, value, "EX", seconds).then(() => undefined),
    () => {
      pruneMemory();
      globalForRedis.memoryStore!.set(key, {
        value,
        expiresAt: Date.now() + seconds * 1000
      });
    }
  );
}

export async function cacheGet(key: string) {
  return withRedis(
    (client) => client.get(key),
    () => {
      pruneMemory();
      return globalForRedis.memoryStore!.get(key)?.value ?? null;
    }
  );
}

export async function cacheDel(key: string) {
  return withRedis(
    (client) => client.del(key).then(() => undefined),
    () => {
      globalForRedis.memoryStore!.delete(key);
      globalForRedis.memoryCounters!.delete(key);
      globalForRedis.memorySets!.delete(key);
    }
  );
}

export async function cacheIncrWithTtl(key: string, windowSeconds: number) {
  return withRedis(
    async (client) => {
      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, windowSeconds);
      }
      const ttl = await client.ttl(key);
      return {
        count,
        ttl: ttl > 0 ? ttl : windowSeconds
      };
    },
    () => {
      pruneMemory();
      const now = Date.now();
      const current = globalForRedis.memoryCounters!.get(key);
      const expiresAt = current && current.expiresAt > now
        ? current.expiresAt
        : now + windowSeconds * 1000;
      const value = current && current.expiresAt > now ? current.value + 1 : 1;

      globalForRedis.memoryCounters!.set(key, { value, expiresAt });

      return {
        count: value,
        ttl: Math.max(Math.ceil((expiresAt - now) / 1000), 1)
      };
    }
  );
}

export async function cacheSetAdd(key: string, value: string, ttlSeconds?: number) {
  return withRedis(
    async (client) => {
      await client.sadd(key, value);
      if (ttlSeconds) {
        await client.expire(key, ttlSeconds);
      }
    },
    () => {
      pruneMemory();
      const current = globalForRedis.memorySets!.get(key) ?? {
        values: new Set<string>(),
        expiresAt: null
      };
      current.values.add(value);
      if (ttlSeconds) {
        current.expiresAt = Date.now() + ttlSeconds * 1000;
      }
      globalForRedis.memorySets!.set(key, current);
    }
  );
}

export async function cacheSetRemove(key: string, value: string) {
  return withRedis(
    (client) => client.srem(key, value).then(() => undefined),
    () => {
      pruneMemory();
      const current = globalForRedis.memorySets!.get(key);
      if (!current) return;
      current.values.delete(value);
      if (current.values.size === 0) {
        globalForRedis.memorySets!.delete(key);
      }
    }
  );
}

export async function cacheSetCount(key: string) {
  return withRedis(
    (client) => client.scard(key),
    () => {
      pruneMemory();
      return globalForRedis.memorySets!.get(key)?.values.size ?? 0;
    }
  );
}

export const redis = {
  get: cacheGet,
  setex: cacheSetEx,
  del: cacheDel,
  sadd: cacheSetAdd,
  srem: cacheSetRemove,
  scard: cacheSetCount,
  incr: async (key: string) => {
    const result = await cacheIncrWithTtl(key, 60);
    return result.count;
  },
  expire: async () => 1,
  ttl: async () => 60
};
