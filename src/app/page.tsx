"use client";

import {
  useEffect,
  useMemo,
  useState,
  FormEvent,
  ReactNode,
  useCallback,
} from "react";
import {
  AssetSuggestion,
  ChannelMetrics,
  TrendResult,
  VideoIdea,
  VideoItem,
} from "@/lib/types";
import { SectionCard } from "@/components/SectionCard";
import {
  Calendar,
  CheckCircle2,
  Cpu,
  FolderOpen,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  UploadCloud,
  Youtube,
} from "lucide-react";

type StatusMessage = { tone: "success" | "info" | "error"; text: string };

interface VideoCollection {
  videos: VideoItem[];
  toPost: VideoItem[];
  posted: VideoItem[];
  scheduled: VideoItem[];
}

const DEFAULT_VIDEO = {
  topic: "",
  description: "",
  caption: "",
  thumbnailPrompt: "",
  retentionNotes: ["Hook with transformation within 3s"],
  filePath: "",
};

export default function Home() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [channelIdInput, setChannelIdInput] = useState("");
  const [channelMetrics, setChannelMetrics] = useState<ChannelMetrics | null>(
    null,
  );
  const [trends, setTrends] = useState<TrendResult[]>([]);
  const [trendSource, setTrendSource] = useState("fallback");
  const [trendQuery, setTrendQuery] = useState("YouTube Shorts trends");
  const [recommendations, setRecommendations] = useState<VideoIdea[]>([]);
  const [assets, setAssets] = useState<AssetSuggestion[]>([]);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [creating, setCreating] = useState(false);
  const [newVideo, setNewVideo] = useState({ ...DEFAULT_VIDEO });
  const [publishingVideoId, setPublishingVideoId] = useState<string | null>(
    null,
  );
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);

  const collections = useMemo<VideoCollection>(() => {
    const toPost = videos.filter((video) => video.status === "to_post");
    const posted = videos.filter((video) => video.status === "posted");
    const scheduled = videos.filter((video) => video.status === "scheduled");
    return { videos, toPost, posted, scheduled };
  }, [videos]);

  const loadVideos = useCallback(async () => {
    try {
      setLoadingVideos(true);
      const response = await fetch("/api/videos", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load videos");
      const payload = (await response.json()) as VideoCollection;
      setVideos(payload.videos);
    } catch (error) {
      console.error(error);
      setStatus({
        tone: "error",
        text: "Failed to fetch videos. Please retry.",
      });
    } finally {
      setLoadingVideos(false);
    }
  }, []);

  const loadTrends = useCallback(
    async (query?: string) => {
      const effectiveQuery = query ?? trendQuery;
      try {
        const response = await fetch(
          `/api/trending?${new URLSearchParams({ query: effectiveQuery }).toString()}`,
        );
        if (!response.ok) throw new Error("Unable to fetch trends");
        const payload = (await response.json()) as {
          source: string;
          trends: TrendResult[];
          message?: string;
      };
      setTrendSource(payload.source);
      setTrends(payload.trends);
      if (payload.message) {
        setStatus({ tone: "info", text: payload.message });
      }
    } catch (error) {
      console.error(error);
      setStatus({
        tone: "error",
        text: "Could not refresh trends. Showing last known ideas.",
      });
    }
    },
    [trendQuery],
  );

  const refreshRecommendations = useCallback(
    async (customTrends: TrendResult[] | null = null) => {
      try {
        setRecommendationsLoading(true);
        const response = await fetch("/api/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channelMetrics,
            trends: customTrends ?? trends,
          }),
        });
        if (!response.ok) throw new Error("Unable to generate recommendations");
        const payload = (await response.json()) as {
          recommendations: VideoIdea[];
          rationale: string;
        };
        setRecommendations(payload.recommendations);
        setStatus({
          tone: "success",
          text: "Recommendations refreshed",
        });
      } catch (error) {
        console.error(error);
        setStatus({
          tone: "error",
          text: "Recommendation engine is temporarily unavailable.",
        });
      } finally {
        setRecommendationsLoading(false);
      }
    },
    [channelMetrics, trends],
  );

  const bootstrap = useCallback(async () => {
    await Promise.all([loadVideos(), loadTrends()]);
    await refreshRecommendations();
  }, [loadVideos, loadTrends, refreshRecommendations]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  async function analyzeChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!channelIdInput) {
      setStatus({ tone: "error", text: "Enter a YouTube channel id first." });
      return;
    }
    try {
      setStatus({ tone: "info", text: "Syncing channel metrics..." });
      const response = await fetch("/api/youtube/channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: channelIdInput }),
      });
      if (!response.ok) throw new Error("Unable to analyze channel");
      const payload = (await response.json()) as {
        metrics: ChannelMetrics;
        live: boolean;
        message?: string;
      };
      setChannelMetrics(payload.metrics);
      setStatus({
        tone: payload.live ? "success" : "info",
        text: payload.message ?? "Channel metrics updated.",
      });
      await refreshRecommendations(trends);
    } catch (error) {
      console.error(error);
      setStatus({
        tone: "error",
        text: "Channel analysis failed. Recheck your API key & channel id.",
      });
    }
  }

  async function handleCreateVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newVideo.topic.trim()) {
      setStatus({ tone: "error", text: "Give the Short a working title first." });
      return;
    }
    try {
      setCreating(true);
      const payload = {
        ...newVideo,
        retentionNotes: newVideo.retentionNotes,
        hookScore: Math.min(95, Math.max(55, newVideo.topic.length + 62)),
        status: "to_post",
      };
      const response = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to create video");
      setNewVideo({ ...DEFAULT_VIDEO });
      setStatus({
        tone: "success",
        text: "Short captured in the “to post” folder.",
      });
      await loadVideos();
    } catch (error) {
      console.error(error);
      setStatus({
        tone: "error",
        text: "Unable to save this Short. Try again in a moment.",
      });
    } finally {
      setCreating(false);
    }
  }

  async function updateVideoPayload(
    id: string,
    updates: Partial<VideoItem>,
    message = "Video updated.",
  ) {
    const response = await fetch(`/api/videos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error("Failed to update video");
    setStatus({ tone: "success", text: message });
    await loadVideos();
  }

  async function handleSchedule(id: string, scheduledFor: string) {
    if (!scheduledFor) return;
    try {
      await updateVideoPayload(
        id,
        { scheduledFor, status: "scheduled" },
        "Upload scheduled. Keep the laptop online for automation.",
      );
    } catch (error) {
      console.error(error);
      setStatus({
        tone: "error",
        text: "Scheduling failed. Pick a new slot.",
      });
    }
  }

  async function handlePublish(video: VideoItem) {
    try {
      setPublishingVideoId(video.id);
      const response = await fetch("/api/youtube/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: video.id,
          title: video.topic,
          description: video.caption ?? video.description,
          tags: video.retentionNotes,
        }),
      });
      if (!response.ok) throw new Error("Publishing failed");
      await loadVideos();
      setStatus({
        tone: "success",
        text: "Upload complete. Moved to posted folder and queued analytics.",
      });
    } catch (error) {
      console.error(error);
      setStatus({
        tone: "error",
        text: "Publishing to YouTube failed. Confirm API keys & OAuth scopes.",
      });
    } finally {
      setPublishingVideoId(null);
    }
  }

  async function handleAssetsSearch(query: string) {
    if (!query) return;
    try {
      setAssetsLoading(true);
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!response.ok) throw new Error("Asset search failed");
      const payload = (await response.json()) as {
        assets: AssetSuggestion[];
        message?: string;
      };
      setAssets(payload.assets);
      if (payload.message) {
        setStatus({ tone: "info", text: payload.message });
      }
    } catch (error) {
      console.error(error);
      setStatus({
        tone: "error",
        text: "Asset providers unavailable. Try again shortly.",
      });
    } finally {
      setAssetsLoading(false);
    }
  }

  function adoptRecommendation(idea: VideoIdea) {
    setNewVideo({
      topic: idea.title,
      description: idea.summary,
      caption: `${idea.title} 🚀 | ${idea.retentionTactics[0]}`,
      thumbnailPrompt: `${idea.primaryKeyword} cinematic hero shot with bold typography`,
      retentionNotes: idea.retentionTactics,
      filePath: "",
    });
    setStatus({
      tone: "info",
      text: "Pre-filled creation form from selected recommendation.",
    });
  }

  const statusToneStyles: Record<StatusMessage["tone"], string> = {
    success:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200",
    info: "border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-200",
    error:
      "border-rose-500/30 bg-rose-500/10 text-rose-900 dark:text-rose-200",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-zinc-100 pb-24 font-sans text-zinc-900 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 dark:text-zinc-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 pt-12 lg:px-10">
        <header className="rounded-3xl border border-zinc-200 bg-white/90 p-8 shadow-lg backdrop-blur-lg dark:border-zinc-800 dark:bg-zinc-900/80">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-200">
                <Sparkles className="h-4 w-4" />
                Create → Post → Analyse → Improve → Recommend
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight lg:text-4xl">
                Shorts Command Center
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
                Mirror the AI-powered InVideo workflow with automated topic
                sourcing, content packaging, scheduling, publishing, and
                iterative growth intelligence—all ready for deployment on
                Vercel.
              </p>
            </div>
            <button
              onClick={() => bootstrap()}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              <RefreshCw className="h-4 w-4" />
              Sync Everything
            </button>
          </div>
          {status ? (
            <div
              className={`mt-6 inline-flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition ${statusToneStyles[status.tone]}`}
            >
              <Cpu className="h-4 w-4" />
              {status.text}
            </div>
          ) : null}
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <SectionCard
            title="Workflow Overview"
            subtitle="Monitor each loop of Create → Post → Analyse → Improve"
          >
            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <WorkflowBadge
                icon={<TrendingUp className="h-4 w-4" />}
                label="Topic Engine"
                description="Recommendations driven by channel data & web trends."
              />
              <WorkflowBadge
                icon={<FolderOpen className="h-4 w-4" />}
                label={`To Post • ${collections.toPost.length}`}
                description="Ideas ready for edit & export before moving to schedule."
              />
              <WorkflowBadge
                icon={<Calendar className="h-4 w-4" />}
                label={`Scheduled • ${collections.scheduled.length}`}
                description="Automation pushes these live when the laptop is on."
              />
              <WorkflowBadge
                icon={<CheckCircle2 className="h-4 w-4" />}
                label={`Posted • ${collections.posted.length}`}
                description="Auto-analyzed for retention, CTR & sentiment loops."
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Channel Intelligence"
            subtitle="Pull retention baselines, sentiment, and leverage for new hooks."
            action={
              <form
                onSubmit={analyzeChannel}
                className="flex items-center gap-2"
              >
                <input
                  value={channelIdInput}
                  onChange={(event) => setChannelIdInput(event.target.value)}
                  placeholder="UCxxxxxxxx"
                  className="w-48 rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-700 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  <Search className="h-3.5 w-3.5" />
                  Analyse
                </button>
              </form>
            }
          >
            {channelMetrics ? (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <MetricTile label="Subscribers" value={channelMetrics.totalSubscribers.toLocaleString()} />
                <MetricTile label="Lifetime views" value={channelMetrics.totalViews.toLocaleString()} />
                <MetricTile
                  label="Avg retention"
                  value={`${channelMetrics.avgRetentionRate.toFixed(1)}%`}
                />
                <MetricTile
                  label="Avg CTR"
                  value={`${channelMetrics.avgClickThroughRate.toFixed(1)}%`}
                />
                <MetricTile
                  label="Comments / Short"
                  value={`${Math.round(channelMetrics.avgCommentsPerVideo)}`}
                />
                <MetricTile
                  label="Sentiment"
                  value={`${channelMetrics.sentimentSnapshot.positive}% +`}
                />
              </div>
            ) : (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Connect a YouTube channel to personalize growth levers across
                topic ideation, hook scoring, and retention tactics.
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="Trend Radar"
            subtitle={`Web scan • ${trendSource === "live-search" ? "Live" : "Curated fallback"}`}
            action={
              <form
                className="flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void loadTrends(trendQuery).then(() =>
                    refreshRecommendations(),
                  );
                }}
              >
                <input
                  value={trendQuery}
                  onChange={(event) => setTrendQuery(event.target.value)}
                  placeholder="AI shorts, creator economy..."
                  className="w-48 rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-700 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-500"
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  Refresh
                </button>
              </form>
            }
          >
            <ul className="space-y-3 text-xs">
              {trends.map((trend) => (
                <li
                  key={trend.keyword}
                  className="rounded-xl border border-zinc-200/70 bg-white/60 p-3 dark:border-zinc-700/70 dark:bg-zinc-900/60"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                      {trend.keyword}
                    </span>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                      Interest {trend.interestScore}
                    </span>
                  </div>
                  <p className="mt-2 text-zinc-500 dark:text-zinc-400">
                    {trend.summary}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {trend.categories?.map((category) => (
                      <span
                        key={category}
                        className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        <SectionCard
          title="Topic Recommendations"
          subtitle="Smart suggestions optimized for retention and growth"
          action={
            <button
              onClick={() => refreshRecommendations()}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500"
            >
              {recommendationsLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Re-run Engine
            </button>
          }
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recommendations.map((idea) => (
              <article
                key={idea.id}
                className="flex h-full flex-col justify-between rounded-2xl border border-zinc-200 bg-white/80 p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900/70"
              >
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {idea.title}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {idea.summary}
                  </p>
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    <span className="rounded-full bg-emerald-500/10 px-2 py-1 font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      Hook {idea.hookScore}
                    </span>
                    <span className="rounded-full bg-sky-500/10 px-2 py-1 font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                      Keyword {idea.primaryKeyword}
                    </span>
                  </div>
                  <ul className="space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {idea.retentionTactics.map((tactic) => (
                      <li key={tactic} className="flex items-start gap-2">
                        <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <span>{tactic}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <button
                    onClick={() => adoptRecommendation(idea)}
                    className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-3 py-1.5 font-semibold text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Use idea
                  </button>
                  <AssetsPopover
                    loading={assetsLoading}
                    onSearch={handleAssetsSearch}
                    assets={assets}
                    query={idea.primaryKeyword}
                  />
                </div>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Content Creation Studio"
          subtitle="Draft, package, and store Shorts in the “to post” vault"
        >
          <form
            onSubmit={handleCreateVideo}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <label className="flex flex-col gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-200">
              Working Title
              <input
                value={newVideo.topic}
                onChange={(event) =>
                  setNewVideo({ ...newVideo, topic: event.target.value })
                }
                placeholder="Foolproof AI Shorts workflow…"
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-200">
              Hook Caption
              <input
                value={newVideo.caption}
                onChange={(event) =>
                  setNewVideo({ ...newVideo, caption: event.target.value })
                }
                placeholder="I cut Shorts editing time by 70% 🤯"
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-200">
              Media file path
              <input
                value={newVideo.filePath}
                onChange={(event) =>
                  setNewVideo({ ...newVideo, filePath: event.target.value })
                }
                placeholder="~/Videos/to-post/shorts/ai-workflow.mp4"
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-200 md:col-span-2">
              Narrative Beat Sheet
              <textarea
                value={newVideo.description}
                onChange={(event) =>
                  setNewVideo({
                    ...newVideo,
                    description: event.target.value,
                  })
                }
                rows={3}
                placeholder="Beat 1: Cold open with exaggerated result…"
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-200 md:col-span-2">
              Thumbnail Prompt
              <textarea
                value={newVideo.thumbnailPrompt}
                onChange={(event) =>
                  setNewVideo({
                    ...newVideo,
                    thumbnailPrompt: event.target.value,
                  })
                }
                rows={2}
                placeholder="Creator pointing at split screen results graph, neon overlay, bold “AI cuts time” text"
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-200 md:col-span-2">
              Retention Tactics
              <div className="flex flex-wrap gap-2">
                {newVideo.retentionNotes.map((note, index) => (
                  <span
                    key={note}
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                  >
                    {note}
                    <button
                      type="button"
                      className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/30 dark:text-emerald-200"
                      onClick={() =>
                        setNewVideo({
                          ...newVideo,
                          retentionNotes: newVideo.retentionNotes.filter(
                            (_, i) => i !== index,
                          ),
                        })
                      }
                    >
                      Remove
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setNewVideo({
                      ...newVideo,
                      retentionNotes: [
                        ...newVideo.retentionNotes,
                        "Frame comment CTA before final punchline",
                      ],
                    })
                  }
                  className="rounded-full border border-dashed border-emerald-400 px-3 py-2 text-xs font-semibold text-emerald-600 transition hover:border-emerald-500 hover:bg-emerald-500/10 dark:text-emerald-300"
                >
                  + Add tactic
                </button>
              </div>
            </label>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FolderOpen className="h-4 w-4" />
                )}
                Save to “to post” vault
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard
          title="Scheduling & Upload"
          subtitle="Auto-move from to post → posted once uploads complete"
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <PipelineColumn
              title="To Post"
              description="Ready to edit, caption, export, and schedule."
              videos={collections.toPost}
              emptyState="Drop curated ideas here and prep them for scheduling."
              loading={loadingVideos}
              renderActions={(video) => (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setNewVideo({
                        topic: video.topic,
                        description: video.description,
                        caption: video.caption,
                        thumbnailPrompt: video.thumbnailPrompt,
                        retentionNotes: video.retentionNotes,
                        filePath: video.filePath ?? "",
                      });
                    }}
                    className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-semibold text-white transition hover:bg-zinc-600 dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleSchedule(video.id, new Date().toISOString())}
                    className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-semibold text-zinc-600 transition hover:border-zinc-500 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
                  >
                    Quick Schedule
                  </button>
                </div>
              )}
            />
            <PipelineColumn
              title="Scheduled"
              description="Laptop online? Automation can auto-upload at slot."
              videos={collections.scheduled}
              emptyState="Schedule Shorts to keep the queue healthy."
              loading={loadingVideos}
              renderActions={(video) => (
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                    Schedule slot
                    <input
                      type="datetime-local"
                      defaultValue={
                        video.scheduledFor?.slice(0, 16) ??
                        new Date().toISOString().slice(0, 16)
                      }
                      onChange={(event) =>
                        handleSchedule(video.id, event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-1 text-xs text-zinc-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    />
                  </label>
                  <button
                    onClick={() => handlePublish(video)}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
                  >
                    {publishingVideoId === video.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UploadCloud className="h-3.5 w-3.5" />
                    )}
                    Publish now
                  </button>
                </div>
              )}
            />
            <PipelineColumn
              title="Posted"
              description="Analytics auto-inject once upload completes."
              videos={collections.posted}
              emptyState="Once uploaded, Shorts move here automatically."
              loading={loadingVideos}
              renderActions={(video) => (
                <div className="space-y-2 text-[11px] text-zinc-500 dark:text-zinc-300">
                  {video.analytics ? (
                    <div className="rounded-2xl border border-zinc-200/70 bg-white/70 p-3 dark:border-zinc-800/60 dark:bg-zinc-900/70">
                      <p className="font-semibold">
                        Retention {video.analytics.retentionRate}%
                      </p>
                      <p className="mt-1">
                        Avg watch {video.analytics.averageViewDuration}s • CTR{" "}
                        {video.analytics.clickThroughRate}%
                      </p>
                      <p className="mt-2 text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                        Improvement Loop
                      </p>
                      <ul className="mt-1 space-y-1">
                        {video.analytics.improvementIdeas.slice(0, 3).map((idea) => (
                          <li key={idea} className="flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span>{idea}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p>Analytics pending. Keep the laptop online.</p>
                  )}
                </div>
              )}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Continuous Improvement"
          subtitle="Compare retention vs trends and evolve recommendations automatically"
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Drop-off intelligence
              </p>
              <ul className="mt-3 space-y-2 text-xs text-zinc-500 dark:text-zinc-400">
                {collections.posted.slice(0, 3).flatMap((video) =>
                  video.analytics?.dropOffMoments.map((drop) => (
                    <li
                      key={`${video.id}-${drop.timestamp}`}
                      className="flex items-start gap-3 rounded-xl border border-zinc-200/70 bg-white/60 p-3 dark:border-zinc-800/60 dark:bg-zinc-900/60"
                    >
                      <span className="rounded-full bg-rose-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-300">
                        {drop.timestamp}s
                      </span>
                      <div>
                        <p className="font-semibold text-zinc-700 dark:text-zinc-200">
                          {video.topic}
                        </p>
                        <p className="text-xs">{drop.description}</p>
                      </div>
                    </li>
                  )) ?? [],
                )}
              </ul>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Next iteration levers
              </p>
              <ul className="mt-3 space-y-2 text-xs text-zinc-500 dark:text-zinc-400">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-500" />
                  Fuse trending topics with best performing retention tactic in
                  posted tab.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-500" />
                  Iterate thumbnails based on top CTR and trending keywords.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-500" />
                  Push comments with explicit “reply for part 2” prompts to
                  drive suggestion loops.
                </li>
              </ul>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function WorkflowBadge({
  icon,
  label,
  description,
}: {
  icon: ReactNode;
  label: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white/70 p-4 transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/70 dark:hover:border-zinc-700">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-zinc-900/90 p-2 text-white dark:bg-zinc-100 dark:text-zinc-900">
          {icon}
        </span>
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {label}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/70">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
        {value}
      </p>
    </div>
  );
}

function PipelineColumn({
  title,
  description,
  videos,
  emptyState,
  loading,
  renderActions,
}: {
  title: string;
  description: string;
  videos: VideoItem[];
  emptyState: string;
  loading: boolean;
  renderActions: (video: VideoItem) => ReactNode;
}) {
  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl border border-zinc-200 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
      <div>
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-zinc-300 py-10 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="ml-2">Syncing videos…</span>
          </div>
        ) : videos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-300">
            {emptyState}
          </div>
        ) : (
          videos.map((video) => (
            <article
              key={video.id}
              className="rounded-2xl border border-zinc-200 bg-white/80 p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/70"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {video.topic}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {video.caption}
                  </p>
                </div>
                <span className="rounded-full bg-zinc-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white dark:bg-zinc-100 dark:text-zinc-900">
                  {video.status}
                </span>
              </div>
              <div className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                {video.thumbnailPrompt}
              </div>
              {video.filePath ? (
                <div className="mt-2 text-[11px] text-zinc-400 dark:text-zinc-500">
                  File: <span className="font-medium text-zinc-600 dark:text-zinc-300">{video.filePath}</span>
                </div>
              ) : null}
              <div className="mt-3">{renderActions(video)}</div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function AssetsPopover({
  loading,
  onSearch,
  assets,
  query,
}: {
  loading: boolean;
  onSearch: (query: string) => void;
  assets: AssetSuggestion[];
  query: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => onSearch(query)}
        className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:border-zinc-500 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Search className="h-3.5 w-3.5" />
        )}
        Stock assets
      </button>
      <div className="flex flex-wrap gap-2">
        {assets.slice(0, 2).map((asset) => (
          <a
            key={asset.id}
            href={asset.url}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-semibold text-zinc-600 transition hover:bg-zinc-900 hover:text-white dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <Youtube className="h-3 w-3 opacity-70 group-hover:opacity-100" />
            {asset.title}
          </a>
        ))}
      </div>
    </div>
  );
}
