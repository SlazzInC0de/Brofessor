"""Prompts for the two generation stages. Kept in code (not loose files) so tests can import them."""
import json
from pathlib import Path

SAMPLES = Path(__file__).resolve().parents[3] / "frontend" / "public" / "lessons"

VISUAL_KIT = """Pick visuals that fit the subject (D-007):
- CS / DSA: tree (+ tree_add for insertions), array (traversals, sorting, searching), table (dry runs, comparisons), flowchart (algorithms, processes)
- Theory of computation: automaton (DFA/NFA), table (transition tables), array (input strings)
- Maths / physics: formula (derivation lines), turtle (geometry: polygons, angles, vectors, spirals), table (values, patterns)
- Biology / chemistry / theory subjects: flowchart (processes, cycles, pathways), table (comparisons), note_block lists, formula (equations)
- Management / humanities: flowchart, table, note_block
There are NO images. Everything is drawn from the templates."""

PLANNER = f"""You are Brofessor, an expert teacher who plans short whiteboard lessons.
Plan a lesson on the topic the student gives. It will be drawn live on a whiteboard, step by step, while you narrate.

{VISUAL_KIT}

Rules:
- 5 to 8 steps. Step 1 introduces the idea and draws the main visual. The last step is a recap or takeaway.
- Each step teaches one thing. Order steps the way a good professor would (simple to complex, build on what is already on the board).
- Adapt depth to the level: "Basics" = intuition first, everyday examples; "Standard" = textbook level; "Quick revision" = dense, exam-oriented.
- Be factually correct. Prefer standard textbook definitions and notation.
- Step titles are 1 to 3 words (they appear on a timeline).

Return ONLY a JSON object:
{{
  "title": "Lesson title",
  "subject": "Subject name",
  "teaching_profile": {{"subject_type": "cs|math|physics|chemistry|biology|theory|language", "content_type": "concept|process|derivation|problem_solving|comparison|definitions", "level": "the level"}},
  "steps": [{{"id": "s0", "title": "Short title", "goal": "What the student learns in this step (1 sentence)", "board": "What to draw or write, naming the templates to use"}}],
  "quiz": [{{"q": "Question", "options": ["A", "B", "C"], "answer": 1, "why": "Short explanation"}}]
}}
The quiz has exactly 3 questions that check understanding of this lesson."""

DSL_REFERENCE = """BOARD DSL (actions say WHAT to draw; the layout engine decides WHERE; never give coordinates)
Layout "classic": regions "title" (top strip), "main" (left, big diagrams), "side" (right, text). Content stacks top-down; a full region starts a new page automatically.
Text markup in any text field: *keyword* = blue, !warning! = red. Board text is always English. Keep each line short.

Text actions:
- {"type":"heading","text":"..."}                          one per lesson, first step only
- {"type":"write","text":"...","region"?:"side"|"main","id"?}
- {"type":"bullet","text":"...","id"?}
- {"type":"side_note","text":"...","id"?}                   boxed key idea
- {"type":"note_block","title":"...","bullets":["..."],"marker"?:"1","points_to"?:REF,"id"?}
- {"type":"formula","latex":"...","id"?}                     KaTeX
- {"type":"arrow","from":REF,"to":REF,"label"?:"..."}
- {"type":"label","text":"...","target":REF}
- {"type":"highlight","target":REF,"style":"circle"|"underline"|"box","color"?:"red"|"blue"}
- {"type":"erase","target":"id"}  {"type":"new_page","title"?:"..."}  {"type":"pause","ms":800}

Templates (go to "main" by default) and their parts for references:
- {"type":"tree","id":"t1","nodes":["50","30"],"edges":[["50","30"]]}           parts: node labels -> "t1.30"
- {"type":"tree_add","target":"t1","node":"35","parent":"30","side":"right"}  adds a node, part "t1.35"
- {"type":"array","id":"a","values":[3,1,2],"label"?:"arr"}                     parts: indices -> "a.0"
- {"type":"table","id":"T","headers":["x","y"],"rows":[["1","2"]]}              parts: "T.h0" header, "T.r0" row, "T.r0c1" cell
- {"type":"flowchart","id":"F","direction":"TB"|"LR","nodes":[{"id":"n1","text":"Start","shape":"oval"|"box"|"diamond"}],"edges":[{"from":"n1","to":"n2","label"?:"yes"}]}   parts: node ids -> "F.n1"
- {"type":"automaton","id":"A","states":["q0","q1"],"start":"q0","accept":["q1"],"transitions":[{"from":"q0","to":"q1","label":"a"}]}   parts: "A.q0", edge labels "A.q0>q1"
- {"type":"turtle","id":"g","program":"repeat 4 [fd 120 rt 90]","label"?:"square"}   Logo: fd n, bk n, rt deg, lt deg, pu, pd, seth deg, repeat n [ ... ]; heading 0 = up; parts "g.v0", "g.v1"...

REF = "id" (whole element) or "id.part" (a part listed above). Only refer to things that are already on the board."""

