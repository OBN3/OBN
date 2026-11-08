// אתחול Firebase Admin SDK עבור הסקריפטים. דורש GOOGLE_APPLICATION_CREDENTIALS (קובץ Service Account).
// אזהרה: Service Account מעניק הרשאות מלאות – לעולם לא לשמור ב-Git ולא לחשוף לדפדפן.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(ROOT, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
if (process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_APPLICATION_CREDENTIALS.startsWith('/')) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = join(ROOT, process.env.GOOGLE_APPLICATION_CREDENTIALS);
}
if (!process.env.FIREBASE_PROJECT_ID) { console.error('✗ חסר FIREBASE_PROJECT_ID ב-.env'); process.exit(1); }

const app = initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID, storageBucket: process.env.FIREBASE_STORAGE_BUCKET });
export const db = getFirestore(app);
export const auth = getAuth(app);
export const bucket = () => getStorage(app).bucket();
export { Timestamp, FieldValue, ROOT };

export const toTs = (v) => (v ? Timestamp.fromDate(new Date(v)) : null);
