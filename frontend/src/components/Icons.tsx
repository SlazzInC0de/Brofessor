/** Hand-drawn, marker-like icon set (matches the board, avoids generic icon kits). */
import type { SVGProps } from 'react';

const base = { viewBox: '0 0 24 24', className: 'hd', 'aria-hidden': true } as const;
type P = SVGProps<SVGSVGElement>;

export const Play = (p: P) => <svg {...base} {...p}><path className="fill" d="M8.2 5.4c-.4 4.4-.3 8.8.1 13.1 3.7-2 7.2-4.2 10.6-6.6-3.4-2.3-7-4.4-10.7-6.5z" /></svg>;
export const Pause = (p: P) => <svg {...base} {...p}><path d="M8.6 5.4c.2 4.5.1 8.9-.2 13.3M15.4 5.6c-.1 4.4 0 8.8.3 13.1" strokeWidth={3} /></svg>;
export const Next = (p: P) => <svg {...base} {...p}><path className="fill" d="M6.3 6.2c-.3 3.9-.2 7.8.1 11.7 2.9-1.8 5.7-3.8 8.4-5.9-2.7-2-5.5-4-8.5-5.8z" /><path d="M17.3 6.1c.2 4 .1 7.9-.2 11.8" strokeWidth={2.4} /></svg>;
export const Speaker = ({ muted, ...p }: P & { muted?: boolean }) => <svg {...base} {...p}><path d="M4.2 9.4c1.3-.1 2.6 0 3.9-.2l4.6-3.8c.2 4.3.1 8.6-.1 12.9l-4.5-3.7c-1.3-.1-2.6 0-3.9-.1-.2-1.7-.2-3.4 0-5.1z" />{muted ? <path d="M16 9.2c1.7 1.8 3.4 3.7 5.1 5.6M21 9.3c-1.7 1.8-3.4 3.6-5 5.5" /> : <><path d="M16.2 8.7c1.6 2.1 1.6 4.7.1 6.8" /><path d="M18.8 6.3c2.7 3.4 2.7 7.9-.1 11.4" /></>}</svg>;
export const Close = (p: P) => <svg {...base} {...p}><path d="M6.3 6.1c3.8 3.9 7.6 7.8 11.5 11.7M17.6 6.4c-3.9 3.7-7.7 7.5-11.3 11.4" /></svg>;
export const Lines = (p: P) => <svg {...base} {...p}><path d="M5.2 6.3c4.6-.2 9.1-.1 13.7.1M5 10.6c3.7.1 7.4 0 11.1-.1M5.3 14.8c4.5-.1 9 0 13.4.2M5.1 19c2.7 0 5.4-.1 8.1 0" /></svg>;
export const CC = (p: P) => <svg {...base} {...p}><path d="M3.6 6.4c5.6-.3 11.2-.2 16.8.1.3 3.8.3 7.6 0 11.3-5.6.3-11.2.3-16.8 0-.3-3.8-.3-7.6 0-11.4z" /><path d="M10.4 10.2c-1-.9-3-.6-3.2 1.2-.2 1.8 1.6 2.9 3.2 1.9M16.6 10.2c-1-.9-3-.6-3.2 1.2-.2 1.8 1.6 2.9 3.2 1.9" /></svg>;
export const Target = (p: P) => <svg {...base} {...p}><path d="M12 5.3c3.8-.1 6.9 3 6.8 6.8 0 3.7-3.1 6.7-6.9 6.7-3.7 0-6.7-3.1-6.6-6.8.1-3.7 3-6.7 6.7-6.7z" /><path d="M12 9.6c1.3 0 2.4 1.1 2.4 2.4 0 1.3-1.1 2.4-2.4 2.4-1.3 0-2.4-1.1-2.4-2.4 0-1.3 1.1-2.4 2.4-2.4z" /><path d="M12 1.9v2.6M12 19.6v2.5M1.9 12h2.6M19.5 12h2.6" /></svg>;
export const Back = (p: P) => <svg {...base} {...p}><path d="M14.6 5.6c-2.2 2.1-4.3 4.2-6.3 6.4 2 2.2 4.1 4.3 6.4 6.3" /></svg>;
export const Logo = () => <svg viewBox="0 0 24 24" aria-hidden><path d="M8.6 4.8c-.3 4.7-.2 9.4.2 14M8.8 5.3c3.6-.8 7-.1 6.9 2.8-.1 2.3-2.6 3.4-6.4 3.6 4.4-.4 7.7.6 7.6 3.6-.1 3-4.1 4-8 3.4" /></svg>;
