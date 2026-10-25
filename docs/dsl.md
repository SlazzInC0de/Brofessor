# Board DSL v1

The format every lesson is written in. The LLM writes it (Phase 3, D-018); the samples in `frontend/public/lessons/` are hand-written. Source of truth: `frontend/src/dsl/schema.ts` (Zod), mirrored in `backend/app/dsl/schema.py` (Pydantic; a test keeps them in sync). Validate with `npm run validate`.

**Rule (D-001): actions say what to draw. The layout engine decides where.** Nothing in the DSL needs coordinates, except optional raw points in references.

## Lesson
```json
{
  "id": "bst-insertion",
  "title": "Binary Search Tree: Insertion",
  "subject": "Data Structures",
  "layout": "classic",                    // or "figure-center"
  "languages": ["hinglish", "english"],   // narration languages available (D-015)
  "credit": "optional attribution shown under the board",
  "teaching_profile": { "subject_type": "cs", "content_type": "process", "level": "college" },
  "steps": [ Step ],
  "quiz": [ { "q": "...", "options": ["a", "b"], "answer": 1, "why": "..." } ]
}
```

## Step
```json
{
  "id": "s2",
  "title": "Compare",                      // shown on the timeline
  "speaker": "prof",                       // "student" reserved for Bro Mode (D-005)
  "narration": { "en": "...", "hi": "Roman Hinglish", "hi_speech": "Devanagari + English for TTS" },
  "actions": [ Action ]
}
```

## Regions
| Preset | Regions | Use for |
|---|---|---|
| `classic` | `title` (top strip), `main` (left, diagrams), `side` (right, text) | most lessons |
| `figure-center` | `left` (notes), `main` (figure), `right` (title + notes) | a big figure explained from both sides |

Content stacks top-down in its region. When a region is full the board is wiped and a new page starts (old pages stay viewable from tabs). Missing regions fall back sensibly (`title` → `right` → `side`).

## Text markup
Any text field: `*keyword*` is written in blue, `!warning!` in red. Long text wraps to the region width.

## Actions
| type | fields | notes |
|---|---|---|
| `heading` | text, region? | underlined title (default region `title`) |
| `write` | text, region?, size?, id? | wrapped paragraph (default region `side`) |
| `bullet` | text, region?, id? | |
| `side_note` | text, id? | boxed note in `side` |
| `note_block` | marker?, title, bullets[], region?, points_to?, id? | numbered/lettered block; `points_to` draws a pointer arrow |
| `formula` | latex, region?, size?, id? | KaTeX |
| `arrow` | from, to, label? | between references |
| `label` | text, target, side? | leader line to a part; auto side, never overlaps other labels; `\n` for two lines |
| `highlight` | target, style (circle / underline / box), color? | |
| `erase` | target | removes a drawn element |
| `new_page` | title? | explicit page break |
| `pause` | ms | |

### Smart templates
| type | fields | parts (for references) |
|---|---|---|
| `tree` | id, nodes[], edges[[parent, child]] | `t1.50` = node 50. Binary trees use the BST layout |
| `tree_add` | target, node, parent, side | grows a tree without moving existing nodes |
| `array` | id, values[], label? | `a.2` = index 2 |
| `table` | id, headers[], rows[][] | `T.h1` header, `T.r0` row, `T.r0c1` cell |
| `flowchart` | id, nodes[{id, text, shape: box/diamond/oval}], edges[{from, to, label?}], direction TB/LR | node ids |
| `automaton` | id, states[], start, accept[], transitions[{from, to, label}] | `A.q0` state, `A.q0>q1` edge label |
| `turtle` | id, program (Logo), label?, size? | `hex.v3` vertex 3. Commands: fd, bk, rt, lt, pu, pd, seth, home, repeat n [ ] |
| `traced_figure` | id, src, outline? | figure from the tracing pipeline (D-010) |
| `figure_part` | figure, part, label?, detail? | draws one part, optional auto-placed label; `fig.stomach` |

`traced_figure` and `figure_part` are not offered to the LLM yet: they need a traced asset (Phase 5). Every other action can be generated.

## References
`"t1"` the whole element, `"t1.50"` a part, or `[x, y]` raw board coordinates (board is 1600 × 1000).
