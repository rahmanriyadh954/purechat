import { NextResponse } from "next/server";
import { requireAdminSession } from "@/features/auth/admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAdminSession();
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200
    });

    return NextResponse.json({ logs });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Admin access is required." },
      { status: 403 }
    );
  }
}
