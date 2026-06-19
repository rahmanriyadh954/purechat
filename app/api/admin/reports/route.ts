import { NextResponse } from "next/server";
import { requireAdminSession } from "@/features/auth/admin";
import { listReportsForAdmin } from "@/features/moderation/moderation.service";

export async function GET() {
  try {
    await requireAdminSession();
    const reports = await listReportsForAdmin();

    return NextResponse.json({ reports });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Admin access is required." },
      { status: 403 }
    );
  }
}
