import { prisma } from "@/lib/prisma";
import { createDirectChatSchema } from "./chat.validators";

export async function createDirectChat(input: unknown, currentUserId: string) {
  const data = createDirectChatSchema.parse(input);

  if (data.userId === currentUserId) {
    throw new Error("You cannot start a chat with yourself.");
  }

  const otherUser = await prisma.user.findFirst({
    where: {
      id: data.userId,
      deletedAt: null,
      status: "ACTIVE"
    },
    select: { id: true }
  });

  if (!otherUser) {
    throw new Error("User not found.");
  }

  const existing = await prisma.chat.findFirst({
    where: {
      type: "DIRECT",
      deletedAt: null,
      members: {
        every: {
          userId: {
            in: [currentUserId, data.userId]
          }
        }
      },
      AND: [
        { members: { some: { userId: currentUserId, status: "ACTIVE" } } },
        { members: { some: { userId: data.userId, status: "ACTIVE" } } }
      ]
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              username: true,
              avatarUrl: true,
              lastSeenAt: true
            }
          }
        }
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1
      },
      anonymousRequest: true
    }
  });

  if (existing) return existing;

  return prisma.chat.create({
    data: {
      type: "DIRECT",
      createdById: currentUserId,
      members: {
        create: [
          { userId: currentUserId, role: "OWNER" },
          { userId: data.userId, role: "MEMBER" }
        ]
      }
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              username: true,
              avatarUrl: true,
              lastSeenAt: true
            }
          }
        }
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1
      },
      anonymousRequest: true
    }
  });
}
