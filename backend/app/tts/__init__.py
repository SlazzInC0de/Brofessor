"""
Narration audio for lesson steps (Phase 4, D-020).

  speech_text(step, lang)   what is spoken: English text, or the Devanagari+English `hi_speech` for Hinglish
  synthesize(...)           audio + word timings for one step, cached on disk by content hash
  providers: edge (free neural voices, word timings), sarvam (Indian voices, key needed), fake (tests)

Word timings let the player highlight the exact word being spoken and know the true step length.
"""
from __future__ import annotations
import asyncio, base64, hashlib, json, os, re
from dataclasses import dataclass, field
from pathlib import Path
import httpx
from app import config

LANGS = ("english", "hinglish")


@dataclass
class Speech:
    audio: bytes
    ext: str                                            # "mp3" | "wav"
    words: list[dict] = field(default_factory=list)     # [{"w": "word", "t": start_ms, "d": duration_ms}]
    duration_ms: int = 0


class TTSError(Exception):
    pass


def speech_text(step: dict, lang: str) -> str:
    n = step.get("narration", {})
    if lang == "hinglish":
        return n.get("hi_speech") or n.get("hi") or n["en"]
    return n["en"]


def _clean(text: str) -> str:
    """Board markup (*blue*, !red!) is for the board, not the voice."""
    return re.sub(r"\s+", " ", re.sub(r"!([^!\n]+)!", r"\1", text.replace("*", ""))).strip()


# ---------------- providers ----------------
class EdgeTTS:
    """Microsoft Edge read-aloud voices via `edge-tts`. Free, unofficial: fine for a prototype, swap for production."""
    name = "edge"
    VOICES = {"english": os.getenv("BROFESSOR_VOICE_EN", "en-IN-NeerjaNeural"),
              "hinglish": os.getenv("BROFESSOR_VOICE_HI", "hi-IN-SwaraNeural")}

    def voice(self, lang: str) -> str: return self.VOICES[lang]

    async def synth(self, text: str, lang: str) -> Speech:
        try:
            import edge_tts
        except ImportError as e:
            raise TTSError("edge-tts is not installed (pip install edge-tts)") from e
        com = edge_tts.Communicate(text, self.voice(lang), rate=os.getenv("BROFESSOR_VOICE_RATE", "-5%"), boundary="WordBoundary")
        audio, words = bytearray(), []
        try:
            async for ch in com.stream():
                if ch["type"] == "audio": audio += ch["data"]
                elif ch["type"] == "WordBoundary":
                    words.append({"w": ch["text"], "t": round(ch["offset"] / 1e4), "d": round(ch["duration"] / 1e4)})
        except Exception as e:
            raise TTSError(f"Edge voice service failed: {type(e).__name__}") from e
        if not audio: raise TTSError("Edge voice service returned no audio")
        end = words[-1]["t"] + words[-1]["d"] if words else 0
        return Speech(bytes(audio), "mp3", words, end + 300)


class SarvamTTS:
    """Sarvam Bulbul (Indian voices, good with code-mixed Hinglish). No word timings: the player estimates them."""
    name = "sarvam"

    def voice(self, lang: str) -> str:
        return os.getenv("SARVAM_SPEAKER_HI" if lang == "hinglish" else "SARVAM_SPEAKER_EN", "")

    async def synth(self, text: str, lang: str) -> Speech:
        key = os.getenv("SARVAM_API_KEY")
        if not key: raise TTSError("SARVAM_API_KEY is not set")
        body = {"text": text, "target_language_code": "hi-IN" if lang == "hinglish" else "en-IN"}
        if os.getenv("SARVAM_MODEL"): body["model"] = os.getenv("SARVAM_MODEL")
        if self.voice(lang): body["speaker"] = self.voice(lang)
        async with httpx.AsyncClient(timeout=60) as c:
            r = await c.post("https://api.sarvam.ai/text-to-speech", headers={"api-subscription-key": key}, json=body)
        if r.status_code != 200: raise TTSError(f"Sarvam API error {r.status_code}")
        audios = r.json().get("audios") or []
        if not audios: raise TTSError("Sarvam returned no audio")
        return Speech(base64.b64decode(audios[0]), "wav")


class FakeTTS:
    """Deterministic stand-in for tests and offline demos: a silent WAV, 300 ms per word, with word timings."""
    name = "fake"
    calls = 0

    def voice(self, lang: str) -> str: return "fake-" + lang

    async def synth(self, text: str, lang: str) -> Speech:
        import io, wave
        FakeTTS.calls += 1
        ws = text.split(); ms = len(ws) * 300 + 300
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(8000); w.writeframes(b"\0\0" * (8 * ms))
        return Speech(buf.getvalue(), "wav", [{"w": x, "t": i * 300, "d": 280} for i, x in enumerate(ws)], ms)


def make_tts(name: str | None = None):
    name = (name or os.getenv("BROFESSOR_TTS", "edge")).lower()
    if name in ("off", "none", ""): return None
    return {"edge": EdgeTTS, "sarvam": SarvamTTS, "fake": FakeTTS}[name]()


# ---------------- cache ----------------
ROOT = config.DATA_DIR / "audio"
_locks: dict[str, asyncio.Lock] = {}
SAFE = re.compile(r"^[A-Za-z0-9_-]{1,120}$")


def _key(text: str, provider, lang: str) -> str:
    return hashlib.sha1(f"{provider.name}|{provider.voice(lang)}|{text}".encode()).hexdigest()[:12]


def cached(lid: str, lang: str, sid: str, text: str, provider) -> dict | None:
    meta = ROOT / lid / lang / f"{sid}-{_key(text, provider, lang)}.json"
    return json.loads(meta.read_text(encoding="utf-8")) if meta.exists() else None


async def synthesize(lid: str, lang: str, step: dict, provider) -> dict:
    """Returns {"file", "words", "duration_ms"}; synthesizes once per (text, voice) and reuses the file afterwards."""
    sid = step["id"]
    if not (SAFE.match(lid) and SAFE.match(sid) and lang in LANGS): raise TTSError("bad lesson, step or language")
    text = _clean(speech_text(step, lang))
    k = _key(text, provider, lang)
    hit = cached(lid, lang, sid, text, provider)
    if hit: return hit
    lock = _locks.setdefault(f"{lid}/{lang}/{sid}/{k}", asyncio.Lock())
    async with lock:
        hit = cached(lid, lang, sid, text, provider)
        if hit: return hit
        sp = await provider.synth(text, lang)
        d = ROOT / lid / lang; d.mkdir(parents=True, exist_ok=True)
        name = f"{sid}-{k}.{sp.ext}"
        (d / name).write_bytes(sp.audio)
        meta = {"file": f"{lid}/{lang}/{name}", "words": sp.words, "duration_ms": sp.duration_ms, "voice": provider.voice(lang)}
        (d / f"{sid}-{k}.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
        return meta


def audio_path(rel: str) -> Path | None:
    """Resolve a cached audio file safely (no path traversal)."""
    parts = rel.split("/")
    if len(parts) != 3 or not SAFE.match(parts[0]) or parts[1] not in LANGS or not re.match(r"^[A-Za-z0-9_-]+\.(mp3|wav)$", parts[2]):
        return None
    p = ROOT / parts[0] / parts[1] / parts[2]
    return p if p.is_file() else None
