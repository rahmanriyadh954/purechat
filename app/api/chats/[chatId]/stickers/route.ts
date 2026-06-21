import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentSession } from "@/features/auth/current-user";
import { presentMessage, sendStickerMessage } from "@/features/messages/message.service";
import { apiError, readValidatedJson } from "@/server/security/api";

const stickerSchema = z.object({
  stickerId: z.string().min(1)
});

type Params = {
  params: Promise<{
    chatId: string;
  }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireCurrentSession();
    const { chatId } = await params;
    const body = await readValidatedJson(request, stickerSchema);
    const message = await sendStickerMessage({ ...body, chatId }, session.userId);

    return NextResponse.json({ message: presentMessage(message, session.userId) });
  } catch (error) {
    return apiError(error);
  }
}
