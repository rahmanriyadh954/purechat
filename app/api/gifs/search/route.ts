import { NextRequest, NextResponse } from "next/server";

const sampleGifs = [
  {
    id: "thanks",
    title: "Thank you",
    previewUrl: "https://media.giphy.com/media/3oEdva9BUHPIs2SkGk/giphy.gif",
    url: "https://media.giphy.com/media/3oEdva9BUHPIs2SkGk/giphy.gif",
    familySafe: true
  },
  {
    id: "great",
    title: "Great",
    previewUrl: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
    url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
    familySafe: true
  }
];

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.toLowerCase() ?? "";

  return NextResponse.json({
    gifs: sampleGifs.filter((gif) => gif.title.toLowerCase().includes(query) || !query)
  });
}
