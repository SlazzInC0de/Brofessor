import { el } from './svg';

/** The marker that follows whatever is being drawn. */
export class Pen {
  readonly layer: SVGGElement;
  private g: SVGGElement;
  private tip: SVGPathElement;
  private cap: SVGRectElement;
  last = 0;
  onMove: (x: number, y: number) => void = () => {};

  constructor(svg: SVGSVGElement) {
    this.layer = el('g', { 'pointer-events': 'none', class: 'pen-layer' }, svg);
    this.g = el('g', { opacity: 0 }, this.layer);
    const r = el('g', { transform: 'rotate(28)' }, this.g);
    el('rect', { x: -5, y: -60, width: 10, height: 42, rx: 4, fill: '#2a3139' }, r);
    this.cap = el('rect', { x: -5.6, y: -70, width: 11.2, height: 13, rx: 3.5, fill: '#1e252d' }, r);
    el('path', { d: 'M-4.2 -18.5 L4.2 -18.5 L1.7 -4.5 L-1.7 -4.5 Z', fill: '#c9ced4' }, r);
    this.tip = el('path', { d: 'M-1.7 -4.5 L1.7 -4.5 L0 0 Z', fill: '#1e252d' }, r);
  }

  at(x: number, y: number, color?: string) {
    this.g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    this.g.setAttribute('opacity', '1');
    this.last = performance.now();
    if (color) { this.tip.setAttribute('fill', color); this.cap.setAttribute('fill', color); }
    this.onMove(x, y);
  }

  /** called every frame; hides the pen when nothing has moved for a moment */
  tick(now: number) { if (now - this.last > 450) this.g.setAttribute('opacity', '0'); }

  bringToFront(svg: SVGSVGElement) { svg.appendChild(this.layer); }
}
