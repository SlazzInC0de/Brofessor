'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Lesson, Step, type LessonT } from '@/dsl/schema';
import { API_URL } from '@/lib/api';
import { Player, type PlayerState } from '@/board/engine/player';
import * as I from './Icons';

const SPEEDS = [0.9, 1, 1.25, 1.5, 2];
const PACE: Record<string, number> = { Basics: 0.9, Standard: 1, 'Quick revision': 1.25 };

export interface Source { id?: string; gen?: string; topic?: string; level?: string; lang?: 'english' | 'hinglish' }
type Plan = { id: string; title: string }[];

export default function LessonPlayer({ id, gen, topic, level: levelIn, lang: langIn }: Source) {
  const svgRef = useRef<SVGSVGElement>(null);
  const playerRef = useRef<Player | null>(null);
  const [lesson, setLesson] = useState<LessonT | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [s, setS] = useState<PlayerState | null>(null);
  const [lang, setLang] = useState<'english' | 'hinglish'>('english');
  const [speed, setSpeed] = useState(1);
  const [level, setLevel] = useState('Standard');
  const [cc, setCc] = useState(true);
  const [voice, setVoice] = useState(true);
  const [follow, setFollow] = useState(false);
  const [transcript, setTranscript] = useState(false);
  const [showEnd, setShowEnd] = useState(true);
  const [quiz, setQuiz] = useState<Record<number, number>>({});
  const [plan, setPlan] = useState<Plan | null>(null);          // streamed lessons: the outline arrives first
  const [genState, setGenState] = useState<'idle' | 'planning' | 'writing' | 'done'>('idle');
  const pending = useRef<LessonT['steps']>([]);
  const lessonRef = useRef<LessonT | null>(null);

  // load + validate the lesson (sample file, cached generated lesson, or a live generation stream)
  useEffect(() => {
    let off = false;
    const fail = (e: unknown) => !off && setError(String((e as Error)?.message || e));
    const load = (url: string) => fetch(url).then(r => { if (!r.ok) throw new Error('Lesson not found'); return r.json(); })
      .then(j => { const res = Lesson.safeParse(j); if (!res.success) throw new Error('Invalid lesson: ' + res.error.issues.slice(0, 3).map(i => `${i.path.join('.')}: ${i.message}`).join('; ')); if (!off) setLesson(res.data); })
      .catch(fail);
    if (topic) {
      setGenState('planning');
      const q = new URLSearchParams({ topic, level: levelIn || 'Standard', language: langIn || 'english' });
      const es = new EventSource(`${API_URL}/api/generate?${q}`);
      es.addEventListener('plan', ev => {
        const d = JSON.parse((ev as MessageEvent).data);
        const l: LessonT = { id: d.id, title: d.title, subject: d.subject ?? undefined, layout: d.layout ?? 'classic', languages: d.languages ?? ['english'], teaching_profile: d.teaching_profile ?? undefined, steps: [] };
        lessonRef.current = l; setPlan(d.steps); setLesson({ ...l }); setGenState('writing');
      });
      es.addEventListener('step', ev => {
        const d = JSON.parse((ev as MessageEvent).data);
        const res = Step.safeParse(d.step);
        if (!res.success) return;                       // the backend validates too; skip anything malformed
        const p = playerRef.current;
        if (p) p.addStep(res.data); else pending.current.push(res.data);
        setLesson(l => l ? { ...l, steps: [...(p ? p.lesson.steps : [...l.steps, res.data])] } : l);
      });
      es.addEventListener('done', ev => {
        const d = JSON.parse((ev as MessageEvent).data);
        setGenState('done'); setLesson(l => l ? { ...l, quiz: d.quiz ?? undefined } : l);
        if (playerRef.current && d.quiz) playerRef.current.lesson.quiz = d.quiz;
        es.close();
      });
      es.addEventListener('error', ev => {
        const data = (ev as MessageEvent).data;
        fail(data ? JSON.parse(data).message : `Could not reach the Brofessor API at ${API_URL}. Is the backend running?`);
        es.close();
      });
      return () => { off = true; es.close(); };
    }
    void load(gen ? `${API_URL}/api/lessons/${encodeURIComponent(gen)}` : `/lessons/${id}.json`);
    return () => { off = true; };
  }, [id, gen, topic, levelIn, langIn]);

  // create the player once the board exists (once per lesson id, not on every streamed step)
  useEffect(() => {
    if (!lesson || !svgRef.current) return;
    const p = new Player(svgRef.current, { ...lesson, steps: [...lesson.steps] });
    if (plan) { p.setExpected(plan.length); pending.current.forEach(st => p.addStep(st)); pending.current = []; }
    playerRef.current = p;
    setLang(p.lang);
    if (langIn) { p.setLang(langIn); setLang(langIn); }
    if (levelIn) setLevel(levelIn);
    const narrow = matchMedia('(max-width:720px)').matches;
    p.setFollow(narrow); setFollow(narrow);
    void p.preload();
    const unsub = p.subscribe(setS);
    return () => { unsub(); p.destroy(); playerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id]);

  // keyboard: space = pause, right = next step
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea')) return;
      if (e.code === 'Space' && !(e.target as HTMLElement).closest('button')) { e.preventDefault(); playerRef.current?.togglePause(); }
      if (e.code === 'ArrowRight') playerRef.current?.skip();
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, []);

  const p = playerRef.current;
  if (error) return <main className="center-msg"><h1>{topic ? 'Could not create this lesson' : 'Could not open this lesson'}</h1><p>{error}</p><Link href="/">Back to lessons</Link></main>;

  const steps = lesson?.steps ?? [];
  const outline: { id: string; title: string }[] = plan ?? steps;
  const ready = s?.ready ?? steps.length;
  const caption = s?.caption ?? '';
  const words = caption.split(/(\s+)/);
  let wi = -1;
  const start = (from = 0) => { if (!p) return; p.setSpeed(PACE[level] ?? speed); setSpeed(PACE[level] ?? speed); setShowEnd(true); setQuiz({}); void p.play(from); };

  return (
    <div className={'app' + (transcript ? ' siding' : '')}>
      <header className="top">
        <Link href="/" className="logo" aria-label="All lessons"><I.Logo /></Link>
        <div className="crumb"><Link href="/"><b>Brofessor</b></Link><span className="sep">/</span><span>{lesson?.title ?? 'Loading…'}</span></div>
        <div className="top-right">
          {lesson && lesson.languages.length > 1 && <>
            <span className="lang-label hide-sm">Class in</span>
            <div className="lang" role="group" aria-label="Class narration language" data-active={lang}>
              <span className="pill" aria-hidden />
              {(['hinglish', 'english'] as const).map(l => <button key={l} aria-pressed={lang === l} onClick={() => { setLang(l); p?.setLang(l); }}>{l === 'hinglish' ? 'Hinglish' : 'English'}</button>)}
            </div>
          </>}
          <button className="icon-btn toggle" aria-pressed={cc} title="Captions" aria-label="Captions" onClick={() => setCc(!cc)}><I.CC /></button>
          <button className="icon-btn toggle hide-sm" aria-pressed={transcript} title="Transcript" aria-label="Transcript" onClick={() => setTranscript(!transcript)}><I.Lines /></button>
          <button className="icon-btn" title="Voice" aria-label={voice ? 'Mute voice' : 'Unmute voice'} onClick={() => { setVoice(!voice); p?.setVoice(!voice); }}><I.Speaker muted={!voice} /></button>
        </div>
      </header>

      <div className="room"><div className="main">
        <div className="stage">
          <div className="card">
            <div className="surface">
              <svg ref={svgRef} className="board" role="img" aria-label="Whiteboard" />
              {!lesson && genState === 'planning' && (
                <div className="start"><div className="start-inner">
                  <h1>{topic}</h1>
                  <p className="meta">Brofessor is planning your lesson…</p>
                  <div className="planning-bar" aria-hidden><span /></div>
                </div></div>
              )}
              {lesson && !s?.started && (
                <div className="start"><div className="start-inner">
                  <h1>{lesson.title}</h1>
                  <p className="meta">{[lesson.subject, lesson.teaching_profile?.content_type, `${outline.length} steps`].filter(Boolean).join(', ')}{genState === 'writing' ? `. Writing step ${Math.min(ready + 1, outline.length)} of ${outline.length}…` : ''}</p>
                  <ol className="outline">{outline.map((st, i) => <li key={st.id} className={plan && i >= ready ? 'pending' : ''}><span>{i + 1}</span>{st.title}</li>)}</ol>
                  <div className="start-row"><label id="lvl">Level</label>
                    <div className="lvl" role="group" aria-labelledby="lvl">{Object.keys(PACE).map(l => <button key={l} aria-pressed={level === l} onClick={() => setLevel(l)}>{l}</button>)}</div>
                  </div>
                  <button className="start-btn" disabled={ready < 1} onClick={() => start(0)}><I.Play width={18} height={18} />{ready < 1 ? 'Writing the first step…' : genState === 'writing' ? 'Start now (the rest is being written)' : 'Start lesson'}</button>
                </div></div>
              )}
              {s && s.pages.length > 1 && (
                <div className="pages">{s.pages.map((pg, i) => <button key={i} aria-current={pg.viewing} className={pg.live && !s.done ? 'live' : ''} onClick={() => p?.showPage(i)}>{pg.title}{pg.live && !s.done ? ' (live)' : ''}</button>)}</div>
              )}
              {s?.done && showEnd && lesson && (
                <div className="end"><div className="end-inner">
                  <h2>Lesson complete</h2>
                  <p className="meta">{steps.length} steps covered.</p>
                  {lesson.quiz && <section className="panel"><h3>Quick check</h3>{lesson.quiz.map((q, qi) => (
                    <div className="q" key={qi}><p>{q.q}</p><div className="opts">{q.options.map((o, oi) => {
                      const picked = quiz[qi];
                      const cls = picked === undefined ? '' : oi === q.answer ? 'right' : oi === picked ? 'wrong' : '';
                      return <button key={oi} className={cls} disabled={picked !== undefined} onClick={() => setQuiz({ ...quiz, [qi]: oi })}>{o}</button>;
                    })}</div>{quiz[qi] !== undefined && q.why && <p className="why">{q.why}</p>}</div>
                  ))}</section>}
                  <div className="end-actions">
                    <button className="primary" onClick={() => start(0)}>Replay lesson</button>
                    <button onClick={() => window.print()}>Save notes as PDF</button>
                    <button onClick={() => setTranscript(true)}>Open transcript</button>
                    <button onClick={() => setShowEnd(false)}>View the board</button>
                  </div>
                </div></div>
              )}
            </div>
            <div className={'caption-bar' + (cc ? '' : ' off')} aria-live="polite" data-empty={!caption}>
              {caption && s?.waiting ? <span className="w future">{caption}</span>
                : caption ? <span>{words.map((w, i) => { if (!w.trim()) return w; wi++; const st = s!.captionWord; return <span key={i} className={'w ' + (wi < st ? '' : wi === st ? 'now' : 'future')}>{w}</span>; })}</span>
                : 'Captions appear here while Brofessor teaches.'}
            </div>
          </div>

          <div className="controls">
            <button className="ctl play" aria-label={s?.paused !== false ? 'Play' : 'Pause'} onClick={() => (s?.started ? p?.togglePause() : start(0))}>{s && !s.paused ? <I.Pause /> : <I.Play />}</button>
            <button className="ctl" aria-label="Next step" title="Next step" onClick={() => p?.skip()}><I.Next /></button>
            <span className="divider" aria-hidden />
            <div className="steps">
              <nav className="timeline" aria-label="Lesson steps">{outline.map((st, i) => {
                const cur = s?.step ?? -1, done = s?.done;
                const w = done || i < cur ? 100 : i === cur && s?.started ? (s.stepFrac * 100) : 0;
                const notYet = i >= ready;
                return <button key={st.id} disabled={notYet} className={'seg' + (i === cur && !done && s?.started ? ' now' : '') + (notYet ? ' pending' : '')} data-title={`${i + 1}. ${st.title}${notYet ? ' (being written)' : ''}`} aria-label={`Go to step ${i + 1}: ${st.title}`} onClick={() => start(i)}><span className="fill" style={{ width: w + '%' }} /></button>;
              })}</nav>
              <span className="step-name">{s?.done ? <><b>Done</b> Lesson complete</> : s?.waiting ? <><b>{s.step + 2}/{outline.length}</b> writing…</> : s?.started ? <><b>{s.step + 1}/{outline.length}</b> {outline[s.step]?.title}</> : null}</span>
            </div>
            <span className="divider" aria-hidden />
            <button className="ctl" aria-pressed={follow} title="Follow the pen" aria-label="Follow the pen" onClick={() => { setFollow(!follow); p?.setFollow(!follow); }}><I.Target /></button>
            <button className="ctl speed" aria-label="Playback speed" onClick={() => { const n = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; setSpeed(n); p?.setSpeed(n); }}>{speed}x</button>
          </div>
          <p className="foot">{lesson?.credit ? lesson.credit + ' ' : ''}{topic || gen ? 'Generated by AI from a topic: check important facts. ' : ''}Shortcuts: <kbd>Space</kbd> pause, <kbd>→</kbd> next step. Doubts during class arrive with the live backend (Phase 6).</p>
        </div>

        {transcript && (
          <aside className="transcript" aria-label="Transcript">
            <div className="side-head"><span className="side-title">Transcript</span><span className="side-note">Click a step to jump</span>
              <button className="icon-btn side-close" aria-label="Close transcript" onClick={() => setTranscript(false)}><I.Close /></button></div>
            <ol className="tr-list">{steps.map((st, i) => (
              <li key={st.id} className={s && (s.done || i < s.step) ? 'done' : s?.step === i && s.started ? 'now' : ''}>
                <button onClick={() => start(i)}><b>{i + 1}. {st.title}</b>{lang === 'hinglish' && st.narration.hi ? st.narration.hi : st.narration.en}</button>
              </li>))}</ol>
          </aside>
        )}
      </div></div>

      <div className="print-only"><h2>{lesson?.title}: notes</h2>{steps.map((st, i) => <p key={st.id}><b>{i + 1}. {st.title}.</b> {lang === 'hinglish' && st.narration.hi ? st.narration.hi : st.narration.en}</p>)}</div>
    </div>
  );
}
