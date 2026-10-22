import { Board } from './board';
import { Stop } from './clock';
import { Narrator, type Lang } from './narration';
import type { LessonT } from '@/dsl/schema';

export interface PlayerState {
  step: number; stepFrac: number; paused: boolean; started: boolean; done: boolean;
  caption: string; captionWord: number; pages: { title: string; live: boolean; viewing: boolean }[];
}

/** Runs a lesson step by step: draws the step's actions while narrating it; jump/skip/pause aware. */
export class Player {
  board: Board;
  narrator: Narrator;
  lang: Lang;
  state: PlayerState = { step: -1, stepFrac: 0, paused: true, started: false, done: false, caption: '', captionWord: -1, pages: [] };
  private listeners = new Set<(s: PlayerState) => void>();
  private stepStart = 0; private stepEst = 6000; private elapsed = 0; private last = 0; private driven = 0;
  private raf = 0;

  constructor(svg: SVGSVGElement, public lesson: LessonT) {
    this.board = new Board(svg, lesson);
    this.narrator = new Narrator(lesson.id);
    this.lang = lesson.languages.includes('hinglish') ? 'hinglish' : 'english';
    this.narrator.onProgress = f => { this.driven = performance.now(); this.setWord(f); };
    this.board.onPages = () => this.emit({ pages: this.pageList() });
    const loop = (now: number) => {
      const dt = now - (this.last || now); this.last = now;
      const s = this.state;
      if (s.started && !s.paused && !s.done && s.step >= 0) {
        this.elapsed += dt * this.board.clock.speed;
        const af = this.narrator.audioFrac;
        const f = Math.min(0.97, af ?? this.elapsed / this.stepEst);
        if (Math.abs(f - s.stepFrac) > 0.01) this.emit({ stepFrac: f });
        if (now - this.driven > 1500) this.setWord(Math.min(1, this.elapsed / this.stepEst));
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  subscribe(fn: (s: PlayerState) => void) { this.listeners.add(fn); fn(this.state); return () => this.listeners.delete(fn); }
  private emit(p: Partial<PlayerState>) { this.state = { ...this.state, ...p }; this.listeners.forEach(f => f(this.state)); }
  private pageList() { const b = this.board; return b.pages.map((p, i) => ({ title: p.title, live: i === b.cur, viewing: i === b.viewing })); }

  private words(t: string) { return t.split(/\s+/).filter(Boolean).length; }
  private setWord(f: number) { const n = this.words(this.state.caption); const i = Math.min(n - 1, Math.floor(f * n)); if (i !== this.state.captionWord) this.emit({ captionWord: i }); }

  narrationText(i: number) { const n = this.lesson.steps[i].narration; return this.lang === 'hinglish' && n.hi ? n.hi : n.en; }

  async preload() { await this.board.preload(); }

  /** Start (or jump) at step `from`. Earlier steps are redrawn instantly. */
  async play(from = 0) {
    const b = this.board, clock = b.clock;
    const token = ++clock.run;
    this.narrator.stop(); b.reset(); b.camera.locked = false; b.camera.full();
    clock.paused = false;
    this.emit({ started: true, paused: false, done: false, step: from, stepFrac: 0 });
    try {
      for (let i = 0; i < this.lesson.steps.length; i++) {
        const st = this.lesson.steps[i];
        const catchUp = i < from;
        clock.skipping = catchUp;
        if (!catchUp) {
          const text = this.narrationText(i);
          this.elapsed = 0; this.stepEst = Math.max(3500, text.length * 62); this.driven = 0;
          this.emit({ step: i, stepFrac: 0, caption: text, captionWord: -1 });
        }
        const text = this.narrationText(i);
        const speech = catchUp ? Promise.resolve()
          : this.narrator.voiceOn
            ? this.narrator.speak(st.id, text, (this.lang === 'hinglish' && st.narration.hi_speech) || text, this.lang, clock.speed)
            : clock.tween(Math.max(2500, text.length * 55), k => this.setWord(k), token).catch(() => {});
        for (const a of st.actions) await b.run(a, token);
        if (!clock.skipping) await speech; else this.narrator.stop();
        clock.skipping = false;
        if (!catchUp) { this.emit({ stepFrac: 1, captionWord: 9999 }); await clock.wait(450, token); }
      }
      b.camera.full();
      this.emit({ done: true, paused: true, step: this.lesson.steps.length - 1, stepFrac: 1, captionWord: 9999, pages: this.pageList() });
      clock.paused = true;
    } catch (e) { if (!(e instanceof Stop)) { console.error(e); throw e; } }
  }

  togglePause() {
    const c = this.board.clock;
    if (!this.state.started) { void this.play(0); return; }
    if (this.board.viewing !== this.board.cur) this.board.showPage(this.board.cur);
    c.paused = !c.paused;
    c.paused ? this.narrator.pause() : this.narrator.resume();
    this.emit({ paused: c.paused });
  }
  skip() { if (this.state.started && !this.state.done) { this.board.clock.skipping = true; this.narrator.stop(); } }
  setSpeed(s: number) { this.board.clock.speed = s; this.narrator.setRate(s); }
  setLang(l: Lang) { this.lang = l; }
  setFollow(on: boolean) { const c = this.board.camera; c.follow = on; c.zoom = matchMedia('(max-width:720px)').matches ? 2.1 : 1.6; if (!on) c.full(); }
  setVoice(on: boolean) { this.narrator.voiceOn = on; if (!on) this.narrator.stop(); }
  showPage(i: number) {
    this.board.showPage(i);
    if (i !== this.board.cur && !this.board.clock.paused && !this.state.done) { this.board.clock.paused = true; this.narrator.pause(); this.emit({ paused: true }); }
  }
  destroy() { cancelAnimationFrame(this.raf); this.board.clock.run++; this.narrator.stop(); this.board.destroy(); }
}
