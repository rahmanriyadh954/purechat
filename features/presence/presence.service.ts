import { cacheSetAdd, cacheSetCount, cacheSetRemove } from "@/server/redis/client";

const presenceKey = (userId: string) => `presence:user:${userId}`;

export async function markUserOnline(userId: string, socketId: string) {
  await cacheSetAdd(presenceKey(userId), socketId, 60);
}

export async function markUserOffline(userId: string, socketId: string) {
  await cacheSetRemove(presenceKey(userId), socketId);
}

export async function isUserOnline(userId: string) {
  return (await cacheSetCount(presenceKey(userId))) > 0;
}
