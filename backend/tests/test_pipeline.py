import asyncio, json
from app.llm.provider import ReplayProvider, parse_json
from app.pipeline.generate import generate_lesson
from app.pipeline.validate import check_lesson


def test_parse_json_handles_fences_and_prose():
    assert parse_json('Sure!\n```json\n{"a": 1}\n```') == {"a": 1}
    assert parse_json('blah {"a": {"b": 2}} trailing') == {"a": {"b": 2}}


def test_generate_with_repair_and_events():
    events = []
    async def emit(ev, data): events.append((ev, data))
    p = ReplayProvider()
    lesson, m = asyncio.run(generate_lesson(p, "Binary search tree insertion", "Standard", ["hinglish", "english"], emit))
    assert len(lesson.steps) == 6 and check_lesson(lesson) == []
    assert m.plan_first_try and m.steps_first_try == 5 and m.steps_repaired == 1 and m.steps_salvaged == 0
    # the repair call told the model what was wrong
    repair_msgs = [msgs for _, msgs in p.calls if len(msgs) > 1]
    assert any('"t1.99"' in msgs[-1]["content"] for msgs in repair_msgs)
    assert [e for e, _ in events] == ["plan"] + ["step"] * 6
    assert lesson.quiz and len(lesson.quiz) == 3


def test_salvage_drops_only_bad_actions():
    plan = {"title": "T", "steps": [{"id": "s0", "title": "A", "goal": "g"}, {"id": "s1", "title": "B", "goal": "g"}, {"id": "s2", "title": "C", "goal": "g"}], "quiz": []}
    bad = {"id": "s0", "title": "A", "narration": {"en": "hi"}, "actions": [{"type": "array", "id": "a", "values": [1, 2]}, {"type": "highlight", "target": "nope.1"}]}
    good = {"id": "x", "title": "y", "narration": {"en": "ok"}, "actions": [{"type": "highlight", "target": "a.1"}]}
    p = ReplayProvider(responses=[json.dumps(plan), json.dumps(bad), json.dumps(bad), json.dumps(bad), json.dumps(good), json.dumps(good)])
    lesson, m = asyncio.run(generate_lesson(p, "t"))
    assert m.steps_salvaged == 1 and m.actions_dropped == 1
    assert [a.type for a in lesson.steps[0].actions] == ["array"]
    assert check_lesson(lesson) == []
