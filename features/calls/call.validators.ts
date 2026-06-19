import { z } from "zod";

export const startCallSchema = z.object({
  chatId: z.string().min(1),
  type: z.enum(["AUDIO", "VIDEO"]),
  participantIds: z.array(z.string().min(1)).optional(),
  isGroupCall: z.boolean().default(false)
});

export const callIdSchema = z.object({
  callId: z.string().min(1)
});

export const callSignalSchema = z.object({
  callId: z.string().min(1),
  chatId: z.string().min(1),
  targetUserId: z.string().min(1),
  sdp: z.string().optional(),
  candidate: z.unknown().optional()
});

export const screenShareSchema = z.object({
  callId: z.string().min(1),
  enabled: z.boolean()
});
