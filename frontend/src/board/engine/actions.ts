import katex from 'katex';
import type { Board } from './board';
import type { ActionT, ActionOf } from '@/dsl/schema';
import { el, type Pt } from './svg';
import { write, textWidth, line, curve, circle, ellipse, roughRect, animate, strokeAttrs } from './draw';
import { INK, BLUE, RED, SOFT, FAINT, color, parseRich, type Run } from './palette';
import type { RegionName } from '../layout/regions';
import { drawTree, addTreeNode } from '../templates/tree';
import { drawArray } from '../templates/array';
import { drawTable } from '../templates/table';
import { drawFlowchart } from '../templates/flowchart';
import { drawAutomaton } from '../templates/automaton';
import { drawTurtle } from '../templates/turtle';
import { drawFigure, drawFigurePart } from '../templates/figure';

/** Split rich runs into lines no wider than maxW. */
export function wrap(runs: Run[], maxW: number, size: number): Run[][] {
  const words: Run[] = [];
  for (const [t, c] of runs) t.split(/(\s+)/).forEach(w => w && words.push([w, c]));
  const lines: Run[][] = [[]]; let w = 0;
  for (const word of words) {
    const ww = textWidth(word[0], size);
    if (w + ww > maxW && w > 0 && word[0].trim()) { lines.push([]); w = 0; }
    if (!lines[lines.length - 1].length && !word[0].trim()) continue;
    lines[lines.length - 1].push(word); w += ww;
  }
  return lines.filter(l => l.length);
}

const defRegion = (b: Board, r?: RegionName, fallback: RegionName = 'side') => r ?? fallback;

async function writeBlock(b: Board, text: string, region: RegionName, token: number, size = 21, indent = 0, bullet = false) {
  const box = b.layout.box(region), lh = size * 1.38;
  const lines = wrap(parseRich(text), box.w - indent - 8, size);
  const ctx = b.ctx(token), g = el('g', {}, b.L.notes);
  let first: { x: number; y: number } | null = null, top = 0;
  for (let i = 0; i < lines.length; i++) {
    const r = await b.take(region, lh, token, 0);
    if (!first) { first = r; top = r.y; }
    if (i === 0 && bullet) el('circle', { cx: r.x + indent - 12, cy: r.y + lh * 0.55, r: 2.6, fill: INK }, g);
    await write(ctx, g, r.x + indent, r.y + lh * 0.78, lines[i], { size });
  }
  b.layout.take(region, 0, 6);
  return { g, x: first?.x ?? 0, y: top, h: lines.length * lh, w: box.w };
}

