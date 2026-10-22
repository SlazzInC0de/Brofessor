/** Speech for a step: pre-generated audio if present, otherwise the best browser voice. */
export type Lang = 'english' | 'hinglish';

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
  private audio: HTMLAudioElement | null = null;
  private resolveCur: (() => void) | null = null;
  private noAudio: Record<string, boolean> = {};
  onProgress: (frac: number) => void = () => {};

  constructor(private lessonId: string) { if (typeof speechSynthesis !== 'undefined') speechSynthesis.getVoices(); }

  stop() {
    if (this.audio) { this.audio.onended = this.audio.onerror = null; this.audio.pause(); this.audio = null; }
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    const r = this.resolveCur; this.resolveCur = null; r?.();
  }
  pause() { if (this.audio) this.audio.pause(); else speechSynthesis.pause(); }
  resume() { if (this.audio) this.audio.play().catch(() => {}); else speechSynthesis.resume(); }
  setRate(r: number) { if (this.audio) this.audio.playbackRate = r; }
  get audioFrac() { return this.audio && this.audio.duration ? this.audio.currentTime / this.audio.duration : null; }

  /** Resolves when the step's narration finishes (or is stopped). */
  speak(key: string, display: string, speech: string, lang: Lang, rate: number): Promise<void> {
    this.stop();
    if (!this.voiceOn) return Promise.resolve();
    return new Promise<void>(res => {
      this.resolveCur = res;
      const viaBrowser = () => {
        if (typeof speechSynthesis === 'undefined') return res();
        let text = display, v: SpeechSynthesisVoice | null;
        if (lang === 'english') v = pickVoice('en-IN') || pickVoice('en-US');
        else { v = pickVoice('hi-IN'); if (v) text = speech; else v = pickVoice('en-IN'); }
        const u = new SpeechSynthesisUtterance(text);
        if (v) { u.voice = v; u.lang = v.lang; }
        u.rate = Math.min(1.6, 0.95 * rate);
        const timer = setTimeout(res, display.length * 120 / rate + 3000);
        u.onend = u.onerror = () => { clearTimeout(timer); res(); };
        u.onboundary = e => this.onProgress(e.charIndex / text.length);
        speechSynthesis.speak(u);
      };
      if (this.noAudio[lang]) return viaBrowser();
      const a = new Audio(`/audio/${this.lessonId}/${lang}/${key}.mp3`);
      a.playbackRate = rate; this.audio = a;
      a.ontimeupdate = () => a.duration && this.onProgress(a.currentTime / a.duration);
      a.onended = () => { this.audio = null; res(); };
      a.onerror = () => { this.audio = null; this.noAudio[lang] = true; viaBrowser(); };
      a.play().catch(() => { this.audio = null; this.noAudio[lang] = true; viaBrowser(); });
    });
  }
}
