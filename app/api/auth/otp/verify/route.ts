import { NextRequest, NextResponse } from "next/server";
import { setAuthCookies } from "@/features/auth/auth.cookies";
import { verifyOtpLogin } from "@/features/auth/auth.service";
import { otpVerifySchema } from "@/features/auth/auth.validators";
import { apiError, readValidatedJson } from "@/server/security/api";
import { getClientIp, rateLimit } from "@/server/security/rate-limit";

export async function POST(request: NextRequest) {
  const ipAddress = getClientIp(request.headers);
  const limit = await rateLimit({
    key: `rate:auth:otp:verify:${ipAddress}`,
    limit: 10,
    windowSeconds: 60 * 10
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many code tries. Please wait a little." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  try {
    const body = await readValidatedJson(request, otpVerifySchema);
    const session = await verifyOtpLogin(body, {
      ipAddress,
      userAgent: request.headers.get("user-agent") ?? undefined
    });

    await setAuthCookies(session);

    return NextResponse.json({
      ok: true,
      message: "Signed in."
    });
  } catch (error) {
    return apiError(error);
  }
}
