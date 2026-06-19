import { cookies } from "next/headers";
import { env } from "@/lib/env";

export const accessCookieName = env.AUTH_COOKIE_NAME;
export const refreshCookieName = `${env.AUTH_COOKIE_NAME}.refresh`;

const isProduction = process.env.NODE_ENV === "production";

export async function setAuthCookies(input: {
  accessToken: string;
  refreshToken: string;
  accessTokenMaxAgeSeconds: number;
  refreshTokenMaxAgeSeconds: number;
}) {
  const cookieStore = await cookies();

  cookieStore.set(accessCookieName, input.accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
    maxAge: input.accessTokenMaxAgeSeconds
  });

  cookieStore.set(refreshCookieName, input.refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/api/auth",
    maxAge: input.refreshTokenMaxAgeSeconds
  });
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  cookieStore.set(accessCookieName, "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
    maxAge: 0
  });
  cookieStore.set(refreshCookieName, "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/api/auth",
    maxAge: 0
  });
}

export async function getAccessTokenCookie() {
  return (await cookies()).get(accessCookieName)?.value;
}

export async function getRefreshTokenCookie() {
  return (await cookies()).get(refreshCookieName)?.value;
}
