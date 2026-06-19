import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import { revokeSession } from "@/features/auth/auth.service";
import { assertCsrfSafe } from "@/server/security/csrf";

type Params = {
  params: Promise<{ sessionId: string }>;
};

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    assertCsrfSafe(request);
    const session = await requireCurrentSession();
    const { sessionId } = await params;
    await revokeSession(session.userId, sessionId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not revoke session." },
      { status: 400 }
    );
  }
}
