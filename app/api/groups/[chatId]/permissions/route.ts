import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import { updateGroupPermissions } from "@/features/groups/group.service";
import { groupPermissionsSchema } from "@/features/groups/group.validators";
import { apiError, readValidatedJson } from "@/server/security/api";

type Params = {
  params: Promise<{
    chatId: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireCurrentSession();
    const { chatId } = await params;
    const group = await updateGroupPermissions(
      chatId,
      session.userId,
      await readValidatedJson(request, groupPermissionsSchema)
    );

    return NextResponse.json({ group });
  } catch (error) {
    return apiError(error);
  }
}
