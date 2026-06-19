import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import { requestToJoinGroup } from "@/features/groups/group.service";
import { joinRequestSchema } from "@/features/groups/group.validators";
import { apiError, readValidatedJson } from "@/server/security/api";

type Params = {
  params: Promise<{
    code: string;
  }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireCurrentSession();
    const { code } = await params;
    const body = await readValidatedJson(request, joinRequestSchema);
    const result = await requestToJoinGroup(code, session.userId, body);

    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
