// מתאם הדגמה: אותו ממשק כמו firebase-adapter, אך הנתונים נשמרים ב-localStorage של הדפדפן.
// מיועד לבדיקה מקומית ולהדגמה בלבד – לא לשימוש בייצור.
import { normalizeTip, normalizeDistribution, rankRelated, compareBySort } from '../utils/tip-logic.js';
import { queryTokens, matchesTokens, buildSearchTokens } from '../utils/text.js';
import { blobToDataUrl, uid } from '../utils/image.js';
import { NUMBER_SORT_EMPTY } from './shared.js';

const KEY = 'technotips-demo-v1';
const SESSION_KEY = 'technotips-demo-session';
export const DEMO_CREDENTIALS = { email: 'admin@demo.local', password: 'demo1234' };

let state;
const authListeners = new Set();

export async function init() {
  const raw = localStorage.getItem(KEY);
  if (raw) { try { state = JSON.parse(raw); return; } catch { /* נטען seed מחדש */ } }
  const res = await fetch('/seed/seed-data.json');
  if (!res.ok) throw new Error('טעינת נתוני ההדגמה נכשלה');
  const seed = await res.json();
  const catName = Object.fromEntries(seed.categories.map((c) => [c.id, c.name]));
  const now = Date.now();
  state = {
    categories: seed.categories.map((c) => ({ ...c, createdAt: now, updatedAt: now })),
    groups: seed.distributionGroups.map((g) => ({ ...g, createdAt: now, updatedAt: now })),
    tips: {}, tipAdmin: {}
  };
  for (const t of seed.tips) {
    const { distribution = [], ...tip } = t;
    tip.searchTokens = buildSearchTokens(tip, catName[tip.categoryId]);
    tip.numberSort = tip.number ?? NUMBER_SORT_EMPTY;
    tip.createdAt = tip.updatedAt = tip.websitePublishedAt || new Date(now).toISOString();
    state.tips[tip.id] = tip;
    state.tipAdmin[tip.id] = { distribution };
  }
  persist();
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { throw new Error('נפח האחסון בדפדפן מלא (מצב הדגמה). מחקו תמונות או אפסו את נתוני ההדגמה.'); }
}
const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const clone = (o) => JSON.parse(JSON.stringify(o));
const tipsArr = () => Object.values(state.tips).map((t) => normalizeTip(clone(t)));

export function resetDemo() { localStorage.removeItem(KEY); sessionStorage.removeItem(SESSION_KEY); }

/* ---------- Auth ---------- */
function currentUser() {
  return sessionStorage.getItem(SESSION_KEY) ? { uid: 'demo-admin', email: DEMO_CREDENTIALS.email, isAdmin: true } : null;
}
export function onAuthChange(cb) {
  authListeners.add(cb);
  queueMicrotask(() => cb(currentUser()));
  return () => authListeners.delete(cb);
}
export async function login(email, password) {
  await delay();
  if (email.trim().toLowerCase() !== DEMO_CREDENTIALS.email || password !== DEMO_CREDENTIALS.password) {
    const e = new Error('פרטי ההתחברות שגויים.'); e.code = 'auth/invalid-credential'; throw e;
  }
  sessionStorage.setItem(SESSION_KEY, '1');
  authListeners.forEach((cb) => cb(currentUser()));
  return currentUser();
}
export async function logout() { sessionStorage.removeItem(SESSION_KEY); authListeners.forEach((cb) => cb(null)); }
function requireAdmin() { if (!currentUser()) { const e = new Error('אין הרשאה לפעולה זו.'); e.code = 'permission-denied'; throw e; } }

/* ---------- Public ---------- */
export async function listActiveCategories() {
  await delay(60);
  return clone(state.categories).filter((c) => c.active).sort((a, b) => a.order - b.order);
}

export async function listPublishedTips({ categoryId, tag, q, sort = 'newest', pageSize = 12, cursor = 0 } = {}) {
  await delay();
  const tokens = queryTokens(q);
  const all = tipsArr()
    .filter((t) => t.status === 'published')
    .filter((t) => !categoryId || t.categoryId === categoryId)
    .filter((t) => !tag || t.tags.some((x) => x.toLowerCase() === tag.toLowerCase()))
    .filter((t) => matchesTokens(t, tokens))
    .sort(compareBySort(sort));
  const start = cursor || 0;
  const items = all.slice(start, start + pageSize);
  return { items, cursor: start + items.length, hasMore: start + items.length < all.length };
}

