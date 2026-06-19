import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import { presentChat } from "@/features/chats/chat.presenters";
import { createGroup } from "@/features/groups/group.service";
import { createGroupSchema } from "@/features/groups/group.validators";
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
            status: "ACTIVE"
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
        }
      },
      orderBy: {
        lastMessageAt: "desc"
      }
    });

    return NextResponse.json({
      chats: chats.map((chat) => presentChat(chat, session.userId))
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
    const body = await readValidatedJson(request, createGroupSchema);
    const group = await createGroup(body, session.userId);

    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
