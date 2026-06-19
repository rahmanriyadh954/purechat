import { NextRequest, NextResponse } from "next/server";
import { setAuthCookies } from "@/features/auth/auth.cookies";
import { loginWithPassword } from "@/features/auth/auth.service";
import { loginSchema } from "@/features/auth/auth.validators";
import { readValidatedJson } from "@/server/security/api";
import {
  getClientIp,
  normalizeRateLimitIdentifier,
  rateLimit,
  resetRateLimit
} from "@/server/security/rate-limit";

export async function POST(request: NextRequest) {
  const ipAddress = getClientIp(request.headers);

  try {
    const body = await readValidatedJson(request, loginSchema);

    const identifier = normalizeRateLimitIdentifier(body.identifier);
    const rateLimitKey = `rate:auth:login:${ipAddress}:${identifier}`;

    const limit = await rateLimit({
      key: rateLimitKey,
      limit: 10,
      windowSeconds: 60 * 10
    });

    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many login tries for this account. Please wait a little." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
      );
    }

    const result = await loginWithPassword(body, {
      ipAddress,
      userAgent: request.headers.get("user-agent") ?? undefined
    });

    if (result.requiresTwoFactor) {
      return NextResponse.json({
        requiresTwoFactor: true,
        identifier: result.identifier,
        message: "Enter the code we sent."
      });
    }

    if (!result.session) {
      return NextResponse.json(
        { error: "The login details are incorrect." },
        { status: 401 }
      );
    }

    await resetRateLimit(rateLimitKey);
    await setAuthCookies(result.session);

    return NextResponse.json({
      ok: true,
      message: "Signed in."
    });
  } catch (error) {
    console.error("[PureChat Login Error]", error);

    const message =
      error instanceof Error && error.message
        ? error.message
        : "The login details are incorrect.";

    return NextResponse.json(
      { error: message },
      { status: 401 }
    );
  }
}