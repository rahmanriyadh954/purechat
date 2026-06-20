import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
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

const invalidLoginMessage = "The email or password is incorrect.";

function logAuthFailure(reason: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;
  console.warn("[PureChat Auth] Login failed", { reason, ...details });
}

function isInvalidCredentialError(error: unknown) {
  if (error instanceof ZodError) return true;
  if (!(error instanceof Error)) return false;

  return (
    error.message === "The login details are incorrect." ||
    error.message === invalidLoginMessage
  );
}

export async function POST(request: NextRequest) {
  const ipAddress = getClientIp(request.headers);

  try {
    const body = await readValidatedJson(request, loginSchema);

    const identifier = normalizeRateLimitIdentifier(body.identifier);
    const rateLimitKey = `rate:auth:login:${ipAddress}:${identifier}`;
    let result: Awaited<ReturnType<typeof loginWithPassword>>;

    try {
      result = await loginWithPassword(body, {
        ipAddress,
        userAgent: request.headers.get("user-agent") ?? undefined
      });
    } catch (error) {
      if (!isInvalidCredentialError(error)) throw error;

      const limit = await rateLimit({
        key: rateLimitKey,
        limit: 10,
        windowSeconds: 60 * 10
      });

      if (!limit.allowed) {
        logAuthFailure("rate_limited", { ipAddress, identifier });
        return NextResponse.json(
          { error: "Too many login tries for this account. Please wait a little." },
          { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
        );
      }

      logAuthFailure("invalid_credentials", { ipAddress, identifier });
      return NextResponse.json({ error: invalidLoginMessage }, { status: 401 });
    }

    if (result.requiresTwoFactor) {
      return NextResponse.json({
        requiresTwoFactor: true,
        identifier: result.identifier,
        message: "Enter the code we sent."
      });
    }

    if (!result.session) {
      logAuthFailure("missing_session", { ipAddress, identifier });
      return NextResponse.json(
        { error: invalidLoginMessage },
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
    const message = error instanceof Error ? error.message : "Unknown login error";
    const isInvalidLogin = isInvalidCredentialError(error);

    logAuthFailure(isInvalidLogin ? "invalid_credentials" : "request_error", {
      ipAddress,
      error: message
    });

    return NextResponse.json(
      { error: isInvalidLogin ? invalidLoginMessage : "Sign in could not be completed. Please try again." },
      { status: isInvalidLogin ? 401 : 400 }
    );
  }
}
