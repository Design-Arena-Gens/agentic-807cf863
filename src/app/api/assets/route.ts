import { NextRequest, NextResponse } from "next/server";
import { AssetSuggestion } from "@/lib/types";

const BASE_ENDPOINT =
  process.env.ASSET_SEARCH_ENDPOINT ?? "https://api.pexels.com/v1/search";

const FALLBACK_ASSETS: AssetSuggestion[] = [
  {
    id: "hook-crowd-reaction",
    type: "stock_video",
    title: "Crowd cheering reaction loop",
    source: "Pexels",
    url: "https://www.pexels.com/video/8193668/",
    thumbnail:
      "https://images.pexels.com/photos/8193668/pexels-photo-8193668.jpeg?auto=compress&cs=tinysrgb&h=120",
  },
  {
    id: "beat-riser",
    type: "music",
    title: "Modern trap riser (StockTune)",
    source: "Pixabay Music",
    url: "https://pixabay.com/music/beats-hip-hop-11254/",
  },
  {
    id: "template-flash-cut",
    type: "template",
    title: "Flash-cut Shorts template (Canva)",
    source: "Canva",
    url: "https://www.canva.com/templates/EAE7wzgieSo/",
  },
];

export async function POST(request: NextRequest) {
  const { query } = (await request.json()) as { query?: string };
  if (!process.env.ASSET_SEARCH_KEY || !query) {
    return NextResponse.json({
      source: "fallback",
      assets: FALLBACK_ASSETS,
      message:
        "Returning curated stock assets. Provide ASSET_SEARCH_KEY to fetch live templates.",
    });
  }

  try {
    const params = new URLSearchParams({
      query,
      per_page: "6",
    });
    const response = await fetch(`${BASE_ENDPOINT}?${params.toString()}`, {
      headers: {
        Authorization: process.env.ASSET_SEARCH_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Asset search failed with ${response.status}`);
    }

    const payload = (await response.json()) as {
      videos?: Array<{
        id: number;
        url: string;
        image: string;
        video_files?: Array<{ link: string }>;
      }>;
    };

    const assets: AssetSuggestion[] =
      payload.videos?.map((video) => ({
        id: `pexels-${video.id}`,
        type: "stock_video",
        title: `Pexels asset #${video.id}`,
        source: "Pexels",
        url: video.url,
        thumbnail: video.image,
      })) ?? FALLBACK_ASSETS;

    return NextResponse.json({ source: "live", assets });
  } catch (error) {
    console.error("[assets] fallback due to error:", error);
    return NextResponse.json({
      source: "fallback",
      assets: FALLBACK_ASSETS,
      message: "Asset provider unavailable. Displaying curated defaults.",
    });
  }
}

