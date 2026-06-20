import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import { presentChat } from "@/features/chats/chat.presenters";
import { createAnonymousConversation } from "@/features/anonymous/anonymous.service";
import { createAnonymousConversationSchema } from "@/features/anonymous/anonymous.validators";
import { createGroup } from "@/features/groups/group.service";
import { createGroupSchema } from "@/features/groups/group.validators";
import { isUserOnline } from "@/features/presence/presence.service";
import { prisma } from "@/lib/prisma";
import { apiError, readValidatedJson } from "@/server/security/api";

export async function GET() {
  try {
    const session = await requireCurrentSession();
    const chats = await prisma.chat.findMany({
      where: {
        deletedAt: null,
        members: {
          some: {
            userId: session.userId,
            status: "ACTIVE",
            isArchived: false
          }
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
      },
      orderBy: {
        lastMessageAt: "desc"
      }
    });
    const chatIds = chats.map((chat) => chat.id);
    const unreadCounts = chatIds.length > 0
      ? await prisma.message.groupBy({
          by: ["chatId"],
          where: {
            chatId: { in: chatIds },
            senderId: { not: session.userId },
            deletedAt: null,
            status: { not: "PENDING_APPROVAL" },
            readReceipts: {
              none: {
                userId: session.userId,
                readAt: { not: null }
              }
            }
          },
          _count: { _all: true }
        })
      : [];
    const unreadCountByChat = new Map(
      unreadCounts.map((item) => [item.chatId, item._count._all])
    );
    const safetyStates = chatIds.length > 0
      ? await prisma.conversationSafetyState.findMany({
          where: {
            chatId: { in: chatIds },
            userId: session.userId
          },
          select: {
            chatId: true,
            status: true
          }
        })
      : [];
    const safetyStatusByChat = new Map(
      safetyStates.map((item) => [item.chatId, item.status])
    );
    const userIds = Array.from(
      new Set(chats.flatMap((chat) => chat.members.map((member) => member.userId)))
    );
    const onlinePairs = await Promise.all(
      userIds.map(async (userId) => [userId, await isUserOnline(userId)] as const)
    );
    const onlineUserIds = new Set(
      onlinePairs.filter(([, online]) => online).map(([userId]) => userId)
    );

    return NextResponse.json({
      chats: chats.map((chat) =>
        presentChat(chat, session.userId, {
          unreadCount: unreadCountByChat.get(chat.id) ?? 0,
          onlineUserIds,
          safetyStatus: safetyStatusByChat.get(chat.id)
        })
      )
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Please sign in." },
      { status: 401 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireCurrentSession();
    const rawBody = await request.json();
    if (rawBody?.mode === "anonymous") {
      const body = createAnonymousConversationSchema.parse(rawBody);
      const chat = await createAnonymousConversation(body, session.userId);

      return NextResponse.json({ chat }, { status: 201 });
    }

    const body = createGroupSchema.parse(rawBody);
    const group = await createGroup(body, session.userId);

    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
