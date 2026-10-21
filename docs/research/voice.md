# Voice: picking a Hinglish TTS

The browser's built-in voice is robotic and mispronounces code-mixed Hinglish. The player now plays pre-generated audio files when they exist (`playground/audio/<lang>/<key>.mp3`) and only falls back to the browser voice. This file is about choosing what generates those files.

---

## Candidates
| Option | Type | Why consider it | Watch out for |
|---|---|---|---|
| **Sarvam Bulbul v4-flash** | API (India) | Built for Indian languages; 13 dedicated code-mixed "enhi" personas; accepts mixed Devanagari + English text | Romanised Hindi degrades quality (use `narration_speech`, D-003) |
| Sarvam Bulbul v3 | API | 30+ voices, good for the English (en-IN) track | Pick a voice that sounds like a teacher, not an ad |
| ElevenLabs (multilingual models) | API | Very natural prosody, voice cloning | Hindi quality depends on the model; cost |
| Google Cloud TTS (Chirp HD voices) | API | hi-IN and en-IN, SSML control | Code-mixing quality varies by voice |
| Azure Neural TTS | API | hi-IN voices, SSML styles, word boundary events (useful for sync) | Same code-mixing caveat |
| Smallest AI (Lightning) | API (India) | Low latency, Hindi support | Claims come from the vendor; test yourself |
| AI4Bharat Indic Parler-TTS | Open source (Apache 2.0, ~0.9B) | Free, self-hosted, voice described by prompt (gender, pace, accent) | Needs a GPU for speed; code-mixing not documented |
| IndicF5 | Open source | Free, voice cloning from a reference clip | Check licence and code-mixed quality |

Check current pricing and free credits on each provider's site before committing.

## Bake-off protocol
1. Same text for everyone: steps `s1`, `s3`, `s5` from `playground/tts/digestive-script.json` (they contain English terms like "mechanical digestion", "HCl", "bile").
2. Generate each with every candidate (`python generate_sarvam.py --compare` covers all Sarvam enhi personas).
3. Listen blind (rename files A, B, C...) and score 1 to 5:
   - Naturalness (does it sound like a person teaching?)
   - English terms inside Hindi sentences pronounced correctly
   - Teacher tone (calm, clear, not an ad voice)
   - Speed of generation and cost per lesson
4. Bonus: does the API return word timestamps? Those let the board highlight a part exactly when it is spoken.

## Results
| Voice | Natural | English terms | Teacher tone | Cost/lesson | Notes |
|---|---|---|---|---|---|
| | | | | | |

## Decision
Pending the bake-off. Default for now: Sarvam `bulbul:v4-flash` with `shubh_enhi_companion` (Hinglish) and `bulbul:v3` `shubh` (English).
