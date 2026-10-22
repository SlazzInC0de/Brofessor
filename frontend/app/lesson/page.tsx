'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import LessonPlayer from '@/components/LessonPlayer';

function Inner() {
  const id = useSearchParams().get('id') ?? 'bst-insertion';
  return <LessonPlayer key={id} id={id} />;
}

export default function LessonPage() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}
