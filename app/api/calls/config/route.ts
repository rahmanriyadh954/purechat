import { NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import { getIceServers } from "@/features/calls/call.service";

export async function GET() {
  try {
    await requireCurrentSession();

    return NextResponse.json({
      iceServers: await getIceServers()
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Please sign in." },
      { status: 401 }
    );
  }
}
