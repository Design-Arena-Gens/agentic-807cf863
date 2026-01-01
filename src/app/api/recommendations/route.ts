import { NextRequest, NextResponse } from "next/server";
import { buildRecommendations } from "@/lib/recommendations";
import { RecommendationRequest } from "@/lib/types";
import { readStore } from "@/lib/storage";
import { defaultTrends } from "@/lib/trends";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<RecommendationRequest>;
  const store = await readStore();

  const payload: RecommendationRequest = {
    channelMetrics: body.channelMetrics ?? null,
    trends: body.trends ?? defaultTrends(),
    history: store.history.slice(-10),
  };

  const result = buildRecommendations(payload);
  return NextResponse.json(result);
}

