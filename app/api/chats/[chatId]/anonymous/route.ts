import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import {
  acceptAnonymousConversation,
  blockAnonymousConversation,
  rejectAnonymousConversation,
  reportAnonymousConversation,
  revealAnonymousIdentities
} from "@/features/anonymous/anonymous.service";
import { anonymousActionSchema } from "@/features/anonymous/anonymous.validators";
import { apiError } from "@/server/security/api";
import { getClientIp, rateLimit } from "@/server/security/rate-limit";

type RouteContext = {
  params: Promise<{
    chatId: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const limit = await rateLimit({
      key: `rate:anonymous:${getClientIp(request.headers)}`,
      limit: 30,
      windowSeconds: 60 * 10
    });
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many anonymous request actions. Please wait." }, { status: 429 });
    }

    const session = await requireCurrentSession();
    const { chatId } = await context.params;
    const rawBody = await request.json();
    const action = String(rawBody?.action ?? "");
    const body = anonymousActionSchema.parse(rawBody);

    if (action === "ACCEPT") {
      const anonymous = await acceptAnonymousConversation(chatId, session.userId);
      return NextResponse.json({ anonymous });
    }
    if (action === "REJECT") {
      const anonymous = await rejectAnonymousConversation(chatId, session.userId);
      return NextResponse.json({ anonymous });
    }
    if (action === "REPORT") {
      const result = await reportAnonymousConversation(chatId, session.userId, body.note);
      return NextResponse.json(result);
    }
    if (action === "BLOCK") {
      const anonymous = await blockAnonymousConversation(chatId, session.userId, body.note);
      return NextResponse.json({ anonymous });
    }
    if (action === "REVEAL") {
      const anonymous = await revealAnonymousIdentities(chatId, session.userId);
      return NextResponse.json({ anonymous });
    }

    return NextResponse.json({ error: "Unknown anonymous request action." }, { status: 400 });
  } catch (error) {
    return apiError(error);
  }
}
