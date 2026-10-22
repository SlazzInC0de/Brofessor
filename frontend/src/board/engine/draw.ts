import { el, smoothPath, polyPath, makeRng, type Pt } from './svg';
import type { Clock } from './clock';
import type { Pen } from './pen';
import { INK, SOFT, color, parseRich, type Run } from './palette';
import font from '../fonts/futural.json';

export interface Ctx { clock: Clock; pen: Pen; token: number | 'side' }

export interface Stroke { p: SVGGeometryElement; L: number; col: string }

export function makeStroke(d: string, col: string, width: number, parent: Element, extra: Record<string, string | number> = {}): Stroke {
  const p = el('path', { d, fill: 'none', stroke: col, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra }, parent);
  const L = p.getTotalLength() || 0.5;
  p.style.strokeDasharray = String(L); p.style.strokeDashoffset = String(L);
  return { p, L, col };
}

/** Draws strokes one after another like a single pen, total duration ms. */
export async function drawStrokes(ctx: Ctx, list: Stroke[], ms: number) {
  const total = list.reduce((a, s) => a + s.L, 0) || 1;
  await ctx.clock.tween(ms, k => {
    let budget = k * total, acc = 0, active: [Stroke, number] | null = null;
    for (const s of list) {
      const v = Math.max(0, Math.min(s.L, budget - acc));
      s.p.style.strokeDashoffset = String(s.L - v);
      if (!active && v > 0 && v < s.L) active = [s, v];
      acc += s.L;
    }
    if (active) { const pt = active[0].p.getPointAtLength(active[1]); ctx.pen.at(pt.x, pt.y, active[0].col); }
  }, ctx.token);
}

export async function animate(ctx: Ctx, p: SVGGeometryElement, ms: number, col = INK) {
  const L = p.getTotalLength() || 1;
  p.style.strokeDasharray = String(L); p.style.strokeDashoffset = String(L);
  await ctx.clock.tween(ms, k => {
    p.style.strokeDashoffset = String(L * (1 - k));
    if (k < 1) { const pt = p.getPointAtLength(L * k); ctx.pen.at(pt.x, pt.y, col); }
  }, ctx.token);
  return p;
}

