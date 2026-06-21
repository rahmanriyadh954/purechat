import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import {
  getConversationSafety,
  updateConversationSafety
} from "@/features/safety/conversation-safety.service";
import { apiError, readValidatedJson } from "@/server/security/api";
import { getClientIp, rateLimit } from "@/server/security/rate-limit";
import { conversationSafetySchema } from "@/features/safety/conversation-safety.validators";

type RouteContext = {
  params: Promise<{
    chatId: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requireCurrentSession();
    const { chatId } = await context.params;
    const safety = await getConversationSafety(chatId, session.userId);

    return NextResponse.json({ safety });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const limit = await rateLimit({
      key: `rate:safety:${getClientIp(request.headers)}`,
      limit: 30,
      windowSeconds: 60 * 10
    });
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many safety updates. Please wait." }, { status: 429 });
    }

    const session = await requireCurrentSession();
    const { chatId } = await context.params;
    const body = await readValidatedJson(request, conversationSafetySchema);
    const result = await updateConversationSafety(chatId, session.userId, body);

    return NextResponse.json({
      safety: result.state,
      event: result.event,
      reportId: result.reportId,
      anonymousReveal: result.anonymousReveal
    });
  } catch (error) {
    return apiError(error);
  }
}
