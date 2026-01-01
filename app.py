import asyncio
import contextlib
import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import BackgroundTasks, FastAPI
from pydantic import BaseModel, Field
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data" / "videos.json"
TO_POST_DIR = (
    Path(os.environ.get("TO_POST_FOLDER", BASE_DIR / "to_post")).expanduser()
)
POSTED_DIR = (
    Path(os.environ.get("POSTED_FOLDER", BASE_DIR / "posted")).expanduser()
)

app = FastAPI(
    title="Shorts Workflow Automator",
    version="1.0.0",
    description=(
        "Background automation that mirrors the Next.js UI: handles scheduling, "
        "publishing sync, and post-upload analytics when running locally."
    ),
)

store_lock = asyncio.Lock()
schedule_task: Optional[asyncio.Task[Any]] = None

load_dotenv(BASE_DIR / ".env.local")


class DropOffMoment(BaseModel):
    timestamp: int
    description: str


class VideoAnalyticsModel(BaseModel):
    averageViewDuration: float
    retentionRate: float
    clickThroughRate: float
    commentsSummary: str
    dropOffMoments: List[DropOffMoment]
    improvementIdeas: List[str]


class VideoItemModel(BaseModel):
    id: str
    topic: str
    description: str
    caption: str
    thumbnailPrompt: str
    hookScore: int = Field(ge=0, le=100)
    retentionNotes: List[str] = Field(default_factory=list)
    status: str
    scheduledFor: Optional[str] = None
    createdAt: str
    publishedAt: Optional[str] = None
    youtubeVideoId: Optional[str] = None
    filePath: Optional[str] = None
    analytics: Optional[VideoAnalyticsModel] = None


class VideoStore(BaseModel):
    videos: List[VideoItemModel] = Field(default_factory=list)
    history: List[VideoItemModel] = Field(default_factory=list)


def ensure_directories() -> None:
    TO_POST_DIR.mkdir(parents=True, exist_ok=True)
    POSTED_DIR.mkdir(parents=True, exist_ok=True)
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not DATA_FILE.exists():
        DATA_FILE.write_text(json.dumps({"videos": [], "history": []}, indent=2))


async def read_store() -> VideoStore:
    async with store_lock:
        ensure_directories()
        content = await asyncio.to_thread(DATA_FILE.read_text)
        data = json.loads(content)
        return VideoStore.model_validate(data)


async def write_store(store: VideoStore) -> None:
    async with store_lock:
        ensure_directories()
        payload = store.model_dump(mode="json")
        await asyncio.to_thread(
            DATA_FILE.write_text,
            json.dumps(payload, indent=2),
        )


def generate_analytics(video: VideoItemModel) -> VideoAnalyticsModel:
    seed = sum(ord(char) for char in f"{video.id}{video.topic}")
    base = (seed % 25) + 55
    retention = min(96, base + len(video.retentionNotes) * 3)
    average_view = round(40 + (seed % 18), 1)
    ctr = round(5.0 + (seed % 20) / 10, 2)

    drop_offs = [
        DropOffMoment(timestamp=12, description="Energy dips after the opener."),
        DropOffMoment(timestamp=26, description="CTA arrives before payoff."),
        DropOffMoment(timestamp=38, description="Music loses momentum – consider switch."),
    ]

    improvements = [
        "Add kinetic typography synced with the narration peaks.",
        "Introduce a mid-roll tease that promises a payoff late in the Short.",
        "Shorten dead air by trimming 0.3s gaps between sound bites.",
    ]

    if video.retentionNotes:
        improvements.append(f"Double down on tactic: {video.retentionNotes[0]}.")

    return VideoAnalyticsModel(
        averageViewDuration=average_view,
        retentionRate=float(retention),
        clickThroughRate=ctr,
        commentsSummary=(
            "Audience engaged with the core hook. Highlighted desire for faster pacing."
        ),
        dropOffMoments=drop_offs,
        improvementIdeas=improvements,
    )


def move_file(video: VideoItemModel) -> Optional[str]:
    if not video.filePath:
        return None
    source = Path(video.filePath).expanduser()
    if not source.exists():
        return None

    destination = POSTED_DIR / source.name
    POSTED_DIR.mkdir(parents=True, exist_ok=True)
    try:
        shutil.move(str(source), destination)
        return str(destination)
    except (OSError, shutil.Error):
        return None


async def process_schedule() -> Dict[str, Any]:
    store = await read_store()
    now = datetime.now(tz=timezone.utc)
    updated = False
    processed: List[str] = []

    for video in store.videos:
        if video.status != "scheduled" or not video.scheduledFor:
            continue
        try:
            scheduled_at = datetime.fromisoformat(video.scheduledFor)
        except ValueError:
            continue

        scheduled_at = scheduled_at.replace(tzinfo=scheduled_at.tzinfo or timezone.utc)
        if scheduled_at <= now:
            destination = move_file(video)
            analytics = generate_analytics(video)
            video.status = "posted"
            video.publishedAt = now.isoformat()
            video.analytics = analytics
            if destination:
                video.filePath = destination
            processed.append(video.id)
            updated = True

    if updated:
        # Ensure history mirrors posted items
        history_ids = {item.id for item in store.history}
        for video in store.videos:
            if video.status == "posted" and video.id not in history_ids:
                store.history.append(video)
        await write_store(store)

    return {"processed": processed, "timestamp": now.isoformat()}


async def scheduler_loop() -> None:
    while True:
        await process_schedule()
        await asyncio.sleep(30)


@app.on_event("startup")
async def startup_event() -> None:
    ensure_directories()
    global schedule_task
    if schedule_task is None or schedule_task.done():
        schedule_task = asyncio.create_task(scheduler_loop())


@app.on_event("shutdown")
async def shutdown_event() -> None:
    global schedule_task
    if schedule_task:
        schedule_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await schedule_task


@app.get("/health")
async def healthcheck() -> Dict[str, Any]:
    store = await read_store()
    return {
        "status": "ok",
        "videos": len(store.videos),
        "scheduled": len([v for v in store.videos if v.status == "scheduled"]),
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
    }


@app.get("/videos")
async def get_videos() -> VideoStore:
    return await read_store()


@app.post("/schedule/run")
async def run_schedule(background: BackgroundTasks) -> Dict[str, Any]:
    background.add_task(process_schedule)
    return {"status": "queued"}


@app.post("/videos/{video_id}/mark-posted")
async def mark_posted(video_id: str) -> Dict[str, Any]:
    store = await read_store()
    for video in store.videos:
        if video.id == video_id:
            video.status = "posted"
            video.publishedAt = datetime.now(tz=timezone.utc).isoformat()
            video.analytics = generate_analytics(video)
            destination = move_file(video)
            if destination:
                video.filePath = destination
            history_ids = {item.id for item in store.history}
            if video.id not in history_ids:
                store.history.append(video)
            await write_store(store)
            return {"status": "posted", "video": video}
    return {"status": "not_found", "video_id": video_id}


if __name__ == "__main__":
    import uvicorn

    ensure_directories()
    uvicorn.run(
        "app:app",
        host=os.environ.get("API_HOST", "127.0.0.1"),
        port=int(os.environ.get("API_PORT", "8000")),
        reload=False,
    )
