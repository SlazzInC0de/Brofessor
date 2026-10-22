import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import 'katex/dist/katex.min.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Brofessor',
  description: 'Any topic, taught on a whiteboard: drawn stroke by stroke, explained out loud.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
