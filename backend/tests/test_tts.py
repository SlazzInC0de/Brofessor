import tempfile, time
from pathlib import Path
from fastapi.testclient import TestClient
from app import tts


def test_speech_text_and_markup():
    step = {"id": "s1", "narration": {"en": "The *root* is !never! empty.", "hi": "Root *kabhi* khali nahi.", "hi_speech": "रूट कभी खाली नहीं."}}
    assert tts._clean(tts.speech_text(step, "english")) == "The root is never empty."
    assert tts.speech_text(step, "hinglish") == "रूट कभी खाली नहीं."
    assert tts.speech_text({"narration": {"en": "x", "hi": "y"}}, "hinglish") == "y"


def _client(monkeypatch):
    tmp = Path(tempfile.mkdtemp())
    from app import store
    monkeypatch.setenv("BROFESSOR_TTS", "fake")
    monkeypatch.setattr(tts, "ROOT", tmp / "audio")
    monkeypatch.setattr(store, "DIR", tmp / "lessons")
    from app.main import app
    return TestClient(app)


def test_step_audio_is_made_once_and_served(monkeypatch):
    c = _client(monkeypatch)
    assert c.get("/api/health").json()["tts"] == "fake"
    before = tts.FakeTTS.calls
    r = c.get("/api/tts/bst-insertion/english/s1")          # a hand-written sample shipped with the frontend
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["url"].startswith("/api/audio/bst-insertion/english/s1-") and j["words"] and j["duration_ms"] > 0
    assert "*" not in " ".join(w["w"] for w in j["words"])
    assert c.get("/api/tts/bst-insertion/english/s1").json() == j
    assert tts.FakeTTS.calls == before + 1                    # cached on disk
    a = c.get(j["url"])
    assert a.status_code == 200 and a.content.startswith(b"RIFF") and a.headers["content-type"] == "audio/wav" and "immutable" in a.headers["cache-control"]
    h = c.get("/api/tts/bst-insertion/hinglish/s1").json()   # Hinglish speaks the Devanagari + English text
    assert h["url"] != j["url"]


def test_bad_requests(monkeypatch):
    c = _client(monkeypatch)
    assert c.get("/api/tts/bst-insertion/english/nope").status_code == 404
    assert c.get("/api/tts/no-such-lesson/english/s1").status_code == 404
    assert c.get("/api/tts/bst-insertion/french/s1").status_code == 422
    assert c.get("/api/audio/bst-insertion/english/..%2F..%2Fsecret.mp3").status_code == 404
    assert c.get("/api/audio/x/english/missing.mp3").status_code == 404


def test_generation_voices_steps_in_background(monkeypatch):
    c = _client(monkeypatch)
    from app import config
    monkeypatch.setattr(config, "PROVIDER", "replay"); monkeypatch.setattr(config, "MODEL", "replay")
    r = c.get("/api/generate", params={"topic": "Binary search tree insertion", "language": "english"})
    assert r.status_code == 200 and "event: done" in r.text
    for _ in range(50):                                       # prefetch runs alongside the stream
        if len(list(tts.ROOT.rglob("*.json"))) >= 6: break
        time.sleep(0.05)
    assert len(list(tts.ROOT.rglob("*.json"))) >= 6
