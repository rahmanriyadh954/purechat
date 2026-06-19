import { NextRequest, NextResponse } from "next/server";
import {
  getGroupDetails,
  updateGroup
} from "@/features/groups/group.service";
import { requireCurrentSession } from "@/features/auth/current-user";
import { updateGroupSchema } from "@/features/groups/group.validators";
import { apiError, readValidatedJson } from "@/server/security/api";

type Params = {
  params: Promise<{
    chatId: string;
  }>;
};

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = await requireCurrentSession();
    const { chatId } = await params;
    const group = await getGroupDetails(chatId, session.userId);

    return NextResponse.json({ group });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load group." },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireCurrentSession();
    const { chatId } = await params;
    const body = await readValidatedJson(request, updateGroupSchema);
    const group = await updateGroup(chatId, session.userId, body);

    return NextResponse.json({ group });
  } catch (error) {
    return apiError(error);
  }
}
