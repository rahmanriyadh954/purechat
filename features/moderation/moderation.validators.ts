import { z } from "zod";

export const reportSchema = z.object({
  type: z.enum(["USER", "MESSAGE", "CHAT", "GROUP", "ATTACHMENT"]),
  reportedUserId: z.string().min(1).optional(),
  chatId: z.string().min(1).optional(),
  messageId: z.string().min(1).optional(),
  reason: z.string().trim().min(3).max(160),
  details: z.string().trim().max(1000).optional()
});

export const warningSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().trim().min(3).max(500),
  expiresAt: z.string().datetime().optional()
});

export const userRestrictionSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().trim().min(3).max(500),
  suspendedUntil: z.string().datetime().optional()
});

export const reviewReportSchema = z.object({
  status: z.enum(["REVIEWING", "RESOLVED", "REJECTED"]),
  resolutionNote: z.string().trim().max(1000).optional()
});

export const familyModeSchema = z.object({
  enabled: z.boolean(),
  blockUnknownContacts: z.boolean().optional(),
  filterGifs: z.boolean().optional(),
  filterStickers: z.boolean().optional(),
  filterMedia: z.boolean().optional()
});

export const approveMessageSchema = z.object({
  approved: z.boolean()
});
