import * as dagre from '@dagrejs/dagre';
import type { Board, Part } from '../engine/board';
import type { ActionOf } from '@/dsl/schema';
import { el, smoothPath, type Pt } from '../engine/svg';
import { write, textWidth, roughRect, animate, strokeAttrs } from '../engine/draw';
import { INK, BLUE } from '../engine/palette';

/** Boxes / decisions / terminals laid out by dagre. Parts: node ids. */
export async function drawFlowchart(b: Board, a: ActionOf<'flowchart'>, token: number) {
  const size = 20;
  const g0 = new dagre.graphlib.Graph();
  g0.setGraph({ rankdir: a.direction, nodesep: 46, ranksep: 54, marginx: 10, marginy: 10 });
  g0.setDefaultEdgeLabel(() => ({}));
  for (const n of a.nodes) {
    const tw = textWidth(n.text, size) + 40;
    const w = n.shape === 'diamond' ? tw * 1.35 + 20 : tw, h = n.shape === 'diamond' ? 78 : 52;
    g0.setNode(n.id, { width: w, height: h });
  }
  for (const e of a.edges) g0.setEdge(e.from, e.to);
  dagre.layout(g0);
  const gr = g0.graph() as { width?: number; height?: number };
  const W = gr.width ?? 400, H = gr.height ?? 300;
  const f = await b.fit(a.region ?? 'main', W, H, token);
  const s = f.s, X = (x: number) => f.x + x * s, Y = (y: number) => f.y + y * s;
  const g = el('g', { class: 'flowchart' }, b.L.diagram), ctx = b.ctx(token);
  const parts: Record<string, Part> = {};
  const drawn = new Set<string>();
  const drawNode = async (id: string) => {
    if (drawn.has(id)) return; drawn.add(id);
    const n = a.nodes.find(k => k.id === id)!, d = g0.node(id) as { x: number; y: number; width: number; height: number };
    const cx = X(d.x), cy = Y(d.y), w = d.width * s, h = d.height * s;
    if (n.shape === 'diamond') await animate(ctx, el('path', { d: `M${cx},${cy - h / 2} L${cx + w / 2},${cy} L${cx},${cy + h / 2} L${cx - w / 2},${cy} Z`, ...strokeAttrs(INK) }, g), 420);
    else if (n.shape === 'oval') await animate(ctx, el('rect', { x: cx - w / 2, y: cy - h / 2, width: w, height: h, rx: h / 2, ...strokeAttrs(INK) }, g), 420);
    else await roughRect(ctx, g, cx - w / 2, cy - h / 2, w, h, INK, 380);
    await write(ctx, g, cx, cy + 7 * s, n.text, { size: size * s, anchor: 'middle' });
    parts[id] = { x: cx, y: cy, box: { x: cx - w / 2, y: cy - h / 2, w, h } };
  };
  // walk edges in order so the chart grows along its arrows
  await drawNode(a.nodes[0].id);
  for (const e of a.edges) {
    await drawNode(e.from);
    const pts = ((g0.edge(e.from, e.to) as { points: { x: number; y: number }[] }).points).map(p => [X(p.x), Y(p.y)] as Pt);
    const p = el('path', { d: smoothPath(pts), ...strokeAttrs(INK, 2), 'marker-end': 'url(#ah)' }, g);
    await animate(ctx, p, 320);
    if (e.label) { const m = pts[Math.floor(pts.length / 2)]; await write(ctx, g, m[0] + 10, m[1] - 6, e.label, { size: 17 * Math.max(s, .8), color: BLUE }); }
    await drawNode(e.to);
  }
  for (const n of a.nodes) await drawNode(n.id);
  b.register({ id: a.id, g, box: { x: f.x, y: f.y, w: W * s, h: H * s }, parts });
}
