// טעינת נתוני דוגמה (seed/seed-data.json) ל-Firestore: קטגוריות, קבוצות הפצה ו-7 טיפים.
// שימוש: node seed.mjs [--force]   (ללא --force לא ידרוס מסמכים קיימים)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { db, ROOT, toTs, FieldValue } from './_admin.mjs';
import { buildSearchTokens } from '../assets/js/utils/text.js';

const force = process.argv.includes('--force');
const seed = JSON.parse(readFileSync(join(ROOT, 'seed/seed-data.json'), 'utf8'));
const catName = Object.fromEntries(seed.categories.map((c) => [c.id, c.name]));
const now = FieldValue.serverTimestamp();
let written = 0, skipped = 0;

async function put(path, data) {
  const ref = db.doc(path);
  if (!force && (await ref.get()).exists) { skipped++; return; }
  await ref.set(data); written++;
}

for (const { id, ...c } of seed.categories) await put(`categories/${id}`, { ...c, createdAt: now, updatedAt: now });
for (const { id, ...g } of seed.distributionGroups) await put(`distributionGroups/${id}`, { ...g, createdAt: now, updatedAt: now });
for (const t of seed.tips) {
  const { distribution = [], ...tip } = t;
  await put(`tips/${tip.id}`, {
    ...tip,
    numberSort: tip.number ?? 999999999,
    searchTokens: buildSearchTokens(tip, catName[tip.categoryId]),
    websitePublishedAt: toTs(tip.websitePublishedAt),
    createdAt: now, updatedAt: now
  });
  await put(`tipAdmin/${tip.id}`, { distribution: distribution.map((d) => ({ ...d, publishedAt: toTs(d.publishedAt) })), updatedAt: now });
}
console.log(`✓ Seed הושלם: ${written} מסמכים נכתבו, ${skipped} דולגו (קיימים${force ? '' : '; השתמשו ב---force לדריסה'}).`);
console.log('ℹ️ הפוסטרים בנתוני הדוגמה הם קבצי SVG מתוך /media/seed – הם יוצגו רק כשהאתר מוגש מאותו דומיין.');
process.exit(0);
