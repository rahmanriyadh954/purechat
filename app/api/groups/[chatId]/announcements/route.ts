import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import { createPinnedAnnouncement } from "@/features/groups/group.service";
import { pinnedAnnouncementSchema } from "@/features/groups/group.validators";
import { apiError, readValidatedJson } from "@/server/security/api";

type Params = {
  params: Promise<{
    chatId: string;
  }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireCurrentSession();
    const { chatId } = await params;
    const announcement = await createPinnedAnnouncement(
      chatId,
      session.userId,
      await readValidatedJson(request, pinnedAnnouncementSchema)
    );

    return NextResponse.json({ announcement }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
