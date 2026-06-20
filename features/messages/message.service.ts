import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertChatMember } from "@/server/security/permissions";
import {
  completeUploadSchema,
  presignUploadSchema
} from "@/features/attachments/attachment.validators";
import {
  assertStorageKeyBelongsToUpload,
  createStorageKey,
  validateUpload
} from "@/features/attachments/attachment-security";
import { createPresignedUploadUrl } from "@/server/storage/uploads";
import {
  assertUserCanAct,
  evaluateTextSafety,
  getFamilyModeForUser
} from "@/features/moderation/moderation.service";
import {
  editMessageSchema,
  messageIdSchema,
  reactionSchema,
  sendMessageSchema
} from "./message.validators";

const messageInclude = {
  sender: {
    select: {
      id: true,
      displayName: true,
      username: true,
      avatarUrl: true
    }
  },
  reactions: {
    include: {
      user: {
        select: {
          id: true,
          displayName: true
        }
      }
    }
  },
  readReceipts: true,
  attachments: true
  ,
  chat: {
    select: {
      anonymousRequest: true
    }
  }
} as const;

export function presentMessage<T extends object>(message: T) {
  const attachments = "attachments" in message
    ? (message as { attachments?: Array<{ sizeBytes: bigint }> }).attachments
    : undefined;

  const chat = "chat" in message
    ? (message as {
        chat?: {
          anonymousRequest?: {
            senderId: string;
            receiverId: string;
            senderAlias: string;
            receiverAlias: string;
            revealedAt?: Date | string | null;
          } | null;
        };
        senderId?: string | null;
        sender?: { id?: string; displayName?: string; username?: string; avatarUrl?: string | null } | null;
      }).chat
    : undefined;
  const anonymous = chat?.anonymousRequest;
  const shouldMask = anonymous && !anonymous.revealedAt;
  const senderId = "senderId" in message
    ? (message as { senderId?: string | null }).senderId
    : undefined;
  const senderAlias = anonymous && senderId === anonymous.senderId
    ? anonymous.senderAlias
    : anonymous && senderId === anonymous.receiverId
      ? anonymous.receiverAlias
      : "Guest";

  const presented = {
    ...message,
    attachments: (attachments ?? []).map((attachment) => ({
      ...attachment,
      sizeBytes: attachment.sizeBytes.toString()
    })),
    ...(shouldMask
      ? {
          sender: senderId
            ? {
                id: senderId,
                displayName: senderAlias,
                username: "",
                avatarUrl: null
              }
            : null
        }
      : {})
  };

  if ("chat" in presented) {
    delete (presented as { chat?: unknown }).chat;
  }

  return presented;
}

async function assertGroupActionAllowed(
  chatId: string,
  userId: string,
  action: "send" | "upload" | "react"
) {
  const member = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
    include: {
      chat: {
        include: {
          group: true
        }
      }
    }
  });

  if (!member || member.status !== "ACTIVE") {
    throw new Error("You are not a member of this chat.");
  }

  if (member.chat.type !== "GROUP" || !member.chat.group) return;

  const isAdmin = member.role === "OWNER" || member.role === "ADMIN";
  const group = member.chat.group;

  if (action === "send" && (group.onlyAdminsCanPost || !group.membersCanSend) && !isAdmin) {
    throw new Error("Only admins can send messages in this group.");
  }

  if (action === "upload" && !group.membersCanUploadMedia && !isAdmin) {
    throw new Error("Only admins can upload media in this group.");
  }

  if (action === "react" && !group.membersCanReact && !isAdmin) {
    throw new Error("Only admins can react in this group.");
  }
}

async function assertAnonymousChatAllowed(chatId: string) {
  const anonymous = await prisma.anonymousConversation.findUnique({
    where: { chatId },
    select: { status: true, expiresAt: true }
  });

  if (!anonymous) return;
  if (anonymous.expiresAt < new Date()) {
    throw new Error("This anonymous conversation has expired.");
  }
  if (!["ACCEPTED", "REVEALED"].includes(anonymous.status)) {
    throw new Error("The receiver must accept this anonymous request before chatting.");
  }
}

