import { NextRequest, NextResponse } from "next/server";
import { addVideo, readStore } from "@/lib/storage";
import { VideoItem } from "@/lib/types";
import { v4 as uuid } from "uuid";

export async function GET() {
  const store = await readStore();
  return NextResponse.json({
    videos: store.videos,
    toPost: store.videos.filter((video) => video.status === "to_post"),
    posted: store.videos.filter((video) => video.status === "posted"),
    scheduled: store.videos.filter((video) => video.status === "scheduled"),
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<VideoItem>;
  const now = new Date().toISOString();
  const newVideo: VideoItem = {
    id: uuid(),
    topic: body.topic ?? "Untitled Short",
    description: body.description ?? "",
    caption: body.caption ?? "",
    thumbnailPrompt: body.thumbnailPrompt ?? "",
    hookScore: body.hookScore ?? 75,
    retentionNotes: body.retentionNotes ?? [],
    status: body.status ?? "to_post",
    scheduledFor: body.scheduledFor,
    createdAt: now,
    publishedAt: body.status === "posted" ? now : undefined,
    youtubeVideoId: body.youtubeVideoId,
    analytics: body.analytics,
  };

  await addVideo(newVideo);
  return NextResponse.json(newVideo, { status: 201 });
}