export async function runAction(b: Board, a: ActionT, token: number): Promise<void> {
  const ctx = b.ctx(token);
  switch (a.type) {
    case 'heading': {
      const region = defRegion(b, a.region, 'title');
      const r = await b.take(region, 54, token);
      const w = await write(ctx, b.L.notes, r.x, r.y + 38, a.text, { size: 33, bold: true });
      await line(ctx, b.L.notes, [[r.x, r.y + 50], [r.x + w.w + 8, r.y + 48]], BLUE, 2.5, 300, false);
      return;
    }
    case 'write': { const blk = await writeBlock(b, a.text, defRegion(b, a.region), token, a.size ?? 21); if (a.id) b.register({ id: a.id, g: blk.g, box: { x: blk.x, y: blk.y, w: blk.w, h: blk.h }, parts: {} }); return; }
    case 'bullet': { const blk = await writeBlock(b, a.text, defRegion(b, a.region), token, 21, 24, true); if (a.id) b.register({ id: a.id, g: blk.g, box: { x: blk.x, y: blk.y, w: blk.w, h: blk.h }, parts: {} }); return; }
    case 'side_note': {
      const region: RegionName = 'side', size = 20, box = b.layout.box(region);
      const lines = wrap(parseRich(a.text), box.w - 40, size), lh = size * 1.4, h = lines.length * lh + 22;
      const r = await b.take(region, h, token);
      const g = el('g', {}, b.L.notes);
      await roughRect(ctx, g, r.x, r.y, box.w - 10, h, FAINT, 400, 1.6);
      for (let i = 0; i < lines.length; i++) await write(ctx, g, r.x + 16, r.y + 14 + lh * (i + 0.78), lines[i], { size });
      if (a.id) b.register({ id: a.id, g, box: { x: r.x, y: r.y, w: box.w - 10, h }, parts: {} });
      return;
    }
    case 'note_block': return noteBlock(b, a, token);
    case 'formula': return formula(b, a, token);
    case 'arrow': {
      const A = b.resolve(a.from), B = b.resolve(a.to);
      const p1 = b.edgePoint(A, [B.x, B.y]), p2 = b.edgePoint(B, [A.x, A.y], 8);
      await line(ctx, b.L.labels, [p1, p2], INK, 2.2, 380);
      if (a.label) {
        const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2, dx = p2[0] - p1[0], dy = p2[1] - p1[1], d = Math.hypot(dx, dy) || 1;
        const nx = -dy / d, ny = dx / d, side = nx < 0 ? -1 : 1;
        await write(ctx, b.L.labels, mx + nx * 18 * side, my + ny * 18 * side + 6, a.label, { size: 18, anchor: nx * side < -0.3 ? 'end' : nx * side > 0.3 ? 'start' : 'middle', color: BLUE });
      }
      return;
    }
    case 'label': return label(b, a, token);
    case 'highlight': {
      const p = b.resolve(a.target), col = color(a.color ?? 'red');
      const bx = p.box ?? (p.r ? { x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2 } : { x: p.x - 24, y: p.y - 24, w: 48, h: 48 });
      if (a.style === 'underline') await line(ctx, b.L.labels, [[bx.x, bx.y + bx.h + 6], [bx.x + bx.w, bx.y + bx.h + 4]], col, 2.8, 300, false);
      else if (a.style === 'box') await roughRect(ctx, b.L.labels, bx.x - 8, bx.y - 8, bx.w + 16, bx.h + 16, col, 450, 2.6);
      else await ellipse(ctx, b.L.labels, bx.x + bx.w / 2, bx.y + bx.h / 2, bx.w / 2 + 14, bx.h / 2 + 12, col, 450);
      return;
    }
    case 'erase': {
      const e = b.entities.get(a.target); if (!e) return;
      await b.clock.tween(350, k => e.g.setAttribute('opacity', String(1 - k)), token); e.g.remove(); b.entities.delete(a.target);
      return;
    }
    case 'new_page': return b.newPage(a.title, token);
    case 'pause': return b.clock.wait(a.ms, token);
    case 'tree': return drawTree(b, a, token);
    case 'tree_add': return addTreeNode(b, a, token);
    case 'array': return drawArray(b, a, token);
    case 'table': return drawTable(b, a, token);
    case 'flowchart': return drawFlowchart(b, a, token);
    case 'automaton': return drawAutomaton(b, a, token);
    case 'turtle': return drawTurtle(b, a, token);
    case 'traced_figure': return drawFigure(b, a, token);
    case 'figure_part': return drawFigurePart(b, a, token);
  }
}

async function noteBlock(b: Board, a: ActionOf<'note_block'>, token: number) {
  const ctx = b.ctx(token), region = defRegion(b, a.region), box = b.layout.box(region);
  const size = 19, lh = size * 1.38, tsize = 24;
  const bl = a.bullets.map(t => wrap(parseRich(t), box.w - 60, size));
  const h = 40 + bl.reduce((n, l) => n + l.length * lh + 4, 0);
  const r = await b.take(region, h, token, 22);
  const g = el('g', {}, b.L.notes);
  let tx = r.x;
  if (a.marker) { await circle(ctx, g, r.x + 15, r.y + 18, 15, INK, 260); await write(ctx, g, r.x + 15, r.y + 26, a.marker, { size: 19, anchor: 'middle', ms: 120 }); tx = r.x + 40; }
  const t = await write(ctx, g, tx, r.y + 27, a.title, { size: tsize, bold: true });
  await line(ctx, g, [[tx, r.y + 36], [tx + t.w + 6, r.y + 34]], INK, 2, 220, false);
  let y = r.y + 40 + lh * 0.78;
  for (const lines of bl) {
    el('circle', { cx: r.x + 50, cy: y - 6, r: 2.6, fill: INK }, g);
    for (const ln of lines) { await write(ctx, g, r.x + 62, y, ln, { size }); y += lh; }
    y += 4;
  }
  const id = a.id ?? `note${b.entities.size}`;
  b.register({ id, g, box: { x: r.x, y: r.y, w: box.w, h }, parts: { title: { x: tx + t.w / 2, y: r.y + 18, box: { x: tx, y: r.y, w: t.w, h: 30 } } } });
  if (a.points_to) {
    const P = b.resolve(a.points_to);
    const from: Pt = P.x > tx + t.w ? [tx + t.w + 12, r.y + 18] : [r.x - 6, r.y + 18];
    const to = b.edgePoint(P, from, 6);
    await curve(ctx, b.L.labels, from, [(from[0] + to[0]) / 2, Math.min(from[1], to[1]) - 30], to, SOFT, 520);
  }
}

