import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import {
  deleteMessage,
  editMessage,
  presentMessage
} from "@/features/messages/message.service";
import {
  editMessageSchema,
  messageIdSchema
} from "@/features/messages/message.validators";
import { apiError, readValidatedJson } from "@/server/security/api";

type Params = {
  params: Promise<{
    chatId: string;
    messageId: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireCurrentSession();
    const { chatId, messageId } = await params;
    const body = await readValidatedJson(
      request,
      editMessageSchema.omit({ chatId: true, messageId: true })
    );
    const message = await editMessage({ ...body, chatId, messageId }, session.userId);

    return NextResponse.json({ message: presentMessage(message) });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const session = await requireCurrentSession();
    const { chatId, messageId } = await params;
    const data = messageIdSchema.parse({ chatId, messageId });
    const message = await deleteMessage(data, session.userId);

    return NextResponse.json({ message: presentMessage(message) });
  } catch (error) {
    return apiError(error);
  }
}
