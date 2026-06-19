import { prisma } from "@/lib/prisma";

export async function getUserChats(userId: string) {
  return prisma.chat.findMany({
    where: {
      members: {
        some: {
          userId,
          status: "ACTIVE"
        }
      },
      deletedAt: null
    },
    include: {
      members: {
        select: {
          userId: true,
          role: true
        }
      }
    },
    orderBy: {
      lastMessageAt: "desc"
    }
  });
}
