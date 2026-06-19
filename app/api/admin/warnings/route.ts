import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/features/auth/admin";
import { warnUser } from "@/features/moderation/moderation.service";
import { warningSchema } from "@/features/moderation/moderation.validators";
import { apiError, readValidatedJson } from "@/server/security/api";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminSession();
    const body = await readValidatedJson(request, warningSchema);
    const warning = await warnUser(session.userId, body);

    return NextResponse.json({ warning }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
