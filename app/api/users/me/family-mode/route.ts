import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import { updateFamilyMode } from "@/features/moderation/moderation.service";
import { familyModeSchema } from "@/features/moderation/moderation.validators";
import { apiError, readValidatedJson } from "@/server/security/api";

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireCurrentSession();
    const body = await readValidatedJson(request, familyModeSchema);
    const profile = await updateFamilyMode(session.userId, body);

    return NextResponse.json({ profile });
  } catch (error) {
    return apiError(error);
  }
}
