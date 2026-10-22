import type { Board, Part } from '../engine/board';
import type { ActionOf } from '@/dsl/schema';
import { el } from '../engine/svg';
import { write, line, textWidth } from '../engine/draw';
import { INK, FAINT } from '../engine/palette';

/** Grid with a bold header row. Parts: "<id>.h<c>", "<id>.r<r>", "<id>.r<r>c<c>" (0-based body rows). */
export async function drawTable(b: Board, a: ActionOf<'table'>, token: number) {
  const size = 20, pad = 22, rh = 44;
  const cols = a.headers.map((h, c) => Math.max(textWidth(h, size) * 1.15, ...a.rows.map(r => textWidth(String(r[c] ?? ''), size))) + pad * 2);
  const width = cols.reduce((x, y) => x + y, 0), height = rh * (a.rows.length + 1);
  const f = await b.fit(a.region ?? 'main', width, height, token);
  const s = f.s, g = el('g', { class: 'table' }, b.L.diagram), ctx = b.ctx(token);
  const xs = [f.x]; cols.forEach(w => xs.push(xs[xs.length - 1] + w * s));
  const parts: Record<string, Part> = {};
  // header
  for (let c = 0; c < cols.length; c++) {
    await write(ctx, g, xs[c] + pad * s, f.y + rh * s * 0.66, a.headers[c], { size: size * s, bold: true });
    parts['h' + c] = { x: (xs[c] + xs[c + 1]) / 2, y: f.y + rh * s / 2, box: { x: xs[c], y: f.y, w: cols[c] * s, h: rh * s } };
  }
  await line(ctx, g, [[f.x, f.y + rh * s], [f.x + width * s, f.y + rh * s]], INK, 2.2, 300, false);
  for (let c = 1; c < cols.length; c++) await line(ctx, g, [[xs[c], f.y + 6], [xs[c], f.y + height * s - 6]], FAINT, 1.6, 160, false);
  for (let r = 0; r < a.rows.length; r++) {
    const y = f.y + rh * s * (r + 1);
    if (r > 0) await line(ctx, g, [[f.x, y], [f.x + width * s, y]], FAINT, 1.4, 160, false);
    for (let c = 0; c < cols.length; c++) {
      await write(ctx, g, xs[c] + pad * s, y + rh * s * 0.66, String(a.rows[r][c] ?? ''), { size: size * s, ms: 160 });
      parts[`r${r}c${c}`] = { x: (xs[c] + xs[c + 1]) / 2, y: y + rh * s / 2, box: { x: xs[c], y, w: cols[c] * s, h: rh * s } };
    }
    parts['r' + r] = { x: f.x + width * s / 2, y: y + rh * s / 2, box: { x: f.x, y, w: width * s, h: rh * s } };
  }
  b.register({ id: a.id, g, box: { x: f.x, y: f.y, w: width * s, h: height * s }, parts });
}
