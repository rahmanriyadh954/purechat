import { redis } from "@/server/redis/client";

const presenceKey = (userId: string) => `presence:user:${userId}`;

export async function markUserOnline(userId: string, socketId: string) {
  await redis.sadd(presenceKey(userId), socketId);
  await redis.expire(presenceKey(userId), 60);
}

export async function markUserOffline(userId: string, socketId: string) {
  await redis.srem(presenceKey(userId), socketId);
}

export async function isUserOnline(userId: string) {
  return (await redis.scard(presenceKey(userId))) > 0;
}
