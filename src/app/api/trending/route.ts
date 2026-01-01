import { NextRequest, NextResponse } from "next/server";
import { defaultTrends } from "@/lib/trends";
import { TrendResult } from "@/lib/types";

const SEARCH_ENDPOINT =
  process.env.SEARCH_API_ENDPOINT ?? "https://newsdata.io/api/1/news";

export async function GET(request: NextRequest) {
  const searchQuery =
    request.nextUrl.searchParams.get("query") ?? "YouTube Shorts trends";

  if (!process.env.SEARCH_API_KEY) {
    const trends = defaultTrends().filter((item) =>
      item.keyword.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    return NextResponse.json({
      source: "fallback",
      trends: trends.length ? trends : defaultTrends(),
      message:
        "Using curated trending data. Set SEARCH_API_KEY to enable live web search.",
    });
  }

  try {
    const params = new URLSearchParams({
      apikey: process.env.SEARCH_API_KEY,
      q: searchQuery,
      language: "en",
      category: "entertainment",
      size: "8",
    });

    const response = await fetch(`${SEARCH_ENDPOINT}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`Search request failed with ${response.status}`);
    }

    const payload = (await response.json()) as {
      results?: Array<{
        title?: string;
        description?: string;
        category?: string | string[];
        pubDate?: string;
      }>;
    };

    const trends: TrendResult[] =
      payload.results?.slice(0, 6).map((item, index) => ({
        keyword: item.title ?? `Trending idea ${index + 1}`,
        interestScore: 70 + (index % 5) * 5,
        summary:
          item.description ??
          "Live search result transformed into Shorts-friendly insight.",
        categories: Array.isArray(item.category)
          ? item.category
          : item.category
            ? [item.category]
            : ["creator"],
        lastUpdated: item.pubDate ?? new Date().toISOString(),
      })) ?? defaultTrends();

    return NextResponse.json({ source: "live-search", trends });
  } catch (error) {
    console.error("[trending] fallback due to error:", error);
    const trends = defaultTrends().filter((item) =>
      item.keyword.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    return NextResponse.json({
      source: "fallback",
      trends: trends.length ? trends : defaultTrends(),
      message: "Live search failed, using cached suggestions.",
    });
  }
}
