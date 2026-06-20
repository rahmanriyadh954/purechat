import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(8)
});

export const otpStartSchema = z.object({
  identifier: z.string().min(3)
});

export const otpVerifySchema = z.object({
  identifier: z.string().min(3),
  code: z.string().length(6)
});

export const registerSchema = z.object({
  displayName: z.string().trim().min(2, "Display name is required.").max(80),
  username: z.string().trim().min(3, "Username must be at least 3 characters.").max(32).regex(/^[a-zA-Z0-9._]+$/, "Username can use letters, numbers, dot, and underscore."),
  email: z.string().trim().email("Enter a valid email address.").optional(),
  phone: z.string().trim().regex(/^\+?[1-9]\d{7,14}$/, "Enter a valid phone number.").optional(),
  password: z.string()
    .min(10, "Password must be at least 10 characters.")
    .regex(/[A-Z]/, "Password needs at least one uppercase letter.")
    .regex(/[a-z]/, "Password needs at least one lowercase letter.")
    .regex(/[0-9]/, "Password needs at least one number.")
    .regex(/[^A-Za-z0-9]/, "Password needs at least one symbol."),
  gender: z.enum(["MALE", "FEMALE", "PREFER_NOT_TO_SAY"]).optional(),
  deviceFingerprintHash: z.string().regex(/^[a-f0-9]{64}$/).optional()
}).refine((data) => data.email || data.phone, {
  message: "Email or phone is required.",
  path: ["email"]
});
