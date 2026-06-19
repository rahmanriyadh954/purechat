import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import { reviewJoinRequest } from "@/features/groups/group.service";
import { reviewJoinRequestSchema } from "@/features/groups/group.validators";
import { apiError, readValidatedJson } from "@/server/security/api";

type Params = {
  params: Promise<{
    chatId: string;
    requestId: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireCurrentSession();
    const { chatId, requestId } = await params;
    const joinRequest = await reviewJoinRequest(
      chatId,
      session.userId,
      requestId,
      await readValidatedJson(request, reviewJoinRequestSchema)
    );

    return NextResponse.json({ joinRequest });
  } catch (error) {
    return apiError(error);
  }
}
