import { z } from "zod";

export const conversationSafetySchema = z.object({
  status: z.enum(["SAFE", "UNSURE", "UNSAFE"]),
  action: z.enum(["REPORT", "BLOCK", "END_CONVERSATION"]).optional(),
  note: z.string().trim().max(500).optional()
});
