> Superseded by `docs/dsl.md` (Board DSL v1, implemented in `frontend/src/dsl/schema.ts`). Kept for history.

# Board DSL v0 (draft)

Brofessor's own lecture format. The LLM writes it, the renderer plays it. Complete by Day 7.

---

## 1. Lecture
```json
{
  "title": "string",
  "language": "english | hinglish",
  "board": { "theme": "whiteboard | blackboard" },
  "teaching_profile": TeachingProfile,
  "steps": [ Step ]
}
```

## 1b. Teaching Profile (D-007)
Produced by the Material Analyzer; the user can override it.
```json
{
  "subject_type": "math | cs | physics | chemistry | biology | theory | language",
  "content_type": "problem_solving | concept | derivation | process | comparison | definitions | anatomy",
  "level": "school | college | advanced",
  "length": { "lectures": 3, "minutes_each": 8 },
  "visual_kit": ["tree", "automaton", "table"],
  "pace": "slow | normal | fast",
  "mode": "class | bro"
}
```
TODO: write the default `visual_kit` and teaching pattern for each `subject_type` (e.g. math = problem -> given -> formula -> steps -> answer box).

## 2. Step
```json
{
  "id": "s1",
  "speaker": "prof | student",
  "narration_display": "text shown on screen",
  "narration_speech": "text sent to TTS (Hinglish: Devanagari + English)",
  "source": { "page": 4 },
  "actions": [ Action ]
}
```
- `speaker` defaults to `prof` (Bro Mode uses `student`, see D-005)
- `source` is optional; set when the step comes from uploaded material (D-009)

TODO: should a step have a maximum number of actions? How many?

## 3. Board regions
TODO: decide how the board is divided. Suggestion (matches the digestive demo):
- `title`: top strip
- `main`: centre, the diagram
- `notes_left`, `notes_right`: numbered note blocks with arrows into the diagram
Use the Day 1 teacher observations to decide.

## 4. Actions (primitives)
Every action has a `type` and an optional `id` (so it can be referenced later).

| type | fields | example |
|---|---|---|
| heading | text | `{ "type": "heading", "text": "BST" }` |
| write | text, region? | TODO |
| side_note | text | TODO |
| note_block | number, title, bullets, points_to? | numbered block like the demo's "3 Stomach" |
| formula | latex | TODO |
| arrow | from, to, label? | TODO |
| label | text, target | short label + leader arrow to a part |
| highlight | target, style (circle/underline/box) | TODO |
| erase | target | TODO |
| TODO | | |

## 5. Templates (smart diagrams)
| type | fields | notes |
|---|---|---|
| tree | nodes, edges | first node is the root |
| automaton | states, start, accept, transitions | TODO |
| array | values | TODO |
| table | headers, rows | TODO |
| flowchart | TODO | |
| traced_figure | source, parts[], detail | figure traced from material (D-010) |

`traced_figure` part:
```json
{ "id": "stomach", "label": "stomach", "color": "red", "detail": "none | key | full" }
```
`detail` defaults to `none` (outline only, D-008).

## 5b. Doubts (D-012)
A doubt answer is a mini lecture drawn on a temporary doubt sheet, returned by the backend.
```json
{
  "doubt": "Why doesn't HCl burn the stomach?",
  "at_step": "s3",
  "chat_answer": "text shown in the chat",
  "highlight": "fig1.stomach",
  "sheet_actions": [ Action ],
  "follow_ups": ["What is an ulcer?"]
}
```
TODO: should doubts that are covered later in the lesson be answered now, or bookmarked ("we'll get there in 2 steps")?

## 6. References
How to refer to part of an element. Current idea: `"t1.50"` = node `50` of tree `t1`, `"fig1.stomach"` = part `stomach` of traced figure `fig1`.
TODO: is this format good enough?

## 7. Open questions
- TODO: what happens when the board is full? (auto erase / new board / scroll)
- TODO: does the LLM choose colours, or do fixed rules apply (e.g. highlights always red, one colour per part)?
- TODO: how is step timing decided (from audio duration)?
