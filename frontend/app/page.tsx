'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Icons';
import { API_URL } from '@/lib/api';

interface Entry { id: string; title: string; subject: string; blurb: string; templates: string[]; steps: number }
interface Generated { id: string; title: string; subject?: string; topic: string; level: string; steps: number; model?: string }

const LEVELS = ['Basics', 'Standard', 'Quick revision'];
const IDEAS = ['Bubble sort', 'TCP three-way handshake', 'Photosynthesis', 'DFA for strings ending in 01', 'Pythagoras theorem'];

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
    <div className="app">
      <header className="top"><span className="logo"><Logo /></span><div className="crumb"><b>Brofessor</b></div></header>
      <main className="library">
        <section className="create">
          <h1>What do you want to learn?</h1>
          <p className="lede">Type any topic. Brofessor plans the lesson, then teaches it on the board while it writes the next steps.</p>
          <form onSubmit={e => { e.preventDefault(); create(); }} className="create-form">
            <input value={topic} onChange={e => setTopic(e.target.value)} maxLength={200} placeholder="e.g. Merge sort, Ohm's law, Normalization in DBMS" aria-label="Topic" />
            <button type="submit" disabled={topic.trim().length < 3}>Teach me</button>
          </form>
          <div className="create-opts">
            <div className="lvl" role="group" aria-label="Level">{LEVELS.map(l => <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)}>{l}</button>)}</div>
            <div className="lvl" role="group" aria-label="Class language">{(['english', 'hinglish'] as const).map(l => <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>{l === 'english' ? 'English' : 'Hinglish'}</button>)}</div>
          </div>
          <p className="ideas">Try: {IDEAS.map((t, i) => <span key={t}><button type="button" onClick={() => { setTopic(t); create(t); }}>{t}</button>{i < IDEAS.length - 1 ? ', ' : ''}</span>)}</p>
        </section>

        {recent && recent.length > 0 && <>
          <h2>Recently generated</h2>
          <ul className="lesson-grid">{recent.map(l => (
            <li key={l.id}><Link href={`/lesson/?gen=${encodeURIComponent(l.id)}`} className="lesson-card">
              <span className="subject">{l.subject || 'Generated'}</span><b>{l.title}</b>
              <span className="blurb">From the topic &ldquo;{l.topic}&rdquo;</span>
              <span className="tags">{l.level}, {l.steps} steps</span>
            </Link></li>))}
          </ul>
        </>}

        <h2>Hand-written samples</h2>
        <ul className="lesson-grid">
          {list.map(l => (
            <li key={l.id}>
              <Link href={`/lesson/?id=${l.id}`} className="lesson-card">
                <span className="subject">{l.subject}</span>
                <b>{l.title}</b>
                <span className="blurb">{l.blurb}</span>
                <span className="tags">{l.templates.join(', ')}, {l.steps} steps</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
