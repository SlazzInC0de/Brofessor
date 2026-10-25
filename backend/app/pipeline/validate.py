"""
Semantic checks the schema cannot express. These are the mistakes LLMs actually make:
references to things that were never drawn, duplicate ids, a tree_add whose parent is missing,
automaton transitions to unknown states, quiz answers out of range...
Returns human-readable errors that are fed back to the model in the repair loop.
"""
from __future__ import annotations
import re
from dataclasses import dataclass, field
from app.dsl.schema import GENERATABLE, Lesson, Step

REGIONS = {"classic": {"title", "main", "side"}, "figure-center": {"left", "main", "right"}}


@dataclass
class Registry:
    """What exists on the board so far: element id -> its addressable parts."""
    parts: dict[str, set[str]] = field(default_factory=dict)
    any_part: set[str] = field(default_factory=set)      # elements whose parts can't be enumerated statically (turtle vertices)

    def describe(self) -> str:
        if not self.parts:
            return "(nothing drawn yet)"
        out = []
        for k, v in self.parts.items():
            if k in self.any_part:
                out.append(f"{k} (parts: v0, v1, ... vertices)")
            elif v:
                shown = sorted(v, key=lambda s: (len(s), s))[:24]
                out.append(f"{k} (parts: {', '.join(shown)}{' ...' if len(v) > 24 else ''})")
            else:
                out.append(k)
        return "; ".join(out)


def _ref_ok(reg: Registry, ref) -> str | None:
    if isinstance(ref, (list, tuple)):
        return None
    eid, _, part = ref.partition(".")
    if eid not in reg.parts:
        return f'reference "{ref}": no element with id "{eid}" has been drawn yet'
    if part and eid not in reg.any_part and part not in reg.parts[eid]:
        known = ", ".join(sorted(reg.parts[eid])[:12]) or "none"
        return f'reference "{ref}": "{eid}" has no part "{part}" (known parts: {known})'
    if part and eid in reg.any_part and not re.fullmatch(r"v\d+", part):
        return f'reference "{ref}": turtle parts are v0, v1, ...'
    return None


