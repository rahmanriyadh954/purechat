import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import { privacyUpdateSchema } from "@/features/users/user-settings.validators";
import { prisma } from "@/lib/prisma";
import { readValidatedJson } from "@/server/security/api";

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireCurrentSession();
    const body = await readValidatedJson(request, privacyUpdateSchema);
    const profile = await prisma.profile.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        lastSeenVisibility: body.lastSeenVisibility,
        profilePhotoVisibility: body.profilePhotoVisibility,
        onlineStatusEnabled: body.onlineStatusEnabled,
        readReceiptsEnabled: body.readReceiptsEnabled
      },
      update: body
    });

    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update privacy settings." },
      { status: 400 }
    );
  }
}
