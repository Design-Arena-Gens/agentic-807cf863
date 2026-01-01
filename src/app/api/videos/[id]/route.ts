import { NextRequest, NextResponse } from "next/server";
import { removeVideo, updateVideo } from "@/lib/storage";
import { generateAnalytics } from "@/lib/analytics";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const updates = await request.json();
  const updated = await updateVideo(id, updates);

  if (!updated) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  if (updates.status === "posted" && !updated.analytics) {
    updated.analytics = generateAnalytics(updated);
    await updateVideo(id, { analytics: updated.analytics });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  await removeVideo(id);
  return NextResponse.json({ ok: true });
}
