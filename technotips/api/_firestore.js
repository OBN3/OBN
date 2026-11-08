// עזר משותף לפונקציות Vercel: קריאה ציבורית מ-Firestore דרך REST (ללא SDK וללא סודות).
// השאילתות עוברות דרך Security Rules כמו כל קורא אנונימי – לכן הן תמיד מסננות status == 'published'.

const PROJECT = process.env.FIREBASE_PROJECT_ID;
const API_KEY = process.env.FIREBASE_API_KEY;

export const isConfigured = () => !!(PROJECT && API_KEY);

function decode(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
  return null;
}
export function decodeFields(fields) {
  const o = {};
  for (const [k, v] of Object.entries(fields || {})) o[k] = decode(v);
  return o;
}

export async function runQuery(structuredQuery) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery?key=${API_KEY}`;
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ structuredQuery }) });
  if (!res.ok) throw new Error(`Firestore ${res.status}: ${await res.text()}`);
  const rows = await res.json();
  return rows.filter((r) => r.document).map((r) => ({ id: r.document.name.split('/').pop(), ...decodeFields(r.document.fields) }));
}

const eq = (field, value) => ({ fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value } });

export async function getPublishedTipBySlug(slug) {
  const rows = await runQuery({
    from: [{ collectionId: 'tips' }],
    where: { compositeFilter: { op: 'AND', filters: [eq('slug', { stringValue: slug }), eq('status', { stringValue: 'published' })] } },
    limit: 1
  });
  return rows[0] || null;
}

export async function listPublishedTipsForSitemap(max = 5000) {
  return runQuery({
    from: [{ collectionId: 'tips' }],
    where: eq('status', { stringValue: 'published' }),
    orderBy: [{ field: { fieldPath: 'websitePublishedAt' }, direction: 'DESCENDING' }],
    select: { fields: [{ fieldPath: 'slug' }, { fieldPath: 'updatedAt' }, { fieldPath: 'websitePublishedAt' }, { fieldPath: 'status' }] },
    limit: max
  });
}

export async function listActiveCategories() {
  return runQuery({
    from: [{ collectionId: 'categories' }],
    where: eq('active', { booleanValue: true }),
    select: { fields: [{ fieldPath: 'slug' }, { fieldPath: 'active' }] }
  });
}

export function originFrom(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