async function assertNotAnonymousChat(chatId: string, message: string) {
  const anonymous = await prisma.anonymousConversation.findUnique({
    where: { chatId },
    select: { id: true, revealedAt: true }
  });
  if (anonymous && !anonymous.revealedAt) {
    throw new Error(message);
  }
}

export async function sendTextMessage(input: unknown, senderId: string) {
  const data = sendMessageSchema.parse(input);
  await assertUserCanAct(senderId);
  await assertChatMember(senderId, data.chatId);
  await assertAnonymousChatAllowed(data.chatId);
  await assertGroupActionAllowed(data.chatId, senderId, "send");
  const familyMode = await getFamilyModeForUser(senderId);
  const safety = evaluateTextSafety(data.body, Boolean(familyMode?.familyModeEnabled));
  if (!safety.allowed) {
    throw new Error("This message was blocked by safety settings.");
  }
  const member = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId: data.chatId, userId: senderId } },
    include: { chat: { include: { group: true } } }
  });
  const isAdmin = member?.role === "OWNER" || member?.role === "ADMIN";
  const pendingApproval =
    member?.chat.type === "GROUP" &&
    member.chat.group?.messageApprovalRequired &&
    !isAdmin;

  return prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: {
        chatId: data.chatId,
        senderId,
        type: "TEXT",
        status: pendingApproval ? "PENDING_APPROVAL" : "SENT",
        body: data.body,
        metadata: {
          ...(data.clientId ? { clientId: data.clientId } : {}),
          moderation: {
            needsReview: safety.needsReview,
            reasons: safety.reasons,
            severity: safety.severity,
            privateByDefault: member?.chat.type === "DIRECT"
          },
          pendingApproval
        },
        replyToMessageId: data.replyToMessageId
      },
      include: messageInclude
    });

    if (!pendingApproval) {
      await tx.chat.update({
        where: { id: data.chatId },
        data: {
          lastMessageId: message.id,
          lastMessageAt: message.createdAt
        }
      });
    }

    await tx.messageReadReceipt.create({
      data: {
        messageId: message.id,
        userId: senderId,
        deliveredAt: message.createdAt,
        readAt: message.createdAt
      }
    });

    return message;
  });
}

export async function createAttachmentUpload(input: unknown, userId: string) {
  const data = presignUploadSchema.parse(input);
  await assertUserCanAct(userId);
  await assertChatMember(userId, data.chatId);
  await assertAnonymousChatAllowed(data.chatId);
  await assertNotAnonymousChat(data.chatId, "Media is disabled in anonymous mode for safety.");
  await assertGroupActionAllowed(data.chatId, userId, "upload");
  const familyMode = await getFamilyModeForUser(userId);
  if (familyMode?.familyModeEnabled && familyMode.filterMedia) {
    throw new Error("Media uploads are off in family mode.");
  }
  validateUpload(data);

  const storageKey = createStorageKey({
    chatId: data.chatId,
    userId,
    kind: data.kind,
    fileName: data.fileName
  });
  const uploadUrl = await createPresignedUploadUrl({
    storageKey,
    mimeType: data.mimeType,
    sizeBytes: data.sizeBytes
  });

  return {
    uploadUrl,
    storageKey,
    expiresInSeconds: 300
  };
}

