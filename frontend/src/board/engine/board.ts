import { el, type Box, type Pt } from './svg';
import { Clock } from './clock';
import { Pen } from './pen';
import { Camera } from './camera';
import { Layout, type RegionName } from '../layout/regions';
import type { ActionT, LessonT, RefT } from '@/dsl/schema';
import type { Ctx } from './draw';
import { runAction } from './actions';

export interface Part { x: number; y: number; r?: number; box?: Box }
export interface Entity { id: string; g: SVGGElement; box: Box; parts: Record<string, Part>; data?: unknown }
export interface PageLayers { g: SVGGElement; diagram: SVGGElement; labels: SVGGElement; notes: SVGGElement; hits: SVGGElement }
export interface Page { title: string; layers: PageLayers }

export class Board {
  clock = new Clock();
  pen: Pen;
  camera: Camera;
  layout: Layout;
  pages: Page[] = [];
  cur = -1;
  viewing = -1;
  entities = new Map<string, Entity>();
  labelSlots: Record<'left' | 'right', [number, number][]> = { left: [], right: [] };
  assets = new Map<string, unknown>();
  onPages: () => void = () => {};
  private root: SVGGElement;
  private raf = 0;

  constructor(public svg: SVGSVGElement, public lesson: LessonT) {
    svg.replaceChildren();
    svg.setAttribute('viewBox', '0 0 1600 1000');
    const defs = el('defs', {}, svg);
    defs.innerHTML = `
      <filter id="wobble" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.4" xChannelSelector="R" yChannelSelector="G"/></filter>
      <marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1,1 L9,5 L1,9" fill="none" stroke="context-stroke" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></marker>
      <linearGradient id="shade" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".10"/></linearGradient>`;
    this.root = el('g', { class: 'pages' }, svg);
    this.pen = new Pen(svg);
    this.camera = new Camera(svg, this.clock.reduceMotion);
    this.pen.onMove = (x, y) => this.camera.target(x, y);
    this.layout = new Layout(lesson.layout);
    this.reset();
    let last = performance.now();
    const loop = (now: number) => { this.camera.tick(now - last); this.pen.tick(now); last = now; this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() { cancelAnimationFrame(this.raf); }

  get L(): PageLayers { return this.pages[this.cur].layers; }
  ctx(token: number | 'side'): Ctx { return { clock: this.clock, pen: this.pen, token }; }

  /** Load figure data etc. before playing, so drawing never waits on the network. */
  async preload() {
    const srcs = new Set<string>();
    for (const s of this.lesson.steps) for (const a of s.actions) if (a.type === 'traced_figure') srcs.add(a.src);
    await Promise.all([...srcs].map(async src => this.assets.set(src, await (await fetch(src)).json())));
  }

  reset() {
    this.root.replaceChildren(); this.pages = []; this.entities.clear();
    this.makePage('Board');
  }

  private makePage(title: string) {
    const g = el('g', { class: 'page' }, this.root);
    const layers: PageLayers = {
      g, diagram: el('g', { filter: 'url(#wobble)' }, g), labels: el('g', {}, g), notes: el('g', {}, g), hits: el('g', { class: 'hits' }, g),
    };
    this.pages.push({ title, layers }); this.cur = this.viewing = this.pages.length - 1;
    this.layout.reset(); this.labelSlots = { left: [], right: [] };
    this.onPages();
  }

  /** Wipe the board (eraser sweep) and start a fresh page. */
  async newPage(title: string | undefined, token: number) {
    const old = this.pages[this.cur].layers.g;
    const wipe = el('rect', { x: 0, y: 0, width: 0, height: 1000, fill: '#fff' }, this.root);
    await this.clock.tween(700, k => { wipe.setAttribute('width', String(1640 * k)); this.pen.at(Math.min(1590, 1640 * k), 500 + Math.sin(k * 30) * 380, '#9aa5b1'); }, token);
    old.style.display = 'none'; wipe.remove();
    this.makePage(title ?? `Board ${this.pages.length + 1}`);
  }

  showPage(i: number) {
    this.viewing = i;
    this.pages.forEach((p, k) => (p.layers.g.style.display = k === i ? '' : 'none'));
    this.camera.locked = i !== this.cur; this.camera.target();
    this.onPages();
  }

  /** Reserve space in a region; flips to a new page when the region is full. */
  async take(region: RegionName, h: number, token: number, gap?: number) {
    let r = this.layout.take(region, h, gap);
    if (!r) { await this.newPage(undefined, token); r = this.layout.take(region, h, gap)!; }
    return r;
  }
  async fit(region: RegionName, w: number, h: number, token: number) {
    let r = this.layout.fit(region, w, h);
    if (!r) { await this.newPage(undefined, token); r = this.layout.fit(region, w, h)!; }
    return r;
  }

  register(e: Entity) { this.entities.set(e.id, e); }

  /** Resolve a reference to a point (+ optional radius / box). */
  resolve(ref: RefT): Part {
    if (Array.isArray(ref)) return { x: ref[0], y: ref[1] };
    const [id, ...rest] = ref.split('.');
    const e = this.entities.get(id);
    if (!e) throw new Error(`Unknown reference "${ref}"`);
    if (!rest.length) return { x: e.box.x + e.box.w / 2, y: e.box.y + e.box.h / 2, box: e.box };
    const p = e.parts[rest.join('.')];
    if (!p) throw new Error(`Unknown part "${ref}"`);
    return p;
  }

  /** Point on the edge of a referenced thing, facing `toward`. */
  edgePoint(p: Part, toward: Pt, pad = 6): Pt {
    const dx = toward[0] - p.x, dy = toward[1] - p.y, d = Math.hypot(dx, dy) || 1;
    if (p.r) return [p.x + dx / d * (p.r + pad), p.y + dy / d * (p.r + pad)];
    if (p.box) {
      const hw = p.box.w / 2 + pad, hh = p.box.h / 2 + pad;
      const t = Math.min(hw / Math.abs(dx || 1e-6), hh / Math.abs(dy || 1e-6));
      return [p.x + dx * Math.min(t, 1), p.y + dy * Math.min(t, 1)];
    }
    return [p.x, p.y];
  }

  async run(a: ActionT, token: number) { await runAction(this, a, token); this.pen.bringToFront(this.svg); }
}