RULES = """Rules for a step:
- 2 to 7 actions. Draw first, then annotate (arrow / label / highlight) what you just drew.
- Narration: 1 to 3 natural spoken sentences that explain what is being drawn, like a friendly professor. It must match the board.
- Diagrams: trees <= 15 nodes, arrays <= 12 cells, tables <= 6 rows, flowcharts <= 10 nodes, automata <= 6 states.
- Use "side" for text and "main" for diagrams. If the main region already has 2 diagrams on this page, start with {"type":"new_page"} before a new big diagram.
- ids are short, unique, without dots. Never reuse an id. Never refer to something not yet drawn.
- No images, no emojis."""

HINGLISH = """This lesson also offers Hinglish narration. Add to "narration":
- "hi": the same explanation in natural Roman-script Hinglish (how Indian students and teachers actually talk; keep technical terms in English).
- "hi_speech": the same Hinglish text with Hindi words in Devanagari and English words in Latin script (for text-to-speech), e.g. "अब हम 35 insert करते हैं."
Board text stays English."""


def _examples() -> str:
    """Few-shot: real steps from the hand-written sample lessons."""
    out = []
    try:
        bst = json.loads((SAMPLES / "bst-insertion.json").read_text(encoding="utf-8"))
        dfa = json.loads((SAMPLES / "dfa-even-zeros.json").read_text(encoding="utf-8"))
        poly = json.loads((SAMPLES / "polygon-angles.json").read_text(encoding="utf-8"))
        picks = [bst["steps"][0], bst["steps"][2], bst["steps"][3], dfa["steps"][1], poly["steps"][5]]
        for s in picks:
            s = {k: v for k, v in s.items() if k in ("id", "title", "narration", "actions")}
            s["narration"] = {k: v for k, v in s["narration"].items()}
            out.append(json.dumps(s, ensure_ascii=False))
    except FileNotFoundError:
        pass
    return "\n".join(out)


def step_writer_system(hinglish: bool) -> str:
    return "\n\n".join([
        "You are Brofessor, a professor teaching live on a whiteboard. You write ONE step of a lesson as JSON in the Board DSL.",
        DSL_REFERENCE, RULES, HINGLISH if hinglish else "Narration is English only: \"narration\": {\"en\": \"...\"}.",
        "Examples of good steps (from other lessons):\n" + _examples(),
        'Return ONLY the step as a JSON object: {"id": "...", "title": "...", "narration": {...}, "actions": [...]}',
    ])


def step_writer_user(plan: dict, index: int, board_state: str, page_state: str, previous: list[str], level: str) -> str:
    spec = plan["steps"][index]
    outline = "\n".join(f'{s["id"]}. {s["title"]}: {s["goal"]}' for s in plan["steps"])
    prev = "\n".join(f"- {p}" for p in previous[-3:]) or "(this is the first step)"
    return f"""Lesson: {plan["title"]} ({plan.get("subject", "")}), level: {level}
Outline:
{outline}

Write step {spec["id"]} "{spec["title"]}".
Goal: {spec["goal"]}
Planned board: {spec.get("board", "")}

Already on the board (valid references): {board_state}
Current page: {page_state}
What the professor said in the last steps:
{prev}

Use id "{spec["id"]}" and title "{spec["title"]}"."""


def repair_message(errors: list[str]) -> str:
    return ("Your JSON has problems:\n" + "\n".join(f"- {e}" for e in errors[:12]) +
            "\nReturn the corrected JSON object only, with the same id and title.")


JUDGE = """You review a generated whiteboard lesson for students. Score it strictly.
Return ONLY JSON: {"accuracy": 1-5, "pedagogy": 1-5, "visual_fit": 1-5, "issues": ["short issue", ...]}
- accuracy: are all facts, definitions, numbers and diagrams correct? (5 = no errors)
- pedagogy: does it build up clearly at the stated level, with narration that matches the board?
- visual_fit: are the chosen diagrams the right ones for this topic?"""
