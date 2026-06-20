import { NextRequest, NextResponse } from "next/server";

const makeLocalGif = (label: string, color: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" rx="24" fill="${color}"/><circle cx="70" cy="80" r="26" fill="white" opacity=".35"/><text x="160" y="98" text-anchor="middle" font-family="Arial" font-size="28" font-weight="700" fill="white">${label}</text></svg>`)}`;

const sampleGifs = [
  {
    id: "thanks",
    title: "Thank you",
    previewUrl: makeLocalGif("Thank you", "#059669"),
    url: makeLocalGif("Thank you", "#059669"),
    familySafe: true
  },
  {
    id: "great",
    title: "Great",
    previewUrl: makeLocalGif("Great", "#0f766e"),
    url: makeLocalGif("Great", "#0f766e"),
    familySafe: true
  },
  {
    id: "salam",
    title: "Salam",
    previewUrl: makeLocalGif("Salam", "#d4a017"),
    url: makeLocalGif("Salam", "#d4a017"),
    familySafe: true
  },
  {
    id: "done",
    title: "Done",
    previewUrl: makeLocalGif("Done", "#1d4ed8"),
    url: makeLocalGif("Done", "#1d4ed8"),
    familySafe: true
  }
];

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.toLowerCase() ?? "";

  return NextResponse.json({
    gifs: sampleGifs.filter((gif) => gif.title.toLowerCase().includes(query) || !query)
  });
}
