// מתאם Firebase: Firestore (נתונים), Storage (מדיה), Authentication (מנהל).
// כל ההרשאות נאכפות ב-firestore.rules / storage.rules – הבדיקות כאן הן לחוויית משתמש בלבד.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  initializeFirestore, collection, doc, getDoc, getDocs, query, where, orderBy, limit, startAfter,
  writeBatch, setDoc, addDoc, deleteDoc, serverTimestamp, Timestamp, arrayUnion
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
// Auth ו-Storage נטענים בעצלות – הדפים הציבוריים טוענים רק App + Firestore (חיסכון משמעותי בגודל).
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
let authP, storageP;
function authMod() {
  if (!authP) authP = import(`${SDK}/firebase-auth.js`).then((m) => ({ m, auth: m.getAuth(app) }));
  return authP;
}
function storageMod() {
  if (!storageP) storageP = import(`${SDK}/firebase-storage.js`).then((m) => ({ m, storage: m.getStorage(app) }));
  return storageP;
}
import { firebaseConfig } from '../firebase-config.js';
import { normalizeTip, normalizeDistribution, rankRelated } from '../utils/tip-logic.js';
import { queryTokens, matchesTokens } from '../utils/text.js';
import { uid } from '../utils/image.js';

let app, db;

export async function init() {
  app = initializeApp(firebaseConfig);
  db = initializeFirestore(app, { ignoreUndefinedProperties: true });
}

/* ---------- המרות ---------- */
function convert(v) {
  if (v instanceof Timestamp) return v.toDate();
  if (Array.isArray(v)) return v.map(convert);
  if (v && typeof v === 'object' && v.constructor === Object) {
    const o = {}; for (const [k, x] of Object.entries(v)) o[k] = convert(x); return o;
  }
  return v;
}
const tipFrom = (snap) => normalizeTip({ id: snap.id, ...convert(snap.data()) });
const plainFrom = (snap) => ({ id: snap.id, ...convert(snap.data()) });

function friendly(err) {
  const map = {
    'permission-denied': 'אין הרשאה לפעולה זו.',
    'unavailable': 'אין חיבור לשרת. בדקו את החיבור לאינטרנט ונסו שוב.',
    'failed-precondition': 'נדרש אינדקס ב-Firestore. ראו README (firestore.indexes.json).',
    'storage/unauthorized': 'אין הרשאה להעלות קבצים.',
    'storage/canceled': 'ההעלאה בוטלה.',
    'storage/quota-exceeded': 'חרגתם ממכסת האחסון.'
  };
  const e = new Error(map[err?.code] || err?.message || 'שגיאה לא צפויה');
  e.code = err?.code; e.cause = err;
  return e;
}
async function safe(fn) { try { return await fn(); } catch (e) { throw friendly(e); } }

/* ---------- Auth ---------- */
async function checkAdmin(user) {
  if (!user) return false;
  const token = await user.getIdTokenResult();
  if (token.claims.admin === true) return true;
  try { return (await getDoc(doc(db, 'admins', user.uid))).exists(); } catch { return false; }
}

export function onAuthChange(cb) {
  let off = null, cancelled = false;
  authMod().then(({ m, auth }) => {
    if (cancelled) return;
    off = m.onAuthStateChanged(auth, async (user) => {
      if (!user) return cb(null);
      cb({ uid: user.uid, email: user.email, isAdmin: await checkAdmin(user) });
    });
  });
  return () => { cancelled = true; off?.(); };
}

export async function login(email, password) {
  const { m, auth } = await authMod();
  try {
    await m.setPersistence(auth, m.browserSessionPersistence);
    const { user } = await m.signInWithEmailAndPassword(auth, email, password);
    const isAdmin = await checkAdmin(user);
    if (!isAdmin) { await m.signOut(auth); const e = new Error('למשתמש זה אין הרשאת ניהול.'); e.code = 'not-admin'; throw e; }
    return { uid: user.uid, email: user.email, isAdmin };
  } catch (e) {
    if (e.code === 'not-admin') throw e;
    const msg = {
      'auth/invalid-credential': 'פרטי ההתחברות שגויים.', 'auth/wrong-password': 'פרטי ההתחברות שגויים.',
      'auth/user-not-found': 'פרטי ההתחברות שגויים.', 'auth/too-many-requests': 'יותר מדי ניסיונות. נסו שוב מאוחר יותר.',
      'auth/network-request-failed': 'אין חיבור לרשת.'
    }[e.code];
    const err = new Error(msg || 'ההתחברות נכשלה.'); err.code = e.code; throw err;
  }
}
export async function logout() { const { m, auth } = await authMod(); await m.signOut(auth); }

/* ---------- Public ---------- */
export async function listActiveCategories() {
  return safe(async () => {
    const snap = await getDocs(query(collection(db, 'categories'), where('active', '==', true), orderBy('order', 'asc')));
    return snap.docs.map(plainFrom);
  });
}

