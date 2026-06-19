import { NextResponse } from "next/server";
import {
  clearAuthCookies,
  getAccessTokenCookie,
  getRefreshTokenCookie
} from "@/features/auth/auth.cookies";
import { logoutSession } from "@/features/auth/auth.service";

export async function POST() {
  await logoutSession(await getRefreshTokenCookie(), await getAccessTokenCookie());
  await clearAuthCookies();

  return NextResponse.json({
    ok: true,
    message: "Signed out."
  });
}
