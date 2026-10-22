import type { Board, Part } from '../engine/board';
import type { ActionOf } from '@/dsl/schema';
import { el, smoothPath, type Pt } from '../engine/svg';
import { makeStroke, drawStrokes } from '../engine/draw';
import { INK, SOFT } from '../engine/palette';
import { runAction } from '../engine/actions';

/** Output of playground/trace (segment.py + strokes.py). Coordinates are source-image pixels. */
interface FigureData {
  bbox: [number, number, number, number];
  body: Pt[][];
  organs: Record<string, { outline: Pt[][]; detail: Pt[][]; centroid: Pt }>;
}
interface FigState { data: FigureData; T: (p: Pt) => Pt; g: SVGGElement }

/** Fits a traced figure into the region and draws its silhouette. Parts are added with figure_part. */
export async function drawFigure(b: Board, a: ActionOf<'traced_figure'>, token: number) {
  const data = b.assets.get(a.src) as FigureData;
  if (!data) throw new Error(`Figure not preloaded: ${a.src}`);
  const [bx, by, bw, bh] = data.bbox;
  const f = await b.fit(a.region ?? 'main', bw, bh, token);
  const T = (p: Pt): Pt => [f.x + (p[0] - bx) * f.s, f.y + (p[1] - by) * f.s];
  const g = el('g', { class: 'figure' }, b.L.diagram);
  if (a.outline) {
    const strokes = data.body.map(p => makeStroke(smoothPath(p.map(T)), SOFT, 2.4, g));
    await drawStrokes(b.ctx(token), strokes, 2600);
  }
  const state: FigState = { data, T, g };
  b.register({ id: a.id, g, box: { x: f.x, y: f.y, w: bw * f.s, h: bh * f.s }, parts: {}, data: { figure: true, state } });
}

export async function drawFigurePart(b: Board, a: ActionOf<'figure_part'>, token: number) {
  const e = b.entities.get(a.figure); if (!e) throw new Error(`No figure "${a.figure}"`);
  const { data, T, g } = (e.data as { state: FigState }).state;
  const o = data.organs[a.part]; if (!o) throw new Error(`Figure has no part "${a.part}"`);
  const pg = el('g', { class: 'org', 'data-part': a.part }, g);
  const outline = o.outline.map(p => makeStroke(smoothPath(p.map(T)), INK, 2.6, pg));
  const n = a.detail ?? 0;
  const detail = [...o.detail].sort((x, y) => y.length - x.length).slice(0, n).map(p => makeStroke(smoothPath(p.map(T)), INK, 1.8, pg));
  const ms = Math.min(2600, 500 + outline.reduce((s, x) => s + x.L, 0) * 1.4);
  await drawStrokes(b.ctx(token), outline, n ? ms * .6 : ms);
  if (detail.length) await drawStrokes(b.ctx(token), detail, ms * .5);
  const pts = o.outline.flat().map(T);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  const [cx, cy] = T(o.centroid);
  const part: Part = { x: cx, y: cy, box };
  e.parts[a.part] = part;
  if (a.label) await runAction(b, { type: 'label', text: a.label, target: `${a.figure}.${a.part}`, side: 'auto' }, token);
}
