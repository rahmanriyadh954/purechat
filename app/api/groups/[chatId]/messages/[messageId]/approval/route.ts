import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import {
  approvePendingMessage
} from "@/features/moderation/moderation.service";
import { presentMessage } from "@/features/messages/message.service";
import { approveMessageSchema } from "@/features/moderation/moderation.validators";
import { apiError, readValidatedJson } from "@/server/security/api";

type Params = {
  params: Promise<{ chatId: string; messageId: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireCurrentSession();
    const { chatId, messageId } = await params;
    const message = await approvePendingMessage(
      chatId,
      messageId,
      session.userId,
      await readValidatedJson(request, approveMessageSchema)
    );

    return NextResponse.json({ message: presentMessage(message) });
  } catch (error) {
    return apiError(error);
  }
}
