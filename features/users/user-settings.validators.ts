import { z } from "zod";

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(2, "Display name is required.").max(80).optional(),
  username: z.string().trim().min(3, "Username must be at least 3 characters.").max(32).regex(/^[a-zA-Z0-9._]+$/, "Username can use letters, numbers, dot, and underscore.").optional(),
  email: z.string().trim().email("Enter a valid email address.").nullable().optional(),
  phone: z.string().trim().regex(/^\+?[1-9]\d{7,14}$/, "Enter a valid phone number.").nullable().optional(),
  gender: z.enum(["MALE", "FEMALE", "PREFER_NOT_TO_SAY"]).nullable().optional(),
  country: z.string().trim().max(80).nullable().optional(),
  statusMessage: z.string().trim().max(160).nullable().optional(),
  bio: z.string().trim().max(500).nullable().optional()
});

export const privacyUpdateSchema = z.object({
  lastSeenVisibility: z.enum(["EVERYONE", "CONTACTS", "NOBODY"]).optional(),
  profilePhotoVisibility: z.enum(["EVERYONE", "CONTACTS", "NOBODY"]).optional(),
  onlineStatusEnabled: z.boolean().optional(),
  readReceiptsEnabled: z.boolean().optional()
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z.string()
    .min(10, "Password must be at least 10 characters.")
    .regex(/[A-Z]/, "Password needs at least one uppercase letter.")
    .regex(/[a-z]/, "Password needs at least one lowercase letter.")
    .regex(/[0-9]/, "Password needs at least one number.")
    .regex(/[^A-Za-z0-9]/, "Password needs at least one symbol.")
});
