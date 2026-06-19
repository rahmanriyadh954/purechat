import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import {
  removeGroupMember,
  updateGroupMemberRole
} from "@/features/groups/group.service";
import { memberRoleSchema } from "@/features/groups/group.validators";
import { apiError, readValidatedJson } from "@/server/security/api";

type Params = {
  params: Promise<{
    chatId: string;
    userId: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireCurrentSession();
    const { chatId, userId } = await params;
    const member = await updateGroupMemberRole(
      chatId,
      session.userId,
      userId,
      await readValidatedJson(request, memberRoleSchema)
    );

    return NextResponse.json({ member });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const session = await requireCurrentSession();
    const { chatId, userId } = await params;
    await removeGroupMember(chatId, session.userId, userId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