export async function completeAttachmentMessage(input: unknown, senderId: string) {
  const data = completeUploadSchema.parse(input);
  await assertUserCanAct(senderId);
  await assertChatMember(senderId, data.chatId);
  await assertAnonymousChatAllowed(data.chatId);
  await assertNotAnonymousChat(data.chatId, "Media is disabled in anonymous mode for safety.");
  await assertGroupActionAllowed(data.chatId, senderId, "upload");
  validateUpload(data);
  assertStorageKeyBelongsToUpload({
    storageKey: data.storageKey,
    chatId: data.chatId,
    userId: senderId,
    kind: data.kind
  });

  const messageType = {
    image: "IMAGE",
    video: "VIDEO",
    document: "FILE",
    audio: "AUDIO",
    voice: "VOICE"
  } as const;

  return prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: {
        chatId: data.chatId,
        senderId,
        type: messageType[data.kind],
        body: data.caption,
        attachments: {
          create: {
            uploaderId: senderId,
            fileName: data.fileName,
            originalName: data.fileName,
            mimeType: data.mimeType,
            fileType: data.kind,
            sizeBytes: BigInt(data.sizeBytes),
            storageKey: data.storageKey,
            thumbnailKey: data.thumbnailKey,
            width: data.width,
            height: data.height,
            durationSeconds: data.durationSeconds,
            waveform: data.waveform as Prisma.InputJsonValue | undefined,
            scanStatus: "PENDING"
          }
        }
      },
      include: messageInclude
    });

    await tx.chat.update({
      where: { id: data.chatId },
      data: {
        lastMessageId: message.id,
        lastMessageAt: message.createdAt
      }
    });

    await tx.messageReadReceipt.create({
      data: {
        messageId: message.id,
        userId: senderId,
        deliveredAt: message.createdAt,
        readAt: message.createdAt
      }
    });

    return message;
  });
}

export async function sendGifMessage(
  input: { chatId: string; gifUrl: string; title?: string },
  senderId: string
) {
  await assertUserCanAct(senderId);
  await assertChatMember(senderId, input.chatId);
  await assertAnonymousChatAllowed(input.chatId);
  await assertNotAnonymousChat(input.chatId, "GIFs are disabled in anonymous mode for safety.");
  await assertGroupActionAllowed(input.chatId, senderId, "send");
  const familyMode = await getFamilyModeForUser(senderId);
  if (familyMode?.familyModeEnabled && familyMode.filterGifs) {
    throw new Error("GIFs are off in family mode.");
  }

  return prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: {
        chatId: input.chatId,
        senderId,
        type: "GIF",
        body: input.title,
        metadata: {
          gifUrl: input.gifUrl
        }
      },
      include: messageInclude
    });

    await tx.chat.update({
      where: { id: input.chatId },
      data: { lastMessageId: message.id, lastMessageAt: message.createdAt }
    });

    await tx.messageReadReceipt.create({
      data: {
        messageId: message.id,
        userId: senderId,
        deliveredAt: message.createdAt,
        readAt: message.createdAt
      }
    });

    return message;
  });
}

export async function sendStickerMessage(
  input: { chatId: string; stickerId: string },
  senderId: string
) {
  await assertUserCanAct(senderId);
  await assertChatMember(senderId, input.chatId);
  await assertAnonymousChatAllowed(input.chatId);
  await assertNotAnonymousChat(input.chatId, "Stickers are disabled in anonymous mode for safety.");
  await assertGroupActionAllowed(input.chatId, senderId, "send");
  const familyMode = await getFamilyModeForUser(senderId);
  if (familyMode?.familyModeEnabled && familyMode.filterStickers) {
    throw new Error("Stickers are off in family mode.");
  }
  const sticker = await prisma.sticker.findUniqueOrThrow({
    where: { id: input.stickerId }
  });

  return prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: {
        chatId: input.chatId,
        senderId,
        type: "STICKER",
        metadata: {
          stickerId: sticker.id,
          storageKey: sticker.storageKey,
          emoji: sticker.emoji
        }
      },
      include: messageInclude
    });

    await tx.chat.update({
      where: { id: input.chatId },
      data: { lastMessageId: message.id, lastMessageAt: message.createdAt }
    });

    await tx.messageReadReceipt.create({
      data: {
        messageId: message.id,
        userId: senderId,
        deliveredAt: message.createdAt,
        readAt: message.createdAt
      }
    });

    return message;
  });
}

