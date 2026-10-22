/** A pausable, skippable animation clock. Every drawing call awaits tween(). */
export class Stop extends Error { constructor() { super('stop'); } }

export const NOOP = () => {};

export class Clock {
  paused = true;
  speed = 1;
  skipping = false;
  run = 0;               // incremented on restart/jump; old runs abort
  reduceMotion = typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  private frame = () => new Promise<number>(r => requestAnimationFrame(r));

  /** token: the run id that started this animation, or 'side' for animations that ignore pause (doubts, overlays). */
  async tween(ms: number, fn: (k: number) => void, token: number | 'side'): Promise<void> {
    let t = 0, last = performance.now(), prev = -1;
    while (t < ms) {
      await this.frame();
      if (token !== 'side' && token !== this.run) throw new Stop();
      const now = performance.now();
      if (token === 'side' || !this.paused) t += (now - last) * this.speed;
      last = now;
      if ((this.skipping && token !== 'side') || (this.reduceMotion && fn !== NOOP)) t = ms;
      if (t !== prev) { prev = t; fn(Math.min(1, t / ms)); }
    }
  }

  wait(ms: number, token: number | 'side') { return this.tween(ms, NOOP, token); }
}
