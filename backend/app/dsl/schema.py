"""
Board DSL v1 in Pydantic. Mirrors frontend/src/dsl/schema.ts (Zod); tests/test_schema_parity.py
checks every sample lesson against both. Spec: docs/dsl.md.
Rule (D-001): actions say WHAT to draw; the layout engine decides WHERE.
"""
from __future__ import annotations
from typing import Annotated, Literal, Optional, Union
from pydantic import BaseModel, ConfigDict, Field

Ref = Union[str, tuple[float, float]]
Region = Optional[Literal["title", "main", "side", "left", "right"]]


class _A(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Heading(_A):
    type: Literal["heading"]; text: str; region: Region = None
class Write(_A):
    type: Literal["write"]; text: str; region: Region = None; size: Optional[float] = None; id: Optional[str] = None
class Bullet(_A):
    type: Literal["bullet"]; text: str; region: Region = None; id: Optional[str] = None
class SideNote(_A):
    type: Literal["side_note"]; text: str; id: Optional[str] = None
class NoteBlock(_A):
    type: Literal["note_block"]; title: str; bullets: list[str]
    id: Optional[str] = None; region: Region = None; marker: Optional[str] = None; points_to: Optional[Ref] = None
class Formula(_A):
    type: Literal["formula"]; latex: str; region: Region = None; size: Optional[float] = None; id: Optional[str] = None
class Arrow(_A):
    type: Literal["arrow"]; from_: Ref = Field(alias="from"); to: Ref; label: Optional[str] = None
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
class Label(_A):
    type: Literal["label"]; text: str; target: Ref; side: Optional[Literal["left", "right", "auto"]] = None
class Highlight(_A):
    type: Literal["highlight"]; target: Ref; style: Literal["circle", "underline", "box"] = "circle"; color: Optional[str] = None
class Erase(_A):
    type: Literal["erase"]; target: str
class NewPage(_A):
    type: Literal["new_page"]; title: Optional[str] = None
class Pause(_A):
    type: Literal["pause"]; ms: float

# ---- smart templates ----
class Tree(_A):
    type: Literal["tree"]; id: str; nodes: list[str] = Field(min_length=1); edges: list[tuple[str, str]]; region: Region = None
class TreeAdd(_A):
    type: Literal["tree_add"]; target: str; node: str; parent: str; side: Literal["left", "right"]
class ArrayT(_A):
    type: Literal["array"]; id: str; values: list[Union[str, float, int]]; label: Optional[str] = None; region: Region = None
class Table(_A):
    type: Literal["table"]; id: str; headers: list[str]; rows: list[list[Union[str, float, int]]]; region: Region = None
class FlowNode(_A):
    id: str; text: str; shape: Literal["box", "diamond", "oval"] = "box"
class FlowEdge(_A):
    from_: str = Field(alias="from"); to: str; label: Optional[str] = None
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
class Flowchart(_A):
    type: Literal["flowchart"]; id: str; nodes: list[FlowNode]; edges: list[FlowEdge]
    direction: Literal["TB", "LR"] = "TB"; region: Region = None
class Transition(_A):
    from_: str = Field(alias="from"); to: str; label: str
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
class Automaton(_A):
    type: Literal["automaton"]; id: str; states: list[str] = Field(min_length=1); start: str
    accept: list[str] = []; transitions: list[Transition]; region: Region = None
class Turtle(_A):
    type: Literal["turtle"]; id: str; program: str; label: Optional[str] = None; size: Optional[float] = None; region: Region = None
class TracedFigure(_A):
    type: Literal["traced_figure"]; id: str; src: str; outline: bool = True; region: Region = None
class FigurePart(_A):
    type: Literal["figure_part"]; figure: str; part: str; label: Optional[str] = None; detail: Optional[float] = None

Action = Annotated[Union[Heading, Write, Bullet, SideNote, NoteBlock, Formula, Arrow, Label, Highlight, Erase, NewPage, Pause,
                         Tree, TreeAdd, ArrayT, Table, Flowchart, Automaton, Turtle, TracedFigure, FigurePart],
                   Field(discriminator="type")]

# Templates the LLM may use (traced figures need assets from the tracing pipeline, Phase 5)
GENERATABLE = {"heading", "write", "bullet", "side_note", "note_block", "formula", "arrow", "label", "highlight", "erase",
               "new_page", "pause", "tree", "tree_add", "array", "table", "flowchart", "automaton", "turtle"}


class Narration(_A):
    en: str; hi: Optional[str] = None; hi_speech: Optional[str] = None


class Step(_A):
    id: str; title: str; speaker: Literal["prof", "student"] = "prof"; narration: Narration; actions: list[Action]


class TeachingProfile(_A):
    subject_type: Optional[str] = None; content_type: Optional[str] = None; level: Optional[str] = None; pace: Optional[str] = None


class QuizItem(_A):
    q: str; options: list[str] = Field(min_length=2); answer: int; why: Optional[str] = None


class Lesson(_A):
    id: str; title: str; subject: Optional[str] = None
    layout: Literal["classic", "figure-center"] = "classic"
    languages: list[Literal["english", "hinglish"]] = ["english"]
    credit: Optional[str] = None
    teaching_profile: Optional[TeachingProfile] = None
    steps: list[Step] = Field(min_length=1)
    quiz: Optional[list[QuizItem]] = None


def dump(model: BaseModel) -> dict:
    """JSON-ready dict using the DSL's field names ("from", not "from_"), without nulls."""
    return model.model_dump(by_alias=True, exclude_none=True)
