'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import LessonPlayer from '@/components/LessonPlayer';

function Inner() {
  const q = useSearchParams();
  const topic = q.get('topic') ?? undefined, gen = q.get('gen') ?? undefined;
  const id = q.get('id') ?? (topic || gen ? undefined : 'bst-insertion');
  const level = q.get('level') ?? undefined;
  const lang = (q.get('lang') as 'english' | 'hinglish' | null) ?? undefined;
  return <LessonPlayer key={`${id}|${gen}|${topic}|${level}|${lang}`} id={id} gen={gen} topic={topic} level={level} lang={lang} />;
}

export default function LessonPage() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}