def check_step(step: Step, reg: Registry, layout: str, generated: bool = True) -> list[str]:
    """Validate one step against the registry and update the registry with what it draws."""
    errs: list[str] = []
    allowed_regions = REGIONS.get(layout, set())
    for i, a in enumerate(step.actions):
        where = f"step {step.id} action {i} ({a.type})"
        if generated and a.type not in GENERATABLE:
            errs.append(f"{where}: type not allowed for generated lessons"); continue
        region = getattr(a, "region", None)
        if region and region not in allowed_regions and not (region == "title" and layout == "figure-center"):
            errs.append(f"{where}: region \"{region}\" does not exist in layout \"{layout}\" (use {sorted(allowed_regions)})")
        new_id = getattr(a, "id", None)
        if new_id is not None and a.type not in ("tree_add",):
            if "." in new_id:
                errs.append(f'{where}: id "{new_id}" must not contain "."')
            if new_id in reg.parts:
                errs.append(f'{where}: id "{new_id}" is already used')
        t = a.type
        if t in ("arrow",):
            for r in (a.from_, a.to):
                if (e := _ref_ok(reg, r)): errs.append(f"{where}: {e}")
        elif t in ("label", "highlight"):
            if (e := _ref_ok(reg, a.target)): errs.append(f"{where}: {e}")
        elif t == "note_block":
            if a.points_to is not None and (e := _ref_ok(reg, a.points_to)): errs.append(f"{where}: {e}")
            if a.id: reg.parts[a.id] = {"title"}
        elif t == "erase":
            if a.target not in reg.parts: errs.append(f'{where}: cannot erase "{a.target}", it does not exist')
            else: reg.parts.pop(a.target); reg.any_part.discard(a.target)
        elif t in ("write", "bullet", "side_note", "formula"):
            if a.id: reg.parts[a.id] = set()
        elif t == "tree":
            nodes = set(a.nodes)
            if len(nodes) != len(a.nodes): errs.append(f"{where}: duplicate node labels in tree")
            for p, c in a.edges:
                if p not in nodes or c not in nodes: errs.append(f'{where}: edge ["{p}", "{c}"] uses a node not in "nodes"')
            children = {}
            for p, c in a.edges: children.setdefault(p, []).append(c)
            if any(len(v) > 6 for v in children.values()): errs.append(f"{where}: a node has more than 6 children; split the tree")
            reg.parts[a.id] = nodes
        elif t == "tree_add":
            if a.target not in reg.parts: errs.append(f'{where}: tree "{a.target}" does not exist')
            else:
                if a.parent not in reg.parts[a.target]: errs.append(f'{where}: parent "{a.parent}" is not in tree "{a.target}"')
                if a.node in reg.parts[a.target]: errs.append(f'{where}: node "{a.node}" already exists in tree "{a.target}"')
                reg.parts[a.target].add(a.node)
        elif t == "array":
            if len(a.values) > 14: errs.append(f"{where}: arrays longer than 14 cells do not fit; use fewer values")
            reg.parts[a.id] = {str(k) for k in range(len(a.values))}
        elif t == "table":
            if any(len(r) != len(a.headers) for r in a.rows): errs.append(f"{where}: every row must have {len(a.headers)} cells")
            if len(a.rows) > 10: errs.append(f"{where}: more than 10 rows do not fit")
            p = {f"h{c}" for c in range(len(a.headers))}
            for r in range(len(a.rows)):
                p.add(f"r{r}"); p |= {f"r{r}c{c}" for c in range(len(a.headers))}
            reg.parts[a.id] = p
        elif t == "flowchart":
            ids = [n.id for n in a.nodes]
            if len(set(ids)) != len(ids): errs.append(f"{where}: duplicate node ids")
            for e in a.edges:
                if e.from_ not in ids or e.to not in ids: errs.append(f'{where}: edge {e.from_} -> {e.to} uses an unknown node id')
            if len(ids) > 12: errs.append(f"{where}: more than 12 nodes do not fit; simplify")
            reg.parts[a.id] = set(ids)
        elif t == "automaton":
            st = set(a.states)
            if a.start not in st: errs.append(f'{where}: start state "{a.start}" is not in states')
            for s in a.accept:
                if s not in st: errs.append(f'{where}: accept state "{s}" is not in states')
            for tr in a.transitions:
                if tr.from_ not in st or tr.to not in st: errs.append(f"{where}: transition {tr.from_} -> {tr.to} uses an unknown state")
            if len(st) > 8: errs.append(f"{where}: more than 8 states do not fit")
            reg.parts[a.id] = st | {f"{tr.from_}>{tr.to}" for tr in a.transitions}
        elif t == "turtle":
            if not re.search(r"\b(fd|forward|bk|back)\b", a.program, re.I): errs.append(f"{where}: turtle program never moves (use fd/forward)")
            reg.parts[a.id] = set(); reg.any_part.add(a.id)
        elif t == "traced_figure":
            reg.parts[a.id] = set()
        elif t == "figure_part":
            if a.figure not in reg.parts: errs.append(f'{where}: figure "{a.figure}" does not exist')
            else: reg.parts[a.figure].add(a.part)
        elif t == "new_page":
            pass   # references to earlier pages stay valid
    if not step.narration.en.strip():
        errs.append(f"step {step.id}: narration.en is empty")
    if len(step.actions) > 9:
        errs.append(f"step {step.id}: {len(step.actions)} actions; keep it to 9 or fewer (split into two steps)")
    return errs


def check_lesson(lesson: Lesson, generated: bool = True) -> list[str]:
    errs: list[str] = []
    reg = Registry()
    seen = set()
    for s in lesson.steps:
        if s.id in seen: errs.append(f'duplicate step id "{s.id}"')
        seen.add(s.id)
        errs += check_step(s, reg, lesson.layout, generated)
        if "hinglish" in lesson.languages and not s.narration.hi:
            errs.append(f"step {s.id}: lesson offers Hinglish but narration.hi is missing")
    for i, q in enumerate(lesson.quiz or []):
        if not 0 <= q.answer < len(q.options): errs.append(f"quiz {i}: answer index {q.answer} is out of range")
    return errs
