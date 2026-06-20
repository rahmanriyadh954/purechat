import { randomInt } from "node:crypto";
import { hashToken } from "./auth.tokens";
import { deliverOtpCode } from "./otp.delivery";
import { prisma } from "@/lib/prisma";

const OTP_TTL_MINUTES = 10;

export function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

export function createOtpCode() {
  return randomInt(100000, 1000000).toString();
}

export async function createOtpChallenge(input: {
  userId?: string;
  identifier: string;
  purpose: "LOGIN" | "VERIFY_EMAIL" | "VERIFY_PHONE" | "TWO_FACTOR" | "PASSWORD_RESET";
  ipAddress?: string;
  userAgent?: string;
}) {
  const code = createOtpCode();
  const normalizedIdentifier = normalizeIdentifier(input.identifier);

  await prisma.otpChallenge.create({
    data: {
      userId: input.userId,
      identifier: normalizedIdentifier,
      purpose: input.purpose,
      codeHash: hashToken(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    }
  });

  const delivery = await deliverOtpCode({
    identifier: normalizedIdentifier,
    code,
    purpose: input.purpose
  });

  return {
    code,
    delivery,
    expiresInMinutes: OTP_TTL_MINUTES
  };
}

export async function verifyOtpChallenge(input: {
  identifier: string;
  code: string;
  purpose: "LOGIN" | "VERIFY_EMAIL" | "VERIFY_PHONE" | "TWO_FACTOR" | "PASSWORD_RESET";
}) {
  const normalizedIdentifier = normalizeIdentifier(input.identifier);

  const challenge = await prisma.otpChallenge.findFirst({
    where: {
      identifier: normalizedIdentifier,
      purpose: input.purpose,
      consumedAt: null,
      expiresAt: {
        gt: new Date()
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  if (!challenge) {
    throw new Error("The code is expired or invalid.");
  }

  if (challenge.attempts >= challenge.maxAttempts) {
    throw new Error("Too many attempts. Please request a new code.");
  }

  const valid = hashToken(input.code) === challenge.codeHash;

  if (!valid) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } }
    });

    throw new Error("The code is incorrect.");
  }

  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() }
  });

  return challenge;
}