export async function listMessages(chatId: string, userId: string) {
  const member = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
    select: { role: true, status: true }
  });

  if (!member || member.status !== "ACTIVE") {
    throw new Error("You are not a member of this chat.");
  }

  const canSeePending = member.role === "OWNER" || member.role === "ADMIN";

  return prisma.message.findMany({
    where: {
      chatId,
      OR: [
        { status: { not: "PENDING_APPROVAL" } },
        { senderId: userId },
        ...(canSeePending ? [{ status: "PENDING_APPROVAL" as const }] : [])
      ]
    },
    include: messageInclude,
    orderBy: {
      createdAt: "asc"
    },
    take: 60
  });
}

export async function markMessageDelivered(input: unknown, userId: string) {
  const data = messageIdSchema.parse(input);
  await assertChatMember(userId, data.chatId);

  return prisma.messageReadReceipt.upsert({
    where: {
      messageId_userId: {
        messageId: data.messageId,
        userId
      }
    },
    create: {
      messageId: data.messageId,
      userId,
      deliveredAt: new Date()
    },
    update: {
      deliveredAt: new Date()
    }
  });
}

export async function markMessageRead(input: unknown, userId: string) {
  const data = messageIdSchema.parse(input);
  await assertChatMember(userId, data.chatId);

  return prisma.messageReadReceipt.upsert({
    where: {
      messageId_userId: {
        messageId: data.messageId,
        userId
      }
    },
    create: {
      messageId: data.messageId,
      userId,
      deliveredAt: new Date(),
      readAt: new Date()
    },
    update: {
      deliveredAt: new Date(),
      readAt: new Date()
    }
  });
}

export async function editMessage(input: unknown, userId: string) {
  const data = editMessageSchema.parse(input);
  await assertChatMember(userId, data.chatId);

  const message = await prisma.message.findFirst({
    where: {
      id: data.messageId,
      chatId: data.chatId,
      senderId: userId,
      deletedAt: null
    }
  });

  if (!message) {
    throw new Error("Message cannot be edited.");
  }

  return prisma.message.update({
    where: {
      id: data.messageId
    },
    data: {
      body: data.body,
      editedAt: new Date()
    },
    include: messageInclude
  });
}

export async function deleteMessage(input: unknown, userId: string) {
  const data = messageIdSchema.parse(input);
  await assertChatMember(userId, data.chatId);

  const message = await prisma.message.findFirst({
    where: {
      id: data.messageId,
      chatId: data.chatId,
      senderId: userId,
      deletedAt: null
    }
  });

  if (!message) {
    throw new Error("Message cannot be deleted.");
  }

  return prisma.message.update({
    where: {
      id: data.messageId
    },
    data: {
      status: "DELETED",
      body: null,
      deletedAt: new Date()
    },
    include: messageInclude
  });
}

export async function addReaction(input: unknown, userId: string) {
  const data = reactionSchema.parse(input);
  await assertChatMember(userId, data.chatId);
  await assertAnonymousChatAllowed(data.chatId);
  await assertGroupActionAllowed(data.chatId, userId, "react");

  await prisma.messageReaction.upsert({
    where: {
      messageId_userId_emoji: {
        messageId: data.messageId,
        userId,
        emoji: data.emoji
      }
    },
    create: {
      messageId: data.messageId,
      userId,
      emoji: data.emoji
    },
    update: {}
  });

  return prisma.message.findUniqueOrThrow({
    where: { id: data.messageId },
    include: messageInclude
  });
}

export async function removeReaction(input: unknown, userId: string) {
  const data = reactionSchema.parse(input);
  await assertChatMember(userId, data.chatId);
  await assertAnonymousChatAllowed(data.chatId);
  await assertGroupActionAllowed(data.chatId, userId, "react");

  await prisma.messageReaction.deleteMany({
    where: {
      messageId: data.messageId,
      userId,
      emoji: data.emoji
    }
  });

  return prisma.message.findUniqueOrThrow({
    where: { id: data.messageId },
    include: messageInclude
  });
}
