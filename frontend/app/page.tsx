'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Icons';
import { Handwritten } from '@/components/Handwritten';
import { API_URL } from '@/lib/api';

interface Entry { id: string; title: string; subject: string; blurb: string; templates: string[]; steps: number }
interface Generated { id: string; title: string; subject?: string; topic: string; level: string; steps: number; model?: string }

const LEVELS = ['Basics', 'Standard', 'Quick revision'];
const IDEAS = [
  { t: 'Bubble sort', c: 'yellow' },
  { t: 'TCP three-way handshake', c: 'blue' },
  { t: 'Photosynthesis', c: 'green' },
  { t: 'DFA for strings ending in 01', c: 'pink' },
  { t: 'Pythagoras theorem', c: 'yellow' },
];

export default function Library() {
  const router = useRouter();
  const [list, setList] = useState<Entry[]>([]);
  const [recent, setRecent] = useState<Generated[] | null>(null);
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState('Standard');
  const [lang, setLang] = useState<'english' | 'hinglish'>('english');

  useEffect(() => {
    fetch('/lessons/index.json').then(r => r.json()).then(setList).catch(() => setList([]));
    fetch(`${API_URL}/api/lessons`).then(r => r.json()).then(setRecent).catch(() => setRecent(null));
  }, []);

  const create = (t = topic) => {
    const clean = t.trim();
    if (clean.length < 3) return;
    router.push(`/lesson/?${new URLSearchParams({ topic: clean, level, lang })}`);
  };

  return (
    <div className="app paper-bg">
      <header className="top"><span className="logo"><Logo /></span><div className="crumb"><b>Brofessor</b></div></header>
      <main className="library">
        <section className="create">
          <Handwritten text="What do you want to learn?" mark="learn" size={46} maxWidth={760} />
          <p className="lede">Type any topic. Brofessor plans the lesson, then teaches it on a whiteboard, drawing every diagram stroke by stroke while it writes the next steps.</p>

          <form onSubmit={e => { e.preventDefault(); create(); }} className="notebook">
            <span className="tape tl" aria-hidden /><span className="tape tr" aria-hidden />
            <label htmlFor="topic" className="nb-label">Today&rsquo;s topic</label>
            <div className="nb-row">
              <input id="topic" value={topic} onChange={e => setTopic(e.target.value)} maxLength={200} placeholder="Merge sort, Ohm's law, normalization in DBMS…" autoComplete="off" />
              <button type="submit" disabled={topic.trim().length < 3}>Teach me</button>
            </div>
            <div className="nb-opts">
              <div className="nb-opt"><span>Level</span>
                <div className="lvl" role="group" aria-label="Level">{LEVELS.map(l => <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)}>{l}</button>)}</div>
              </div>
              <div className="nb-opt"><span>Class in</span>
                <div className="lvl" role="group" aria-label="Class language">{(['english', 'hinglish'] as const).map(l => <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>{l === 'english' ? 'English' : 'Hinglish'}</button>)}</div>
              </div>
            </div>
          </form>

          <div className="stickies" aria-label="Topic ideas">
            <span className="stickies-label">or pick one</span>
            {IDEAS.map(({ t, c }) => (
              <button key={t} type="button" className={'sticky ' + c} onClick={() => { setTopic(t); create(t); }}>{t}</button>
            ))}
          </div>
        </section>

        {recent && recent.length > 0 && <section className="shelf">
          <h2>Recently generated</h2>
          <ul className="cards">{recent.map(l => (
            <li key={l.id}><Link href={`/lesson/?gen=${encodeURIComponent(l.id)}`} className="index-card">
              <span className="tape" aria-hidden />
              <span className="subject">{l.subject || 'Generated'}</span>
              <b>{l.title}</b>
              <span className="blurb">From the topic &ldquo;{l.topic}&rdquo;</span>
              <span className="tags">{l.level} · {l.steps} steps</span>
            </Link></li>))}
          </ul>
        </section>}

        <section className="shelf">
          <h2>Hand-written samples</h2>
          <ul className="cards">
            {list.map(l => (
              <li key={l.id}>
                <Link href={`/lesson/?id=${l.id}`} className="index-card">
                  <span className="tape" aria-hidden />
                  <span className="subject">{l.subject}</span>
                  <b>{l.title}</b>
                  <span className="blurb">{l.blurb}</span>
                  <span className="tags">{l.templates.join(', ')} · {l.steps} steps</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <p className="signoff">Drawn, not generated.</p>
      </main>
    </div>
  );
}