function sortConstraint(sort) {
  if (sort === 'oldest') return orderBy('websitePublishedAt', 'asc');
  if (sort === 'number') return orderBy('numberSort', 'asc');
  return orderBy('websitePublishedAt', 'desc');
}

/**
 * עימוד מבוסס cursor. חיפוש: הטוקן הארוך ביותר נשלח ל-Firestore (array-contains),
 * ושאר הטוקנים + סינון תגית בזמן חיפוש מסוננים בצד הלקוח.
 */
export async function listPublishedTips({ categoryId, tag, q, sort = 'newest', pageSize = 12, cursor = null } = {}) {
  return safe(async () => {
    const tokens = queryTokens(q);
    const cons = [where('status', '==', 'published')];
    if (categoryId) cons.push(where('categoryId', '==', categoryId));
    if (tokens.length) {
      const longest = [...tokens].sort((a, b) => b.length - a.length)[0];
      cons.push(where('searchTokens', 'array-contains', longest));
    } else if (tag) cons.push(where('tags', 'array-contains', tag));
    cons.push(sortConstraint(sort), limit(pageSize));
    if (cursor) cons.push(startAfter(cursor));
    const snap = await getDocs(query(collection(db, 'tips'), ...cons));
    let items = snap.docs.map(tipFrom).filter((t) => matchesTokens(t, tokens));
    if (tokens.length && tag) items = items.filter((t) => t.tags.some((x) => x.toLowerCase() === tag.toLowerCase()));
    return { items, cursor: snap.docs[snap.docs.length - 1] || cursor, hasMore: snap.docs.length === pageSize };
  });
}

export async function listFeaturedTips(n = 3) {
  return safe(async () => {
    const snap = await getDocs(query(collection(db, 'tips'), where('status', '==', 'published'), where('featured', '==', true), orderBy('websitePublishedAt', 'desc'), limit(n)));
    return snap.docs.map(tipFrom);
  });
}

export async function getPublishedTipBySlug(slug) {
  return safe(async () => {
    const snap = await getDocs(query(collection(db, 'tips'), where('slug', '==', slug), where('status', '==', 'published'), limit(1)));
    return snap.empty ? null : tipFrom(snap.docs[0]);
  });
}

export async function getRelatedTips(tip) {
  return safe(async () => {
    const base = collection(db, 'tips');
    const reads = [];
    if (tip.categoryId) reads.push(getDocs(query(base, where('status', '==', 'published'), where('categoryId', '==', tip.categoryId), orderBy('websitePublishedAt', 'desc'), limit(8))));
    if (tip.tags?.length) reads.push(getDocs(query(base, where('status', '==', 'published'), where('tags', 'array-contains-any', tip.tags.slice(0, 10)), orderBy('websitePublishedAt', 'desc'), limit(8))));
    const snaps = await Promise.all(reads);
    const map = new Map();
    snaps.forEach((s) => s.docs.forEach((d) => map.set(d.id, tipFrom(d))));
    return rankRelated(tip, [...map.values()]);
  });
}

/* ---------- Admin: tips ---------- */
export async function newTipId() { return doc(collection(db, 'tips')).id; }

export async function getTipForAdmin(id) {
  return safe(async () => {
    const [t, a] = await Promise.all([getDoc(doc(db, 'tips', id)), getDoc(doc(db, 'tipAdmin', id))]);
    if (!t.exists()) return null;
    return { tip: tipFrom(t), distribution: normalizeDistribution(a.exists() ? convert(a.data()).distribution : []) };
  });
}

/** שתי קריאות בלבד (tips + tipAdmin) – ללא N+1. */
export async function listAllTipsAdmin() {
  return safe(async () => {
    const [tips, admin] = await Promise.all([
      getDocs(query(collection(db, 'tips'), orderBy('updatedAt', 'desc'))),
      getDocs(collection(db, 'tipAdmin'))
    ]);
    const dist = new Map(admin.docs.map((d) => [d.id, normalizeDistribution(convert(d.data()).distribution || [])]));
    return tips.docs.map((d) => ({ tip: tipFrom(d), distribution: dist.get(d.id) || [] }));
  });
}

export async function isSlugTaken(slug, exceptId) {
  return safe(async () => {
    const snap = await getDocs(query(collection(db, 'tips'), where('slug', '==', slug), limit(2)));
    return snap.docs.some((d) => d.id !== exceptId);
  });
}
export async function findTipsByNumber(number, exceptId) {
  return safe(async () => {
    const snap = await getDocs(query(collection(db, 'tips'), where('number', '==', number), limit(3)));
    return snap.docs.filter((d) => d.id !== exceptId).map(tipFrom);
  });
}

