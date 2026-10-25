"""Every hand-written sample lesson must validate in Python too (the frontend validates with Zod)."""
import json
from pathlib import Path
import pytest
from app.dsl.schema import Lesson, dump

LESSONS = sorted((Path(__file__).parents[2] / "frontend" / "public" / "lessons").glob("*.json"))
LESSONS = [p for p in LESSONS if p.name != "index.json"]


@pytest.mark.parametrize("path", LESSONS, ids=lambda p: p.name)
def test_sample_lessons_validate(path):
    lesson = Lesson.model_validate(json.loads(path.read_text(encoding="utf-8")))
    assert lesson.steps
    # round trip keeps the DSL field names
    again = Lesson.model_validate(dump(lesson))
    assert dump(again) == dump(lesson)
