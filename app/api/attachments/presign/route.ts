import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import { createAttachmentUpload } from "@/features/messages/message.service";
import { presignUploadSchema } from "@/features/attachments/attachment.validators";
import { apiError, readValidatedJson } from "@/server/security/api";
import { getClientIp, rateLimit } from "@/server/security/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const limit = await rateLimit({
      key: `rate:uploads:${getClientIp(request.headers)}`,
      limit: 60,
      windowSeconds: 60 * 10
    });
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many uploads. Please wait." }, { status: 429 });
    }
    const session = await requireCurrentSession();
    const body = await readValidatedJson(request, presignUploadSchema);
    const upload = await createAttachmentUpload(body, session.userId);

    return NextResponse.json(upload);
  } catch (error) {
    return apiError(error);
  }
}
