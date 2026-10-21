"""
Free neural narration with Microsoft Edge voices (no API key).

Uses the `edge-tts` package, which talks to the voice service behind Edge's Read Aloud.
It is unofficial: fine for prototyping, not for production (use Sarvam or Azure there).

Setup:   pip install edge-tts
Usage (run from playground/tts):
    python generate_edge.py --lang hinglish            # hi-IN Swara (female)
    python generate_edge.py --lang hinglish --voice hi-IN-MadhurNeural   # male
    python generate_edge.py --lang english             # en-IN Neerja
    python generate_edge.py --compare                  # step s1 in every Indian voice -> audio/compare-edge/

Output: playground/audio/<lang>/<key>.mp3, picked up automatically by 00-digestive-demo.html
"""
import argparse, asyncio, json
from pathlib import Path
import edge_tts

HERE = Path(__file__).resolve().parent
AUDIO = HERE.parent / "audio"
PRESETS = {
    "hinglish": ("hi-IN-SwaraNeural", "hinglish_speech"),
    "english": ("en-IN-NeerjaNeural", "en"),
}
COMPARE = ["hi-IN-SwaraNeural", "hi-IN-MadhurNeural", "en-IN-NeerjaNeural", "en-IN-PrabhatNeural"]


async def say(text, voice, path, rate):
    await edge_tts.Communicate(text, voice, rate=rate).save(str(path))


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", choices=PRESETS, default="hinglish")
    ap.add_argument("--voice")
    ap.add_argument("--rate", default="+0%", help="e.g. -5%% for a calmer teacher pace")
    ap.add_argument("--script", default=str(HERE / "digestive-script.json"))
    ap.add_argument("--compare", action="store_true")
    a = ap.parse_args()
    steps = json.load(open(a.script, encoding="utf-8"))["steps"]

    if a.compare:
        out = AUDIO / "compare-edge"; out.mkdir(parents=True, exist_ok=True)
        s1 = next(s for s in steps if s["key"] == "s1")
        for v in COMPARE:
            text = s1["en"] if v.startswith("en-") else s1["hinglish_speech"]
            await say(text, v, out / f"{v}.mp3", a.rate); print("saved", v)
        return

    voice, field = PRESETS[a.lang]
    voice = a.voice or voice
    out = AUDIO / a.lang; out.mkdir(parents=True, exist_ok=True)
    for s in steps:
        await say(s[field], voice, out / f"{s['key']}.mp3", a.rate); print("saved", s["key"])
    print(f"Done. Open playground/00-digestive-demo.html and pick {a.lang}.")


if __name__ == "__main__":
    asyncio.run(main())
