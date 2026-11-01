"""
Brofessor API.
  GET  /api/health
  GET  /api/lessons                  recently generated lessons
  GET  /api/lessons/{id}             one lesson (Board DSL JSON)
  GET  /api/generate?topic=&level=&language=   Server-Sent Events: plan, step (one per step), done | error
  GET  /api/tts/{lesson}/{lang}/{step}        narration audio for a step: {url, words, duration_ms} (made once, cached)
  GET  /api/audio/{lesson}/{lang}/{file}      the cached audio file
Run: uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations
import asyncio, json, time
from collections import defaultdict, deque
from typing import Literal
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from app import config, store, tts
from app.dsl.schema import dump
from app.llm.provider import make_provider, ProviderError
from app.pipeline.generate import generate_lesson, lesson_id

app = FastAPI(title="Brofessor API", version="0.4.0")
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["GET"], allow_headers=["*"])

_hits: dict[str, deque] = defaultdict(deque)


def _rate_limit(ip: str) -> None:
    now = time.time(); q = _hits[ip]
    while q and now - q[0] > 3600: q.popleft()
    if len(q) >= config.RATE_LIMIT_PER_HOUR:
        raise HTTPException(429, "Too many lessons generated from this address in the last hour. Try again later.")
    q.append(now)


@app.get("/api/health")
def health():
    t = tts.make_tts()
    return {"ok": True, "provider": config.PROVIDER, "model": config.MODEL, "tts": t.name if t else None}


def _find_lesson(lid: str) -> dict | None:
    """A generated lesson from the cache, or one of the hand-written samples shipped with the frontend."""
    if not tts.SAFE.match(lid): return None
    lesson = store.get(lid)
    if lesson: return lesson
    p = config.SAMPLES_DIR / f"{lid}.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.is_file() else None


@app.get("/api/tts/{lid}/{lang}/{sid}")
async def step_audio(lid: str, lang: Literal["english", "hinglish"], sid: str):
    provider = tts.make_tts()
    if not provider: raise HTTPException(404, "Narration audio is turned off on this server")
    lesson = _find_lesson(lid)
    step = next((s for s in (lesson or {}).get("steps", []) if s.get("id") == sid), None)
    if not step: raise HTTPException(404, "Step not found")
    try:
        meta = await tts.synthesize(lid, lang, step, provider)
    except tts.TTSError as e:
        raise HTTPException(502, str(e))
    return {"url": f"/api/audio/{meta['file']}", "words": meta["words"], "duration_ms": meta["duration_ms"], "voice": meta.get("voice")}


@app.get("/api/audio/{lid}/{lang}/{name}")
def audio_file(lid: str, lang: str, name: str):
    p = tts.audio_path(f"{lid}/{lang}/{name}")
    if not p: raise HTTPException(404, "Audio not found")
    # file names carry a content hash, so they never change: cache forever
    return FileResponse(p, media_type="audio/mpeg" if p.suffix == ".mp3" else "audio/wav",
                        headers={"Cache-Control": "public, max-age=31536000, immutable"})


@app.get("/api/lessons")
def list_lessons():
    return store.recent()


@app.get("/api/lessons/{lid}")
def get_lesson(lid: str):
    lesson = store.get(lid)
    if not lesson: raise HTTPException(404, "Lesson not found")
    return lesson


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@app.get("/api/generate")
async def generate(request: Request,
                   topic: str = Query(..., min_length=3, max_length=200),
                   level: Literal["Basics", "Standard", "Quick revision"] = "Standard",
                   language: Literal["english", "hinglish"] = "english"):
    topic = " ".join(topic.split())
    languages = ["hinglish", "english"] if language == "hinglish" else ["english"]
    provider = make_provider()
    lid = lesson_id(topic, level, languages, provider.model)
    cached = store.get(lid)

    async def replay_cached():
        yield _sse("plan", {"id": lid, "title": cached["title"], "subject": cached.get("subject"), "layout": cached.get("layout", "classic"),
                            "languages": cached.get("languages"), "teaching_profile": cached.get("teaching_profile"),
                            "steps": [{"id": s["id"], "title": s["title"]} for s in cached["steps"]], "cached": True})
        for i, s in enumerate(cached["steps"]):
            yield _sse("step", {"index": i, "step": s})
        yield _sse("done", {"id": lid, "quiz": cached.get("quiz"), "cached": True})

    if cached:
        return StreamingResponse(replay_cached(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})

    _rate_limit(request.client.host if request.client else "unknown")
    queue: asyncio.Queue = asyncio.Queue()

    voice = tts.make_tts()
    voice_lang = "hinglish" if language == "hinglish" else "english"
    voice_slots = asyncio.Semaphore(2)

    async def prefetch(step: dict):
        """Voice each step as soon as it is written, so audio is ready before the class reaches it."""
        async with voice_slots:
            try: await tts.synthesize(lid, voice_lang, step, voice)
            except Exception: pass                               # the player falls back to the browser voice

    async def emit(event, data):
        await queue.put((event, data))
        if event == "step" and voice: asyncio.create_task(prefetch(data["step"]))

    async def run():
        try:
            lesson, metrics = await generate_lesson(provider, topic, level, languages, emit)
            store.put(lesson, {"id": lesson.id, "title": lesson.title, "subject": lesson.subject, "topic": topic, "level": level,
                               "languages": languages, "provider": provider.name, "model": provider.model,
                               "steps": len(lesson.steps), "metrics": metrics.to_dict()})
            await queue.put(("done", {"id": lesson.id, "quiz": dump(lesson).get("quiz"),
                                      "metrics": {k: v for k, v in metrics.to_dict().items() if k != "calls"}}))
        except ProviderError as e:
            await queue.put(("error", {"message": str(e)}))
        except Exception as e:                                   # never leak a stack trace to the client
            await queue.put(("error", {"message": f"Generation failed: {type(e).__name__}"}))
        await queue.put(None)

    task = asyncio.create_task(run())

    async def stream():
        try:
            while True:
                item = await queue.get()
                if item is None: break
                yield _sse(*item)
                if await request.is_disconnected(): task.cancel(); break
        finally:
            if not task.done(): task.cancel()

    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
