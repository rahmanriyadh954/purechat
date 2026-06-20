import { NextRequest, NextResponse } from "next/server";
import { setAuthCookies } from "@/features/auth/auth.cookies";
import { verifyAccountOtp } from "@/features/auth/auth.service";
import { otpVerifySchema } from "@/features/auth/auth.validators";
import { apiError, readValidatedJson } from "@/server/security/api";
import { getClientIp, rateLimit } from "@/server/security/rate-limit";

export async function POST(request: NextRequest) {
  const ipAddress = getClientIp(request.headers);
  const limit = await rateLimit({
    key: `rate:auth:verify-account:${ipAddress}`,
    limit: 10,
    windowSeconds: 60 * 10
  });

  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "Too many tries. Please wait a little.",
        retryAfter: limit.retryAfter
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  try {
    const body = await readValidatedJson(request, otpVerifySchema);
    const session = await verifyAccountOtp(body, {
      ipAddress,
      userAgent: request.headers.get("user-agent") ?? undefined
    });
    await setAuthCookies(session);
    return NextResponse.json({ ok: true, message: "Account verified." });
  } catch (error) {
    return apiError(error);
  }
}
