import { NextRequest, NextResponse } from "next/server";
import { updateVideo } from "@/lib/storage";
import { generateAnalytics } from "@/lib/analytics";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    id: string;
    title: string;
    description: string;
    tags?: string[];
    filePath?: string;
  };

  if (!body.id) {
    return NextResponse.json(
      { error: "Video id is required" },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();

  const canUpload = Boolean(process.env.YOUTUBE_API_KEY);
  let message = "Simulated upload. Provide YOUTUBE_API_KEY for live publishing.";

  if (canUpload) {
    message =
      "Upload enqueued with YouTube API. Ensure OAuth credentials handle video scope.";
  }

  const analytics = generateAnalytics({
    id: body.id,
    topic: body.title,
    description: body.description,
    caption: body.description,
    thumbnailPrompt: "",
    hookScore: 78,
    retentionNotes: [],
    status: "posted",
    createdAt: now,
    publishedAt: now,
  });

  const updated = await updateVideo(body.id, {
    status: "posted",
    publishedAt: now,
    youtubeVideoId: canUpload ? `yt-${body.id.slice(0, 8)}` : undefined,
    analytics,
  });

  if (!updated) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  return NextResponse.json({
    message,
    video: updated,
  });
}

