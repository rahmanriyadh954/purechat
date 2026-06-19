import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/features/auth/auth.cookies";
import { requireCurrentSession } from "@/features/auth/current-user";
import { logoutAllDevices } from "@/features/auth/auth.service";

export async function POST() {
  try {
    const session = await requireCurrentSession();
    await logoutAllDevices(session.userId);
    await clearAuthCookies();

    return NextResponse.json({
      ok: true,
      message: "Signed out from all devices."
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Please sign in." },
      { status: 401 }
    );
  }
}
