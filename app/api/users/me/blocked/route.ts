import { NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await requireCurrentSession();
    const blocks = await prisma.block.findMany({
      where: { blockerId: session.userId },
      include: {
        blocked: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatarUrl: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({
      blockedUsers: blocks.map((block) => ({
        id: block.id,
        reason: block.reason,
        createdAt: block.createdAt,
        user: block.blocked
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load blocked users." },
      { status: 401 }
    );
  }
}
