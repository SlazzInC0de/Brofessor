# backend

FastAPI service that turns a topic into a Board DSL lesson with an LLM and streams it to the player step by step (Phase 3, D-018).

## Run
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows  (source .venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
copy .env.example .env            # then set BROFESSOR_PROVIDER and the matching API key
uvicorn app.main:app --port 8000
```
Then run the frontend (`cd frontend && npm run dev`) and type a topic on the home page.
The frontend finds the API through `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`).

Without a key, `BROFESSOR_PROVIDER=replay` plays back a recorded lesson (`tests/fixtures/bst-replay.json`) so the whole flow works offline.

## Providers
| `BROFESSOR_PROVIDER` | Key | Default model |
|---|---|---|
| `gemini` | `GEMINI_API_KEY` | gemini-2.5-flash |
| `openai` | `OPENAI_API_KEY` (+ `OPENAI_BASE_URL` for any OpenAI-compatible host: Groq, OpenRouter, Ollama…) | gpt-4.1-mini |
| `replay` | none | recorded responses |

Override the model with `BROFESSOR_MODEL`. Set `BROFESSOR_PRICE_IN` / `BROFESSOR_PRICE_OUT` (USD per million tokens) to get cost in metrics.

## Pipeline
```
topic ─► plan (title, 5-8 step goals, quiz)            validate ─► repair (errors fed back)
      ─► for each step: writer(plan, board state so far) ─► Pydantic + semantic checks
                                                       ─► repair up to MAX_REPAIRS ─► salvage (drop bad actions)
      ─► SSE: plan, step, step, …, done                  ─► disk cache (data/lessons)
```
- `app/dsl/schema.py`: Pydantic mirror of the Zod schema (`frontend/src/dsl/schema.ts`). The model may use every template except `traced_figure` / `figure_part` (they need a traced asset).
- `app/pipeline/validate.py`: semantic checks the schema can't express: references point at drawn parts, unique ids, regions exist in the layout, size limits per template, Hinglish fields present.
- `app/pipeline/generate.py`: plan → step writer → validate → repair → salvage, with per-call metrics (tokens, latency, repairs).
- `app/llm/`: provider-agnostic client (plain HTTP, retries on 429/5xx) and prompts (few-shot from the hand-written samples).

## API
| Route | |
|---|---|
| `GET /api/health` | provider and model |
| `GET /api/generate?topic=&level=&language=` | Server-Sent Events: `plan`, `step` (one per step), `done`, `error`. Cached topics replay instantly. Rate-limited per IP (`BROFESSOR_RATE_LIMIT`, default 20/hour). |
| `GET /api/lessons` | recently generated lessons |
| `GET /api/lessons/{id}` | one lesson |
| `GET /api/tts/{lesson}/{lang}/{step}` | narration for one step: `{url, words: [{w, t, d}], duration_ms}`; made once, then cached |
| `GET /api/audio/{lesson}/{lang}/{file}` | the audio file |

## Narration voice (Phase 4)
Every step is spoken by a neural voice made on the server, cached on disk, and played by the player with **word timings**, so the caption highlights exactly the word being said.

| `BROFESSOR_TTS` | Voices | Word timings | Key |
|---|---|---|---|
| `edge` (default) | `en-IN-NeerjaNeural` (English), `hi-IN-SwaraNeural` (Hinglish) | yes | none |
| `sarvam` | Bulbul, built for code-mixed Hinglish | estimated | `SARVAM_API_KEY` |
| `off` | browser voice in the player | estimated | none |

- Hinglish speaks the step's `hi_speech` (Devanagari + English terms), which Indian voices pronounce far better than Roman Hindi.
- While a lesson is being generated, each step is voiced as soon as it is written (2 at a time), so audio is ready before the class reaches it. The player also fetches the next step's audio while the current one plays.
- Files are named by a hash of voice + text: edit a step and it is re-voiced; otherwise it is never made twice. Served with immutable cache headers.
- Works for the hand-written samples too (read from `frontend/public/lessons`).
- `edge` uses the voice service behind Edge's Read Aloud: free and good for a prototype, but unofficial. Use Sarvam or another paid TTS in production.

## Tests and eval
```bash
python -m pytest -q                                          # schema parity, validator, pipeline, API, TTS (offline)
python ../eval/run_eval.py --provider gemini --limit 10      # real model on the topic set
python ../eval/run_eval.py --provider gemini --judge         # + LLM-as-judge scores
```
The eval writes `eval/results/<run>/report.md` with: plan valid first try, steps valid first try / after repair / salvaged, actions dropped, time to first step, tokens, cost, judge scores.
