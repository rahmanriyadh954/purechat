import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import { createGroupInvite } from "@/features/groups/group.service";
import { createInviteSchema } from "@/features/groups/group.validators";
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
    const body = await readValidatedJson(request, createInviteSchema);
    const invite = await createGroupInvite(chatId, session.userId, body);

    return NextResponse.json({
      invite,
      inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL}/join/${invite.code}`
    });
  } catch (error) {
    return apiError(error);
  }
}
