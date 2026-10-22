import type { Board, Part } from '../engine/board';
import type { ActionOf } from '@/dsl/schema';
import { el, polyPath, type Pt } from '../engine/svg';
import { write, makeStroke, drawStrokes } from '../engine/draw';
import { INK } from '../engine/palette';

/**
 * A tiny Logo interpreter for geometry and free sketches.
 * fd/forward n, bk/back n, rt/right a, lt/left a, pu/penup, pd/pendown, seth a, home, repeat n [ ... ]
 * Heading 0 = up. Parts: "<id>.v<i>" for every vertex where the pen turned.
 */
export function runLogo(program: string) {
  const tok = program.replace(/\[/g, ' [ ').replace(/\]/g, ' ] ').trim().split(/\s+/);
  let x = 0, y = 0, h = 0, down = true;
  const paths: Pt[][] = [[[0, 0]]]; const verts: Pt[] = [[0, 0]];
  const exec = (t: string[]) => {
    for (let i = 0; i < t.length; i++) {
      const c = t[i].toLowerCase(), n = () => parseFloat(t[++i]);
      if (c === 'fd' || c === 'forward' || c === 'bk' || c === 'back') {
        const d = n() * (c.startsWith('b') ? -1 : 1), r = (h * Math.PI) / 180;
        x += Math.sin(r) * d; y -= Math.cos(r) * d;
        if (down) paths[paths.length - 1].push([x, y]); else paths.push([[x, y]]);
        verts.push([x, y]);
      } else if (c === 'rt' || c === 'right') h += n();
      else if (c === 'lt' || c === 'left') h -= n();
      else if (c === 'seth' || c === 'setheading') h = n();
      else if (c === 'pu' || c === 'penup') down = false;
      else if (c === 'pd' || c === 'pendown') { down = true; paths.push([[x, y]]); }
      else if (c === 'home') { x = 0; y = 0; h = 0; paths.push([[0, 0]]); }
      else if (c === 'repeat') {
        const times = n(); let depth = 0, j = ++i + 1; const start = j;
        for (; j < t.length; j++) { if (t[j] === '[') depth++; if (t[j] === ']') { if (!depth) break; depth--; } }
        const body = t.slice(start, j);
        for (let k = 0; k < times; k++) exec(body);
        i = j;
      }
    }
  };
  exec(tok);
  return { paths: paths.filter(p => p.length > 1), verts };
}

export async function drawTurtle(b: Board, a: ActionOf<'turtle'>, token: number) {
  const { paths, verts } = runLogo(a.program);
  const all = paths.flat();
  const minX = Math.min(...all.map(p => p[0])), maxX = Math.max(...all.map(p => p[0]));
  const minY = Math.min(...all.map(p => p[1])), maxY = Math.max(...all.map(p => p[1]));
  const k = a.size ?? 1, W = (maxX - minX) * k + 20, H = (maxY - minY) * k + 20 + (a.label ? 40 : 0);
  const f = await b.fit(a.region ?? 'main', W, H, token);
  const s = f.s * k, ox = f.x + 10 * f.s - minX * s, oy = f.y + 10 * f.s - minY * s;
  const T = (p: Pt): Pt => [ox + p[0] * s, oy + p[1] * s];
  const g = el('g', { class: 'turtle' }, b.L.diagram), ctx = b.ctx(token);
  const strokes = paths.map(p => makeStroke(polyPath(p.map(T)), INK, 2.4, g));
  const len = strokes.reduce((n, x) => n + x.L, 0);
  await drawStrokes(ctx, strokes, Math.min(4000, 400 + len * 2.2));
  if (a.label) await write(ctx, g, f.x + (W * f.s) / 2, f.y + H * f.s - 10, a.label, { size: 21, anchor: 'middle' });
  const parts: Record<string, Part> = {};
  verts.forEach((v, i) => { const [x, y] = T(v); parts['v' + i] = { x, y }; });
  b.register({ id: a.id, g, box: { x: f.x, y: f.y, w: W * f.s, h: (H - (a.label ? 40 : 0)) * f.s }, parts });
}
