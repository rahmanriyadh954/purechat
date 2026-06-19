import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  addMembersSchema,
  createGroupSchema,
  createInviteSchema,
  groupPermissionsSchema,
  joinRequestSchema,
  memberRoleSchema,
  pinnedAnnouncementSchema,
  reviewJoinRequestSchema,
  updateGroupSchema
} from "./group.validators";

const adminRoles = new Set(["OWNER", "ADMIN"]);

function createInviteCode() {
  return randomBytes(12).toString("base64url");
}

export async function assertGroupAdmin(chatId: string, userId: string) {
  const member = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
    include: { chat: { include: { group: true } } }
  });

  if (!member || member.status !== "ACTIVE" || !adminRoles.has(member.role)) {
    throw new Error("Only group admins can do this.");
  }

  if (member.chat.type !== "GROUP" || !member.chat.group) {
    throw new Error("This is not a group chat.");
  }

  return member;
}

export async function assertGroupMember(chatId: string, userId: string) {
  const member = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
    include: { chat: { include: { group: true } } }
  });

  if (!member || member.status !== "ACTIVE") {
    throw new Error("You are not a member of this group.");
  }

  if (member.chat.type !== "GROUP" || !member.chat.group) {
    throw new Error("This is not a group chat.");
  }

  return member;
}

export async function createGroup(input: unknown, userId: string) {
  const data = createGroupSchema.parse(input);
  const uniqueMemberIds = Array.from(new Set([userId, ...data.memberIds]));

  return prisma.chat.create({
    data: {
      type: "GROUP",
      title: data.title,
      avatarUrl: data.avatarUrl,
      createdById: userId,
      group: {
        create: {
          description: data.description,
          inviteCode: createInviteCode(),
          approvalRequired: data.approvalRequired,
          familySafeOnly: data.familySafeOnly
        }
      },
      members: {
        create: uniqueMemberIds.map((memberId) => ({
          userId: memberId,
          role: memberId === userId ? "OWNER" : "MEMBER"
        }))
      }
    },
    include: {
      group: true,
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
      }
    }
  });
}

export async function getGroupDetails(chatId: string, userId: string) {
  await assertGroupMember(chatId, userId);

  return prisma.chat.findUniqueOrThrow({
    where: { id: chatId },
    include: {
      group: {
        include: {
          invites: {
            where: { revokedAt: null },
            orderBy: { createdAt: "desc" },
            take: 5
          },
          joinRequests: {
            where: { status: "PENDING" },
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  username: true,
                  avatarUrl: true
                }
              }
            },
            orderBy: { createdAt: "desc" }
          }
        }
      },
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
        },
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }]
      },
      pinnedAnnouncements: {
        orderBy: { createdAt: "desc" },
        take: 10
      }
    }
  });
}

export async function updateGroup(chatId: string, userId: string, input: unknown) {
  await assertGroupAdmin(chatId, userId);
  const data = updateGroupSchema.parse(input);

  return prisma.chat.update({
    where: { id: chatId },
    data: {
      title: data.title,
      avatarUrl: data.avatarUrl,
      group: {
        update: {
          description: data.description
        }
      }
    },
    include: { group: true }
  });
}

export async function updateGroupPermissions(
  chatId: string,
  userId: string,
  input: unknown
) {
  await assertGroupAdmin(chatId, userId);
  const data = groupPermissionsSchema.parse(input);

  return prisma.group.update({
    where: { chatId },
    data
  });
}

export async function addGroupMembers(chatId: string, userId: string, input: unknown) {
  await assertGroupAdmin(chatId, userId);
  const data = addMembersSchema.parse(input);

  await prisma.chatMember.createMany({
    data: data.userIds.map((memberId) => ({
      chatId,
      userId: memberId,
      role: "MEMBER"
    })),
    skipDuplicates: true
  });

  return getGroupDetails(chatId, userId);
}

export async function removeGroupMember(
  chatId: string,
  adminId: string,
  memberId: string
) {
  const admin = await assertGroupAdmin(chatId, adminId);

  if (admin.userId === memberId) {
    throw new Error("Use leave group instead.");
  }

  await prisma.chatMember.update({
    where: { chatId_userId: { chatId, userId: memberId } },
    data: {
      status: "REMOVED",
      leftAt: new Date()
    }
  });
}

