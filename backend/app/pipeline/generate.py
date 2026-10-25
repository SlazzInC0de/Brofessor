"""
Topic -> lesson. Two LLM stages with validation and self-repair:

  1. plan   : outline of 5-8 steps + quiz            (validated with Pydantic, repaired if needed)
  2. steps  : each step written as Board DSL, given what is already on the board
              -> schema check (Pydantic) + semantic check (references, ids, template rules)
              -> on errors, the model gets the error list and fixes its JSON (up to MAX_REPAIRS)
              -> if it still fails, invalid actions are dropped (salvage) so a lesson always completes

Each step is emitted as soon as it is valid, so the player can start teaching while later steps are written.
"""
from __future__ import annotations
import copy, hashlib, json, re, time
from dataclasses import dataclass, field, asdict
from typing import Awaitable, Callable, Literal, Optional
from pydantic import BaseModel, Field, ValidationError
from app import config
from app.dsl.schema import Lesson, Step, QuizItem, TeachingProfile, dump
from app.llm import prompts
from app.llm.provider import Provider, parse_json, Completion
from app.pipeline.validate import Registry, check_step, check_lesson

Level = Literal["Basics", "Standard", "Quick revision"]


class PlanStep(BaseModel):
    id: str; title: str; goal: str; board: str = ""


class Plan(BaseModel):
    title: str
    subject: Optional[str] = None
    teaching_profile: Optional[TeachingProfile] = None
    steps: list[PlanStep] = Field(min_length=3, max_length=10)
    quiz: list[QuizItem] = []


@dataclass
class CallStat:
    stage: str; attempt: int; ok: bool; input_tokens: int; output_tokens: int; latency_s: float; errors: list[str] = field(default_factory=list)


@dataclass
class Metrics:
    calls: list[CallStat] = field(default_factory=list)
    plan_first_try: bool = False
    steps_total: int = 0
    steps_first_try: int = 0
    steps_repaired: int = 0
    steps_salvaged: int = 0
    actions_dropped: int = 0
    final_errors: list[str] = field(default_factory=list)
    seconds_to_first_step: float = 0.0
    seconds_total: float = 0.0

    @property
    def input_tokens(self): return sum(c.input_tokens for c in self.calls)
    @property
    def output_tokens(self): return sum(c.output_tokens for c in self.calls)

    def to_dict(self):
        d = asdict(self); d["input_tokens"] = self.input_tokens; d["output_tokens"] = self.output_tokens
        d["cost_usd"] = round(self.input_tokens / 1e6 * config.PRICE_IN + self.output_tokens / 1e6 * config.PRICE_OUT, 5)
        return d


Emit = Callable[[str, dict], Awaitable[None]]


async def _noop(event: str, data: dict) -> None:
    return None


