import { z } from "zod";
import { sanitizeFileName } from "@/server/security/sanitize";

export const attachmentKindSchema = z.enum([
  "image",
  "video",
  "document",
  "audio",
  "voice"
]);

export const presignUploadSchema = z.object({
  chatId: z.string().min(1),
  fileName: z.string().transform(sanitizeFileName).pipe(z.string().min(1).max(180)),
  mimeType: z.string().min(3).max(120),
  sizeBytes: z.number().int().positive(),
  kind: attachmentKindSchema
});

export const completeUploadSchema = presignUploadSchema.extend({
  storageKey: z.string().min(1).max(500),
  thumbnailKey: z.string().max(500).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationSeconds: z.number().int().positive().optional(),
  waveform: z.unknown().optional(),
  caption: z.string().trim().max(2000).optional()
});
