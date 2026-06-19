import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import {
  listMessages,
  presentMessage,
  sendTextMessage
} from "@/features/messages/message.service";
import { sendMessageSchema } from "@/features/messages/message.validators";
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
    const messages = await listMessages(chatId, session.userId);

    return NextResponse.json({ messages: messages.map(presentMessage) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load messages." },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireCurrentSession();
    const { chatId } = await params;
    const body = await readValidatedJson(request, sendMessageSchema.omit({ chatId: true }));
    const message = await sendTextMessage({ ...body, chatId }, session.userId);

    return NextResponse.json({ message: presentMessage(message) });
  } catch (error) {
    return apiError(error);
  }
}
