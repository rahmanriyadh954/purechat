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

  if (packs.length === 0) {
    const pack = await prisma.stickerPack.upsert({
      where: { id: "builtin-purechat-safe" },
      update: {},
      create: {
        id: "builtin-purechat-safe",
        name: "PureChat Safe",
        isOfficial: true,
        isFamilySafe: true,
        isPublished: true,
        stickers: {
          create: [
            { name: "Salam", storageKey: stickerDataUrl("Salam", "#059669"), emoji: "salam", tags: ["salam"], isFamilySafe: true },
            { name: "Thanks", storageKey: stickerDataUrl("Thanks", "#d4a017"), emoji: "thanks", tags: ["thanks"], isFamilySafe: true },
            { name: "Dua", storageKey: stickerDataUrl("Dua", "#0f766e"), emoji: "dua", tags: ["dua"], isFamilySafe: true },
            { name: "Done", storageKey: stickerDataUrl("Done", "#1d4ed8"), emoji: "done", tags: ["done"], isFamilySafe: true }
          ]
        }
      },
      include: { stickers: true }
    });

    return NextResponse.json({ packs: [pack] });
  }

  return NextResponse.json({
    packs: packs.map((pack) => ({
      ...pack,
      stickers: pack.stickers.map((sticker) => ({
        ...sticker,
        storageKey: sticker.storageKey.startsWith("data:")
          ? sticker.storageKey
          : stickerDataUrl(sticker.name, "#059669")
      }))
    }))
  });
}

function stickerDataUrl(label: string, color: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect x="12" y="12" width="136" height="136" rx="34" fill="${color}"/><text x="80" y="88" text-anchor="middle" font-family="Arial" font-size="24" font-weight="700" fill="white">${label}</text></svg>`)}`;
}
