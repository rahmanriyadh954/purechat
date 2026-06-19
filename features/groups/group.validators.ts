import { z } from "zod";

export const createGroupSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  avatarUrl: z.string().url().optional(),
  memberIds: z.array(z.string().min(1)).default([]),
  approvalRequired: z.boolean().default(false),
  familySafeOnly: z.boolean().default(false)
});

export const updateGroupSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional()
});

export const groupPermissionsSchema = z.object({
  membersCanSend: z.boolean(),
  membersCanInvite: z.boolean(),
  membersCanUploadMedia: z.boolean(),
  membersCanReact: z.boolean(),
  onlyAdminsCanPost: z.boolean(),
  messageApprovalRequired: z.boolean(),
  approvalRequired: z.boolean()
});

export const addMembersSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(100)
});

export const memberRoleSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"])
});

export const createInviteSchema = z.object({
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional()
});

export const joinRequestSchema = z.object({
  message: z.string().trim().max(300).optional()
});

export const reviewJoinRequestSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"])
});

export const pinnedAnnouncementSchema = z.object({
  messageId: z.string().min(1).optional(),
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().max(1000).optional(),
  pinnedUntil: z.string().datetime().optional()
});
