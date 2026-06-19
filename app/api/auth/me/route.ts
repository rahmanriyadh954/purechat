import { NextResponse } from "next/server";
import { getCurrentSession } from "@/features/auth/current-user";

export async function GET() {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: session.user,
    session: {
      id: session.id,
      device: session.device,
      expiresAt: session.expiresAt
    }
  });
}
