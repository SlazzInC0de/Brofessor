# Week 1: Research + DSL v0

About 1.5 to 2 hours a day. Each day has one **deliverable**. When it exists, the day is done.

---

## Day 1: Setup + observe a real teacher
- [ ] `git init`, push the first commit to https://github.com/SlazzInC0de/Brofessor
- [ ] Re-read sections 3 and 4 of the plan PDF
- [ ] Watch one Abdul Bari DSA lecture and one NPTEL TOC lecture (15 to 20 minutes each)
- [ ] Note everything the teacher does on the board: where they write, when they circle, what goes in the side area, when they erase
- [ ] Open `playground/00-digestive-demo.html` and note what feels like a real teacher and what does not
- **Deliverable:** `docs/research/teacher-actions.md` (at least 15 actions)

## Day 2: Study existing products
- [ ] **Solvely.ai (main reference):** complete the homework section in `docs/research/solvely-reference.md`
- [ ] **NotebookLM:** generate one Video Overview (Whiteboard style) from a PDF of yours and compare it with Brofessor's goals
- [ ] ChatTutor (github.com/HugeCatLab/ChatTutor): README, demo, folder structure. AGPL licensed, so do not copy code
- [ ] SketchTeach (lablab.ai) and Dudely demos
- [ ] For each: what works, what is missing, how Brofessor differs
- **Deliverable:** `docs/research/competitors.md`

## Day 3: SVG stroke animation basics
- [ ] Search: "SVG line drawing animation stroke-dashoffset"
- [ ] `playground/01-stroke.html`: animate a line, a circle and a curve being drawn (plain HTML + CSS/JS, no library)
- [ ] Understand what `getTotalLength()` does
- **Deliverable:** `playground/01-stroke.html` with three shapes drawn one after another

## Day 4: Hand-drawn look
- [ ] Read the rough.js docs; build a rough rectangle, circle and arrow in `playground/02-rough.html`
- [ ] Run a perfect-freehand example (`playground/03-freehand.html`)
- [ ] Try animating rough.js SVG output with the Day 3 technique
- **Deliverable:** a sketchy circle and arrow that appear to be drawn

## Day 5: Handwritten text (most important experiment)
- [ ] Download **Kalam** (supports Devanagari) or Caveat from Google Fonts
- [ ] Convert a word into an SVG path with opentype.js
- [ ] Animate the path's stroke so it looks like it is being written
- [ ] Note: font glyphs are outlines (hollow), so stroke animation draws the outline. Judge how it looks and research "single-line fonts" / "Hershey fonts" as an alternative
- [ ] Compare with the clip-reveal approach used in the demo
- **Deliverable:** `playground/04-handwriting.html` writing "Binary Search Tree"

## Day 6: Maths + auto layout + tracing
- [ ] Get SVG output for `E = mc^2` and a fraction from KaTeX/MathJax (MathJax SVG output gives real paths)
- [ ] Lay out a 5-node graph with dagre (or elkjs) and draw circles + lines in SVG
- [ ] Read `playground/trace/` and run it on one figure from your own course PDF
- **Deliverable:** `playground/05-math-layout.html` + one traced figure of your own

## Day 7: Write DSL v0
- [ ] Fill every TODO in `docs/dsl-v0.md` (use the Day 1 teacher actions)
- [ ] Hand-write two more lectures in `samples/`: one DFA (TOC) and one of your choice (maths or DBMS)
- [ ] Week review in `docs/log.md`; confirm or change D-002 (SVG vs Canvas)
- **Deliverable:** DSL v0 final + 3 sample lectures

---

After Week 1: Phase 1 (Renderer MVP). Set up Next.js and turn the playground experiments into proper components.
