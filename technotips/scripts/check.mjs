// בדיקה סטטית מהירה: תחביר כל קבצי ה-JS + בדיקות יחידה לפונקציות ליבה (ללא תלויות).
import { readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = [...walk(join(ROOT, 'assets/js')), ...walk(join(ROOT, 'api')), ...walk(join(ROOT, 'scripts')).filter((f) => !f.includes('node_modules'))].filter((f) => /\.m?js$/.test(f));
for (const f of files) execFileSync(process.execPath, ['--check', f], { stdio: 'inherit' });
console.log(`✓ תחביר תקין ב-${files.length} קבצים`);

const { slugify, buildSearchTokens, queryTokens, matchesTokens, parseTags, SLUG_RE } = await import('../assets/js/utils/text.js');
const { distributionProgress, rankRelated } = await import('../assets/js/utils/tip-logic.js');

assert.equal(slugify('Copilot in Outlook: 30 Seconds!'), 'copilot-in-outlook-30-seconds');
assert.equal(slugify('טיפ בעברית'), '');
assert.ok(SLUG_RE.test('tip-12') && !SLUG_RE.test('Tip 12') && !SLUG_RE.test('-a'));
assert.deepEqual(parseTags('Copilot, #Excel ,copilot,, Teams'), ['Copilot', 'Excel', 'Teams']);

const tip = { title: 'סיכום פגישה בקליק', summary: 'בקופיילוט', contentHtml: '<p>Teams <b>Copilot</b></p>', tags: ['Teams'], extras: [{ content: 'פרומפט מיוחד' }], number: 6 };
const tokens = buildSearchTokens(tip, 'Teams');
const has = (q) => matchesTokens({ searchTokens: tokens }, queryTokens(q));
assert.ok(has('סיכום'), 'מילה מלאה');
assert.ok(has('סיכ'), 'תחילית');
assert.ok(has('copilot'), 'אנגלית ללא רגישות לרישיות');
assert.ok(has('COPILOT teams'), 'כמה מילים');
assert.ok(has('קופיילוט'), 'הסרת תחילית ב');
assert.ok(has('מיוחד'), 'חיפוש בתוך extras');
assert.ok(!has('אקסל'), 'אין התאמה שגויה');

assert.deepEqual(distributionProgress([]), { total: 0, done: 0, state: 'none', label: 'אין קבוצות יעד' });
const p = distributionProgress([{ target: true, published: true }, { target: true }, { target: true }, { target: false, published: false }]);
assert.equal(`${p.done}/${p.total}`, '1/3'); assert.equal(p.state, 'partial');
assert.equal(distributionProgress([{ target: true, published: true }]).state, 'complete');
assert.equal(distributionProgress([{ target: true, published: false }]).state, 'pending');

const rel = rankRelated({ id: 'a', categoryId: 'c1', tags: ['x'] }, [{ id: 'a', categoryId: 'c1' }, { id: 'b', categoryId: 'c1', tags: ['x'] }, { id: 'c', categoryId: 'c2', tags: [] }, { id: 'd', categoryId: 'c2', tags: ['X'] }]);
assert.deepEqual(rel.map((t) => t.id), ['b', 'd']);
console.log('✓ בדיקות יחידה עברו');
