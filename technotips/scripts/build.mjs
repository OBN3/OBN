// Build ל-Vercel (ללא תלויות):
// 1. יוצר assets/js/firebase-config.js ממשתני הסביבה.
// 2. מעתיק את האתר ל-dist/ עם תיקיית assets מגורסת (/assets/v<hash>/) ל-Cache ארוך ובטוח.
// שימוש: node scripts/build.mjs            (build מלא)
//        node scripts/build.mjs --config-only  (רק יצירת קובץ ההגדרות מ-.env, לפיתוח מקומי)
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, cpSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

// טעינת .env פשוטה (לפיתוח מקומי)
const envFile = join(ROOT, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const env = (k, d = '') => (process.env[k] ?? d).trim();

function configSource() {
  const cfg = {
    apiKey: env('FIREBASE_API_KEY'), authDomain: env('FIREBASE_AUTH_DOMAIN'), projectId: env('FIREBASE_PROJECT_ID'),
    storageBucket: env('FIREBASE_STORAGE_BUCKET'), messagingSenderId: env('FIREBASE_MESSAGING_SENDER_ID'), appId: env('FIREBASE_APP_ID')
  };
  const pretty = env('PRETTY_URLS', process.env.VERCEL ? 'true' : 'false') === 'true';
  const site = { siteName: 'טכנוטיפים', siteUrl: env('SITE_URL').replace(/\/$/, ''), prettyUrls: pretty, forceDemo: env('FORCE_DEMO') === 'true' };
  return { cfg, src: `// נוצר אוטומטית ע"י scripts/build.mjs – אין לערוך ידנית בייצור.
export const firebaseConfig = ${JSON.stringify(cfg, null, 2)};

export const siteConfig = ${JSON.stringify(site, null, 2)};
` };
}

const { cfg, src } = configSource();
const configured = !!(cfg.apiKey && cfg.projectId);

if (process.argv.includes('--config-only')) {
  writeFileSync(join(ROOT, 'assets/js/firebase-config.js'), src);
  console.log(`✓ assets/js/firebase-config.js נוצר (${configured ? `פרויקט ${cfg.projectId}` : 'מצב הדגמה'})`);
  process.exit(0);
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// Hash לתוכן assets + קובץ ההגדרות
function walk(dir) { return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; }); }
const assetFiles = walk(join(ROOT, 'assets')).sort();
const hash = createHash('sha1');
for (const f of assetFiles) { hash.update(relative(ROOT, f)); hash.update(f.endsWith('firebase-config.js') ? src : readFileSync(f)); }
const version = `v${hash.digest('hex').slice(0, 10)}`;

cpSync(join(ROOT, 'assets'), join(DIST, 'assets', version), { recursive: true });
writeFileSync(join(DIST, 'assets', version, 'js/firebase-config.js'), src);
cpSync(join(ROOT, 'media'), join(DIST, 'media'), { recursive: true });
if (!configured) cpSync(join(ROOT, 'seed'), join(DIST, 'seed'), { recursive: true }); // נדרש רק למצב הדגמה

const rewrite = (html) => html.replaceAll('"/assets/', `"/assets/${version}/`);
const htmlFiles = [...readdirSync(ROOT).filter((f) => f.endsWith('.html')), ...readdirSync(join(ROOT, 'admin')).filter((f) => f.endsWith('.html')).map((f) => `admin/${f}`)];
mkdirSync(join(DIST, 'admin'), { recursive: true });
for (const f of htmlFiles) writeFileSync(join(DIST, f), rewrite(readFileSync(join(ROOT, f), 'utf8')));

console.log(`✓ Build הושלם → dist/ (assets ${version}, ${htmlFiles.length} דפים, ${configured ? `Firebase: ${cfg.projectId}` : 'מצב הדגמה – Firebase לא הוגדר'})`);
