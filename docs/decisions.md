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

## D-011: Player UI direction (v2: clean modern app)
- v1 (classroom wall, aluminium frame, marker tray) was rejected as cluttered. v2 follows a clean app direction (Notion/Linear-like).
- Shell: light neutral background, slim top bar (logo, lesson name, language switch, mute), the board in a plain white card, captions in a bar under the board, a floating control pill (play, next, step dots with the current step name, speed, Ask a doubt), and the doubt chat as a side panel (bottom sheet on mobile).
- Board uses **three markers only**: ink for drawings, labels and headings; blue for keywords and the doubt sheet; red for highlights and warnings. Body outline and pointer arrows in light grey. No per-organ rainbow.
- Fonts: Geist for UI, Kalam only for what is written on the board.
- Accent `#2b4fd8` is used only for primary actions (Start, Ask a doubt, send, current step).
- Free voice upgrade: the player prefers neural browser voices (Edge "Natural"/"Online", Google) over old desktop voices; `playground/tts/generate_edge.py` makes free neural audio files.
- Every UI change is checked with Playwright screenshots (desktop + mobile).

## D-012: Doubts interrupt the lecture through a chat, and the class waits until they are cleared
- The student can interrupt at any moment (button or `D` key). The lecture pauses immediately and a **doubt chat** opens next to the board.
- Doubts are **typed in the chat, not spoken**. Answers come back as chat text, and Brofessor also sketches the answer on a temporary **doubt sheet** on the board (same drawn-not-generated rule), highlighting the related part of the diagram.
- The lecture **does not resume until the student confirms** ("Yes, clear"). "Still unclear" keeps the chat open for follow-ups. "Never mind" resumes without an answer.
- On resume, the doubt sheet is wiped and Brofessor restarts the current step's narration with a short bridge ("Okay, back to the lesson").
- The chat history stays for the whole class (doubt count shown on the button); later it feeds the end-of-class summary and quiz.
- Backend (Phase 6): the doubt + current step + Board DSL so far go to the LLM, which returns a chat answer and a mini Board DSL for the doubt sheet. The demo uses pre-scripted doubts and says so for anything else.
- Why: a real class lets you stop the teacher. Typing keeps doubts precise, works in a hostel/library, and leaves a written record to revise from.

## D-013: Voice from pre-generated neural TTS, browser voice only as fallback
- The browser's speech engine sounds robotic, especially for Hinglish. Lesson narration is now generated ahead of time with a neural TTS and stored per step (`audio/<lang>/<key>.mp3`); the player plays those files and pauses/stops them for doubts.
- Candidate: Sarvam Bulbul v4-flash with code-mixed "enhi" personas for Hinglish, Bulbul v3 for English. Final pick after the bake-off in `docs/research/voice.md` (also ElevenLabs, Google, Azure, Smallest AI, open-source Indic Parler-TTS / IndicF5).
- Generation script: `playground/tts/generate_sarvam.py` (reads `digestive-script.json`, needs `SARVAM_API_KEY`).
- In the product the backend generates and caches audio per step, so a lesson is paid for once and replayed for free.
- Doubts are text-only (D-012), so they don't need TTS.

## D-014: Player v3: the board feels live, doubts are pointable
- **Pen cursor:** a marker follows the tip of whatever is being drawn or written.
- **Single-line handwriting:** board text is drawn stroke by stroke with the Hershey Simplex (futural) single-line font, slightly slanted and jittered so it reads like marker print. Characters the font lacks (e.g. Devanagari typed in a doubt) fall back to the Kalam font with a reveal.
- **Camera follow:** the view zooms and pans after the pen. Always on for small screens, toggleable on desktop.
- **Board pages:** a full board is wiped and a new page starts (the recap is now page 2, a flow chart of the food path with helper organs). Old pages stay viewable from tabs; viewing an old page pauses the lesson.
- **Point & ask:** every drawn organ is clickable; it opens the doubt chat about that organ with matching suggestions.
- **Doubt pins + recap:** each doubt adds a pin on the timeline step where it was asked; the end screen lists them.
- **Doubt sheet** slides in like a fresh page instead of fading over the notes.
- **Timeline:** segmented progress bar with per-step fill and hover titles; click to jump.
- **Karaoke captions:** the current word is highlighted (speech boundary events, audio time, or a time estimate).
- **Transcript panel** with click-to-jump; **captions toggle**.
- **Start screen:** lesson outline + level (Basics / Standard / Quick revision sets the pace). **End screen:** quick 3-question check, doubts recap, replay, save notes as PDF (print), transcript.
- **Polish:** press feedback on controls, message enter animation, swipe-down to close sheets on mobile, hand-drawn icon set and marker-drawn logo (replacing generic icons), reduced-motion draws instantly.

## D-015: (next decision)
