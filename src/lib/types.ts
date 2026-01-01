export type VideoStatus = "to_post" | "posted" | "scheduled";

export interface VideoIdea {
  id: string;
  title: string;
  summary: string;
  primaryKeyword: string;
  hookScore: number;
  retentionTactics: string[];
  assets: AssetSuggestion[];
}

export interface AssetSuggestion {
  id: string;
  type: "stock_video" | "music" | "template" | "broll" | "sound_effect";
  title: string;
  source: string;
  url?: string;
  thumbnail?: string;
}

export interface VideoItem {
  id: string;
  topic: string;
  description: string;
  caption: string;
  thumbnailPrompt: string;
  hookScore: number;
  retentionNotes: string[];
  status: VideoStatus;
  scheduledFor?: string;
  createdAt: string;
  publishedAt?: string;
  youtubeVideoId?: string;
  filePath?: string;
  analytics?: VideoAnalytics;
}

export interface VideoAnalytics {
  averageViewDuration: number;
  retentionRate: number;
  clickThroughRate: number;
  commentsSummary: string;
  dropOffMoments: Array<{
    timestamp: number;
    description: string;
  }>;
  improvementIdeas: string[];
}

export interface ChannelMetrics {
  channelId: string;
  channelName: string;
  totalSubscribers: number;
  totalViews: number;
  avgRetentionRate: number;
  avgClickThroughRate: number;
  avgCommentsPerVideo: number;
  trendingTopics: string[];
  sentimentSnapshot: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

export interface TrendResult {
  keyword: string;
  interestScore: number;
  summary: string;
  categories: string[];
  lastUpdated: string;
}

export interface RecommendationRequest {
  channelMetrics: ChannelMetrics | null;
  trends: TrendResult[];
  history: VideoItem[];
}

export interface RecommendationResponse {
  recommendations: VideoIdea[];
  rationale: string;
}
