# Decisions Log

Every significant technical decision goes here: what was chosen, what the options were, and why.

---

## D-001: The LLM produces semantic actions, not coordinates
- Options: (a) the LLM outputs SVG or coordinates directly, (b) the LLM says *what* to draw and a layout engine decides *where*
- Chosen: (b)
- Why: LLMs are bad at coordinates, which leads to overlaps and overflow. Deterministic layout code keeps the board clean.

## D-002: Render with SVG, not Canvas
- Options: HTML Canvas, SVG, embedding tldraw/Excalidraw
- Chosen: SVG (to be confirmed after Week 1 experiments)
- Why: paths animate easily with stroke-dashoffset, no blur on zoom, and every element lives in the DOM so highlight and erase are simple.

## D-003: Two narration fields
- `narration_display`: Roman-script Hinglish, shown on screen
- `narration_speech`: Hindi words in Devanagari, English words in Latin script, sent to TTS
- Why: Hinglish TTS (Sarvam Bulbul) sounds poor on romanised Hindi and natural on mixed script.

## D-004: Python (FastAPI) backend
- Why: PDF parsing (PyMuPDF, Docling), image processing (OpenCV), AI SDKs and Pydantic validation are strongest in Python.

## D-005: Two teaching modes, Class Mode first
- Idea: Solvely-style step-by-step content + NotebookLM-style two-host conversation + a live board
- Chosen:
  - **Class Mode (MVP):** only Brofessor speaks, the user is the student (doubt button)
  - **Bro Mode (Phase 6+):** Brofessor plus an AI student who voices common doubts and mistakes, which the teacher resolves on the board
- Why: Bro Mode is engaging and distinct from NotebookLM (its hosts only talk, nobody solves on a board). But two voices double TTS cost, dialogue scripts are harder, and lectures get longer. Get single-voice sync right first.
- DSL impact: each step has a `speaker` field (`"prof"` | `"student"`), added now to avoid a breaking change later.

## D-006: Core USP locked: "Drawn, not generated"
- Brofessor never generates or pastes images. Every visual is a stroke-by-stroke drawing produced by code.
- Why: tools like NotebookLM use AI images, which can contain wrong labels and details. Our diagrams are built from data (nodes, edges, values, traced contours), so they are exact and editable. This is never compromised.

## D-007: Teaching adapts to the material (Teaching Profile)
- A **Material Analyzer** step runs on upload and produces a `teaching_profile` that the planner and board script follow.
- Profile fields:
  - `subject_type`: math / cs / physics / chemistry / biology / theory / language
  - `content_type`: problem_solving / concept / derivation / process / comparison / definitions / anatomy
  - `level`: school / college / advanced (detected from language and depth)
  - `length`: number of lectures and minutes each (from material size)
  - `visual_kit`: which templates dominate
  - `pace`: dense material = slower with more recap
- Example mapping:
  - Maths / physics numericals: step_derivation, formula side box, a "why" for every step
  - DSA / TOC: tree, array, automaton, dry-run table
  - Theory (management, history): flowchart, comparison table, timeline, keyword side notes
  - Processes (OS scheduling, DBMS transactions): timeline, step boxes, arrows
  - Biology / anatomy: traced figure outlines + labels + numbered side notes (see D-008, D-010)
- The user can override level, length, language and mode. Auto-detection is only the default.
- Why: one teaching style does not fit every subject. A real professor teaches maths and history differently.

## D-008: Outline-first sketching
- Default sketch level: **outlines only**. No fills, shading or hatching.
- Detail strokes are added only when they carry meaning (e.g. small intestine coils, liver lobe split). The Board Script controls this per element via `detail: none | key | full` (default `none`).
- Why: a professor is not an artist. Heavy detail slows the lesson and distracts from the concept. Colour is used for meaning (one marker colour per organ/concept, labels match), not decoration.
- Verified in `playground/00-digestive-demo.html`.

## D-009: Deep explanation of PPTs/PDFs through scanning
- Uploaded material is scanned, not just summarised:
  1. Extract text, headings, bullet hierarchy, tables, formulas and figures per page/slide (PyMuPDF / python-pptx, Docling for complex layouts).
  2. Material Analyzer builds the Teaching Profile and a concept map: which slides belong to which concept, prerequisites, what is a definition vs an example vs a figure.
  3. The planner turns slides into lessons by **concept**, not by slide order. Thin bullet slides are expanded with explanation and examples; figures are redrawn (D-010).
  4. Every board step keeps a source reference (page/slide number) so the student can jump back to the material.
- Why: slides are compressed notes. A professor explains *between* the bullets. Teaching slide by slide just reads the slides aloud.

## D-010: Figures are traced into strokes, never pasted
- Pipeline for figures from material (verified in the digestive system demo):
  1. Remove labels and leader lines (detect dark thin strokes, inpaint)
  2. Segment the figure into parts (seeded watershed in the demo; SAM or a vision LLM for seeds in production)
  3. Trace each part's outline (contours, simplified with Douglas-Peucker, smoothed as curves)
  4. Optional meaningful detail: edges inside the part, skeletonised to single-line strokes
  5. A vision LLM names the parts; the Board Script adds labels, arrows and notes
- Diagrams that fit a template (tree, automaton, flowchart) are rebuilt from the template instead of traced.
- Open question: segmentation seeds were hand-picked in the demo. Automating them is the main research item for Phase 5 (plan in `docs/research/figure-understanding.md`): OCR labels + follow leader lines to get seeds, SAM 2 for masks, vision LLM to verify; fine-tune on AI2D only where zero-shot fails.

## D-011: Player UI direction
- The board is the hero; everything else stays quiet.
- Classroom wall background, aluminium board frame, and a marker-tray ledge under the board that holds the controls and clickable step chapters.
- Atkinson Hyperlegible for UI (built for legibility), Kalam for everything written on the board.
- No emoji icons, no all-caps labels, no gradient decoration on content. Keyboard support (Space, Right arrow), visible focus, responsive to mobile.
- Every UI change is checked with Playwright screenshots (desktop + mobile).

## D-012: (next decision)
