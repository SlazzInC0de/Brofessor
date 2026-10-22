/** Validates every lesson in public/lessons against the Board DSL schema. Run: npm run validate */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Lesson } from '../src/dsl/schema';

const dir = join(__dirname, '..', 'public', 'lessons');
let bad = 0;
for (const f of readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json')) {
  const res = Lesson.safeParse(JSON.parse(readFileSync(join(dir, f), 'utf8')));
  if (res.success) console.log(`ok    ${f}  (${res.data.steps.length} steps)`);
  else { bad++; console.log(`FAIL  ${f}`); res.error.issues.slice(0, 5).forEach(i => console.log(`      ${i.path.join('.')}: ${i.message}`)); }
}
process.exit(bad ? 1 : 0);
