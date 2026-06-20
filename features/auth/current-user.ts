import { getAccessTokenCookie, getRefreshTokenCookie } from "./auth.cookies";
import { getSessionFromAccessToken, getSessionFromRefreshToken } from "./auth.service";

export async function getCurrentSession() {
  const accessToken = await getAccessTokenCookie();
  const session = await getSessionFromAccessToken(accessToken);

  if (session) return session;

  return getSessionFromRefreshToken(await getRefreshTokenCookie());
}

export async function requireCurrentSession() {
  const session = await getCurrentSession();

  if (!session) {
    throw new Error("Please sign in.");
  }

  return session;
}
