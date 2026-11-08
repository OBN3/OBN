import { getApi, isDemo } from '../api/index.js';
import { initLayout } from '../components/layout.js';
import { h, $, getParam } from '../utils/dom.js';
import { safeNext } from './common.js';

initLayout();
const form = $('#login-form');
const errBox = $('#login-error');
const btn = form.querySelector('button[type="submit"]');

(async () => {
  const api = await getApi();
  if (isDemo) {
    const { DEMO_CREDENTIALS } = await import('../api/demo-adapter.js');
    $('#login-note').append(h('div', { class: 'demo-hint' },
      h('strong', {}, 'מצב הדגמה. '), 'פרטי כניסה: ', h('code', {}, DEMO_CREDENTIALS.email), ' / ', h('code', {}, DEMO_CREDENTIALS.password)));
  }
  // משתמש מחובר עם הרשאה – ישר לניהול
  const off = api.onAuthChange((u) => { if (u?.isAdmin) location.replace(safeNext(getParam('next'))); queueMicrotask(() => off?.()); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.textContent = '';
    const email = $('#email').value.trim();
    const password = $('#password').value;
    ['#email', '#password'].forEach((s) => $(s).removeAttribute('aria-invalid'));
    if (!email || !password) {
      errBox.textContent = 'יש למלא דוא"ל וסיסמה.';
      (!email ? $('#email') : $('#password')).setAttribute('aria-invalid', 'true');
      return;
    }
    btn.disabled = true; btn.textContent = 'מתחבר…';
    try {
      await api.login(email, password);
      location.replace(safeNext(getParam('next')));
    } catch (err) {
      errBox.textContent = err.message;
      $('#password').value = '';
      $('#password').focus();
    } finally { btn.disabled = false; btn.textContent = 'כניסה'; }
  });
})();
