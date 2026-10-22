import type { Box } from './svg';

export const BOARD_W = 1600, BOARD_H = 1000;
const FULL: Box = { x: 0, y: 0, w: BOARD_W, h: BOARD_H };

/** Eases the SVG viewBox towards a goal. With follow on, the goal tracks the pen (zoomed in). */
export class Camera {
  follow = false;
  zoom = 1.6;
  locked = false;      // e.g. while a doubt sheet or an overlay is open
  private cur: Box = { ...FULL };
  private goal: Box = { ...FULL };

  constructor(private svg: SVGSVGElement, private reduceMotion = false) {}

  target(x?: number, y?: number) {
    if (!this.follow || this.locked || x === undefined || y === undefined) { this.goal = { ...FULL }; return; }
    const w = BOARD_W / this.zoom, h = BOARD_H / this.zoom;
    const c = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    this.goal = { x: c(x - w / 2, 0, BOARD_W - w), y: c(y - h / 2, 0, BOARD_H - h), w, h };
  }

  full() { this.goal = { ...FULL }; }

  tick(dt: number) {
    const k = this.reduceMotion ? 1 : 1 - Math.pow(1 - 0.09, dt / 16.7);
    (['x', 'y', 'w', 'h'] as const).forEach(p => { this.cur[p] += (this.goal[p] - this.cur[p]) * k; });
    const v = this.cur;
    this.svg.setAttribute('viewBox', `${v.x.toFixed(1)} ${v.y.toFixed(1)} ${v.w.toFixed(1)} ${v.h.toFixed(1)}`);
  }
}
