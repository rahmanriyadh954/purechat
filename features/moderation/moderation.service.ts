import { prisma } from "@/lib/prisma";
import { assertChatMember } from "@/server/security/permissions";
import { decryptSensitiveText, encryptSensitiveText } from "@/server/security/encryption";
import { writeAuditLog } from "@/server/security/audit";
import {
  approveMessageSchema,
  familyModeSchema,
  reportSchema,
  reviewReportSchema,
  userRestrictionSchema,
  warningSchema
} from "./moderation.validators";

const badLanguagePatterns = [
  /\b(fuck|shit|bitch|bastard|asshole)\b/i
];

const adultTextPatterns = [
  /\b(porn|nude|sex|xxx|escort)\b/i
];

const harassmentPatterns = [
  /\b(kill yourself|i will hurt you|stupid idiot|worthless)\b/i
];

const scamSpamPatterns = [
  /\b(send money|free crypto|investment guaranteed|click this link|urgent prize)\b/i,
  /(https?:\/\/\S+){3,}/i
];

export type ModerationEvaluation = {
  allowed: boolean;
  needsReview: boolean;
  reasons: string[];
  severity: "LOW" | "MEDIUM" | "HIGH";
};

export function evaluateTextSafety(text: string, familyModeEnabled: boolean): ModerationEvaluation {
  const reasons: string[] = [];

  if (badLanguagePatterns.some((pattern) => pattern.test(text))) {
    reasons.push("bad_language");
  }
  if (adultTextPatterns.some((pattern) => pattern.test(text))) {
    reasons.push("adult_text");
  }
  if (harassmentPatterns.some((pattern) => pattern.test(text))) {
    reasons.push("harassment");
  }
  if (scamSpamPatterns.some((pattern) => pattern.test(text))) {
    reasons.push("scam_or_spam");
  }

  const highRisk = reasons.includes("harassment") || reasons.includes("scam_or_spam");
  const familyBlocked =
    familyModeEnabled &&
    (reasons.includes("bad_language") || reasons.includes("adult_text"));

  return {
    allowed: !familyBlocked && !highRisk,
    needsReview: reasons.length > 0,
    reasons,
    severity: highRisk ? "HIGH" : reasons.length > 0 ? "MEDIUM" : "LOW"
  };
}

export async function getFamilyModeForUser(userId: string) {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: {
      familyModeEnabled: true,
      blockUnknownContacts: true,
      filterGifs: true,
      filterStickers: true,
      filterMedia: true
    }
  });

  return profile;
}

export async function assertUserCanAct(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      suspendedUntil: true
    }
  });

  if (!user || user.status === "DELETED") {
    throw new Error("Account not found.");
  }
  if (user.status === "BANNED") {
    throw new Error("This account is banned.");
  }
  if (user.status === "SUSPENDED" && user.suspendedUntil && user.suspendedUntil > new Date()) {
    throw new Error("This account is temporarily suspended.");
  }
}

export async function createReport(input: unknown, reporterId: string) {
  const data = reportSchema.parse(input);

  if (data.chatId) {
    await assertChatMember(reporterId, data.chatId);
  }

  let evidence: Record<string, unknown> | undefined;

  if (data.messageId) {
    const message = await prisma.message.findFirst({
      where: {
        id: data.messageId,
        chatId: data.chatId
      },
      select: {
        id: true,
        senderId: true,
        type: true,
        body: true,
        createdAt: true
      }
    });

    if (message) {
      evidence = {
        messageSnapshot: message
      };
    }
  }

  const report = await prisma.report.create({
    data: {
      reporterId,
      reportedUserId: data.reportedUserId,
      chatId: data.chatId,
      messageId: data.messageId,
      type: data.type,
      reason: data.reason,
      details: data.details,
      evidence: undefined,
      encryptedEvidence: evidence ? encryptSensitiveText(JSON.stringify(evidence)) : undefined
    }
  });

  await writeAuditLog({
    actorId: reporterId,
    action: "REPORT_CREATED",
    entityType: "Report",
    entityId: report.id,
    metadata: {
      type: data.type,
      hasMessageEvidence: Boolean(evidence)
    }
  });

  return report;
}

