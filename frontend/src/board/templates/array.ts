import type { Board, Part } from '../engine/board';
import type { ActionOf } from '@/dsl/schema';
import { el } from '../engine/svg';
import { write, roughRect } from '../engine/draw';
import { INK, SOFT } from '../engine/palette';

/** A row of cells with indices underneath. Parts: "<id>.<index>". */
export async function drawArray(b: Board, a: ActionOf<'array'>, token: number) {
  const cw = 66, ch = 58, n = a.values.length;
  const width = n * cw + (a.label ? 120 : 0), height = ch + 34;
  const f = await b.fit(a.region ?? 'main', width, height, token);
  const s = f.s, g = el('g', { class: 'array' }, b.L.diagram), ctx = b.ctx(token);
  const x0 = f.x + (a.label ? 120 * s : 0);
  if (a.label) await write(ctx, g, f.x, f.y + ch * s * 0.62, a.label + ' =', { size: 22 * s });
  const parts: Record<string, Part> = {};
  for (let i = 0; i < n; i++) {
    const x = x0 + i * cw * s;
    await roughRect(ctx, g, x, f.y, cw * s, ch * s, INK, 180, 2);
    await write(ctx, g, x + cw * s / 2, f.y + ch * s * 0.64, String(a.values[i]), { size: 22 * s, anchor: 'middle', ms: 140 });
    await write(ctx, g, x + cw * s / 2, f.y + (ch + 24) * s, String(i), { size: 15 * s, anchor: 'middle', color: SOFT, ms: 80 });
    parts[String(i)] = { x: x + cw * s / 2, y: f.y + ch * s / 2, box: { x, y: f.y, w: cw * s, h: ch * s } };
  }
  b.register({ id: a.id, g, box: { x: x0, y: f.y, w: n * cw * s, h: ch * s }, parts });
}
