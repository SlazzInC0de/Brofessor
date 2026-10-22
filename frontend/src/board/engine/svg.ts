export const NS = 'http://www.w3.org/2000/svg';
export type Pt = [number, number];
export type Attrs = Record<string, string | number>;

export function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, parent?: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  if (parent) parent.appendChild(e);
  return e;
}

/** Catmull-Rom style smoothing of a polyline into cubic curves. */
export function smoothPath(p: Pt[]): string {
  const f = (n: number) => n.toFixed(1);
  if (p.length < 3) return 'M' + p.map(q => `${f(q[0])},${f(q[1])}`).join(' L');
  let d = `M${f(p[0][0])},${f(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}

export const polyPath = (p: Pt[]) => 'M' + p.map(q => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' L');

/** Seeded random, so the hand-drawn jitter is the same on every replay. */
export function makeRng(seed = 11) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export interface Box { x: number; y: number; w: number; h: number }
