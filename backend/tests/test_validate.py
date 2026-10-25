import json
from pathlib import Path
import pytest
from app.dsl.schema import Lesson, Step
from app.pipeline.validate import Registry, check_lesson, check_step

SAMPLES = Path(__file__).parents[2] / "frontend" / "public" / "lessons"


@pytest.mark.parametrize("name", ["bst-insertion", "dfa-even-zeros", "polygon-angles", "digestive-system"])
def test_hand_written_samples_are_semantically_valid(name):
    lesson = Lesson.model_validate(json.loads((SAMPLES / f"{name}.json").read_text(encoding="utf-8")))
    assert check_lesson(lesson, generated=False) == []


def step(actions, sid="s1"):
    return Step.model_validate({"id": sid, "title": "t", "narration": {"en": "x"}, "actions": actions})


def test_reference_to_undrawn_element():
    errs = check_step(step([{"type": "highlight", "target": "t1.50"}]), Registry(), "classic")
    assert any('no element with id "t1"' in e for e in errs)


def test_reference_to_missing_part_and_tree_add():
    reg = Registry()
    assert check_step(step([{"type": "tree", "id": "t1", "nodes": ["5", "3"], "edges": [["5", "3"]]}]), reg, "classic") == []
    errs = check_step(step([{"type": "arrow", "from": "t1.5", "to": "t1.9"}, {"type": "tree_add", "target": "t1", "node": "4", "parent": "7", "side": "left"}]), reg, "classic")
    assert any('no part "9"' in e for e in errs) and any('parent "7"' in e for e in errs)


def test_automaton_and_table_rules():
    errs = check_step(step([
        {"type": "automaton", "id": "A", "states": ["q0"], "start": "q9", "accept": ["q0"], "transitions": [{"from": "q0", "to": "q1", "label": "a"}]},
        {"type": "table", "id": "T", "headers": ["a", "b"], "rows": [["1"]]},
    ]), Registry(), "classic")
    assert any("start state" in e for e in errs) and any("unknown state" in e for e in errs) and any("2 cells" in e for e in errs)


def test_wrong_region_and_forbidden_type():
    errs = check_step(step([{"type": "write", "text": "x", "region": "left"}, {"type": "traced_figure", "id": "f", "src": "x"}]), Registry(), "classic")
    assert any("does not exist in layout" in e for e in errs) and any("not allowed" in e for e in errs)


def test_duplicate_ids_and_erase():
    reg = Registry()
    check_step(step([{"type": "array", "id": "a", "values": [1, 2]}]), reg, "classic")
    errs = check_step(step([{"type": "array", "id": "a", "values": [3]}, {"type": "erase", "target": "zz"}]), reg, "classic")
    assert any("already used" in e for e in errs) and any('cannot erase "zz"' in e for e in errs)
