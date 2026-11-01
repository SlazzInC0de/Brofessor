/**
 * Speech for a step. In order of preference:
 *   1. neural voice from the Brofessor API (/api/tts), with word timings for exact karaoke captions
 *   2. pre-generated files in /audio/<lesson>/<lang>/<step>.mp3
 *   3. the best browser voice
 */
export type Lang = 'english' | 'hinglish';
interface Word { w: string; t: number; d: number }
interface Info { url: string; words: Word[]; duration_ms: number }

const score = (v: SpeechSynthesisVoice) => {
  const n = v.name.toLowerCase();
  return (n.includes('natural') || n.includes('online') ? 3 : 0) + (n.includes('google') ? 2 : 0) + (v.localService ? 0 : 1);
};
function pickVoice(code: string) {
  const all = speechSynthesis.getVoices();
  const exact = all.filter(v => v.lang?.replace('_', '-') === code);
  const pool = exact.length ? exact : all.filter(v => v.lang?.startsWith(code.split('-')[0]));
  return pool.sort((a, b) => score(b) - score(a))[0] ?? null;
}

export class Narrator {
  voiceOn = true;
  /** Base URL of the Brofessor API when it can make narration audio; null = browser voice only. */
  api: string | null = null;
  private audio: HTMLAudioElement | null = null;
  private resolveCur: (() => void) | null = null;
  private noAudio: Record<string, boolean> = {};
  private apiDead: Record<string, boolean> = {};
  private infos = new Map<string, Promise<Info | null>>();
  private preloaded = new Map<string, HTMLAudioElement>();
  private run = 0;
  private paused = false;
  private rate = 1;
  /** Progress through the spoken words, 0..1 (word-accurate when timings are known). */
  onProgress: (frac: number) => void = () => {};

  constructor(private lessonId: string) { if (typeof speechSynthesis !== 'undefined') speechSynthesis.getVoices(); }

  stop() {
    this.run++;
    if (this.audio) { this.audio.onended = this.audio.onerror = this.audio.ontimeupdate = null; this.audio.pause(); this.audio = null; }
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    const r = this.resolveCur; this.resolveCur = null; r?.();
  }
  pause() { this.paused = true; if (this.audio) this.audio.pause(); else if (typeof speechSynthesis !== 'undefined') speechSynthesis.pause(); }
  resume() { this.paused = false; if (this.audio) this.audio.play().catch(() => {}); else if (typeof speechSynthesis !== 'undefined') speechSynthesis.resume(); }
  setRate(r: number) { this.rate = r; if (this.audio) this.audio.playbackRate = r; }
  get audioFrac() { return this.audio && this.audio.duration ? this.audio.currentTime / this.audio.duration : null; }

  private info(key: string, lang: Lang): Promise<Info | null> {
    const id = `${lang}/${key}`;
    if (!this.api || this.apiDead[lang]) return Promise.resolve(null);
    let p = this.infos.get(id);
    if (!p) {
      const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 20000);
      p = fetch(`${this.api}/api/tts/${encodeURIComponent(this.lessonId)}/${lang}/${encodeURIComponent(key)}`, { signal: ctl.signal })
        .then(r => (r.ok ? r.json() as Promise<Info> : null))
        .catch(() => null)
        .then(j => { clearTimeout(timer); if (!j) { this.infos.delete(id); } return j; });
      this.infos.set(id, p);
    }
    return p;
  }

  /** Ask the server for the next step's audio while this one plays, so there is no gap. */
  prefetch(key: string, lang: Lang) {
    if (!this.voiceOn) return;
    void this.info(key, lang).then(i => {
      if (!i || this.preloaded.has(i.url)) return;
      const a = new Audio(this.api + i.url); a.preload = 'auto'; this.preloaded.set(i.url, a);
    });
  }

  /** Resolves when the step's narration finishes (or is stopped). */
  speak(key: string, display: string, speech: string, lang: Lang, rate: number): Promise<void> {
    this.stop();
    this.rate = rate;
    if (!this.voiceOn) return Promise.resolve();
    const run = this.run;
    return new Promise<void>(res => {
      this.resolveCur = res;
      const alive = () => run === this.run;

      const viaBrowser = () => {
        if (!alive()) return;
        if (typeof speechSynthesis === 'undefined') return res();
        let text = display, v: SpeechSynthesisVoice | null;
        if (lang === 'english') v = pickVoice('en-IN') || pickVoice('en-US');
        else { v = pickVoice('hi-IN'); if (v) text = speech; else v = pickVoice('en-IN'); }
        const u = new SpeechSynthesisUtterance(text);
        if (v) { u.voice = v; u.lang = v.lang; }
        u.rate = Math.min(1.6, 0.95 * this.rate);
        const timer = setTimeout(res, display.length * 120 / this.rate + 3000);
        u.onend = u.onerror = () => { clearTimeout(timer); res(); };
        u.onboundary = e => this.onProgress(e.charIndex / text.length);
        speechSynthesis.speak(u);
      };

      const play = (src: string, words: Word[] | null, onFail: () => void, reuse?: HTMLAudioElement) => {
        if (!alive()) return;
        const a = reuse ?? new Audio(src);
        a.currentTime = 0; a.playbackRate = this.rate; this.audio = a;
        let k = 0;
        a.ontimeupdate = () => {
          if (words && words.length) {
            const t = a.currentTime * 1000;
            while (k + 1 < words.length && words[k + 1].t <= t) k++;
            if (k > 0 && words[k].t > t) k = 0;
            this.onProgress(t < words[0].t ? 0 : (k + 0.5) / words.length);
          } else if (a.duration) this.onProgress(a.currentTime / a.duration);
        };
        a.onended = () => { this.audio = null; this.onProgress(1); res(); };
        a.onerror = () => { this.audio = null; onFail(); };
        if (!this.paused) a.play().catch(() => { this.audio = null; onFail(); });
      };

      const viaFile = () => {
        if (!alive()) return;
        if (this.noAudio[lang]) return viaBrowser();
        play(`/audio/${this.lessonId}/${lang}/${key}.mp3`, null, () => { this.noAudio[lang] = true; viaBrowser(); });
      };

      if (!this.api || this.apiDead[lang]) return viaFile();
      void this.info(key, lang).then(i => {
        if (!alive()) return;
        if (!i) { this.apiDead[lang] = true; return viaFile(); }
        const url = this.api + i.url;
        play(url, i.words, () => { this.apiDead[lang] = true; viaFile(); }, this.preloaded.get(i.url));
        this.preloaded.delete(i.url);
      });
    });
  }
}
