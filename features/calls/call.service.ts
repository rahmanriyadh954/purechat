import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { assertChatMember } from "@/server/security/permissions";
import {
  callIdSchema,
  screenShareSchema,
  startCallSchema
} from "./call.validators";

const callInclude = {
  startedBy: {
    select: {
      id: true,
      displayName: true,
      username: true,
      avatarUrl: true
    }
  },
  participants: {
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          username: true,
          avatarUrl: true
        }
      }
    }
  },
  chat: {
    select: {
      id: true,
      title: true,
      type: true
    }
  }
} as const;

export async function startCall(input: unknown, startedById: string) {
  const data = startCallSchema.parse(input);
  await assertChatMember(startedById, data.chatId);

  const anonymous = await prisma.anonymousConversation.findUnique({
    where: { chatId: data.chatId },
    select: { revealedAt: true }
  });
  if (anonymous && !anonymous.revealedAt) {
    throw new Error("Calls are disabled in anonymous mode for safety.");
  }

  const members = await prisma.chatMember.findMany({
    where: {
      chatId: data.chatId,
      status: "ACTIVE"
    },
    select: {
      userId: true
    }
  });

  const participantIds = data.participantIds?.length
    ? Array.from(new Set([startedById, ...data.participantIds]))
    : members.map((member) => member.userId);

  return prisma.$transaction(async (tx) => {
    const call = await tx.call.create({
      data: {
        chatId: data.chatId,
        startedById,
        type: data.type,
        isGroupCall: data.isGroupCall || participantIds.length > 2,
        participants: {
          create: participantIds.map((userId) => ({
            userId,
            status: userId === startedById ? "JOINED" : "RINGING",
            joinedAt: userId === startedById ? new Date() : undefined
          }))
        }
      },
      include: callInclude
    });

    const message = await tx.message.create({
      data: {
        chatId: data.chatId,
        senderId: startedById,
        type: "CALL",
        body: data.type === "VIDEO" ? "Video call started" : "Audio call started",
        metadata: {
          callId: call.id,
          callType: data.type,
          isGroupCall: call.isGroupCall
        }
      }
    });

    await tx.chat.update({
      where: { id: data.chatId },
      data: {
        lastMessageId: message.id,
        lastMessageAt: message.createdAt
      }
    });

    return call;
  });
}

export async function acceptCall(input: unknown, userId: string) {
  const data = callIdSchema.parse(input);
  const call = await getCallForParticipant(data.callId, userId);

  return prisma.$transaction(async (tx) => {
    await tx.callParticipant.update({
      where: {
        callId_userId: {
          callId: data.callId,
          userId
        }
      },
      data: {
        status: "JOINED",
        joinedAt: new Date()
      }
    });

    return tx.call.update({
      where: { id: data.callId },
      data: {
        status: "ACCEPTED",
        answeredAt: call.answeredAt ?? new Date()
      },
      include: callInclude
    });
  });
}

export async function rejectCall(input: unknown, userId: string) {
  const data = callIdSchema.parse(input);
  await getCallForParticipant(data.callId, userId);

  await prisma.callParticipant.update({
    where: {
      callId_userId: {
        callId: data.callId,
        userId
      }
    },
    data: {
      status: "REJECTED",
      leftAt: new Date()
    }
  });

  return prisma.call.update({
    where: { id: data.callId },
    data: { status: "REJECTED" },
    include: callInclude
  });
}

export async function endCall(input: unknown, userId: string) {
  const data = callIdSchema.parse(input);
  const call = await getCallForParticipant(data.callId, userId);
  const endedAt = new Date();
  const durationSeconds = Math.max(
    0,
    Math.round((endedAt.getTime() - call.startedAt.getTime()) / 1000)
  );

  return prisma.$transaction(async (tx) => {
    await tx.callParticipant.updateMany({
      where: {
        callId: data.callId,
        leftAt: null,
        status: "RINGING"
      },
      data: {
        status: "MISSED",
        leftAt: endedAt
      }
    });

    await tx.callParticipant.updateMany({
      where: {
        callId: data.callId,
        leftAt: null,
        status: { not: "MISSED" }
      },
      data: {
        status: "LEFT",
        leftAt: endedAt
      }
    });

    return tx.call.update({
      where: { id: data.callId },
      data: {
        status: call.answeredAt ? "ENDED" : "MISSED",
        endedAt,
        durationSeconds
      },
      include: callInclude
    });
  });
}

export async function updateScreenShare(input: unknown, userId: string) {
  const data = screenShareSchema.parse(input);
  await getCallForParticipant(data.callId, userId);

  return prisma.$transaction(async (tx) => {
    await tx.callParticipant.update({
      where: {
        callId_userId: {
          callId: data.callId,
          userId
        }
      },
      data: {
        screenSharing: data.enabled
      }
    });

    return tx.call.update({
      where: { id: data.callId },
      data: data.enabled
        ? { screenShareStartedAt: new Date() }
        : { screenShareEndedAt: new Date() },
      include: callInclude
    });
  });
}

export async function getCallForParticipant(callId: string, userId: string) {
  const call = await prisma.call.findFirst({
    where: {
      id: callId,
      participants: {
        some: {
          userId
        }
      }
    },
    include: callInclude
  });

  if (!call) {
    throw new Error("Call not found.");
  }

  return call;
}

export async function getCallHistory(userId: string) {
  return prisma.call.findMany({
    where: {
      participants: {
        some: {
          userId
        }
      }
    },
    include: callInclude,
    orderBy: {
      startedAt: "desc"
    },
    take: 100
  });
}

export async function getIceServers() {
  const iceServers: RTCIceServer[] = [
    { urls: env.WEBRTC_STUN_URL }
  ];

  if (
    env.TURN_SERVER_URL &&
    env.TURN_USERNAME &&
    env.TURN_CREDENTIAL
  ) {
    iceServers.push({
      urls: env.TURN_SERVER_URL,
      username: env.TURN_USERNAME,
      credential: env.TURN_CREDENTIAL
    });
  }

  return iceServers;
}
