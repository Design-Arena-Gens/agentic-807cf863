import {
  RecommendationRequest,
  RecommendationResponse,
  TrendResult,
  VideoIdea,
  VideoItem,
} from "./types";

const VIDEO_TEMPLATES = [
  {
    pattern: "Why {topic} Is Exploding Right Now",
    summary:
      "Break down the viral elements that make {topic} irresistible and show how to ride the wave.",
    tactics: [
      "Use rapid-fire stats with motion-tracked typography.",
      "Smash cut between you and trending clips to keep momentum.",
      "End with a cliffhanger statistic to drive comments.",
    ],
  },
  {
    pattern: "{topic} in 30 Seconds: Creator Playbook",
    summary:
      "Deliver a rapid blueprint that makes viewers feel confident to act immediately.",
    tactics: [
      "Overlay progress bar to signal pacing and build anticipation.",
      "Flash high-contrast keyword cards synced to narration beats.",
      "Tease a bonus tactic mid-video to retain viewers.",
    ],
  },
  {
    pattern: "Avoid These {topic} Mistakes Everyone Makes",
    summary:
      "Hook viewers with high-stakes pitfalls around {topic} and offer quick fixes.",
    tactics: [
      "Use glitch transitions to emphasize mistakes.",
      "Highlight audience comments as social proof.",
      "Add sound design spikes whenever a mistake appears.",
    ],
  },
];

function pickTemplate(index: number) {
  return VIDEO_TEMPLATES[index % VIDEO_TEMPLATES.length];
}

function deriveKeyword(trend: TrendResult): string {
  return trend.categories?.[0] ?? trend.keyword.split(" ")[0];
}

function baseHookScore(topic: string, index: number): number {
  const seed = topic + index.toString();
  return (
    70 +
    (Array.from(seed).reduce((acc, code) => acc + code.charCodeAt(0), 0) % 30)
  );
}

function createAssets(topic: string) {
  return [
    {
      id: `${topic}-broll`,
      type: "stock_video" as const,
      title: `${topic} cinematic b-roll`,
      source: "Pexels",
      url: "https://www.pexels.com/search/shorts/",
    },
    {
      id: `${topic}-music`,
      type: "music" as const,
      title: "High-energy beat for fast cuts",
      source: "Artlist",
      url: "https://artlist.io/",
    },
    {
      id: `${topic}-template`,
      type: "template" as const,
      title: "Vertical split-screen template",
      source: "Canva",
      url: "https://www.canva.com/",
    },
  ];
}

function alreadyCovered(topic: string, history: VideoItem[]) {
  const normalized = topic.toLowerCase();
  return history.some((item) =>
    item.topic.toLowerCase().includes(normalized),
  );
}

export function buildRecommendations(
  payload: RecommendationRequest,
): RecommendationResponse {
  const items: VideoIdea[] = [];
  const { trends, history } = payload;

  const filteredTrends = trends
    .filter((trend) => !alreadyCovered(trend.keyword, history))
    .slice(0, 6);

  filteredTrends.forEach((trend, index) => {
    const template = pickTemplate(index);
    const title = template.pattern.replace("{topic}", trend.keyword);
    const summary = template.summary.replace("{topic}", trend.keyword);
    const hookScore = Math.min(
      95,
      Math.round(baseHookScore(trend.keyword, index)),
    );

    const idea: VideoIdea = {
      id: `${trend.keyword.replace(/\s+/g, "-").toLowerCase()}-${index}`,
      title,
      summary,
      primaryKeyword: deriveKeyword(trend),
      hookScore,
      retentionTactics: template.tactics,
      assets: createAssets(trend.keyword),
    };
    items.push(idea);
  });

  let rationale = "Blends emerging search momentum with channel proven formats.";
  if (payload.channelMetrics) {
    rationale = `Tailored to ${payload.channelMetrics.channelName}, focusing on boosting retention (avg ${payload.channelMetrics.avgRetentionRate}%) and mirroring positive comment sentiment.`;
  }

  if (items.length === 0 && trends.length) {
    rationale =
      "All trending topics already covered recently; re-surface the highest performers with refreshed hooks.";
  }

  return { recommendations: items, rationale };
}

