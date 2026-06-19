import { NextRequest, NextResponse } from "next/server";
import type { ZodSchema } from "zod";
import { assertCsrfSafe } from "./csrf";

const MAX_JSON_BYTES = 256 * 1024;

export async function readValidatedJson<T>(
  request: NextRequest,
  schema: ZodSchema<T>
) {
  assertCsrfSafe(request);

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("Content type must be application/json.");
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_JSON_BYTES) {
    throw new Error("Request body is too large.");
  }

  return schema.parse(JSON.parse(text));
}

export function apiError(error: unknown, status = 400) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Request failed." },
    { status }
  );
}
