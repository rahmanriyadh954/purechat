import type { Socket } from "socket.io";
import { parse } from "cookie";
import { getSessionFromAccessToken } from "@/features/auth/auth.service";

export type AuthenticatedSocket = Socket & {
  userId?: string;
  sessionId?: string;
};

const accessCookieName = process.env.AUTH_COOKIE_NAME ?? "purechat.session";

export async function authenticateSocket(socket: AuthenticatedSocket) {
  const cookieHeader = socket.handshake.headers.cookie;
  const tokenFromCookie = cookieHeader
    ? parse(cookieHeader)[accessCookieName]
    : undefined;
  const tokenFromAuth =
    typeof socket.handshake.auth.accessToken === "string"
      ? socket.handshake.auth.accessToken
      : undefined;
  const session = await getSessionFromAccessToken(tokenFromCookie ?? tokenFromAuth);

  if (!session || session.user.status !== "ACTIVE") {
    throw new Error("Unauthorized socket connection");
  }

  socket.userId = session.userId;
  socket.sessionId = session.id;
}
