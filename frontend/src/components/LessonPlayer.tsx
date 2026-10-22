'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Lesson, type LessonT } from '@/dsl/schema';
import { Player, type PlayerState } from '@/board/engine/player';
import * as I from './Icons';

const SPEEDS = [0.9, 1, 1.25, 1.5, 2];
const PACE: Record<string, number> = { Basics: 0.9, Standard: 1, 'Quick revision': 1.25 };

export default function LessonPlayer({ id }: { id: string }) {
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

  // load + validate the lesson
  useEffect(() => {
    let off = false;
    fetch(`/lessons/${id}.json`).then(r => { if (!r.ok) throw new Error(`Lesson "${id}" not found`); return r.json(); })
      .then(j => { const res = Lesson.safeParse(j); if (!res.success) throw new Error('Invalid lesson: ' + res.error.issues.slice(0, 3).map(i => `${i.path.join('.')}: ${i.message}`).join('; ')); if (!off) setLesson(res.data); })
      .catch(e => !off && setError(String(e.message || e)));
    return () => { off = true; };
  }, [id]);

  // create the player once the board exists
  useEffect(() => {
    if (!lesson || !svgRef.current) return;
    const p = new Player(svgRef.current, lesson);
    playerRef.current = p;
    setLang(p.lang);
    const narrow = matchMedia('(max-width:720px)').matches;
    p.setFollow(narrow); setFollow(narrow);
    void p.preload();
    const unsub = p.subscribe(setS);
    return () => { unsub(); p.destroy(); playerRef.current = null; };
  }, [lesson]);

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
  if (error) return <main className="center-msg"><h1>Could not open this lesson</h1><p>{error}</p><Link href="/">Back to lessons</Link></main>;

  const steps = lesson?.steps ?? [];
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
              {lesson && !s?.started && (
                <div className="start"><div className="start-inner">
                  <h1>{lesson.title}</h1>
                  <p className="meta">{[lesson.subject, lesson.teaching_profile?.content_type, `${steps.length} steps`].filter(Boolean).join(', ')}</p>
                  <ol className="outline">{steps.map((st, i) => <li key={st.id}><span>{i + 1}</span>{st.title}</li>)}</ol>
                  <div className="start-row"><label id="lvl">Level</label>
                    <div className="lvl" role="group" aria-labelledby="lvl">{Object.keys(PACE).map(l => <button key={l} aria-pressed={level === l} onClick={() => setLevel(l)}>{l}</button>)}</div>
                  </div>
                  <button className="start-btn" onClick={() => start(0)}><I.Play width={18} height={18} />Start lesson</button>
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
              {caption ? <span>{words.map((w, i) => { if (!w.trim()) return w; wi++; const st = s!.captionWord; return <span key={i} className={'w ' + (wi < st ? '' : wi === st ? 'now' : 'future')}>{w}</span>; })}</span>
                : 'Captions appear here while Brofessor teaches.'}
            </div>
          </div>

          <div className="controls">
            <button className="ctl play" aria-label={s?.paused !== false ? 'Play' : 'Pause'} onClick={() => (s?.started ? p?.togglePause() : start(0))}>{s && !s.paused ? <I.Pause /> : <I.Play />}</button>
            <button className="ctl" aria-label="Next step" title="Next step" onClick={() => p?.skip()}><I.Next /></button>
            <span className="divider" aria-hidden />
            <div className="steps">
              <nav className="timeline" aria-label="Lesson steps">{steps.map((st, i) => {
                const cur = s?.step ?? -1, done = s?.done;
                const w = done || i < cur ? 100 : i === cur && s?.started ? (s.stepFrac * 100) : 0;
                return <button key={st.id} className={'seg' + (i === cur && !done && s?.started ? ' now' : '')} data-title={`${i + 1}. ${st.title}`} aria-label={`Go to step ${i + 1}: ${st.title}`} onClick={() => start(i)}><span className="fill" style={{ width: w + '%' }} /></button>;
              })}</nav>
              <span className="step-name">{s?.done ? <><b>Done</b> Lesson complete</> : s?.started ? <><b>{s.step + 1}/{steps.length}</b> {steps[s.step]?.title}</> : null}</span>
            </div>
            <span className="divider" aria-hidden />
            <button className="ctl" aria-pressed={follow} title="Follow the pen" aria-label="Follow the pen" onClick={() => { setFollow(!follow); p?.setFollow(!follow); }}><I.Target /></button>
            <button className="ctl speed" aria-label="Playback speed" onClick={() => { const n = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; setSpeed(n); p?.setSpeed(n); }}>{speed}x</button>
          </div>
          <p className="foot">{lesson?.credit ? lesson.credit + ' ' : ''}Shortcuts: <kbd>Space</kbd> pause, <kbd>→</kbd> next step. Doubts during class arrive with the live backend (Phase 6).</p>
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
