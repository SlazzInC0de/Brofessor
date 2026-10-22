'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Icons';

interface Entry { id: string; title: string; subject: string; blurb: string; templates: string[]; steps: number }

export default function Library() {
  const [list, setList] = useState<Entry[]>([]);
  useEffect(() => { fetch('/lessons/index.json').then(r => r.json()).then(setList).catch(() => setList([])); }, []);
  return (
    <div className="app">
      <header className="top"><span className="logo"><Logo /></span><div className="crumb"><b>Brofessor</b></div></header>
      <main className="library">
        <h1>Lessons</h1>
        <p className="lede">Each lesson is a Board DSL file. Brofessor draws it stroke by stroke and explains it out loud.</p>
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
