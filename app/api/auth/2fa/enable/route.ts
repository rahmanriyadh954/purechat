import { NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import { setTwoFactorEnabled } from "@/features/auth/auth.service";

export async function POST() {
  try {
    const session = await requireCurrentSession();
    await setTwoFactorEnabled(session.userId, true);

    return NextResponse.json({
      ok: true,
      message: "Two-step verification is on."
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Please sign in." },
      { status: 401 }
    );
  }
}
