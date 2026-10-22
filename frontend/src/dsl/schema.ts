import { z } from 'zod';

/**
 * Board DSL v1. The LLM (Phase 3) writes this; the player renders it.
 * Rule (D-001): actions say WHAT to draw. The layout engine decides WHERE.
 * Text fields accept inline markup: *keyword* = blue, !warning! = red.
 */

/** A reference to a drawn thing: "t1" (element), "t1.50" (part of it), or raw board coordinates. */
export const Ref = z.union([z.string(), z.tuple([z.number(), z.number()])]);
export const RegionName = z.enum(['title', 'main', 'side', 'left', 'right']);
const region = RegionName.optional();

const Heading = z.object({ type: z.literal('heading'), text: z.string(), region });
const Write = z.object({ type: z.literal('write'), text: z.string(), region, size: z.number().optional(), id: z.string().optional() });
const Bullet = z.object({ type: z.literal('bullet'), text: z.string(), region, id: z.string().optional() });
const SideNote = z.object({ type: z.literal('side_note'), text: z.string(), id: z.string().optional() });
const NoteBlock = z.object({
  type: z.literal('note_block'), id: z.string().optional(), region,
  marker: z.string().optional(),          // "1", "A"...
  title: z.string(), bullets: z.array(z.string()), points_to: Ref.optional(),
});
const Formula = z.object({ type: z.literal('formula'), latex: z.string(), region, size: z.number().optional(), id: z.string().optional() });
const Arrow = z.object({ type: z.literal('arrow'), from: Ref, to: Ref, label: z.string().optional() });
const Label = z.object({ type: z.literal('label'), text: z.string(), target: Ref, side: z.enum(['left', 'right', 'auto']).optional() });
const Highlight = z.object({ type: z.literal('highlight'), target: Ref, style: z.enum(['circle', 'underline', 'box']).default('circle'), color: z.string().optional() });
const Erase = z.object({ type: z.literal('erase'), target: z.string() });
const NewPage = z.object({ type: z.literal('new_page'), title: z.string().optional() });
const Pause = z.object({ type: z.literal('pause'), ms: z.number() });

// ---- smart templates (Phase 2) ----
const Tree = z.object({ type: z.literal('tree'), id: z.string(), nodes: z.array(z.string()).min(1), edges: z.array(z.tuple([z.string(), z.string()])), region });
const TreeAdd = z.object({ type: z.literal('tree_add'), target: z.string(), node: z.string(), parent: z.string(), side: z.enum(['left', 'right']) });
const ArrayT = z.object({ type: z.literal('array'), id: z.string(), values: z.array(z.union([z.string(), z.number()])), label: z.string().optional(), region });
const Table = z.object({ type: z.literal('table'), id: z.string(), headers: z.array(z.string()), rows: z.array(z.array(z.union([z.string(), z.number()]))), region });
const Flowchart = z.object({
  type: z.literal('flowchart'), id: z.string(), region,
  direction: z.enum(['TB', 'LR']).default('TB'),
  nodes: z.array(z.object({ id: z.string(), text: z.string(), shape: z.enum(['box', 'diamond', 'oval']).default('box') })),
  edges: z.array(z.object({ from: z.string(), to: z.string(), label: z.string().optional() })),
});
const Automaton = z.object({
  type: z.literal('automaton'), id: z.string(), region,
  states: z.array(z.string()).min(1), start: z.string(), accept: z.array(z.string()).default([]),
  transitions: z.array(z.object({ from: z.string(), to: z.string(), label: z.string() })),
});
const Turtle = z.object({ type: z.literal('turtle'), id: z.string(), program: z.string(), label: z.string().optional(), size: z.number().optional(), region });
const TracedFigure = z.object({ type: z.literal('traced_figure'), id: z.string(), src: z.string(), outline: z.boolean().default(true), region });
const FigurePart = z.object({ type: z.literal('figure_part'), figure: z.string(), part: z.string(), label: z.string().optional(), detail: z.number().optional() });

export const Action = z.discriminatedUnion('type', [
  Heading, Write, Bullet, SideNote, NoteBlock, Formula, Arrow, Label, Highlight, Erase, NewPage, Pause,
  Tree, TreeAdd, ArrayT, Table, Flowchart, Automaton, Turtle, TracedFigure, FigurePart,
]);

export const Step = z.object({
  id: z.string(),
  title: z.string(),                                   // chapter name on the timeline
  speaker: z.enum(['prof', 'student']).default('prof'),
  narration: z.object({ en: z.string(), hi: z.string().optional(), hi_speech: z.string().optional() }),
  actions: z.array(Action),
});

export const Lesson = z.object({
  id: z.string(),
  title: z.string(),
  subject: z.string().optional(),
  layout: z.enum(['classic', 'figure-center']).default('classic'),
  languages: z.array(z.enum(['english', 'hinglish'])).default(['english']),
  credit: z.string().optional(),
  teaching_profile: z.object({
    subject_type: z.string(), content_type: z.string(), level: z.string(), pace: z.string().optional(),
  }).partial().optional(),
  steps: z.array(Step).min(1),
  quiz: z.array(z.object({ q: z.string(), options: z.array(z.string()).min(2), answer: z.number(), why: z.string().optional() })).optional(),
});

export type LessonT = z.infer<typeof Lesson>;
export type StepT = z.infer<typeof Step>;
export type ActionT = z.infer<typeof Action>;
export type RefT = z.infer<typeof Ref>;
export type ActionOf<K extends ActionT['type']> = Extract<ActionT, { type: K }>;
