import type { Board, Part } from '../engine/board';
import type { ActionOf } from '@/dsl/schema';
import { el, type Pt } from '../engine/svg';
import { write, line, circle } from '../engine/draw';
import { INK } from '../engine/palette';

const R = 27, LEVEL = 96;
interface TreeData { pos: Record<string, Part>; depth: Record<string, number>; spread: number; s: number; g: SVGGElement }

/**
 * Binary trees use the classic layout (each level halves the horizontal offset), so a BST
 * can grow with tree_add without moving existing nodes. Wider trees use leaf slots.
 */
export async function drawTree(b: Board, a: ActionOf<'tree'>, token: number) {
  const kids: Record<string, string[]> = {}; const parent: Record<string, string> = {};
  a.edges.forEach(([p, c]) => { (kids[p] ||= []).push(c); parent[c] = p; });
  const root = a.nodes.find(n => !parent[n]) ?? a.nodes[0];
  const depth: Record<string, number> = {};
  const walk = (n: string, d: number) => { depth[n] = d; (kids[n] || []).forEach(c => walk(c, d + 1)); };
  walk(root, 0);
  const maxD = Math.max(...Object.values(depth));
  const binary = Object.values(kids).every(k => k.length <= 2);
  const rel: Record<string, Pt> = {};
  let width: number;
  if (binary) {
    const spread = Math.max(220, 64 * 2 ** Math.min(maxD + 1, 4));
    width = spread * 2 + R * 2;
    const place = (n: string, x: number, d: number) => {
      rel[n] = [x, d * LEVEL];
      const ks = kids[n] || [], off = spread / 2 ** (d + 1);
      if (ks.length === 2) { place(ks[0], x - off, d + 1); place(ks[1], x + off, d + 1); }
      else if (ks.length === 1) {
        const isNum = !isNaN(+ks[0]) && !isNaN(+n);
        place(ks[0], isNum && +ks[0] > +n ? x + off : x - off, d + 1);
      }
    };
    place(root, 0, 0);
  } else {
    let slot = 0; const leafX: Record<string, number> = {};
    const lay = (n: string): number => { const ks = kids[n] || []; if (!ks.length) return (leafX[n] = slot++ * 90); const xs = ks.map(lay); return (leafX[n] = (xs[0] + xs[xs.length - 1]) / 2); };
    lay(root);
    const mid = (Math.max(...Object.values(leafX)) + Math.min(...Object.values(leafX))) / 2;
    Object.keys(leafX).forEach(n => (rel[n] = [leafX[n] - mid, depth[n] * LEVEL]));
    width = Math.max(...Object.values(leafX)) - Math.min(...Object.values(leafX)) + R * 4;
  }
  const height = (maxD + (binary ? 2 : 1)) * LEVEL;          // leave a level for tree_add
  const f = await b.fit(a.region ?? 'main', width, height, token);
  const s = f.s, ox = f.x + (width * s) / 2, oy = f.y + R * s + 6;
  const g = el('g', { class: 'tree' }, b.L.diagram);
  const pos: Record<string, Part> = {};
  for (const n of a.nodes) { const [x, y] = rel[n]; pos[n] = { x: ox + x * s, y: oy + y * s, r: R * s }; }
  const ctx = b.ctx(token);
  // draw parent-first so the pen moves like a teacher
  const order: string[] = []; const bfs = [root]; while (bfs.length) { const n = bfs.shift()!; order.push(n); bfs.push(...(kids[n] || [])); }
  for (const n of order) {
    if (parent[n]) await edge(b, g, pos[parent[n]], pos[n], token);
    await node(b, g, pos[n], n, token, s);
  }
  const data: TreeData = { pos, depth, spread: binary ? Math.max(220, 64 * 2 ** Math.min(maxD + 1, 4)) : 90, s, g };
  b.register({ id: a.id, g, box: { x: f.x, y: f.y, w: width * s, h: height * s }, parts: pos, data });
  void ctx;
}

async function node(b: Board, g: SVGGElement, p: Part, label: string, token: number, s: number) {
  const ctx = b.ctx(token);
  await circle(ctx, g, p.x, p.y, p.r!, INK, 260);
  await write(ctx, g, p.x, p.y + 7 * s, label, { size: Math.max(14, 21 * s), anchor: 'middle', ms: 160 + label.length * 40 });
}
async function edge(b: Board, g: SVGGElement, A: Part, B: Part, token: number) {
  const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
  await line(b.ctx(token), g, [[A.x + dx / d * A.r!, A.y + dy / d * A.r!], [B.x - dx / d * B.r!, B.y - dy / d * B.r!]], INK, 2, 240, false);
}

export async function addTreeNode(b: Board, a: ActionOf<'tree_add'>, token: number) {
  const e = b.entities.get(a.target); if (!e) throw new Error(`No tree "${a.target}"`);
  const t = e.data as TreeData, P = t.pos[a.parent];
  const d = (t.depth[a.parent] ?? 0) + 1, off = (t.spread / 2 ** d) * t.s;
  const p: Part = { x: P.x + (a.side === 'left' ? -off : off), y: P.y + LEVEL * t.s, r: P.r };
  t.pos[a.node] = p; t.depth[a.node] = d; e.parts[a.node] = p;
  await edge(b, t.g, P, p, token);
  await node(b, t.g, p, a.node, token, t.s);
}
