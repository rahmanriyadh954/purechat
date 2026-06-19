import { NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import { endCall } from "@/features/calls/call.service";

type Params = {
  params: Promise<{ callId: string }>;
};

export async function POST(_request: Request, { params }: Params) {
  try {
    const session = await requireCurrentSession();
    const { callId } = await params;
    const call = await endCall({ callId }, session.userId);

    return NextResponse.json({ call });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not end call." },
      { status: 400 }
    );
  }
}