def lesson_id(topic: str, level: str, languages: list[str], model: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", topic.lower()).strip("-")[:40] or "lesson"
    h = hashlib.sha1(f"{topic.strip().lower()}|{level}|{','.join(languages)}|{model}".encode()).hexdigest()[:8]
    return f"{slug}-{h}"


def page_state(steps: list[Step]) -> str:
    """Rough fill level of the current page, so the model knows when to start a new one."""
    diagrams = lines = 0
    for s in steps:
        for a in s.actions:
            if a.type == "new_page": diagrams = lines = 0
            elif a.type in ("tree", "array", "table", "flowchart", "automaton", "turtle"): diagrams += 1 if getattr(a, "region", None) != "side" else 0
            elif a.type in ("write", "bullet", "side_note", "formula"): lines += 1 + len(getattr(a, "text", "") or "") // 40
            elif a.type == "note_block": lines += 2 + len(a.bullets)
    return f"main region has {diagrams} diagram(s); side region has about {lines} line(s) of ~24 that fit"


async def _call(provider: Provider, system: str, messages: list[dict], m: Metrics, stage: str, attempt: int) -> Completion:
    c = await provider.complete(system, messages)
    m.calls.append(CallStat(stage, attempt, False, c.input_tokens, c.output_tokens, round(c.latency_s, 3)))
    return c


async def make_plan(provider: Provider, topic: str, level: str, m: Metrics) -> Plan:
    messages = [{"role": "user", "content": f"Topic: {topic}\nLevel: {level}"}]
    for attempt in range(config.MAX_REPAIRS + 1):
        c = await _call(provider, prompts.PLANNER, messages, m, "plan", attempt)
        try:
            plan = Plan.model_validate(parse_json(c.text))
            ids = [s.id for s in plan.steps]
            if len(set(ids)) != len(ids): raise ValueError("step ids must be unique")
            m.calls[-1].ok = True; m.plan_first_try = attempt == 0
            return plan
        except (ValidationError, ValueError, json.JSONDecodeError) as e:
            errs = [str(e)[:600]]
            m.calls[-1].errors = errs
            messages += [{"role": "assistant", "content": c.text}, {"role": "user", "content": prompts.repair_message(errs)}]
    raise RuntimeError("could not produce a valid lesson plan")


def _salvage(raw: dict, spec: PlanStep, reg: Registry, layout: str) -> tuple[Step, int]:
    """Keep only the actions that validate on their own, in order."""
    narration = raw.get("narration") if isinstance(raw.get("narration"), dict) else {"en": spec.goal}
    if not narration.get("en"): narration["en"] = spec.goal
    kept, dropped = [], 0
    trial = copy.deepcopy(reg)
    for a in raw.get("actions", []) if isinstance(raw.get("actions"), list) else []:
        try:
            one = Step.model_validate({"id": spec.id, "title": spec.title, "narration": narration, "actions": [a]})
        except ValidationError:
            dropped += 1; continue
        probe = copy.deepcopy(trial)
        if check_step(one, probe, layout):
            dropped += 1; continue
        trial = probe; kept.append(a)
    if not kept:
        kept = [{"type": "write", "text": spec.goal}]
    return Step.model_validate({"id": spec.id, "title": spec.title, "narration": narration, "actions": kept}), dropped


async def write_step(provider: Provider, plan: Plan, index: int, steps: list[Step], reg: Registry, level: str,
                     hinglish: bool, layout: str, m: Metrics) -> Step:
    spec = plan.steps[index]
    system = prompts.step_writer_system(hinglish)
    previous = [s.narration.en for s in steps]
    user = prompts.step_writer_user(plan.model_dump(), index, reg.describe(), page_state(steps), previous, level)
    messages = [{"role": "user", "content": user}]
    raw: dict = {}
    for attempt in range(config.MAX_REPAIRS + 1):
        c = await _call(provider, system, messages, m, f"step:{spec.id}", attempt)
        errs: list[str]
        try:
            raw = parse_json(c.text)
            raw["id"], raw["title"] = spec.id, spec.title          # keep the plan's ids/titles
            step = Step.model_validate(raw)
            probe = copy.deepcopy(reg)
            errs = check_step(step, probe, layout)
            if hinglish and not (step.narration.hi and step.narration.hi_speech):
                errs.append('narration needs "hi" (Roman Hinglish) and "hi_speech" (Devanagari + English)')
        except json.JSONDecodeError as e:
            errs = [f"not valid JSON: {e}"]
        except ValidationError as e:
            errs = [f"{'.'.join(str(x) for x in er['loc'])}: {er['msg']}" for er in e.errors()[:10]]
        if not errs:
            m.calls[-1].ok = True
            reg.parts, reg.any_part = probe.parts, probe.any_part
            if attempt == 0: m.steps_first_try += 1
            else: m.steps_repaired += 1
            return step
        m.calls[-1].errors = errs
        messages += [{"role": "assistant", "content": c.text}, {"role": "user", "content": prompts.repair_message(errs)}]
    step, dropped = _salvage(raw if isinstance(raw, dict) else {}, spec, reg, layout)
    check_step(step, reg, layout)            # commit what survived
    m.steps_salvaged += 1; m.actions_dropped += dropped
    return step


async def generate_lesson(provider: Provider, topic: str, level: str = "Standard", languages: list[str] | None = None,
                          emit: Emit = _noop) -> tuple[Lesson, Metrics]:
    languages = languages or ["english"]
    hinglish = "hinglish" in languages
    layout = "classic"
    m = Metrics(); t0 = time.perf_counter()
    plan = await make_plan(provider, topic, level, m)
    lid = lesson_id(topic, level, languages, provider.model)
    await emit("plan", {"id": lid, "title": plan.title, "subject": plan.subject, "layout": layout, "languages": languages,
                        "teaching_profile": plan.teaching_profile.model_dump(exclude_none=True) if plan.teaching_profile else None,
                        "steps": [{"id": s.id, "title": s.title} for s in plan.steps]})
    reg, steps = Registry(), []
    for i in range(len(plan.steps)):
        step = await write_step(provider, plan, i, steps, reg, level, hinglish, layout, m)
        steps.append(step)
        if i == 0: m.seconds_to_first_step = round(time.perf_counter() - t0, 2)
        await emit("step", {"index": i, "step": dump(step)})
    m.steps_total = len(steps)
    quiz = [q for q in plan.quiz if 0 <= q.answer < len(q.options)][:3] or None
    lesson = Lesson(id=lid, title=plan.title, subject=plan.subject, layout=layout, languages=languages,
                    teaching_profile=plan.teaching_profile, steps=steps, quiz=quiz)
    m.final_errors = check_lesson(lesson)
    m.seconds_total = round(time.perf_counter() - t0, 2)
    return lesson, m
