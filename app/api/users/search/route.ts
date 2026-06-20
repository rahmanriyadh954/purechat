import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await requireCurrentSession();
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    if (query.length < 2) {
      return NextResponse.json({ users: [] });
    }

    const users = await prisma.user.findMany({
      where: {
        id: { not: session.userId },
        deletedAt: null,
        status: "ACTIVE",
        OR: [
          { username: { contains: query, mode: "insensitive" } },
          { displayName: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
          { phone: { contains: query } }
        ]
      },
      select: {
        id: true,
        displayName: true,
        username: true,
        avatarUrl: true
      },
      take: 8,
      orderBy: { displayName: "asc" }
    });

    return NextResponse.json({ users });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not search users." },
      { status: 401 }
    );
  }
}
