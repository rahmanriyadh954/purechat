import { NextResponse } from "next/server";
import { requireAdminSession } from "@/features/auth/admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAdminSession();
    const reviews = await prisma.duplicateAccountReview.findMany({
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return NextResponse.json({ reviews });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Admin access is required." },
      { status: 403 }
    );
  }
}
