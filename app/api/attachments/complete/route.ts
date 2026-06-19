import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import { completeUploadSchema } from "@/features/attachments/attachment.validators";
import {
  completeAttachmentMessage,
  presentMessage
} from "@/features/messages/message.service";
import { apiError, readValidatedJson } from "@/server/security/api";

export async function POST(request: NextRequest) {
  try {
    const session = await requireCurrentSession();
    const body = await readValidatedJson(request, completeUploadSchema);
    const message = await completeAttachmentMessage(body, session.userId);

    return NextResponse.json({ message: presentMessage(message) });
  } catch (error) {
    return apiError(error);
  }
}
