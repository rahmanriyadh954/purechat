import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentSession } from "@/features/auth/current-user";
import { presentMessage, sendGifMessage } from "@/features/messages/message.service";
import { apiError, readValidatedJson } from "@/server/security/api";

const gifSchema = z.object({
  gifUrl: z.string().min(1).max(5000),
  title: z.string().trim().max(120).optional()
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
    const body = await readValidatedJson(request, gifSchema);
    const message = await sendGifMessage({ ...body, chatId }, session.userId);

    return NextResponse.json({ message: presentMessage(message, session.userId) });
  } catch (error) {
    return apiError(error);
  }
}