export async function updateGroupMemberRole(
  chatId: string,
  adminId: string,
  memberId: string,
  input: unknown
) {
  await assertGroupAdmin(chatId, adminId);
  const data = memberRoleSchema.parse(input);

  return prisma.chatMember.update({
    where: { chatId_userId: { chatId, userId: memberId } },
    data: {
      role: data.role
    }
  });
}

export async function createGroupInvite(chatId: string, userId: string, input: unknown) {
  const member = await assertGroupMember(chatId, userId);
  const group = member.chat.group;

  if (!group) throw new Error("Group not found.");
  if (!group.membersCanInvite && !adminRoles.has(member.role)) {
    throw new Error("Only admins can invite members.");
  }

  const data = createInviteSchema.parse(input);

  return prisma.groupInvite.create({
    data: {
      groupId: group.id,
      code: createInviteCode(),
      createdById: userId,
      maxUses: data.maxUses,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined
    }
  });
}

export async function requestToJoinGroup(inviteCode: string, userId: string, input: unknown) {
  const data = joinRequestSchema.parse(input);
  const invite = await prisma.groupInvite.findUnique({
    where: { code: inviteCode },
    include: { group: true }
  });

  if (!invite || invite.revokedAt) throw new Error("Invite link is invalid.");
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    throw new Error("Invite link has expired.");
  }
  if (invite.maxUses && invite.usedCount >= invite.maxUses) {
    throw new Error("Invite link has reached its limit.");
  }

  const existingMember = await prisma.chatMember.findUnique({
    where: {
      chatId_userId: {
        chatId: invite.group.chatId,
        userId
      }
    }
  });

  if (existingMember?.status === "ACTIVE") {
    return { joined: true, chatId: invite.group.chatId };
  }

  if (!invite.group.approvalRequired) {
    await prisma.$transaction([
      prisma.chatMember.upsert({
        where: { chatId_userId: { chatId: invite.group.chatId, userId } },
        create: { chatId: invite.group.chatId, userId, role: "MEMBER" },
        update: { status: "ACTIVE", leftAt: null, role: "MEMBER" }
      }),
      prisma.groupInvite.update({
        where: { id: invite.id },
        data: { usedCount: { increment: 1 } }
      })
    ]);

    return { joined: true, chatId: invite.group.chatId };
  }

  const request = await prisma.groupJoinRequest.upsert({
    where: {
      groupId_userId_status: {
        groupId: invite.group.id,
        userId,
        status: "PENDING"
      }
    },
    create: {
      groupId: invite.group.id,
      userId,
      message: data.message
    },
    update: {
      message: data.message
    }
  });

  return { joined: false, request };
}

export async function reviewJoinRequest(
  chatId: string,
  adminId: string,
  requestId: string,
  input: unknown
) {
  const admin = await assertGroupAdmin(chatId, adminId);
  const groupId = admin.chat.group?.id;
  if (!groupId) throw new Error("Group not found.");
  const data = reviewJoinRequestSchema.parse(input);

  const request = await prisma.groupJoinRequest.update({
    where: { id: requestId },
    data: {
      status: data.status,
      reviewedById: adminId,
      reviewedAt: new Date()
    }
  });

  if (data.status === "APPROVED") {
    await prisma.chatMember.upsert({
      where: { chatId_userId: { chatId, userId: request.userId } },
      create: { chatId, userId: request.userId, role: "MEMBER" },
      update: { status: "ACTIVE", leftAt: null, role: "MEMBER" }
    });
  }

  return request;
}

export async function createPinnedAnnouncement(
  chatId: string,
  userId: string,
  input: unknown
) {
  await assertGroupAdmin(chatId, userId);
  const data = pinnedAnnouncementSchema.parse(input);

  return prisma.groupPinnedAnnouncement.create({
    data: {
      chatId,
      messageId: data.messageId,
      title: data.title,
      body: data.body,
      pinnedUntil: data.pinnedUntil ? new Date(data.pinnedUntil) : undefined,
      createdById: userId
    }
  });
}

export async function getSharedMedia(chatId: string, userId: string) {
  await assertGroupMember(chatId, userId);

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
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return attachments.map((attachment) => ({
    ...attachment,
    sizeBytes: attachment.sizeBytes.toString()
  }));
}