export async function listFeaturedTips(n = 3) {
  await delay(60);
  return tipsArr().filter((t) => t.status === 'published' && t.featured).sort(compareBySort('newest')).slice(0, n);
}

export async function getPublishedTipBySlug(slug) {
  await delay();
  return tipsArr().find((t) => t.slug === slug && t.status === 'published') || null;
}

export async function getRelatedTips(tip) {
  return rankRelated(tip, tipsArr().filter((t) => t.status === 'published'));
}

/* ---------- Admin: tips ---------- */
export async function newTipId() { return uid('tip_'); }

export async function getTipForAdmin(id) {
  requireAdmin(); await delay(60);
  const t = state.tips[id];
  if (!t) return null;
  return { tip: normalizeTip(clone(t)), distribution: normalizeDistribution(state.tipAdmin[id]?.distribution || []) };
}

export async function listAllTipsAdmin() {
  requireAdmin(); await delay(60);
  return tipsArr().sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0))
    .map((tip) => ({ tip, distribution: normalizeDistribution(state.tipAdmin[tip.id]?.distribution || []) }));
}

export async function isSlugTaken(slug, exceptId) {
  requireAdmin();
  return Object.values(state.tips).some((t) => t.slug === slug && t.id !== exceptId);
}
export async function findTipsByNumber(number, exceptId) {
  requireAdmin();
  return Object.values(state.tips).filter((t) => t.number === number && t.id !== exceptId).map((t) => normalizeTip(clone(t)));
}

export async function saveTip(id, data, distribution, { isNew } = {}) {
  requireAdmin(); await delay();
  const now = new Date().toISOString();
  const prev = state.tips[id];
  if (!isNew && !prev) throw new Error('הטיפ לא נמצא (ייתכן שנמחק).');
  state.tips[id] = { ...clone(data), id, createdAt: prev?.createdAt || now, updatedAt: now };
  state.tipAdmin[id] = { distribution: clone(distribution) };
  persist();
}

export async function deleteTip(id) {
  requireAdmin(); await delay();
  delete state.tips[id]; delete state.tipAdmin[id];
  persist();
}

/* ---------- Admin: categories ---------- */
export async function listAllCategories() { requireAdmin(); return clone(state.categories).sort((a, b) => a.order - b.order); }
export async function isCategorySlugTaken(slug, exceptId) { return state.categories.some((c) => c.slug === slug && c.id !== exceptId); }
export async function saveCategory(cat) {
  requireAdmin(); await delay(60);
  const now = Date.now();
  const i = state.categories.findIndex((c) => c.id === cat.id);
  if (i >= 0) state.categories[i] = { ...state.categories[i], ...cat, updatedAt: now };
  else state.categories.push({ ...cat, id: uid('cat_'), createdAt: now, updatedAt: now });
  persist();
}
export async function deleteCategory(id) {
  requireAdmin();
  if (Object.values(state.tips).some((t) => t.categoryId === id)) {
    const e = new Error('לא ניתן למחוק קטגוריה שיש בה טיפים. העבירו את הטיפים או סמנו את הקטגוריה כלא פעילה.'); e.code = 'in-use'; throw e;
  }
  state.categories = state.categories.filter((c) => c.id !== id);
  persist();
}

/* ---------- Admin: distribution groups ---------- */
export async function listGroups() { requireAdmin(); return clone(state.groups).sort((a, b) => a.order - b.order); }
export async function saveGroup(g) {
  requireAdmin(); await delay(60);
  const now = Date.now();
  const i = state.groups.findIndex((x) => x.id === g.id);
  if (i >= 0) state.groups[i] = { ...state.groups[i], ...g, updatedAt: now };
  else state.groups.push({ ...g, id: uid('grp_'), createdAt: now, updatedAt: now });
  persist();
}
export async function deleteOrArchiveGroup(id) {
  requireAdmin();
  const used = Object.values(state.tipAdmin).some((a) => (a.distribution || []).some((d) => d.groupId === id));
  if (used) { await saveGroup({ id, archived: true, active: false }); return 'archived'; }
  state.groups = state.groups.filter((g) => g.id !== id); persist(); return 'deleted';
}

/* ---------- Media ---------- */
export async function uploadImage(tipId, kind, blob, ext, onProgress) {
  requireAdmin();
  for (let p = 20; p <= 100; p += 40) { onProgress?.(p); await delay(40); }
  const url = await blobToDataUrl(blob);
  return { url, storagePath: `demo:tips/${tipId}/${kind}/${uid()}.${ext}` };
}
export async function deleteFiles() { /* במצב הדגמה הקבצים נשמרים בתוך המסמך */ }
