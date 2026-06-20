import { z } from "zod";

export const createAnonymousConversationSchema = z.object({
  receiverUsername: z.string().trim().min(3).max(40),
  message: z.string().trim().min(1).max(2000).optional()
});

export const anonymousActionSchema = z.object({
  note: z.string().trim().max(500).optional()
});