async function formula(b: Board, a: ActionOf<'formula'>, token: number) {
  const ctx = b.ctx(token), region = defRegion(b, a.region), size = a.size ?? 30;
  const probe = document.createElement('div');
  probe.style.cssText = `position:absolute;visibility:hidden;font-size:${size}px;white-space:nowrap;left:-9999px;top:0`;
  probe.innerHTML = katex.renderToString(a.latex, { throwOnError: false, output: 'html' });
  document.body.appendChild(probe);
  const w = Math.ceil(probe.offsetWidth * 1.12) + 24, h = probe.offsetHeight + 12; probe.remove();
  const box = b.layout.box(region);
  const r = await b.take(region, h, token);
  const x = r.x + Math.max(0, (Math.min(box.w, w) - w) / 2);
  const g = el('g', {}, b.L.notes);
  const fo = el('foreignObject', { x, y: r.y, width: w, height: h }, g);
  const div = document.createElement('div');
  div.className = 'board-formula'; div.style.fontSize = size + 'px'; div.style.color = INK;
  div.innerHTML = katex.renderToString(a.latex, { throwOnError: false, output: 'html' });
  fo.appendChild(div);
  const id = 'fclip' + Math.random().toString(36).slice(2, 8);
  const cp = el('clipPath', { id }, g); const rc = el('rect', { x, y: r.y - 4, width: 0, height: h + 8 }, cp);
  fo.setAttribute('clip-path', `url(#${id})`);
  await b.clock.tween(Math.max(500, a.latex.length * 45), k => { rc.setAttribute('width', String(w * k)); if (k < 1) ctx.pen.at(x + w * k, r.y + h * 0.7, INK); }, token);
  if (a.id) b.register({ id: a.id, g, box: { x, y: r.y, w, h }, parts: {} });
}

async function label(b: Board, a: ActionOf<'label'>, token: number) {
  const ctx = b.ctx(token), P = b.resolve(a.target);
  // which side: away from the centre of the board's main region
  const main = b.layout.box('main');
  const side = a.side && a.side !== 'auto' ? a.side : (P.x < main.x + main.w / 2 ? 'left' : 'right');
  const fig = [...b.entities.values()].find(e => (e.data as { figure?: boolean })?.figure && P.x >= e.box.x && P.x <= e.box.x + e.box.w);
  const pb = P.box ?? { x: P.x, y: P.y, w: 0, h: 0 };
  // inside a traced figure, labels sit just beside the part but stay within the figure; elsewhere 150px out
  const edgeX = fig
    ? (side === 'left' ? Math.max(fig.box.x + 95, Math.min(pb.x - 14, P.x - 70)) : Math.min(fig.box.x + fig.box.w - 110, Math.max(pb.x + pb.w + 14, P.x + 70)))
    : (side === 'left' ? P.x - 150 : P.x + 150);
  // keep labels from overlapping: each takes a vertical band sized by its line count
  const lines = a.text.split('\n'), half = (lines.length * 22 + 6) / 2;
  let y = P.y; const slots = b.labelSlots[side];
  const clash = (yy: number) => slots.some(([c, h]) => Math.abs(c - yy) < h + half);
  for (let guard = 0; guard < 60 && clash(y); guard++) y += 6;
  slots.push([y, half]);
  const tx = side === 'left' ? edgeX : edgeX;
  for (let i = 0; i < lines.length; i++) await write(ctx, b.L.labels, tx, y + 6 + (i - (lines.length - 1) / 2) * 22, lines[i], { size: 19, anchor: side === 'left' ? 'end' : 'start' });
  const from: Pt = [side === 'left' ? tx + 6 : tx - 6, y];
  await line(ctx, b.L.labels, [from, [P.x, P.y]], INK, 1.8, 320);
}

export { el, strokeAttrs, animate, RED, SOFT };