export async function listReportsForAdmin() {
  const reports = await prisma.report.findMany({
    include: {
      reporter: {
        select: { id: true, displayName: true, username: true }
      },
      reportedUser: {
        select: { id: true, displayName: true, username: true, status: true }
      },
      message: {
        select: { id: true, type: true, createdAt: true }
      },
      chat: {
        select: { id: true, title: true, type: true }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return reports.map((report) => ({
    ...report,
    evidence: report.encryptedEvidence
      ? JSON.parse(decryptSensitiveText(report.encryptedEvidence))
      : report.evidence
  }));
}

export async function reviewReport(reportId: string, adminId: string, input: unknown) {
  const data = reviewReportSchema.parse(input);

  const report = await prisma.report.update({
    where: { id: reportId },
    data: {
      status: data.status,
      resolutionNote: data.resolutionNote,
      reviewedById: adminId,
      reviewedAt: new Date()
    }
  });

  await writeAuditLog({
    actorId: adminId,
    action: "REPORT_REVIEWED",
    entityType: "Report",
    entityId: reportId,
    metadata: { status: data.status }
  });

  return report;
}

export async function warnUser(adminId: string, input: unknown) {
  const data = warningSchema.parse(input);

  const warning = await prisma.warning.create({
    data: {
      userId: data.userId,
      issuedById: adminId,
      reason: data.reason,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined
    }
  });

  await writeAuditLog({
    actorId: adminId,
    action: "USER_WARNED",
    entityType: "User",
    entityId: data.userId,
    metadata: { warningId: warning.id }
  });

  return warning;
}

export async function suspendUser(adminId: string, input: unknown) {
  const data = userRestrictionSchema.parse(input);

  const user = await prisma.user.update({
    where: { id: data.userId },
    data: {
      status: "SUSPENDED",
      suspendedUntil: data.suspendedUntil ? new Date(data.suspendedUntil) : undefined,
      moderationNote: data.reason
    }
  });

  await prisma.moderationAction.create({
    data: {
      adminId,
      targetUserId: data.userId,
      actionType: "SUSPEND_USER",
      reason: data.reason
    }
  });

  await writeAuditLog({
    actorId: adminId,
    action: "USER_SUSPENDED",
    entityType: "User",
    entityId: data.userId,
    metadata: {
      suspendedUntil: data.suspendedUntil,
      reason: data.reason
    }
  });

  return user;
}

export async function banUser(adminId: string, input: unknown) {
  const data = userRestrictionSchema.parse(input);

  const user = await prisma.user.update({
    where: { id: data.userId },
    data: {
      status: "BANNED",
      moderationNote: data.reason
    }
  });

  await prisma.moderationAction.create({
    data: {
      adminId,
      targetUserId: data.userId,
      actionType: "BAN_USER",
      reason: data.reason
    }
  });

  await writeAuditLog({
    actorId: adminId,
    action: "USER_BANNED",
    entityType: "User",
    entityId: data.userId,
    metadata: { reason: data.reason }
  });

  return user;
}

export async function updateFamilyMode(userId: string, input: unknown) {
  const data = familyModeSchema.parse(input);

  const profile = await prisma.profile.upsert({
    where: { userId },
    create: {
      userId,
      familyModeEnabled: data.enabled,
      blockUnknownContacts: data.blockUnknownContacts ?? false,
      filterGifs: data.filterGifs ?? data.enabled,
      filterStickers: data.filterStickers ?? data.enabled,
      filterMedia: data.filterMedia ?? false
    },
    update: {
      familyModeEnabled: data.enabled,
      blockUnknownContacts: data.blockUnknownContacts,
      filterGifs: data.filterGifs,
      filterStickers: data.filterStickers,
      filterMedia: data.filterMedia
    }
  });

  await writeAuditLog({
    actorId: userId,
    action: "FAMILY_MODE_UPDATED",
    entityType: "User",
    entityId: userId,
    metadata: { enabled: data.enabled }
  });

  return profile;
}

export async function approvePendingMessage(chatId: string, messageId: string, adminId: string, input: unknown) {
  const data = approveMessageSchema.parse(input);
  const member = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId: adminId } },
    select: { role: true, status: true }
  });

  if (!member || member.status !== "ACTIVE" || !["OWNER", "ADMIN"].includes(member.role)) {
    throw new Error("Only group admins can review messages.");
  }

  const message = await prisma.message.update({
    where: { id: messageId },
    data: data.approved
      ? { status: "SENT", metadata: { approvedBy: adminId, approvedAt: new Date().toISOString() } }
      : { status: "DELETED", deletedAt: new Date(), metadata: { rejectedBy: adminId, rejectedAt: new Date().toISOString() } },
    include: {
      sender: { select: { id: true, displayName: true, username: true, avatarUrl: true } },
      reactions: true,
      readReceipts: true,
      attachments: true
    }
  });

  if (data.approved) {
    await prisma.chat.update({
      where: { id: chatId },
      data: {
        lastMessageId: message.id,
        lastMessageAt: message.createdAt
      }
    });
  }

  return message;
}
