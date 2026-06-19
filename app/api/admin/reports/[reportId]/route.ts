import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/features/auth/admin";
import { reviewReport } from "@/features/moderation/moderation.service";
import { reviewReportSchema } from "@/features/moderation/moderation.validators";
import { apiError, readValidatedJson } from "@/server/security/api";

type Params = {
  params: Promise<{ reportId: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAdminSession();
    const { reportId } = await params;
    const body = await readValidatedJson(request, reviewReportSchema);
    const report = await reviewReport(reportId, session.userId, body);

    return NextResponse.json({ report });
  } catch (error) {
    return apiError(error);
  }
}
