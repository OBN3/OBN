// רשימת טיפים עם עימוד "טען עוד", מצבי טעינה / ריק / שגיאה, והכרזת מספר תוצאות.
import { h, clear } from '../utils/dom.js';
import { getApi, getCategoryMap } from '../api/index.js';
import { tipCard } from './tip-card.js';
import { stateBox, skeletonCards } from './layout.js';

const PAGE_SIZE = 12;

export function createTipList(root, { onCount } = {}) {
  const grid = h('div', { class: 'tip-grid' });
  const status = h('p', { class: 'visually-hidden', 'aria-live': 'polite' });
  const moreBtn = h('button', { type: 'button', class: 'btn btn--secondary', hidden: true }, 'טען עוד טיפים');
  const footer = h('div', { class: 'list-footer' }, moreBtn);
  let params = {}, cursor = null, loading = false, total = 0, reqId = 0;

  async function load(reset) {
    if (loading && !reset) return;
    const my = ++reqId;
    loading = true;
    if (reset) { cursor = null; total = 0; clear(root).append(skeletonCards(6)); }
    moreBtn.disabled = true; moreBtn.textContent = 'טוען…';
    try {
      const [api, catMap] = await Promise.all([getApi(), getCategoryMap()]);
      const res = await api.listPublishedTips({ ...params, pageSize: PAGE_SIZE, cursor });
      if (my !== reqId) return;
      if (reset) { clear(root).append(grid, footer, status); clear(grid); }
      res.items.forEach((t) => grid.append(tipCard(t, catMap)));
      total += res.items.length;
      cursor = res.cursor;
      moreBtn.hidden = !res.hasMore;
      if (total === 0 && !res.hasMore) {
        clear(root).append(stateBox('empty', 'לא נמצאו טיפים', 'נסו מילת חיפוש אחרת או הסירו סינון.'), status);
      }
      status.textContent = `מוצגים ${total} טיפים${res.hasMore ? ', ניתן לטעון עוד' : ''}`;
      onCount?.(total, res.hasMore);
    } catch (e) {
      if (my !== reqId) return;
      console.warn(e);
      const retry = h('button', { type: 'button', class: 'btn btn--primary', onclick: () => load(true) }, 'נסו שוב');
      clear(root).append(stateBox('error', 'לא הצלחנו לטעון את הטיפים', navigator.onLine ? e.message : 'נראה שאין חיבור לאינטרנט.', retry));
    } finally {
      if (my === reqId) { loading = false; moreBtn.disabled = false; moreBtn.textContent = 'טען עוד טיפים'; }
    }
  }
  moreBtn.addEventListener('click', () => load(false));

  return {
    setParams(p) { params = p; return load(true); },
    reload() { return load(true); }
  };
}
