// ניקוי קבצים יתומים: מוחק קבצים שנרשמו ב-cleanupQueue, ובאופציה --scan גם קבצים
// ב-Storage שאינם מקושרים לאף טיפ (למשל העלאות שלא נשמרו).
// שימוש: node cleanup.mjs [--scan] [--dry-run]
import { db, bucket } from './_admin.mjs';

const scan = process.argv.includes('--scan');
const dry = process.argv.includes('--dry-run');
const toDelete = new Set();

const q = await db.doc('cleanupQueue/pending').get();
(q.exists ? q.get('paths') || [] : []).forEach((p) => toDelete.add(p));

if (scan) {
  const used = new Set();
  (await db.collection('tips').get()).docs.forEach((d) => {
    const t = d.data();
    if (t.poster?.storagePath) used.add(t.poster.storagePath);
    (t.images || []).forEach((im) => im.storagePath && used.add(im.storagePath));
  });
  const [files] = await bucket().getFiles({ prefix: 'tips/' });
  const dayAgo = Date.now() - 24 * 3600 * 1000; // הגנה על העלאות בתהליך עריכה
  files.filter((f) => !used.has(f.name) && new Date(f.metadata.timeCreated).getTime() < dayAgo).forEach((f) => toDelete.add(f.name));
}

console.log(`${toDelete.size} קבצים למחיקה${dry ? ' (dry run)' : ''}`);
if (!dry) {
  for (const p of toDelete) { try { await bucket().file(p).delete({ ignoreNotFound: true }); } catch (e) { console.warn(`✗ ${p}: ${e.message}`); } }
  if (q.exists) await db.doc('cleanupQueue/pending').delete();
}
console.log('✓ סיום');
process.exit(0);
