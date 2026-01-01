import { VideoAnalytics, VideoItem } from "./types";

const BASE_IMPROVEMENTS = [
  "Open with the highest energy clip to hook viewers within the first 2 seconds.",
  "Add dynamic on-screen text that mirrors the narration to boost retention.",
  "Tighten pacing by trimming pauses longer than 0.7 seconds.",
  "Pair the key message with a visual punchline to reinforce memory.",
  "Include a comment call-to-action that prompts specific responses.",
];

const DROP_OFF_HINTS = [
  { ts: 12, desc: "Pacing slows during explanation. Consider adding b-roll." },
  {
    ts: 24,
    desc: "Viewers drop when CTA appears. Move CTA to 45% mark with teaser.",
  },
  {
    ts: 40,
    desc: "Audio dip detected. Normalize levels and add subtle riser.",
  },
];

export function generateAnalytics(video: VideoItem): VideoAnalytics {
  const randomFactor = (seed: string) =>
    Array.from(seed)
      .map((char) => char.charCodeAt(0))
      .reduce((acc, code) => (acc * 33 + code) % 1000, 7) / 1000;

  const factor = randomFactor(video.id + video.topic);
  const averageViewDuration = Math.round((45 + factor * 30) * 10) / 10;
  const retentionRate = Math.round((50 + factor * 35) * 10) / 10;
  const clickThroughRate = Math.round((4.5 + factor * 3) * 100) / 100;

  const dropOffMoments = DROP_OFF_HINTS.map((hint, idx) => ({
    timestamp: hint.ts + Math.round(factor * idx * 6),
    description: hint.desc,
  }));

  const improvementIdeas = BASE_IMPROVEMENTS.slice(0, 3 + Math.floor(factor * 2));
  if (video.retentionNotes.length) {
    improvementIdeas.push(
      `Double down on retention tactic: ${video.retentionNotes[0]}.`,
    );
  }

  return {
    averageViewDuration,
    retentionRate,
    clickThroughRate,
    commentsSummary:
      factor > 0.6
        ? "Audience praised the pacing and visuals. Some requested deeper tips."
        : "Comments highlight solid idea but ask for more energy at the start.",
    dropOffMoments,
    improvementIdeas,
  };
}

