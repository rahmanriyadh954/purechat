import { NextRequest, NextResponse } from "next/server";
import { getRefreshTokenCookie, setAuthCookies } from "@/features/auth/auth.cookies";
import { rotateRefreshToken } from "@/features/auth/auth.service";
import { getClientIp } from "@/server/security/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const tokens = await rotateRefreshToken(await getRefreshTokenCookie(), {
      ipAddress: getClientIp(request.headers),
      userAgent: request.headers.get("user-agent") ?? undefined
    });

    await setAuthCookies(tokens);

    return NextResponse.json({ ok: true, message: "Session refreshed." });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Please sign in again." },
      { status: 401 }
    );
  }
}
