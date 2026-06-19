import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import { getCallHistory, startCall } from "@/features/calls/call.service";
import { startCallSchema } from "@/features/calls/call.validators";
import { apiError, readValidatedJson } from "@/server/security/api";
import { getClientIp, rateLimit } from "@/server/security/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const limit = await rateLimit({
      key: `rate:calls:${getClientIp(request.headers)}`,
      limit: 30,
      windowSeconds: 60 * 10
    });
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many call attempts. Please wait." }, { status: 429 });
    }
    const session = await requireCurrentSession();
    const calls = await getCallHistory(session.userId);

    return NextResponse.json({ calls });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load calls." },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireCurrentSession();
    const body = await readValidatedJson(request, startCallSchema);
    const call = await startCall(body, session.userId);

    return NextResponse.json({ call }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
