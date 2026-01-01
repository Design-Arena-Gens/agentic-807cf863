import { NextRequest, NextResponse } from "next/server";
import { readStore, updateVideo } from "@/lib/storage";
import { generateAnalytics } from "@/lib/analytics";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const now = new Date().toISOString();

  const store = await readStore();
  const current = store.videos.find((item) => item.id === id);
  if (!current) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const analyticsPayload = generateAnalytics({
    ...current,
    status: "posted",
    publishedAt: now,
  });

  const video = await updateVideo(id, {
    status: "posted",
    publishedAt: now,
    analytics: analyticsPayload,
  });

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  return NextResponse.json(video);
}
