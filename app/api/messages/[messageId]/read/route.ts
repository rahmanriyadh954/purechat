import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentSession } from "@/features/auth/current-user";
import { markMessageRead } from "@/features/messages/message.service";
import { apiError, readValidatedJson } from "@/server/security/api";

const readReceiptSchema = z.object({
  chatId: z.string().min(1)
});

type Params = {
  params: Promise<{
    messageId: string;
  }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireCurrentSession();
    const { messageId } = await params;
    const { chatId } = await readValidatedJson(request, readReceiptSchema);
    const receipt = await markMessageRead({ chatId, messageId }, session.userId);

    return NextResponse.json({ receipt });
  } catch (error) {
    return apiError(error);
  }
}
