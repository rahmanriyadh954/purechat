import { NextRequest, NextResponse } from "next/server";
import { startOtpLogin } from "@/features/auth/auth.service";
import { otpStartSchema } from "@/features/auth/auth.validators";
import { apiError, readValidatedJson } from "@/server/security/api";
import { getClientIp, rateLimit } from "@/server/security/rate-limit";

export async function POST(request: NextRequest) {
  const ipAddress = getClientIp(request.headers);
  const limit = await rateLimit({
    key: `rate:auth:otp:start:${ipAddress}`,
    limit: 5,
    windowSeconds: 60 * 10
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many code requests. Please wait a little." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  try {
    const body = await readValidatedJson(request, otpStartSchema);
    const result = await startOtpLogin(body, {
      ipAddress,
      userAgent: request.headers.get("user-agent") ?? undefined
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
