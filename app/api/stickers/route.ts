import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const packs = await prisma.stickerPack.findMany({
    where: {
      isPublished: true,
      isFamilySafe: true
    },
    include: {
      stickers: {
        where: {
          isFamilySafe: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return NextResponse.json({ packs });
}
