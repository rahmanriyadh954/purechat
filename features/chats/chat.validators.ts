import { z } from "zod";

export const createDirectChatSchema = z.object({
  mode: z.literal("direct"),
  userId: z.string().min(1)
});
