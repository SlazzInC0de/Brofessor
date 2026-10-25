# frontend

The Brofessor player: a Next.js app that renders **Board DSL** lessons on a whiteboard, stroke by stroke, with narration.

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
npm run validate     # check every lesson in public/lessons against the DSL schema
npm run typecheck
npm run build        # static export to out/  (npm start serves it)
```

## How it works
```
public/lessons/<id>.json  ──► Lesson.parse (Zod)  ──► Player ──► Board ──► SVG
                                                   │          ├─ Layout (regions, auto new page)
                                                   │          ├─ actions + templates
                                                   │          ├─ Pen (marker cursor), Camera (follow)
                                                   │          └─ Clock (pause / skip / jump)
                                                   └─ Narrator (audio file or browser voice, karaoke progress)
```

## Structure
```
app/
  page.tsx              home: "What do you want to learn?" form, recently generated, samples
  lesson/page.tsx       player page: /lesson/?id=<sample> | ?topic=<topic> (live generation) | ?gen=<cached id>
  globals.css
src/
  dsl/schema.ts         Board DSL v1 (Zod). Spec: docs/dsl.md
  board/
    engine/
      board.ts          pages, registry of drawn things, reference resolution
      actions.ts        dispatcher + text primitives (heading, write, bullet, side_note, note_block, formula, arrow, label, highlight, erase)
      draw.ts           strokes, animated paths, single-line handwriting (Hershey futural)
      clock.ts          pausable / skippable animation clock
      pen.ts, camera.ts marker cursor, follow camera
      narration.ts      audio files or best browser voice
      player.ts         step loop, jump, skip, state for the UI
      palette.ts        ink / blue / red markers, *rich* !text! parser
    layout/regions.ts   region presets (classic, figure-center) and space allocation
    templates/          tree, array, table, flowchart, automaton, turtle, traced figure
    fonts/futural.json  Hershey Simplex glyphs
  components/
    LessonPlayer.tsx    top bar, board, captions, controls, transcript, start/end screens; streams generated steps (SSE)
  lib/api.ts            backend URL (NEXT_PUBLIC_API_URL, default http://localhost:8000)
    Icons.tsx           hand-drawn icon set
public/lessons/         lesson JSON + assets (traced figures)
scripts/validate-lessons.ts
```

## Adding a lesson
1. Write `public/lessons/<id>.json` (see `docs/dsl.md`; copy one of the samples).
2. Add it to `public/lessons/index.json`.
3. `npm run validate`, then open `/lesson/?id=<id>`.

Optional narration audio: `public/audio/<lesson-id>/<english|hinglish>/<step-id>.mp3` (generate with `playground/tts`). Without files the player uses the best browser voice.
