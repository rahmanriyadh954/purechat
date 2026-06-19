import { NextRequest } from "next/server";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function assertCsrfSafe(request: NextRequest) {
  if (!unsafeMethods.has(request.method)) return;

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) {
    throw new Error("Missing request origin.");
  }

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    throw new Error("Invalid request origin.");
  }

  if (originUrl.host !== host) {
    throw new Error("Invalid request origin.");
  }
}

export function csrfHeaders() {
  return {
    "X-CSRF-Protection": "origin-check"
  };
}
