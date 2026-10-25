'use client';
import font from '@/board/fonts/futural.json';
import { makeRng } from '@/board/engine/svg';

/**
 * Text written in the board's single-line handwriting (Hershey futural), drawn stroke by stroke with CSS.
 * Used for page headings so the app speaks in the same hand as the professor.
 */
type Glyph = { w: number; l: number; s: number[][][] };
const G = (font as unknown as { g: Record<string, Glyph> }).g;
const glyph = (ch: string) => G[ch] ?? G['?'];

interface Props {
  text: string;
  size?: number;          // cap height-ish, px
  maxWidth?: number;      // wrap words past this width (px)
  mark?: string;          // a word written in blue with a marker underline
  speed?: number;         // ms per character
  delay?: number;         // ms before the first stroke
  className?: string;
  as?: 'h1' | 'h2';
}

export function Handwritten({ text, size = 40, maxWidth = 900, mark, speed = 28, delay = 0, className, as: Tag = 'h1' }: Props) {
  const sc = size * 0.62 / 21, lineH = size * 1.25, rng = makeRng(text.length * 7 + 3);
  const space = glyph(' ').w * sc;

  // word wrap
  const words = text.split(/\s+/).filter(Boolean);
  const wordW = (w: string) => [...w].reduce((a, ch) => a + glyph(ch).w * sc, 0);
  const lines: string[][] = [[]]; let cur = 0;
  for (const w of words) {
    const ww = wordW(w);
    if (cur > 0 && cur + space + ww > maxWidth) { lines.push([]); cur = 0; }
    lines[lines.length - 1].push(w); cur += (cur > 0 ? space : 0) + ww;
  }

  const paths: { d: string; blue: boolean; i: number }[] = [];
  const unders: { d: string; i: number }[] = [];
  let width = 0, n = 0;
  const strip = (w: string) => w.replace(/[^\w]/g, '').toLowerCase();
  lines.forEach((ln, li) => {
    let x = 4; const base = size * 0.95 + li * lineH;
    ln.forEach((w, wi) => {
      if (wi > 0) x += space;
      const blue = !!mark && strip(w) === strip(mark); const x0 = x;
      for (const ch of w) {
        const g = glyph(ch);
        for (const s of g.s) {
          const d = 'M' + s.map(([px, py]) => {
            const yy = (py - 9) * sc;
            return `${(x + (px - g.l) * sc - yy * 0.1 + (rng() - .5) * size / 40).toFixed(1)},${(base + yy + (rng() - .5) * size / 40).toFixed(1)}`;
          }).join(' L');
          paths.push({ d, blue, i: n });
        }
        x += g.w * sc; n++;
      }
      if (blue) {
        const y = base + size * 0.28, x1 = x - size * 0.05;
        unders.push({ d: `M${x0 - 2},${y + 2} C${x0 + (x1 - x0) * .3},${y - 3} ${x0 + (x1 - x0) * .7},${y + 5} ${x1 + 6},${y - 1}`, i: n });
      }
    });
    width = Math.max(width, x + 8);
  });
  const height = size * 1.25 + (lines.length - 1) * lineH;

  return (
    <Tag className={'handwritten ' + (className ?? '')} aria-label={text}>
      <svg viewBox={`0 0 ${width.toFixed(0)} ${height.toFixed(0)}`} width={width} height={height} aria-hidden style={{ maxWidth: '100%', height: 'auto' }}>
        {paths.map((p, k) => (
          <path key={k} d={p.d} pathLength={1} className={p.blue ? 'hw-blue' : undefined}
            style={{ strokeWidth: Math.max(1.6, size / 15), animationDelay: `${delay + p.i * speed}ms` }} />
        ))}
        {unders.map((u, k) => (
          <path key={'u' + k} d={u.d} pathLength={1} className="hw-under"
            style={{ strokeWidth: Math.max(3, size / 7), animationDelay: `${delay + u.i * speed + 120}ms` }} />
        ))}
      </svg>
    </Tag>
  );
}
