import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { requireCurrentSession } from "@/features/auth/current-user";
import { env } from "@/lib/env";
import { getLocalUploadPath } from "@/server/storage/uploads";

type Params = {
  params: Promise<{ key: string[] }>;
};

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    if (env.STORAGE_DRIVER !== "local") {
      return NextResponse.json({ error: "Local uploads are not enabled." }, { status: 404 });
    }

    const session = await requireCurrentSession();
    const { key } = await params;
    const storageKey = key.join("/");

    if (!storageKey.includes(`/${session.userId}/`)) {
      return NextResponse.json({ error: "Invalid upload target." }, { status: 403 });
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (!contentLength || contentLength > env.UPLOAD_MAX_BYTES) {
      return NextResponse.json({ error: "This file is too large." }, { status: 413 });
    }

    const bytes = Buffer.from(await request.arrayBuffer());
    if (bytes.byteLength > env.UPLOAD_MAX_BYTES) {
      return NextResponse.json({ error: "This file is too large." }, { status: 413 });
    }

    const filePath = getLocalUploadPath(storageKey);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, bytes);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 400 }
    );
  }
}
