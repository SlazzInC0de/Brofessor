"""Generated lessons are cached on disk: a topic is paid for once and replayed for free."""
import json, time
from pathlib import Path
from app import config
from app.dsl.schema import Lesson, dump

DIR = config.DATA_DIR / "lessons"


def _p(lid: str, kind: str = "lesson") -> Path:
    safe = "".join(ch for ch in lid if ch.isalnum() or ch in "-_")
    return DIR / (f"{safe}.json" if kind == "lesson" else f"{safe}.meta.json")


def get(lid: str) -> dict | None:
    p = _p(lid)
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def put(lesson: Lesson, meta: dict) -> None:
    DIR.mkdir(parents=True, exist_ok=True)
    _p(lesson.id).write_text(json.dumps(dump(lesson), ensure_ascii=False, indent=1), encoding="utf-8")
    _p(lesson.id, "meta").write_text(json.dumps({**meta, "created": int(time.time())}, ensure_ascii=False, indent=1), encoding="utf-8")


def recent(limit: int = 20) -> list[dict]:
    if not DIR.exists(): return []
    out = []
    for m in sorted(DIR.glob("*.meta.json"), key=lambda p: p.stat().st_mtime, reverse=True)[:limit]:
        meta = json.loads(m.read_text(encoding="utf-8"))
        out.append({k: meta.get(k) for k in ("id", "title", "subject", "topic", "level", "languages", "model", "created", "steps")})
    return out