export async function saveTip(id, data, distribution, { isNew, createdAt } = {}) {
  return safe(async () => {
    const batch = writeBatch(db);
    batch.set(doc(db, 'tips', id), {
      ...data, id,
      createdAt: isNew ? serverTimestamp() : (createdAt ? Timestamp.fromDate(createdAt) : serverTimestamp()),
      updatedAt: serverTimestamp()
    });
    // הפצה נשמרת במסמך נפרד הנגיש למנהלים בלבד (שמות קבוצות והערות אינם ציבוריים).
    batch.set(doc(db, 'tipAdmin', id), { distribution, updatedAt: serverTimestamp() });
    await batch.commit();
  });
}

export async function deleteTip(id) {
  return safe(async () => {
    const t = await getDoc(doc(db, 'tips', id));
    const paths = [];
    if (t.exists()) {
      const d = t.data();
      if (d.poster?.storagePath) paths.push(d.poster.storagePath);
      (d.images || []).forEach((im) => im.storagePath && paths.push(im.storagePath));
    }
    const batch = writeBatch(db);
    batch.delete(doc(db, 'tips', id));
    batch.delete(doc(db, 'tipAdmin', id));
    await batch.commit();
    await deleteFiles(paths);
  });
}

/* ---------- Admin: categories ---------- */
export async function listAllCategories() {
  return safe(async () => (await getDocs(query(collection(db, 'categories'), orderBy('order', 'asc')))).docs.map(plainFrom));
}
export async function isCategorySlugTaken(slug, exceptId) {
  return safe(async () => (await getDocs(query(collection(db, 'categories'), where('slug', '==', slug), limit(2)))).docs.some((d) => d.id !== exceptId));
}
export async function saveCategory(cat) {
  return safe(async () => {
    const { id, createdAt, updatedAt, ...data } = cat;
    if (id) await setDoc(doc(db, 'categories', id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
    else await addDoc(collection(db, 'categories'), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
}
export async function deleteCategory(id) {
  return safe(async () => {
    const used = await getDocs(query(collection(db, 'tips'), where('categoryId', '==', id), limit(1)));
    if (!used.empty) { const e = new Error('לא ניתן למחוק קטגוריה שיש בה טיפים. העבירו את הטיפים או סמנו את הקטגוריה כלא פעילה.'); e.code = 'in-use'; throw e; }
    await deleteDoc(doc(db, 'categories', id));
  });
}

/* ---------- Admin: distribution groups ---------- */
export async function listGroups() {
  return safe(async () => (await getDocs(query(collection(db, 'distributionGroups'), orderBy('order', 'asc')))).docs.map(plainFrom));
}
export async function saveGroup(g) {
  return safe(async () => {
    const { id, createdAt, updatedAt, ...data } = g;
    if (id) await setDoc(doc(db, 'distributionGroups', id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
    else await addDoc(collection(db, 'distributionGroups'), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
}
/** קבוצה שכבר שימשה בהפצה מועברת לארכיון כדי לשמר היסטוריה. */
export async function deleteOrArchiveGroup(id) {
  return safe(async () => {
    const admin = await getDocs(collection(db, 'tipAdmin'));
    const used = admin.docs.some((d) => (d.data().distribution || []).some((x) => x.groupId === id));
    if (used) { await setDoc(doc(db, 'distributionGroups', id), { archived: true, active: false, updatedAt: serverTimestamp() }, { merge: true }); return 'archived'; }
    await deleteDoc(doc(db, 'distributionGroups', id));
    return 'deleted';
  });
}

/* ---------- Media ---------- */
export async function uploadImage(tipId, kind, blob, ext, onProgress) {
  const { m, storage } = await storageMod();
  const path = `tips/${tipId}/${kind}/${uid()}.${ext}`;
  const task = m.uploadBytesResumable(m.ref(storage, path), blob, { contentType: blob.type, cacheControl: 'public,max-age=31536000,immutable' });
  return new Promise((resolve, reject) => {
    task.on('state_changed',
      (s) => onProgress?.(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
      (err) => reject(friendly(err)),
      async () => { try { resolve({ url: await m.getDownloadURL(task.snapshot.ref), storagePath: path }); } catch (e) { reject(friendly(e)); } });
  });
}

/** מחיקת קבצים; כשל נרשם ל-cleanupQueue לטיפול מאוחר. */
export async function deleteFiles(paths = []) {
  const failed = [];
  const list = paths.filter((p) => p && !p.startsWith('demo:'));
  if (!list.length) return failed;
  const { m, storage } = await storageMod();
  await Promise.all(list.map(async (p) => {
    try { await m.deleteObject(m.ref(storage, p)); }
    catch (e) { if (e.code !== 'storage/object-not-found') failed.push(p); }
  }));
  if (failed.length) {
    try { await setDoc(doc(db, 'cleanupQueue', 'pending'), { paths: arrayUnion(...failed), updatedAt: serverTimestamp() }, { merge: true }); }
    catch { /* לא חוסם את המשתמש */ }
  }
  return failed;
}
