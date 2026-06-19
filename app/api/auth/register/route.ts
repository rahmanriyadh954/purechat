import { NextRequest, NextResponse } from "next/server";
import { registerUser } from "@/features/auth/auth.service";
import { registerSchema } from "@/features/auth/auth.validators";
import { apiError, readValidatedJson } from "@/server/security/api";
import { getClientIp, rateLimit } from "@/server/security/rate-limit";

export async function POST(request: NextRequest) {
  const ipAddress = getClientIp(request.headers);
  const limit = await rateLimit({
    key: `rate:auth:register:${ipAddress}`,
    limit: 5,
    windowSeconds: 60 * 10
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many tries. Please wait a little." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  try {
    const body = await readValidatedJson(request, registerSchema);
    const user = await registerUser(body, {
      ipAddress,
      userAgent: request.headers.get("user-agent") ?? undefined
    });

    return NextResponse.json({
      user,
      message: "Account created. Please verify your email or phone."
    });
  } catch (error) {
    return apiError(error);
  }
}
