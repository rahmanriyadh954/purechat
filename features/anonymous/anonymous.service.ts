import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/server/security/audit";
import { assertChatMember } from "@/server/security/permissions";
import { createAnonymousConversationSchema } from "./anonymous.validators";

const guestNames = [
  "Guest Falcon",
  "Guest Moon",
  "Guest River",
  "Guest Cedar",
  "Guest Dawn",
  "Guest Lantern",
  "Guest Valley",
  "Guest Pearl",
  "Guest Breeze",
  "Guest Star"
];

export async function createAnonymousConversation(input: unknown, senderId: string) {
  const data = createAnonymousConversationSchema.parse(input);
  const receiver = await prisma.user.findUnique({
    where: { username: data.receiverUsername },
    select: { id: true, status: true }
  });

  if (!receiver || receiver.status !== "ACTIVE") {
    throw new Error("User not found.");
  }
  if (receiver.id === senderId) {
    throw new Error("You cannot start an anonymous chat with yourself.");
  }

  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: senderId, blockedId: receiver.id },
        { blockerId: receiver.id, blockedId: senderId }
      ]
    }
  });
  if (blocked) {
    throw new Error("This anonymous request cannot be sent.");
  }

  const aliases = createAliasPair(senderId, receiver.id);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const chat = await prisma.$transaction(async (tx) => {
    const createdChat = await tx.chat.create({
      data: {
        type: "ANONYMOUS",
        title: "Anonymous Safe Request",
        createdById: senderId,
        expiresAt,
        members: {
          create: [
            { userId: senderId, role: "MEMBER" },
            { userId: receiver.id, role: "MEMBER" }
          ]
        },
        anonymousRequest: {
          create: {
            senderId,
            receiverId: receiver.id,
            senderAlias: aliases.senderAlias,
            receiverAlias: aliases.receiverAlias,
            expiresAt
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
      }
    });

    const message = await tx.message.create({
      data: {
        chatId: createdChat.id,
        senderId,
        type: "TEXT",
        body: data.message ?? "Assalamu alaikum. I would like to start a safe anonymous conversation.",
        metadata: {
          anonymous: true,
          privateByDefault: true
        }
      }
    });

    await tx.chat.update({
      where: { id: createdChat.id },
      data: {
        lastMessageId: message.id,
        lastMessageAt: message.createdAt
      }
    });

    return createdChat;
  });

  await writeAuditLog({
    actorId: senderId,
    action: "ANONYMOUS_CONVERSATION_CREATED",
    entityType: "Chat",
    entityId: chat.id,
    metadata: { receiverId: receiver.id }
  });

  return chat;
}

export async function acceptAnonymousConversation(chatId: string, userId: string) {
  await assertChatMember(userId, chatId);
  const request = await getAnonymousRequestForReceiver(chatId, userId);

  const anonymous = await prisma.anonymousConversation.update({
    where: { id: request.id },
    data: {
      status: "ACCEPTED",
      approvedAt: new Date()
    }
  });

  await writeAuditLog({
    actorId: userId,
    action: "ANONYMOUS_CONVERSATION_ACCEPTED",
    entityType: "Chat",
    entityId: chatId
  });

  return anonymous;
}

export async function rejectAnonymousConversation(chatId: string, userId: string) {
  await assertChatMember(userId, chatId);
  const request = await getAnonymousRequestForReceiver(chatId, userId);

  const anonymous = await prisma.anonymousConversation.update({
    where: { id: request.id },
    data: {
      status: "REJECTED",
      rejectedAt: new Date()
    }
  });

  await prisma.chatMember.updateMany({
    where: { chatId },
    data: { isArchived: true }
  });

  await writeAuditLog({
    actorId: userId,
    action: "ANONYMOUS_CONVERSATION_REJECTED",
    entityType: "Chat",
    entityId: chatId
  });

  return anonymous;
}

export async function reportAnonymousConversation(chatId: string, userId: string, note?: string) {
  await assertChatMember(userId, chatId);
  const request = await getAnonymousRequestForReceiver(chatId, userId);

  const result = await prisma.$transaction(async (tx) => {
    const anonymous = await tx.anonymousConversation.update({
      where: { id: request.id },
      data: {
        status: "REPORTED",
        reportedAt: new Date()
      }
    });

    const report = await tx.report.create({
      data: {
        reporterId: userId,
        reportedUserId: request.senderId,
        chatId,
        type: "CHAT",
        reason: "Anonymous Safe Request reported",
        details: note ?? "Receiver reported an anonymous safe request.",
        evidence: {
          anonymousSafeRequest: true,
          requestStatus: anonymous.status,
          privateByDefault: true
        }
      }
    });

    await tx.chatMember.updateMany({
      where: { chatId },
      data: { isArchived: true }
    });

    return { anonymous, report };
  });

  await writeAuditLog({
    actorId: userId,
    action: "ANONYMOUS_CONVERSATION_REPORTED",
    entityType: "Chat",
    entityId: chatId,
    metadata: { reportId: result.report.id }
  });

  return result;
}

export async function blockAnonymousConversation(chatId: string, userId: string, note?: string) {
  await assertChatMember(userId, chatId);
  const request = await getAnonymousRequestForReceiver(chatId, userId);

  const anonymous = await prisma.$transaction(async (tx) => {
    await tx.block.upsert({
      where: {
        blockerId_blockedId: {
          blockerId: userId,
          blockedId: request.senderId
        }
      },
      create: {
        blockerId: userId,
        blockedId: request.senderId,
        reason: note ?? "Blocked anonymous safe request"
      },
      update: {
        reason: note ?? "Blocked anonymous safe request"
      }
    });

    await tx.chatMember.updateMany({
      where: { chatId },
      data: { isArchived: true }
    });

    return tx.anonymousConversation.update({
      where: { id: request.id },
      data: {
        status: "BLOCKED",
        blockedAt: new Date()
      }
    });
  });

  await writeAuditLog({
    actorId: userId,
    action: "ANONYMOUS_CONVERSATION_BLOCKED",
    entityType: "Chat",
    entityId: chatId
  });

  return anonymous;
}

export async function getAnonymousRevealStatus(chatId: string) {
  const request = await prisma.anonymousConversation.findUnique({
    where: { chatId },
    include: {
      chat: {
        include: {
          safetyStates: true
        }
      }
    }
  });

  if (!request) {
    return {
      anonymous: null,
      eligible: false,
      bothSafe: false
    };
  }

  const safeUserIds = new Set(
    request.chat.safetyStates
      .filter((state) => state.status === "SAFE")
      .map((state) => state.userId)
  );
  const bothSafe = safeUserIds.has(request.senderId) && safeUserIds.has(request.receiverId);

  return {
    anonymous: request,
    eligible: Boolean(request.approvedAt && !request.revealedAt && bothSafe),
    bothSafe
  };
}

export async function revealAnonymousIdentities(chatId: string, userId: string) {
  await assertChatMember(userId, chatId);
  const revealStatus = await getAnonymousRevealStatus(chatId);
  const request = revealStatus.anonymous;

  if (!request) {
    throw new Error("Anonymous request not found.");
  }
  if (!revealStatus.eligible) {
    throw new Error("Both people must mark this chat Safe before identity reveal.");
  }

  const anonymous = await prisma.anonymousConversation.update({
    where: { id: request.id },
    data: {
      status: "REVEALED",
      revealedAt: new Date()
    }
  });

  await writeAuditLog({
    actorId: userId,
    action: "ANONYMOUS_IDENTITIES_REVEALED",
    entityType: "Chat",
    entityId: chatId
  });

  return anonymous;
}

export async function expireAnonymousConversations() {
  const now = new Date();
  const expired = await prisma.anonymousConversation.findMany({
    where: {
      expiresAt: { lt: now },
      revealedAt: null,
      status: "PENDING"
    },
    select: { id: true, chatId: true }
  });

  if (expired.length === 0) return { count: 0 };

  await prisma.$transaction(async (tx) => {
    await tx.anonymousConversation.updateMany({
      where: { id: { in: expired.map((item) => item.id) } },
      data: { status: "EXPIRED" }
    });
    await tx.chat.updateMany({
      where: { id: { in: expired.map((item) => item.chatId) } },
      data: { deletedAt: now }
    });
  });

  return { count: expired.length };
}

function createAliasPair(senderId: string, receiverId: string) {
  const senderIndex = hashToIndex(senderId);
  let receiverIndex = hashToIndex(receiverId);
  if (receiverIndex === senderIndex) {
    receiverIndex = (receiverIndex + 1) % guestNames.length;
  }

  return {
    senderAlias: guestNames[senderIndex],
    receiverAlias: guestNames[receiverIndex]
  };
}

function hashToIndex(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash % guestNames.length;
}

async function getAnonymousRequestForReceiver(chatId: string, receiverId: string) {
  const request = await prisma.anonymousConversation.findUnique({
    where: { chatId }
  });

  if (!request) {
    throw new Error("Anonymous request not found.");
  }
  if (request.receiverId !== receiverId) {
    throw new Error("Only the receiver can do this.");
  }
  if (request.status === "PENDING" && request.expiresAt < new Date()) {
    await prisma.$transaction(async (tx) => {
      await tx.anonymousConversation.update({
        where: { id: request.id },
        data: { status: "EXPIRED" }
      });
      await tx.chatMember.updateMany({
        where: { chatId },
        data: { isArchived: true }
      });
    });
    throw new Error("This anonymous request has expired.");
  }
  if (request.status !== "PENDING" && request.status !== "ACCEPTED") {
    throw new Error("This anonymous request is already closed.");
  }

  return request;
}
