import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import { assertChatMember } from "@/server/security/permissions";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{
    chatId: string;
  }>;
};

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = await requireCurrentSession();
    const { chatId } = await params;
    await assertChatMember(session.userId, chatId);

    const attachments = await prisma.messageAttachment.findMany({
      where: {
        message: {
          chatId,
          deletedAt: null
        }
      },
      include: {
        message: {
          select: {
            id: true,
            type: true,
            createdAt: true,
            sender: {
              select: {
                id: true,
                displayName: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 80
    });

    return NextResponse.json({
      attachments: attachments.map((attachment) => ({
        ...attachment,
        sizeBytes: attachment.sizeBytes.toString()
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load gallery." },
      { status: 400 }
    );
  }
}
