"""
Generate lesson narration with Sarvam Bulbul TTS.

The demo player (playground/00-digestive-demo.html) plays audio/<lang>/<key>.mp3 when the file
exists and falls back to the browser voice otherwise.

Setup:
    1. Get an API key at https://dashboard.sarvam.ai
    2. Windows (PowerShell):  $env:SARVAM_API_KEY = "your-key"

Usage (run from playground/tts):
    python generate_sarvam.py --lang hinglish                 # all steps, default teacher voice
    python generate_sarvam.py --lang english
    python generate_sarvam.py --lang hinglish --speaker simran_enhi_companion
    python generate_sarvam.py --compare                       # step s1 in every Hinglish persona -> audio/compare/

Hinglish text uses Devanagari for Hindi words and Latin for English words (D-003);
Sarvam's docs say this mixed script sounds far better than romanised Hindi.
No third-party packages needed (standard library only).
"""
import argparse, base64, json, os, sys, time, urllib.request, urllib.error
from pathlib import Path

API = "https://api.sarvam.ai/text-to-speech"
HERE = Path(__file__).resolve().parent
AUDIO = HERE.parent / "audio"

# Code-mixed English+Hindi personas for bulbul:v4-flash (from Sarvam's API reference, Oct 2026)
ENHI_PERSONAS = [
    "shubh_enhi_companion", "shubh_enhi_ads", "shubh_enhi_banking",
    "simran_enhi_companion", "simran_enhi_customer", "simran_enhi_banking_expressive",
    "ishita_enhi_companion", "ishita_enhi_customer", "ishita_enhi_customer_expressive",
    "shalini_enhi_companion", "shalini_enhi_customer", "sanchita_enhi_companion", "sunny_enhi_customer",
]

PRESETS = {
    # lang: (model, language_code, default speaker, script field)
    "hinglish": ("bulbul:v4-flash", "hi-IN", "shubh_enhi_companion", "hinglish_speech"),
    "english": ("bulbul:v3", "en-IN", "shubh", "en"),
}


def tts(text, model, language_code, speaker, pace, key):
    body = {
        "text": text,
        "language_code": language_code,
        "model": model,
        "speaker": speaker,
        "pace": pace,
        "speech_sample_rate": 24000,
        "output_audio_codec": "mp3",
    }
    req = urllib.request.Request(API, data=json.dumps(body).encode(), method="POST",
                                 headers={"api-subscription-key": key, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"Sarvam API error {e.code}: {e.read().decode(errors='ignore')}")
    return base64.b64decode(data["audios"][0])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", choices=PRESETS, default="hinglish")
    ap.add_argument("--speaker", help="override the default voice")
    ap.add_argument("--pace", type=float, default=1.0)
    ap.add_argument("--script", default=str(HERE / "digestive-script.json"))
    ap.add_argument("--compare", action="store_true", help="render step s1 in every Hinglish persona")
    a = ap.parse_args()

    key = os.environ.get("SARVAM_API_KEY")
    if not key:
        sys.exit("Set SARVAM_API_KEY first (see the top of this file).")
    steps = json.load(open(a.script, encoding="utf-8"))["steps"]

    if a.compare:
        out = AUDIO / "compare"; out.mkdir(parents=True, exist_ok=True)
        text = next(s for s in steps if s["key"] == "s1")["hinglish_speech"]
        for p in ENHI_PERSONAS:
            (out / f"{p}.mp3").write_bytes(tts(text, "bulbul:v4-flash", "hi-IN", p, a.pace, key))
            print("saved", p); time.sleep(0.3)
        print(f"Listen to {out} and rate them in docs/research/voice.md")
        return

    model, code, speaker, field = PRESETS[a.lang]
    speaker = a.speaker or speaker
    out = AUDIO / a.lang; out.mkdir(parents=True, exist_ok=True)
    for s in steps:
        (out / f"{s['key']}.mp3").write_bytes(tts(s[field], model, code, speaker, a.pace, key))
        print("saved", s["key"]); time.sleep(0.3)
    print(f"Done. Open playground/00-digestive-demo.html and pick {a.lang}.")


if __name__ == "__main__":
    main()
