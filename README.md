<img src="docs/assets/logo.svg" width="96" alt="Brofessor logo">

# BROFESSOR

> Give it any topic, or upload your material (PDF, PPT, notes). Brofessor teaches it on a whiteboard the way a professor does: writing, sketching and explaining out loud. In English or Hinglish.

Repo: https://github.com/SlazzInC0de/Brofessor

## Core rule: Drawn, not generated
Nothing is pasted or AI-generated as an image. Every diagram, graph, tree or automaton is drawn stroke by stroke from code. If the source material contains a figure, Brofessor understands it and redraws it on the board.

## Sketch like a professor, not an artist
Outlines first. No heavy colouring or shading. Detail is added only where it carries meaning (for example, the coils of the small intestine show that it is a long tube packed into a small space).

## Adaptive teaching
When material is uploaded, Brofessor scans it and builds a **Teaching Profile** (subject, content type, level, length, visual kit, pace), then teaches accordingly: maths numericals as step-by-step derivations, DSA with trees and dry runs, theory with flowcharts and timelines. The user can override level, length, language and mode.

## Doubts mid-lecture
Stop the class at any moment and type your doubt in the chat. Brofessor answers in the chat, sketches the answer on the board, and only continues once you say it's clear.

## Product references
- **Solvely.ai** (`docs/research/solvely-reference.md`): text-based step-by-step solutions. Brofessor teaches the same content on a live board with voice.
- **NotebookLM** (`docs/research/notebooklm-reference.md`): podcasts and whiteboard-style videos built from AI-generated images, pre-rendered. Brofessor is live, draws exact strokes, takes doubts mid-lesson and speaks Hinglish.

## Teaching modes
- **Class Mode:** Brofessor teaches, the user is the student (MVP)
- **Bro Mode:** Brofessor plus an AI student character in conversation, synced with the board (later)

## Architecture
```
Input (topic / PDF / PPT / photo)
  -> Content Extractor
  -> Material Analyzer (LLM)        -> Teaching Profile
  -> Lesson Planner (LLM)
  -> Board Script Generator (LLM)   -> Board DSL (JSON)
  -> Validator + Layout Engine
  -> TTS (audio per step)
  -> Board Player (SVG stroke animation + audio sync)
```
Key decision: the LLM decides **what** to draw and say. The Layout Engine decides **where**.

## Run it
```bash
# 1. backend (lesson generation)
cd backend
pip install -r requirements.txt
copy .env.example .env          # set BROFESSOR_PROVIDER + API key (or "replay" to run offline)
uvicorn app.main:app --port 8000

# 2. frontend (player)
cd frontend && npm install && npm run dev     # http://localhost:3000
```
Type any topic on the home page: the lesson is planned, written step by step by the LLM, validated, and streamed into the player while it plays. Four hand-written sample lessons work without the backend. Lesson format: `docs/dsl.md`. Backend details: `backend/README.md`.

## Eval
```bash
python eval/run_eval.py --provider gemini --limit 10 --judge
```
Generates a lesson per topic in `eval/topics.yaml` and reports schema validity (first try / after repair), salvaged steps, time to first step, tokens, cost and judge scores (D-018).

## Folder structure
```
Brofessor/
  frontend/      Next.js player + board engine + Board DSL v1 (Phase 1-2)
  backend/       FastAPI: LLM lesson generation pipeline, SSE streaming (Phase 3)
  eval/          Eval harness: topic set + metrics report
  samples/       Hand-written Board DSL lectures
  playground/    Standalone experiments and demos
  docs/
    log.md         Daily log
    decisions.md   Decisions with reasons
    dsl.md         Board DSL v1 reference
    week1.md       Week 1 day-by-day plan
    research/      Research notes
```

## Roadmap
| Phase | Scope | Status |
|---|---|---|
| 0 | Research + DSL v0 | Mostly done |
| 1 | Renderer MVP (JSON to animated board) | Done |
| 2 | Smart templates (tree, automaton, flowchart, table) | Done |
| 3 | LLM lecture generation + eval harness | Done |
| 4 | Voice (English + Hinglish) + sync | |
| 5 | PDF/PPT scanning + figure redraw | |
| 6 | Doubts, quiz, notes export, Bro Mode | |
| 7 | Polish + deploy | |

## Stack (planned)
Next.js, TypeScript, SVG, rough.js, perfect-freehand, opentype.js, KaTeX, GSAP | FastAPI, Pydantic, PyMuPDF, OpenCV | Sarvam Bulbul TTS (Hinglish, pre-generated per step)
