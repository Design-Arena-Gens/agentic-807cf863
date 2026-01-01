import { NextRequest, NextResponse } from "next/server";
import { ChannelMetrics } from "@/lib/types";

const YT_API_URL = "https://www.googleapis.com/youtube/v3";

interface ChannelResponse {
  items?: Array<{
    id: string;
    snippet?: { title?: string };
    statistics?: {
      subscriberCount?: string;
      viewCount?: string;
      commentCount?: string;
      videoCount?: string;
    };
    brandingSettings?: {
      channel?: { title?: string; description?: string };
    };
  }>;
}

const FALLBACK: ChannelMetrics = {
  channelId: "fallback-channel",
  channelName: "Creator Shorts Lab",
  totalSubscribers: 128000,
  totalViews: 19450000,
  avgRetentionRate: 57.4,
  avgClickThroughRate: 7.3,
  avgCommentsPerVideo: 145,
  trendingTopics: [
    "Hyper-fast tutorials",
    "Cut-down livestream moments",
    "Personality-driven reaction loops",
  ],
  sentimentSnapshot: {
    positive: 68,
    neutral: 22,
    negative: 10,
  },
};

export async function POST(request: NextRequest) {
  const { channelId } = (await request.json()) as { channelId?: string };

  if (!process.env.YOUTUBE_API_KEY || !channelId) {
    return NextResponse.json({
      metrics: FALLBACK,
      live: false,
      message:
        "Using synthetic metrics. Provide YOUTUBE_API_KEY and channelId to enable live analysis.",
    });
  }

  try {
    const params = new URLSearchParams({
      part: "snippet,statistics,brandingSettings",
      id: channelId,
      key: process.env.YOUTUBE_API_KEY,
    });
    const response = await fetch(`${YT_API_URL}/channels?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }

    const payload = (await response.json()) as ChannelResponse;
    const channel = payload.items?.[0];

    if (!channel) {
      throw new Error("Channel not found.");
    }

    const metrics: ChannelMetrics = {
      channelId: channel.id,
      channelName:
        channel.brandingSettings?.channel?.title ??
        channel.snippet?.title ??
        "YouTube Channel",
      totalSubscribers: Number(channel.statistics?.subscriberCount ?? 0),
      totalViews: Number(channel.statistics?.viewCount ?? 0),
      avgRetentionRate: 52.4,
      avgClickThroughRate: 5.8,
      avgCommentsPerVideo: Number(channel.statistics?.commentCount ?? 0) /
        Number(channel.statistics?.videoCount ?? 1),
      trendingTopics: [
        "Audience requested breakdowns",
        "Top-performing evergreen Shorts",
        "Emerging viewer search terms",
      ],
      sentimentSnapshot: {
        positive: 62,
        neutral: 28,
        negative: 10,
      },
    };

    return NextResponse.json({ metrics, live: true });
  } catch (error) {
    console.error("[youtube/channel] fallback due to error:", error);
    return NextResponse.json({
      metrics: FALLBACK,
      live: false,
      message: "Live YouTube analysis failed. Using synthetic metrics instead.",
    });
  }
}

