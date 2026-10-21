# BROFESSOR

> Give it any topic, or upload your material (PDF, PPT, notes). Brofessor teaches it on a whiteboard the way a professor does: writing, sketching and explaining out loud. In English or Hinglish.

Repo: https://github.com/SlazzInC0de/Brofessor

## Core rule: Drawn, not generated
Nothing is pasted or AI-generated as an image. Every diagram, graph, tree or automaton is drawn stroke by stroke from code. If the source material contains a figure, Brofessor understands it and redraws it on the board.

## Sketch like a professor, not an artist
Outlines first. No heavy colouring or shading. Detail is added only where it carries meaning (for example, the coils of the small intestine show that it is a long tube packed into a small space).

## Adaptive teaching
When material is uploaded, Brofessor scans it and builds a **Teaching Profile** (subject, content type, level, length, visual kit, pace), then teaches accordingly: maths numericals as step-by-step derivations, DSA with trees and dry runs, theory with flowcharts and timelines. The user can override level, length, language and mode.

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

## Folder structure
```
Brofessor/
  frontend/      Next.js + SVG board renderer (Phase 1)
  backend/       FastAPI: extraction, LLM, TTS (Phase 3)
  samples/       Hand-written Board DSL lectures
  playground/    Standalone experiments and demos
  docs/
    log.md         Daily log
    decisions.md   Decisions with reasons
    dsl-v0.md      Board DSL spec (draft)
    week1.md       Week 1 day-by-day plan
    research/      Research notes
```

## Roadmap
| Phase | Scope | Status |
|---|---|---|
| 0 | Research + DSL v0 | In progress |
| 1 | Renderer MVP (JSON to animated board) | |
| 2 | Smart templates (tree, automaton, flowchart, table) | |
| 3 | LLM lecture generation | |
| 4 | Voice (English + Hinglish) + sync | |
| 5 | PDF/PPT scanning + figure redraw | |
| 6 | Doubts, quiz, notes export, Bro Mode | |
| 7 | Polish + deploy | |

## Stack (planned)
Next.js, TypeScript, SVG, rough.js, perfect-freehand, opentype.js, KaTeX, GSAP | FastAPI, Pydantic, PyMuPDF, OpenCV | Sarvam Bulbul TTS (Hinglish)
