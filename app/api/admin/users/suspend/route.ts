import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/features/auth/admin";
import { suspendUser } from "@/features/moderation/moderation.service";
import { userRestrictionSchema } from "@/features/moderation/moderation.validators";
import { apiError, readValidatedJson } from "@/server/security/api";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminSession();
    const body = await readValidatedJson(request, userRestrictionSchema);
    const user = await suspendUser(session.userId, body);

    return NextResponse.json({ user });
  } catch (error) {
    return apiError(error);
  }
}
