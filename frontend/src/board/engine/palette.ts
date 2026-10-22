/** Three markers, like a professor: ink for drawing and text, blue for keywords, red for highlights. */
export const INK = '#1e252d';
export const BLUE = '#2b4fd8';
export const RED = '#d6333f';
export const SOFT = '#9aa5b1';   // body outlines, pointer arrows
export const FAINT = '#b4bcc6';  // frames and boxes

export const COLORS: Record<string, string> = { ink: INK, blue: BLUE, red: RED, soft: SOFT, faint: FAINT };
export const color = (c?: string) => (c ? COLORS[c] || c : INK);

export type Run = [text: string, color?: string];

/**
 * Inline markup used in lesson text:
 *   *keyword*  -> blue     !warning! -> red
 * e.g. "Teeth chew food (*mechanical digestion*)"
 */
export function parseRich(text: string): Run[] {
  const out: Run[] = [];
  const re = /\*([^*]+)\*|!([^!]+)!/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push([text.slice(last, m.index)]);
    out.push(m[1] !== undefined ? [m[1], 'blue'] : [m[2], 'red']);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push([text.slice(last)]);
  return out;
}
