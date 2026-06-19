import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const ACCESS_TOKEN_BYTES = 32;
const REFRESH_TOKEN_BYTES = 48;

export const accessTokenMaxAgeSeconds = 15 * 60;
export const refreshTokenMaxAgeSeconds = 30 * 24 * 60 * 60;

export function createOpaqueToken(bytes = ACCESS_TOKEN_BYTES) {
  return randomBytes(bytes).toString("base64url");
}

export function createAccessToken() {
  return createOpaqueToken(ACCESS_TOKEN_BYTES);
}

export function createRefreshToken() {
  return createOpaqueToken(REFRESH_TOKEN_BYTES);
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function safeEqualHash(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
