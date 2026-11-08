// ייבוא טיפים בכמות מקובץ JSON או CSV (UTF-8). רץ בצד שרת בלבד.
// שימוש: node import.mjs tips.csv [--publish] [--dry-run]
//
// CSV – שורת כותרות (עמודות אופציונליות למעט title):
//   number,title,slug,summary,content,category,tags,whatsappText,prompt,promptTitle,status
//   category = slug של קטגוריה קיימת | tags מופרדים ב-| | content יכול להכיל HTML בסיסי או טקסט עם שורות
// JSON – מערך אובייקטים באותו מבנה של Tip (ראו seed/seed-data.json).
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { db, toTs, FieldValue } from './_admin.mjs';
import { buildSearchTokens, slugify, parseTags, SLUG_RE } from '../assets/js/utils/text.js';

const [file, ...flags] = process.argv.slice(2);
if (!file) { console.error('שימוש: node import.mjs <file.csv|file.json> [--publish] [--dry-run]'); process.exit(1); }
const publish = flags.includes('--publish');
const dry = flags.includes('--dry-run');

function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

const toHtml = (s) => (/<[a-z][\s\S]*>/i.test(s) ? s : s.split(/\n{2,}/).map((p) => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>`).join(''));

const raw = readFileSync(file, 'utf8');
const items = file.endsWith('.json') ? JSON.parse(raw) : parseCsv(raw);
const cats = (await db.collection('categories').get()).docs.map((d) => ({ id: d.id, ...d.data() }));
const bySlug = new Map(cats.map((c) => [c.slug, c]));
const existingSlugs = new Set((await db.collection('tips').select('slug').get()).docs.map((d) => d.get('slug')));

let ok = 0; const errors = [];
let batch = db.batch(), inBatch = 0;
for (const [i, r] of items.entries()) {
  const line = i + 2;
  const title = (r.title || '').trim();
  if (!title) { errors.push(`שורה ${line}: חסרה כותרת`); continue; }
  const cat = r.categoryId ? cats.find((c) => c.id === r.categoryId) : bySlug.get((r.category || '').trim());
  if (!cat) { errors.push(`שורה ${line}: קטגוריה "${r.category || r.categoryId || ''}" לא נמצאה`); continue; }
  const number = r.number === '' || r.number == null ? null : Number(r.number);
  let slug = (r.slug || slugify(title) || (number != null ? `tip-${number}` : `tip-${randomUUID().slice(0, 8)}`)).toLowerCase();
  if (!SLUG_RE.test(slug)) { errors.push(`שורה ${line}: slug לא תקין "${slug}"`); continue; }
  let n = 2; const base = slug; while (existingSlugs.has(slug)) slug = `${base}-${n++}`;
  existingSlugs.add(slug);
  const extras = Array.isArray(r.extras) ? r.extras : (r.prompt ? [{ id: randomUUID(), type: 'prompt', title: r.promptTitle || 'פרומפט', content: r.prompt, url: '', order: 0 }] : []);
  const status = r.status === 'published' || publish ? 'published' : 'draft';
  const ref = r.id ? db.collection('tips').doc(String(r.id)) : db.collection('tips').doc();
  const tip = {
    id: ref.id, number, numberSort: number ?? 999999999, title, slug, summary: r.summary || '',
    contentHtml: toHtml(r.contentHtml || r.content || ''), poster: r.poster || null, images: r.images || [], extras,
    categoryId: cat.id, tags: parseTags(Array.isArray(r.tags) ? r.tags : String(r.tags || '').split('|')),
    authorName: r.authorName || '', status, featured: r.featured === true || r.featured === 'true',
    websitePublishedAt: status === 'published' ? toTs(r.websitePublishedAt || new Date()) : null,
    whatsappText: r.whatsappText || '', seo: r.seo || { title: '', description: '' },
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
  };
  tip.searchTokens = buildSearchTokens(tip, cat.name);
  if (!dry) {
    batch.set(ref, tip); batch.set(db.doc(`tipAdmin/${ref.id}`), { distribution: [], updatedAt: FieldValue.serverTimestamp() });
    inBatch += 2;
    if (inBatch >= 400) { await batch.commit(); batch = db.batch(); inBatch = 0; }
  }
  ok++;
}
if (!dry && inBatch) await batch.commit();
console.log(`${dry ? '[Dry run] ' : ''}✓ ${ok} טיפים ${dry ? 'תקינים לייבוא' : 'יובאו'}${errors.length ? `, ${errors.length} שגיאות:` : ''}`);
errors.forEach((e) => console.log(`  ✗ ${e}`));
process.exit(errors.length && !ok ? 1 : 0);
