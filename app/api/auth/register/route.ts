import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import {
  duplicateDeviceMessage,
  duplicateIdentityMessage,
  registerUser
} from "@/features/auth/auth.service";
import { registerSchema } from "@/features/auth/auth.validators";
import { readValidatedJson } from "@/server/security/api";
import { writeAuditLog } from "@/server/security/audit";
import { getClientIp, rateLimit } from "@/server/security/rate-limit";

function getFieldErrors(error: ZodError) {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (!fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}

export async function POST(request: NextRequest) {
  const ipAddress = getClientIp(request.headers);
  const limit = await rateLimit({
    key: `rate:auth:register:${ipAddress}`,
    limit: 5,
    windowSeconds: 60 * 10
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many tries. Please wait a little." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  try {
    const body = await readValidatedJson(request, registerSchema);
    const result = await registerUser(body, {
      ipAddress,
      userAgent: request.headers.get("user-agent") ?? undefined
    });

    return NextResponse.json({
      user: result.user,
      verification: result.verification,
      message: result.verification.message
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Please check the highlighted fields.",
          fieldErrors: getFieldErrors(error)
        },
        { status: 400 }
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      await writeAuditLog({
        action: "DUPLICATE_ACCOUNT_ATTEMPT_BLOCKED",
        entityType: "User",
        ipAddress,
        userAgent: request.headers.get("user-agent") ?? undefined,
        metadata: {
          reason: "unique_constraint"
        }
      });

      return NextResponse.json(
        {
          error: duplicateIdentityMessage,
          code: "DUPLICATE_IDENTITY",
          fieldErrors: {
            contact: duplicateIdentityMessage,
            username: duplicateIdentityMessage
          }
        },
        { status: 409 }
      );
    }

    if (error instanceof Error && error.message === duplicateIdentityMessage) {
      return NextResponse.json(
        {
          error: duplicateIdentityMessage,
          code: "DUPLICATE_IDENTITY",
          fieldErrors: {
            contact: duplicateIdentityMessage,
            username: duplicateIdentityMessage
          }
        },
        { status: 409 }
      );
    }

    if (error instanceof Error && error.message === duplicateDeviceMessage) {
      return NextResponse.json(
        {
          error: duplicateDeviceMessage,
          code: "DUPLICATE_DEVICE",
          fieldErrors: {
            form: duplicateDeviceMessage
          }
        },
        { status: 409 }
      );
    }

    if (process.env.NODE_ENV !== "production") {
      console.warn("[PureChat Auth] Registration failed", error);
    }

    return NextResponse.json(
      { error: "Account could not be created. Please check the form and try again." },
      { status: 400 }
    );
  }
}
