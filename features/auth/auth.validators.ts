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
  displayName: z.string().min(2).max(80),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email().optional(),
  phone: z.string().min(8).optional(),
  password: z.string().min(10)
}).refine((data) => data.email || data.phone, {
  message: "Email or phone is required.",
  path: ["email"]
});
