import { initLayout, stateBox, skeletonCards } from '../components/layout.js';
import { getApi, getCategories, getCategoryMap } from '../api/index.js';
import { h, clear, $ } from '../utils/dom.js';
import { tipCard } from '../components/tip-card.js';
import { categoryPath } from '../utils/tip-logic.js';

initLayout({ active: 'home' });

async function loadCategories() {
  const box = $('#categories');
  try {
    const cats = await getCategories();
    clear(box);
    if (!cats.length) box.append(h('p', { class: 'muted' }, 'עדיין אין קטגוריות.'));
    cats.forEach((c) => box.append(h('a', { class: 'chip chip--link', href: categoryPath(c.slug) }, c.name)));
  } catch (e) {
    clear(box).append(h('p', { class: 'muted' }, 'לא ניתן לטעון קטגוריות כרגע.'));
  } finally { box.setAttribute('aria-busy', 'false'); }
}

async function loadTips() {
  const recent = $('#recent');
  recent.append(skeletonCards(6));
  try {
    const api = await getApi();
    const [catMap, featured, latest] = await Promise.all([
      getCategoryMap(), api.listFeaturedTips(3), api.listPublishedTips({ sort: 'newest', pageSize: 9 })
    ]);
    if (featured.length) {
      $('#featured-section').hidden = false;
      $('#featured').append(h('div', { class: 'tip-grid tip-grid--featured' }, featured.map((t) => tipCard(t, catMap))));
    }
    const ids = new Set(featured.map((t) => t.id));
    const rest = latest.items.filter((t) => !ids.has(t.id)).slice(0, 6);
    clear(recent);
    if (!rest.length && !featured.length) recent.append(stateBox('empty', 'עדיין לא פורסמו טיפים', 'חזרו בקרוב 🙂'));
    else recent.append(h('div', { class: 'tip-grid' }, rest.map((t) => tipCard(t, catMap))));
  } catch (e) {
    console.warn(e);
    const retry = h('button', { type: 'button', class: 'btn btn--primary', onclick: () => { clear(recent); loadTips(); } }, 'נסו שוב');
    clear(recent).append(stateBox('error', 'לא הצלחנו לטעון טיפים', navigator.onLine ? e.message : 'נראה שאין חיבור לאינטרנט.', retry));
  }
}

loadCategories();
loadTips();
