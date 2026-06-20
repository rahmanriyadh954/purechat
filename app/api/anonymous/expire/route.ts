import { NextRequest, NextResponse } from "next/server";
import { expireAnonymousConversations } from "@/features/anonymous/anonymous.service";

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET;
  if (configuredSecret) {
    const providedSecret = request.headers.get("x-cron-secret");
    if (providedSecret !== configuredSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await expireAnonymousConversations();
  return NextResponse.json(result);
}
