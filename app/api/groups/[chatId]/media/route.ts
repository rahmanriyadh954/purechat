import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import { getSharedMedia } from "@/features/groups/group.service";

type Params = {
  params: Promise<{
    chatId: string;
  }>;
};

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = await requireCurrentSession();
    const { chatId } = await params;
    const media = await getSharedMedia(chatId, session.userId);

    return NextResponse.json({ media });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load media." },
      { status: 400 }
    );
  }
}
