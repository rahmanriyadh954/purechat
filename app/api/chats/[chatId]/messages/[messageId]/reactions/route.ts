import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentSession } from "@/features/auth/current-user";
import {
  addReaction,
  presentMessage,
  removeReaction
} from "@/features/messages/message.service";
import { reactionSchema } from "@/features/messages/message.validators";
import { apiError, readValidatedJson } from "@/server/security/api";

const reactionBodySchema = reactionSchema.pick({ emoji: true });

type Params = {
  params: Promise<{
    chatId: string;
    messageId: string;
  }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireCurrentSession();
    const { chatId, messageId } = await params;
    const body = await readValidatedJson(request, reactionBodySchema);
    const message = await addReaction({ ...body, chatId, messageId }, session.userId);

    return NextResponse.json({ message: presentMessage(message) });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await requireCurrentSession();
    const { chatId, messageId } = await params;
    const url = new URL(request.url);
    const body = z.object({ emoji: z.string().min(1).max(32) }).parse({
      emoji: url.searchParams.get("emoji")
    });
    const message = await removeReaction({ ...body, chatId, messageId }, session.userId);

    return NextResponse.json({ message: presentMessage(message) });
  } catch (error) {
    return apiError(error);
  }
}
