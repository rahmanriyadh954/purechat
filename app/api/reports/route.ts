import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import { createReport } from "@/features/moderation/moderation.service";
import { reportSchema } from "@/features/moderation/moderation.validators";
import { apiError, readValidatedJson } from "@/server/security/api";
import { getClientIp, rateLimit } from "@/server/security/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const limit = await rateLimit({
      key: `rate:reports:${getClientIp(request.headers)}`,
      limit: 20,
      windowSeconds: 60 * 10
    });
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many reports. Please wait." }, { status: 429 });
    }
    const session = await requireCurrentSession();
    const body = await readValidatedJson(request, reportSchema);
    const report = await createReport(body, session.userId);

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
