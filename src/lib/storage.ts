import { promises as fs } from "node:fs";
import path from "node:path";
import { VideoItem } from "./types";

const DATA_FILE = path.join(process.cwd(), "data", "videos.json");

interface VideoStoreData {
  videos: VideoItem[];
  history: VideoItem[];
}

async function ensureStore(): Promise<void> {
  try {
    await fs.access(DATA_FILE);
  } catch {
    const initial: VideoStoreData = { videos: [], history: [] };
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
}

export async function readStore(): Promise<VideoStoreData> {
  await ensureStore();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(raw) as VideoStoreData;
}

export async function writeStore(data: VideoStoreData): Promise<void> {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

export async function addVideo(video: VideoItem): Promise<VideoItem> {
  const store = await readStore();
  store.videos.push(video);
  await writeStore(store);
  return video;
}

export async function updateVideo(
  id: string,
  updates: Partial<VideoItem>,
): Promise<VideoItem | null> {
  const store = await readStore();
  const index = store.videos.findIndex((item) => item.id === id);
  if (index === -1) {
    return null;
  }
  const updated = { ...store.videos[index], ...updates };
  store.videos[index] = updated;

  // If status transitioned to posted, move to history.
  if (
    store.videos[index].status === "posted" &&
    !store.history.some((item) => item.id === id)
  ) {
    store.history.push(store.videos[index]);
  }

  await writeStore(store);
  return updated;
}

export async function removeVideo(id: string): Promise<void> {
  const store = await readStore();
  store.videos = store.videos.filter((item) => item.id !== id);
  store.history = store.history.filter((item) => item.id !== id);
  await writeStore(store);
}

