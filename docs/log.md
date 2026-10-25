# Daily Log

Format: three lines a day. Done / Blocked on / Next.

---

## Day 1 (21 Oct 2026)
- Done: Project kickoff, repo structure, product references (Solvely, NotebookLM), first tracing demo (`playground/00-digestive-demo.html`).
- Blocked on:
- Next:

## Day 2 (22 Oct 2026)
- Done: Player UI redesign (classroom wall, aluminium frame, marker-tray controls, clickable chapters). Doubt interruption via chat with board sketches; class resumes only after the doubt is cleared (D-012). Figure-understanding research plan. Voice: player plays pre-generated neural TTS files (Sarvam script + bake-off plan, D-013). UX review fixes: chat close, chapter fades, caption bar, mobile bottom sheet, contrast, segmented language switch.
- Blocked on:
- Next:
- UI v2 (clean modern app, 3-marker board) after v1 was rejected; free neural voice path (Edge voices) added.

## Day 3 (22 Oct 2026)
- Done: Player v3 (D-014): pen cursor, single-line handwriting (futural), camera follow, board pages + recap flow chart, point & ask, doubt pins, sliding doubt sheet, timeline, karaoke captions, transcript, start/end screens, hand-drawn icons and logo, captions toggle, reduced motion.
- Hinglish limited to class narration; UI and doubt chat always English (D-015).
- Blocked on: real neural voice files (needs `generate_edge.py` or a Sarvam key run locally).
- Next:
- Phase 1-2 done (D-016): Next.js player in `frontend/`, Board DSL v1 with Zod validation, layout engine with auto pages, templates (tree, array, table, flowchart, automaton, turtle, traced figure), 4 sample lessons, all verified end to end.

## Day 4 (25-26 Oct 2026)
- Done: Phase 3 (D-018). FastAPI backend: Pydantic DSL mirror, semantic validator, planner + step writer prompts with few-shot samples, repair loop, salvage, providers (Gemini, OpenAI-compatible, replay), SSE endpoint, disk cache, rate limit. Eval harness with 30 topics and a markdown report. Frontend: "What do you want to learn?" form, live streaming into the player (start after the first step, waiting state), recently generated list. 17 backend tests; end-to-end verified offline with the replay provider.
- Blocked on: real eval numbers need an API key run locally.
- Next: run the eval with a real model, tune prompts from the report, then Phase 4 (voice per step).
- UI: scrapbook layer on home, start and end screens; hand-drawn headings in the board's own handwriting; Plex Sans + Kalam (D-019).
