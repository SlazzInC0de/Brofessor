import json, os, shutil, tempfile
from fastapi.testclient import TestClient


def parse_sse(text):
    out = []
    for block in text.strip().split("\n\n"):
        ev = next(l[7:] for l in block.splitlines() if l.startswith("event: "))
        data = json.loads(next(l[6:] for l in block.splitlines() if l.startswith("data: ")))
        out.append((ev, data))
    return out


def test_generate_stream_then_cache(monkeypatch):
    tmp = tempfile.mkdtemp()
    from app import config, store
    monkeypatch.setattr(config, "PROVIDER", "replay"); monkeypatch.setattr(config, "MODEL", "replay")
    monkeypatch.setattr(store, "DIR", __import__("pathlib").Path(tmp) / "lessons")
    from app.main import app
    c = TestClient(app)
    assert c.get("/api/health").json()["provider"] == "replay"
    r = c.get("/api/generate", params={"topic": "Binary search tree insertion", "level": "Standard", "language": "hinglish"})
    assert r.status_code == 200
    evs = parse_sse(r.text)
    assert [e for e, _ in evs] == ["plan"] + ["step"] * 6 + ["done"]
    lid = evs[-1][1]["id"]
    assert evs[-1][1]["metrics"]["steps_repaired"] == 1
    # cached: replays without calling the model (replay provider would run out of responses otherwise)
    r2 = c.get("/api/generate", params={"topic": "Binary search tree insertion", "level": "Standard", "language": "hinglish"})
    evs2 = parse_sse(r2.text)
    assert evs2[0][1].get("cached") and len(evs2) == 8
    assert c.get(f"/api/lessons/{lid}").json()["title"] == "Binary Search Tree: Insertion"
    assert c.get("/api/lessons").json()[0]["id"] == lid
    assert c.get("/api/lessons/does-not-exist").status_code == 404
    assert c.get("/api/generate", params={"topic": "x"}).status_code == 422
    shutil.rmtree(tmp)
