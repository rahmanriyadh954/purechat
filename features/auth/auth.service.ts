import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  accessTokenMaxAgeSeconds,
  createAccessToken,
  createRefreshToken,
  hashToken,
  refreshTokenMaxAgeSeconds
} from "./auth.tokens";
import { createOtpChallenge, normalizeIdentifier, verifyOtpChallenge } from "./otp.service";
import { loginSchema, otpStartSchema, otpVerifySchema, registerSchema } from "./auth.validators";
import { writeAuditLog } from "@/server/security/audit";
import { cacheDel, cacheGet, cacheSetEx } from "@/server/redis/client";

const accessSessionKey = (token: string) => `auth:access:${hashToken(token)}`;

export type RequestMeta = {
  ipAddress?: string;
  userAgent?: string;
  deviceName?: string;
};

function detectDeviceType(userAgent = "") {
  const value = userAgent.toLowerCase();

  if (value.includes("iphone") || value.includes("ipad")) return "IOS";
  if (value.includes("android")) return "ANDROID";
  if (value.includes("electron")) return "DESKTOP";

  return "WEB";
}

function isEmail(identifier: string) {
  return identifier.includes("@");
}

export async function registerUser(input: unknown, meta: RequestMeta) {
  const data = registerSchema.parse(input);
  const passwordHash = await hash(data.password, 12);

  const user = await prisma.user.create({
    data: {
      email: data.email ? normalizeIdentifier(data.email) : undefined,
      phone: data.phone,
      username: data.username.toLowerCase(),
      displayName: data.displayName,
      passwordHash,
      profile: {
        create: {}
      }
    },
    select: {
      id: true,
      email: true,
      phone: true,
      username: true,
      displayName: true
    }
  });

  if (user.email) {
    await createOtpChallenge({
      userId: user.id,
      identifier: user.email,
      purpose: "VERIFY_EMAIL",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    });
  }

  if (user.phone) {
    await createOtpChallenge({
      userId: user.id,
      identifier: user.phone,
      purpose: "VERIFY_PHONE",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    });
  }

  await writeAuditLog({
    actorId: user.id,
    action: "USER_REGISTERED",
    entityType: "User",
    entityId: user.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent
  });

  return user;
}

export async function loginWithPassword(input: unknown, meta: RequestMeta) {
  const data = loginSchema.parse(input);
  const identifier = normalizeIdentifier(data.identifier);

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier },
        { phone: data.identifier.trim() },
        { username: identifier }
      ],
      deletedAt: null
    },
    include: {
      profile: true
    }
  });

  if (!user || user.status !== "ACTIVE") {
    throw new Error("The login details are incorrect.");
  }

  const validPassword = await compare(data.password, user.passwordHash);

  if (!validPassword) {
    throw new Error("The login details are incorrect.");
  }

  if (user.profile?.twoFactorEnabled) {
    const target = user.email ?? user.phone;

    if (!target) {
      throw new Error("Two-step verification is not ready for this account.");
    }

    await createOtpChallenge({
      userId: user.id,
      identifier: target,
      purpose: "TWO_FACTOR",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    });

    return {
      requiresTwoFactor: true,
      identifier: target
    };
  }

  return {
    requiresTwoFactor: false,
    session: await createSession(user.id, meta)
  };
}

export async function startOtpLogin(input: unknown, meta: RequestMeta) {
  const data = otpStartSchema.parse(input);
  const identifier = normalizeIdentifier(data.identifier);
  const user = await prisma.user.findFirst({
    where: isEmail(identifier)
      ? { email: identifier, deletedAt: null, status: "ACTIVE" }
      : { phone: data.identifier.trim(), deletedAt: null, status: "ACTIVE" },
    select: {
      id: true,
      email: true,
      phone: true
    }
  });

  if (user) {
    await createOtpChallenge({
      userId: user.id,
      identifier: isEmail(identifier) ? identifier : data.identifier.trim(),
      purpose: "LOGIN",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    });
  }

  return {
    ok: true,
    message: "If the account exists, we sent a code."
  };
}

export async function verifyOtpLogin(input: unknown, meta: RequestMeta) {
  const data = otpVerifySchema.parse(input);
  const challenge = await verifyOtpChallenge({
    identifier: data.identifier,
    code: data.code,
    purpose: "LOGIN"
  });

  if (!challenge.userId) {
    throw new Error("The code is expired or invalid.");
  }

  return createSession(challenge.userId, meta);
}

