import { getAccessTokenCookie } from "./auth.cookies";
import { getSessionFromAccessToken } from "./auth.service";

export async function getCurrentSession() {
  const accessToken = await getAccessTokenCookie();
  return getSessionFromAccessToken(accessToken);
}

export async function requireCurrentSession() {
  const session = await getCurrentSession();

  if (!session) {
    throw new Error("Please sign in.");
  }

  return session;
}
