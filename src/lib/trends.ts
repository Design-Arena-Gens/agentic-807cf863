import { TrendResult } from "./types";

export function defaultTrends(): TrendResult[] {
  const now = new Date().toISOString();
  return [
    {
      keyword: "AI-powered Shorts editing tricks",
      interestScore: 91,
      summary:
        "Creators are showcasing automated editing workflows that cut production time in half.",
      categories: ["creator-tools", "ai"],
      lastUpdated: now,
    },
    {
      keyword: "Viral Reddit story dramatizations",
      interestScore: 86,
      summary:
        "Animated or acted Reddit confessions keep outperforming traditional storytelling formats.",
      categories: ["storytelling", "drama"],
      lastUpdated: now,
    },
    {
      keyword: "Realistic NPC livestream crossovers",
      interestScore: 83,
      summary:
        "NPC style performances spilling into Shorts with cosplay and interaction challenges.",
      categories: ["livestream", "npc-trend"],
      lastUpdated: now,
    },
    {
      keyword: "Budget cinematic transitions",
      interestScore: 88,
      summary:
        "Low-cost lighting hacks and free transitions packs going viral among Shorts filmmakers.",
      categories: ["filmmaking", "transitions"],
      lastUpdated: now,
    },
    {
      keyword: "Micro-learning business tips",
      interestScore: 84,
      summary:
        "Creators packaging finance and marketing advice into 30-second actionable bites.",
      categories: ["business", "education"],
      lastUpdated: now,
    },
  ];
}

