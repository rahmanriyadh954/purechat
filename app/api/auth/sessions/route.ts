import { NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await requireCurrentSession();
    const sessions = await prisma.session.findMany({
      where: {
        userId: session.userId,
        revokedAt: null,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        device: true
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return NextResponse.json({
      sessions: sessions.map((item) => ({
        id: item.id,
        device: item.device,
        ipAddress: item.ipAddress,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        expiresAt: item.expiresAt,
        isCurrent: item.id === session.id
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Please sign in." },
      { status: 401 }
    );
  }
}
