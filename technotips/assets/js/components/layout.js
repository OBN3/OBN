// רכיבי מעטפת משותפים: סימון ניווט פעיל, באנר מצב הדגמה, שנה בפוטר.
import { isDemo } from '../api/index.js';
import { h } from '../utils/dom.js';

export function initLayout({ active } = {}) {
  if (active) document.querySelectorAll(`[data-nav="${active}"]`).forEach((a) => a.setAttribute('aria-current', 'page'));
  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  if (isDemo && !document.querySelector('.demo-banner')) {
    document.body.prepend(h('div', { class: 'demo-banner', role: 'note' },
      'מצב הדגמה: Firebase אינו מוגדר, והנתונים נשמרים בדפדפן זה בלבד.'));
  }
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('is-open', !open);
    });
  }
}

export function stateBox(kind, title, text, action) {
  const icon = { loading: '⏳', empty: '🔍', error: '⚠️', notfound: '🧭' }[kind] || 'ℹ️';
  return h('div', { class: `state state--${kind}`, role: kind === 'error' ? 'alert' : null },
    h('div', { class: 'state__icon', 'aria-hidden': 'true' }, icon),
    h('p', { class: 'state__title' }, title),
    text ? h('p', { class: 'state__text' }, text) : null,
    action || null);
}

export function skeletonCards(n = 6) {
  return h('div', { class: 'tip-grid', 'aria-hidden': 'true' },
    Array.from({ length: n }, () => h('div', { class: 'tip-card tip-card--skeleton' },
      h('div', { class: 'skeleton skeleton--media' }), h('div', { class: 'skeleton skeleton--line' }), h('div', { class: 'skeleton skeleton--line short' }))));
}