export async function verifyAccountOtp(input: unknown) {
  const data = otpVerifySchema.parse(input);
  const identifier = normalizeIdentifier(data.identifier);
  const purpose = isEmail(identifier) ? "VERIFY_EMAIL" : "VERIFY_PHONE";
  const challenge = await verifyOtpChallenge({
    identifier: data.identifier,
    code: data.code,
    purpose
  });

  if (!challenge.userId) {
    throw new Error("The code is expired or invalid.");
  }

  await prisma.user.update({
    where: { id: challenge.userId },
    data:
      purpose === "VERIFY_EMAIL"
        ? { emailVerifiedAt: new Date(), isVerified: true }
        : { phoneVerifiedAt: new Date(), isVerified: true }
  });
}

export async function verifyTwoFactor(input: unknown, meta: RequestMeta) {
  const data = otpVerifySchema.parse(input);
  const challenge = await verifyOtpChallenge({
    identifier: data.identifier,
    code: data.code,
    purpose: "TWO_FACTOR"
  });

  if (!challenge.userId) {
    throw new Error("The code is expired or invalid.");
  }

  return createSession(challenge.userId, meta);
}

export async function createSession(userId: string, meta: RequestMeta) {
  const accessToken = createAccessToken();
  const refreshToken = createRefreshToken();
  const expiresAt = new Date(Date.now() + refreshTokenMaxAgeSeconds * 1000);

  const device = await prisma.device.create({
    data: {
      userId,
      type: detectDeviceType(meta.userAgent),
      name: meta.deviceName ?? "Current device",
      lastActiveAt: new Date()
    }
  });

  const session = await prisma.session.create({
    data: {
      userId,
      deviceId: device.id,
      refreshTokenHash: hashToken(refreshToken),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      expiresAt
    }
  });

  await cacheSetEx(accessSessionKey(accessToken), accessTokenMaxAgeSeconds, session.id);

  await writeAuditLog({
    actorId: userId,
    action: "USER_LOGIN",
    entityType: "Session",
    entityId: session.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent
  });

  return {
    accessToken,
    refreshToken,
    session,
    accessTokenMaxAgeSeconds,
    refreshTokenMaxAgeSeconds
  };
}

export async function getSessionFromAccessToken(accessToken?: string) {
  if (!accessToken) return null;

  const sessionId = await cacheGet(accessSessionKey(accessToken));

  if (!sessionId) return null;

  return prisma.session.findFirst({
    where: {
      id: sessionId,
      revokedAt: null,
      expiresAt: {
        gt: new Date()
      }
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          role: true,
          status: true
        }
      },
      device: true
    }
  });
}

export async function rotateRefreshToken(refreshToken?: string, meta?: RequestMeta) {
  if (!refreshToken) {
    throw new Error("Missing refresh token.");
  }

  const refreshTokenHash = hashToken(refreshToken);
  const session = await prisma.session.findFirst({
    where: {
      refreshTokenHash,
      revokedAt: null,
      expiresAt: {
        gt: new Date()
      }
    }
  });

  if (!session) {
    throw new Error("Please sign in again.");
  }

  const accessToken = createAccessToken();
  const nextRefreshToken = createRefreshToken();

  await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: hashToken(nextRefreshToken),
      ipAddress: meta?.ipAddress ?? session.ipAddress,
      userAgent: meta?.userAgent ?? session.userAgent,
      updatedAt: new Date()
    }
  });

  await cacheSetEx(accessSessionKey(accessToken), accessTokenMaxAgeSeconds, session.id);

  return {
    accessToken,
    refreshToken: nextRefreshToken,
    accessTokenMaxAgeSeconds,
    refreshTokenMaxAgeSeconds
  };
}

export async function logoutSession(refreshToken?: string, accessToken?: string) {
  if (accessToken) {
    await cacheDel(accessSessionKey(accessToken));
  }

  if (!refreshToken) return;

  await prisma.session.updateMany({
    where: {
      refreshTokenHash: hashToken(refreshToken),
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  });

  await writeAuditLog({
    action: "USER_LOGOUT",
    metadata: { scope: "current_session" }
  });
}

export async function logoutAllDevices(userId: string) {
  await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  });

  await writeAuditLog({
    actorId: userId,
    action: "USER_LOGOUT",
    entityType: "User",
    entityId: userId,
    metadata: { scope: "all_devices" }
  });
}

export async function revokeSession(userId: string, sessionId: string) {
  await prisma.session.updateMany({
    where: {
      id: sessionId,
      userId
    },
    data: {
      revokedAt: new Date()
    }
  });

  await writeAuditLog({
    actorId: userId,
    action: "SESSION_REVOKED",
    entityType: "Session",
    entityId: sessionId
  });
}

export async function setTwoFactorEnabled(userId: string, enabled: boolean) {
  await prisma.profile.upsert({
    where: {
      userId
    },
    create: {
      userId,
      twoFactorEnabled: enabled
    },
    update: {
      twoFactorEnabled: enabled,
      twoFactorSecretHash: enabled ? undefined : null
    }
  });
}
