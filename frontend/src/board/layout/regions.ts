import type { Box } from '../engine/svg';

/**
 * The board is split into named regions. Actions name a region (or get a default);
 * the layout engine stacks content top-down inside it and starts a new page when it is full.
 */
export type RegionName = 'title' | 'main' | 'side' | 'left' | 'right';

export const PRESETS: Record<string, Partial<Record<RegionName, Box>>> = {
  classic: {
    title: { x: 40, y: 22, w: 1520, h: 74 },
    main: { x: 40, y: 112, w: 960, h: 860 },
    side: { x: 1050, y: 112, w: 510, h: 860 },
  },
  'figure-center': {
    left: { x: 28, y: 40, w: 470, h: 930 },
    main: { x: 512, y: 14, w: 576, h: 972 },
    right: { x: 1100, y: 40, w: 480, h: 930 },
  },
};

const FALLBACK: Record<RegionName, RegionName[]> = {
  title: ['title', 'right', 'side', 'main'],
  main: ['main'],
  side: ['side', 'right', 'left', 'main'],
  left: ['left', 'side', 'main'],
  right: ['right', 'side', 'main'],
};

export class Layout {
  private cursor: Partial<Record<RegionName, number>> = {};
  constructor(public preset: keyof typeof PRESETS = 'classic') { this.reset(); }

  reset() { for (const k of Object.keys(PRESETS[this.preset]) as RegionName[]) this.cursor[k] = PRESETS[this.preset][k]!.y; }

  resolve(name: RegionName): RegionName {
    const p = PRESETS[this.preset];
    return FALLBACK[name].find(n => p[n]) ?? 'main';
  }

  box(name: RegionName): Box { return PRESETS[this.preset][this.resolve(name)]!; }
  remaining(name: RegionName) { const b = this.box(name); return b.y + b.h - this.cursor[this.resolve(name)]!; }

  /** Reserve h pixels in a region. Returns the top-left, or null when it does not fit (caller starts a new page). */
  take(name: RegionName, h: number, gap = 14): { x: number; y: number; w: number } | null {
    const r = this.resolve(name), b = this.box(r), y = this.cursor[r]!;
    if (y + h > b.y + b.h + 1 && y > b.y) return null;
    this.cursor[r] = y + h + gap;
    return { x: b.x, y, w: b.w };
  }

  /** Fit a w×h drawing into the region (scaled down if needed), centred horizontally. */
  fit(name: RegionName, w: number, h: number, gap = 18): { x: number; y: number; s: number } | null {
    const r = this.resolve(name), b = this.box(r);
    const room = b.y + b.h - this.cursor[r]!;
    let s = Math.min(1, b.w / w);
    if (h * s > room) {
      if (this.cursor[r]! > b.y + 1) return null;            // try a fresh page first
      s = Math.min(s, b.h / h);
    }
    const y = this.cursor[r]!;
    this.cursor[r] = y + h * s + gap;
    return { x: b.x + (b.w - w * s) / 2, y, s };
  }
}
