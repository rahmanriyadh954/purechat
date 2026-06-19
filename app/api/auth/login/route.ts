import { NextRequest, NextResponse } from "next/server";
import { setAuthCookies } from "@/features/auth/auth.cookies";
import { loginWithPassword } from "@/features/auth/auth.service";
import { loginSchema } from "@/features/auth/auth.validators";
import { apiError, readValidatedJson } from "@/server/security/api";
import { getClientIp, rateLimit } from "@/server/security/rate-limit";

export async function POST(request: NextRequest) {
  const ipAddress = getClientIp(request.headers);
  const limit = await rateLimit({
    key: `rate:auth:login:${ipAddress}`,
    limit: 10,
    windowSeconds: 60 * 10
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many login tries. Please wait a little." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  try {
    const body = await readValidatedJson(request, loginSchema);
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
      throw new Error("Login failed.");
    }

    await setAuthCookies(result.session);

    return NextResponse.json({
      ok: true,
      message: "Signed in."
    });
  } catch (error) {
    return apiError(error, 401);
  }
}
