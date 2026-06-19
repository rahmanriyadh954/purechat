import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "purechat",
    time: new Date().toISOString()
  });
}
