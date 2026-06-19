import { z } from "zod";
import { MAX_MESSAGE_LENGTH } from "@/lib/constants";
import { sanitizePlainText } from "@/server/security/sanitize";

export const sendMessageSchema = z.object({
  chatId: z.string().min(1),
  body: z.string().transform(sanitizePlainText).pipe(z.string().min(1).max(MAX_MESSAGE_LENGTH)),
  clientId: z.string().optional(),
  replyToMessageId: z.string().optional()
});

export const editMessageSchema = z.object({
  chatId: z.string().min(1),
  messageId: z.string().min(1),
  body: z.string().transform(sanitizePlainText).pipe(z.string().min(1).max(MAX_MESSAGE_LENGTH))
});

export const messageIdSchema = z.object({
  chatId: z.string().min(1),
  messageId: z.string().min(1)
});

export const reactionSchema = messageIdSchema.extend({
  emoji: z.string().min(1).max(32)
});
