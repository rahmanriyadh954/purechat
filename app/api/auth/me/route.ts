import { NextResponse } from "next/server";
import {
  getAccessTokenCookie,
  getRefreshTokenCookie,
  setAuthCookies
} from "@/features/auth/auth.cookies";
import {
  getSessionFromAccessToken,
  getSessionFromRefreshToken,
  rotateRefreshToken
} from "@/features/auth/auth.service";

export async function GET() {
  const accessToken = await getAccessTokenCookie();
  let session = await getSessionFromAccessToken(accessToken);

  if (!session) {
    const refreshToken = await getRefreshTokenCookie();
    session = await getSessionFromRefreshToken(refreshToken);

    if (session) {
      const tokens = await rotateRefreshToken(refreshToken);
      await setAuthCookies(tokens);
      session = await getSessionFromAccessToken(tokens.accessToken);
    }
  }

  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: session.user,
    session: {
      id: session.id,
      device: session.device,
      expiresAt: session.expiresAt
    }
  });
}
