// מעטפת משותפת לדפי הניהול: אימות הרשאת מנהל לפני הצגת התוכן.
// שימו לב: זו שכבת חוויית משתמש בלבד – האכיפה בפועל נעשית ב-Firestore/Storage Rules.
import { getApi } from '../api/index.js';
import { initLayout } from '../components/layout.js';
import { $ } from '../utils/dom.js';

export function safeNext(next) {
  return typeof next === 'string' && /^\/admin\/[\w\-./?=&%]*$/.test(next) && !next.startsWith('//') ? next : '/admin/';
}

export async function initAdmin(active) {
  initLayout({ active });
  const api = await getApi();
  const user = await new Promise((resolve) => {
    let first = true;
    api.onAuthChange((u) => {
      if (first) { first = false; resolve(u); return; }
      if (!u) location.replace('/admin/login.html'); // התנתקות בטאב אחר / פקיעת סשן
    });
  });
  if (!user || !user.isAdmin) {
    location.replace(`/admin/login.html?next=${encodeURIComponent(location.pathname + location.search)}`);
    return new Promise(() => {}); // עצירת המשך הטעינה
  }
  document.body.classList.remove('auth-pending');
  localStorage.setItem('technotips-admin', '1');
  $('#admin-user').textContent = user.email || '';
  $('#logout').addEventListener('click', async () => { localStorage.removeItem('technotips-admin'); await api.logout(); location.href = '/admin/login.html'; });
  return { api, user };
}

export function confirmAction(message) { return window.confirm(message); }