export function strokeAttrs(col: string, w = 2.2) {
  return { fill: 'none', stroke: col, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
}

export async function line(ctx: Ctx, parent: Element, pts: Pt[], col = INK, w = 2.2, ms = 400, arrow = true) {
  const p = el('path', { d: polyPath(pts), ...strokeAttrs(col, w) }, parent);
  if (arrow) p.setAttribute('marker-end', 'url(#ah)');
  return animate(ctx, p, ms, col);
}

export async function curve(ctx: Ctx, parent: Element, a: Pt, c: Pt, b: Pt, col = SOFT, ms = 550, arrow = true) {
  const p = el('path', { d: `M${a[0]},${a[1]} Q${c[0]},${c[1]} ${b[0]},${b[1]}`, ...strokeAttrs(col) }, parent);
  if (arrow) p.setAttribute('marker-end', 'url(#ah)');
  return animate(ctx, p, ms, INK);
}

const rng = makeRng(23);
export async function roughRect(ctx: Ctx, parent: Element, x: number, y: number, w: number, h: number, col = INK, ms = 450, sw = 2.2) {
  const r = () => (rng() - 0.5) * 3;
  const d = `M${x + r()},${y + r()} L${x + w + r()},${y + r()} L${x + w + r()},${y + h + r()} L${x + r()},${y + h + r()} Z`;
  return animate(ctx, el('path', { d, ...strokeAttrs(col, sw) }, parent), ms, col);
}

export async function circle(ctx: Ctx, parent: Element, cx: number, cy: number, r: number, col = INK, ms = 300, sw = 2.2) {
  return animate(ctx, el('circle', { cx, cy, r, ...strokeAttrs(col, sw) }, parent), ms, col);
}

export async function ellipse(ctx: Ctx, parent: Element, cx: number, cy: number, rx: number, ry: number, col = INK, ms = 450, sw = 2.6) {
  return animate(ctx, el('ellipse', { cx, cy, rx, ry, ...strokeAttrs(col, sw) }, parent), ms, col);
}

export { smoothPath, polyPath };

// ---------------- single-line handwriting (Hershey Simplex, jittered + slanted) ----------------
type Glyph = { w: number; l: number; s: number[][][] };
const F = font as unknown as { g: Record<string, Glyph> };
F.g['→'] = { w: 24, l: -2, s: [[[0, -3], [17, -3]], [[11, -8], [17, -3], [11, 2]]] };
F.g['×'] = { w: 18, l: -9, s: [[[-5, -9], [5, 1]], [[5, -9], [-5, 1]]] };
F.g['°'] = { w: 12, l: -6, s: [[[0, -12], [-2, -11], [-3, -9], [-2, -7], [0, -6], [2, -7], [3, -9], [2, -11], [0, -12]]] };
const hand = makeRng(11);

export const textWidth = (text: string, size: number) =>
  [...text].reduce((a, ch) => a + (F.g[ch]?.w ?? 16) * size * 0.62 / 21, 0);
const canHand = (t: string) => [...t].every(ch => F.g[ch]);

export interface WriteOpts { size?: number; anchor?: 'start' | 'middle' | 'end'; color?: string; bold?: boolean; ms?: number }
export interface Written { g: SVGGElement; x: number; y: number; w: number; h: number }

/** Writes text stroke by stroke. `text` may be rich ("*blue* and !red!") or pre-split runs. */
export async function write(ctx: Ctx, parent: Element, x: number, y: number, text: string | Run[], o: WriteOpts = {}): Promise<Written> {
  const runs = (typeof text === 'string' ? parseRich(text) : text).map(([t, c]) => [t.replace(/…/g, '...'), c] as Run);
  const plain = runs.map(r => r[0]).join('');
  const size = o.size ?? 22, sc = size * 0.62 / 21;
  if (!canHand(plain)) return writeFont(ctx, parent, x, y, runs, o);
  let adv = 0; const gl: { g: Glyph; x: number; c?: string }[] = [];
  for (const [t, c] of runs) for (const ch of t) { const g = F.g[ch]; gl.push({ g, x: adv, c }); adv += g.w * sc; }
  const ox = o.anchor === 'middle' ? x - adv / 2 : o.anchor === 'end' ? x - adv : x;
  const g = el('g', { class: 'hw' }, parent);
  const w = (o.bold ? 1.5 : 1) * Math.max(1.4, size / 13.5), j = size / 32;
  const strokes: Stroke[] = [];
  for (const it of gl) {
    const col = it.c ? color(it.c) : color(o.color);
    for (const s of it.g.s) {
      const pts: Pt[] = s.map(([px, py]) => { const yy = (py - 9) * sc; return [ox + it.x + (px - it.g.l) * sc - yy * 0.1 + (hand() - .5) * j, y + yy + (hand() - .5) * j]; });
      strokes.push(makeStroke(polyPath(pts), col, w, g));
    }
  }
  await drawStrokes(ctx, strokes, o.ms ?? Math.max(300, plain.length * 38));
  return { g, x: ox, y: y - size * 0.68, w: adv, h: size * 0.9 };
}

/** Fallback for characters the stroke font lacks (e.g. Devanagari). */
async function writeFont(ctx: Ctx, parent: Element, x: number, y: number, runs: Run[], o: WriteOpts): Promise<Written> {
  const size = o.size ?? 22;
  const t = el('text', { x, y, 'font-size': size, 'text-anchor': o.anchor ?? 'start', fill: color(o.color), 'font-weight': o.bold ? 700 : 400, class: 'hand-fallback' }, parent);
  for (const [s, c] of runs) { const ts = el('tspan', {}, t); ts.textContent = s; if (c) ts.setAttribute('fill', color(c)); }
  const bb = t.getBBox();
  const id = 'clip' + Math.random().toString(36).slice(2, 8);
  const cp = el('clipPath', { id }, parent); const r = el('rect', { x: bb.x - 4, y: bb.y - 6, width: 0, height: bb.height + 12 }, cp);
  t.setAttribute('clip-path', `url(#${id})`);
  await ctx.clock.tween(o.ms ?? Math.max(300, (t.textContent || '').length * 36), k => {
    r.setAttribute('width', String((bb.width + 8) * k)); if (k < 1) ctx.pen.at(bb.x + bb.width * k, bb.y + bb.height * .8, color(o.color));
  }, ctx.token);
  const g = el('g', {}, parent); g.appendChild(t);
  return { g, x: bb.x, y: bb.y, w: bb.width, h: bb.height };
}

export { smoothPath as smooth };
