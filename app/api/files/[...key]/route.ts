import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { requireCurrentSession } from "@/features/auth/current-user";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { createPresignedDownloadUrl, getLocalUploadPath } from "@/server/storage/uploads";

type Params = {
  params: Promise<{
    key: string[];
  }>;
};

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = await requireCurrentSession();
    const { key } = await params;
    const storageKey = key.join("/");

    const attachment = await prisma.messageAttachment.findFirst({
      where: {
        storageKey,
        message: {
          chat: {
            members: {
              some: {
                userId: session.userId,
                status: "ACTIVE"
              }
            }
          }
        }
      },
      select: {
        id: true,
        mimeType: true,
        fileName: true
      }
    });

    const sticker = attachment
      ? null
      : await prisma.sticker.findFirst({
          where: {
            storageKey,
            isFamilySafe: true,
            pack: {
              isPublished: true
            }
          },
          select: {
            id: true
          }
        });

    if (!attachment && !sticker) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }

    if (env.STORAGE_DRIVER === "local") {
      const file = await readFile(getLocalUploadPath(storageKey));
      return new NextResponse(file, {
        headers: {
          "Content-Type": attachment?.mimeType ?? "application/octet-stream",
          "Content-Disposition": `inline; filename="${attachment?.fileName ?? "file"}"`,
          "Cache-Control": "private, max-age=300"
        }
      });
    }

    const url = await createPresignedDownloadUrl(storageKey);
    return NextResponse.redirect(url);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load file." },
      { status: 400 }
    );
  }
}
