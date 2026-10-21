# frontend

Set up in Phase 1 (Week 2).

```bash
npx create-next-app@latest . --typescript --tailwind --app
```

Planned structure:
```
board/
  renderer/    SVG drawing + animation engine
  primitives/  write, arrow, circle, highlight...
  templates/   tree, automaton, flowchart, table, traced_figure...
  layout/      region manager, auto-layout
  player/      timeline, play/pause, audio sync
dsl/schema.ts  Zod schema (matches the backend Pydantic schema)
```
