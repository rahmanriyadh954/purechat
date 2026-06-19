import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import { addGroupMembers } from "@/features/groups/group.service";
import { addMembersSchema } from "@/features/groups/group.validators";
import { apiError, readValidatedJson } from "@/server/security/api";

type Params = {
  params: Promise<{
    chatId: string;
  }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireCurrentSession();
    const { chatId } = await params;
    const body = await readValidatedJson(request, addMembersSchema);
    const group = await addGroupMembers(chatId, session.userId, body);

    return NextResponse.json({ group });
  } catch (error) {
    return apiError(error);
  }
}
