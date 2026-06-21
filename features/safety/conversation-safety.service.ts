import { prisma } from "@/lib/prisma";
import { getAnonymousRevealStatus } from "@/features/anonymous/anonymous.service";
import { assertChatMember } from "@/server/security/permissions";
import { writeAuditLog } from "@/server/security/audit";
import { conversationSafetySchema } from "./conversation-safety.validators";

export async function getConversationSafety(chatId: string, userId: string) {
  await assertChatMember(userId, chatId);

  const [state, history] = await Promise.all([
    prisma.conversationSafetyState.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId
        }
      }
    }),
    prisma.conversationSafetyEvent.findMany({
      where: {
        chatId,
        userId
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 20
    })
  ]);

  const revealStatus = await getAnonymousRevealStatus(chatId);

  return {
    status: state?.status ?? "SAFE",
    updatedAt: state?.updatedAt ?? null,
    history,
    anonymousReveal: {
      eligible: revealStatus.eligible,
      bothSafe: revealStatus.bothSafe,
      revealed: Boolean(revealStatus.anonymous?.revealedAt)
    }
  };
}

export async function updateConversationSafety(chatId: string, userId: string, input: unknown) {
  const data = conversationSafetySchema.parse(input);
  await assertChatMember(userId, chatId);

  const otherMembers = await prisma.chatMember.findMany({
    where: {
      chatId,
      userId: { not: userId },
      status: "ACTIVE"
    },
    select: {
      userId: true
    }
  });

  const result = await prisma.$transaction(async (tx) => {
    const state = await tx.conversationSafetyState.upsert({
      where: {
        chatId_userId: {
          chatId,
          userId
        }
      },
      create: {
        chatId,
        userId,
        status: data.status,
        note: data.note
      },
      update: {
        status: data.status,
        note: data.note
      }
    });

    const event = await tx.conversationSafetyEvent.create({
      data: {
        chatId,
        userId,
        status: data.status,
        action: data.action,
        note: data.note
      }
    });

    let reportId: string | null = null;
    if (data.status === "UNSAFE" || data.action === "REPORT") {
      const report = await tx.report.create({
        data: {
          reporterId: userId,
          reportedUserId: otherMembers[0]?.userId,
          chatId,
          type: "CHAT",
          reason: "Conversation marked unsafe",
          details: data.note ?? "User used Safe Mode during this conversation.",
          evidence: {
            safeModeStatus: data.status,
            safeModeAction: data.action ?? null,
            privateByDefault: true
          }
        }
      });
      reportId = report.id;
    }

    if (data.action === "BLOCK") {
      await Promise.all(
        otherMembers.map((member) =>
          tx.block.upsert({
            where: {
              blockerId_blockedId: {
                blockerId: userId,
                blockedId: member.userId
              }
            },
            create: {
              blockerId: userId,
              blockedId: member.userId,
              reason: data.note ?? "Blocked from Safe Mode"
            },
            update: {
              reason: data.note ?? "Blocked from Safe Mode"
            }
          })
        )
      );
    }

    if (data.action === "END_CONVERSATION") {
      await tx.chatMember.update({
        where: {
          chatId_userId: {
            chatId,
            userId
          }
        },
        data: {
          isArchived: true
        }
      });
    }

    return {
      state,
      event,
      reportId
    };
  });

  await writeAuditLog({
    actorId: userId,
    action: "CONVERSATION_SAFETY_UPDATED",
    entityType: "Chat",
    entityId: chatId,
    metadata: {
      status: data.status,
      action: data.action ?? null,
      reportId: result.reportId
    }
  });

  const revealStatus = await getAnonymousRevealStatus(chatId);

  return {
    ...result,
    anonymousReveal: {
      eligible: revealStatus.eligible,
      bothSafe: revealStatus.bothSafe,
      revealed: Boolean(revealStatus.anonymous?.revealedAt)
    }
  };
}
