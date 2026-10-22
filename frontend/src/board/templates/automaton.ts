import * as dagre from '@dagrejs/dagre';
import type { Board, Part } from '../engine/board';
import type { ActionOf } from '@/dsl/schema';
import { el, type Pt } from '../engine/svg';
import { write, circle, animate, strokeAttrs, line } from '../engine/draw';
import { INK, BLUE } from '../engine/palette';

const R = 32;

/** DFA/NFA: states left-to-right, double circle = accept, arrow into the start state, self loops on top. */
export async function drawAutomaton(b: Board, a: ActionOf<'automaton'>, token: number) {
  const g0 = new dagre.graphlib.Graph();
  g0.setGraph({ rankdir: 'LR', nodesep: 90, ranksep: 150, marginx: 70, marginy: 60 });
  g0.setDefaultEdgeLabel(() => ({}));
  a.states.forEach(s => g0.setNode(s, { width: R * 2, height: R * 2 }));
  // merge parallel transitions: q0 -0,1-> q1
  const merged = new Map<string, { from: string; to: string; label: string }>();
  for (const t of a.transitions) {
    const k = `${t.from}>${t.to}`;
    merged.set(k, merged.has(k) ? { ...merged.get(k)!, label: merged.get(k)!.label + ',' + t.label } : { ...t });
    if (t.from !== t.to) g0.setEdge(t.from, t.to);
  }
  dagre.layout(g0);
  const gr = g0.graph() as { width?: number; height?: number };
  const W = gr.width ?? 400, H = (gr.height ?? 200) + 40;
  const f = await b.fit(a.region ?? 'main', W, H, token);
  const s = f.s, g = el('g', { class: 'automaton' }, b.L.diagram), ctx = b.ctx(token);
  const parts: Record<string, Part> = {};
  const P = (id: string) => { const n = g0.node(id) as { x: number; y: number }; return { x: f.x + n.x * s, y: f.y + 40 * s + n.y * s }; };
  const r = R * s;
  const drawState = async (id: string) => {
    const { x, y } = P(id);
    await circle(ctx, g, x, y, r, INK, 280);
    if (a.accept.includes(id)) await circle(ctx, g, x, y, r - 6 * s, INK, 220);
    await write(ctx, g, x, y + 7 * s, id, { size: 20 * s, anchor: 'middle', ms: 160 });
    parts[id] = { x, y, r };
  };
  // start arrow
  const st = P(a.start);
  await line(ctx, g, [[st.x - r - 70 * s, st.y], [st.x - r - 4, st.y]], INK, 2.2, 260);
  await write(ctx, g, st.x - r - 72 * s, st.y - 12 * s, 'start', { size: 16 * s, color: BLUE });
  const done = new Set<string>();
  for (const id of a.states) {
    if (!done.has(id)) { await drawState(id); done.add(id); }
  }
  for (const t of merged.values()) {
    const A = P(t.from), B = P(t.to);
    if (t.from === t.to) {
      const d = `M${A.x - r * .55},${A.y - r * .8} C${A.x - r * 1.3},${A.y - r * 2.6} ${A.x + r * 1.3},${A.y - r * 2.6} ${A.x + r * .55},${A.y - r * .8}`;
      await animate(ctx, el('path', { d, ...strokeAttrs(INK, 2), 'marker-end': 'url(#ah)' }, g), 340);
      await write(ctx, g, A.x, A.y - r * 2.15, t.label, { size: 18 * Math.max(s, .8), anchor: 'middle', color: BLUE });
      parts[`${t.from}>${t.to}`] = { x: A.x, y: A.y - r * 2 };
      continue;
    }
    const back = merged.has(`${t.to}>${t.from}`);
    const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy), nx = -dy / d, ny = dx / d;
    const bend = back ? 34 * s : 0;
    const p1: Pt = [A.x + dx / d * r + nx * bend * .5, A.y + dy / d * r + ny * bend * .5];
    const p2: Pt = [B.x - dx / d * (r + 4) + nx * bend * .5, B.y - dy / d * (r + 4) + ny * bend * .5];
    const c: Pt = [(A.x + B.x) / 2 + nx * bend * 1.6, (A.y + B.y) / 2 + ny * bend * 1.6];
    await animate(ctx, el('path', { d: `M${p1[0]},${p1[1]} Q${c[0]},${c[1]} ${p2[0]},${p2[1]}`, ...strokeAttrs(INK, 2), 'marker-end': 'url(#ah)' }, g), 340);
    const lx = (p1[0] + 2 * c[0] + p2[0]) / 4 + nx * 16, ly = (p1[1] + 2 * c[1] + p2[1]) / 4 + ny * 16;
    await write(ctx, g, lx, ly + 6, t.label, { size: 18 * Math.max(s, .8), anchor: 'middle', color: BLUE });
    parts[`${t.from}>${t.to}`] = { x: lx, y: ly };
  }
  b.register({ id: a.id, g, box: { x: f.x, y: f.y, w: W * s, h: H * s }, parts });
}
