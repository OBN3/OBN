import { initAdmin, confirmAction } from './common.js';
import { h, clear, $, debounce } from '../utils/dom.js';
import { distributionProgress, tipPath } from '../utils/tip-logic.js';
import { formatDate } from '../utils/format.js';
import { normalizeText } from '../utils/text.js';
import { stateBox } from '../components/layout.js';
import { showToast } from '../components/toast.js';

const { api } = await initAdmin('tips');
const tableBox = $('#tips-table');
const f = { q: $('#a-q'), status: $('#a-status'), cat: $('#a-cat'), dist: $('#a-dist'), group: $('#a-group'), sort: $('#a-sort') };
let rows = [], catMap = new Map();

function matchesQuery(t, q) {
  if (!q) return true;
  const hay = normalizeText([t.title, t.slug, t.summary, t.number, ...(t.tags || []), catMap.get(t.categoryId)?.name].join(' '));
  return normalizeText(q).split(' ').every((w) => hay.includes(w));
}

function filtered() {
  const q = f.q.value.trim();
  let list = rows.map((r) => ({ ...r, p: distributionProgress(r.distribution) }))
    .filter((r) => matchesQuery(r.tip, q))
    .filter((r) => !f.status.value || (f.status.value === 'featured' ? r.tip.featured : r.tip.status === f.status.value))
    .filter((r) => !f.cat.value || r.tip.categoryId === f.cat.value)
    .filter((r) => {
      const d = f.dist.value;
      if (!d) return true;
      if (d === 'notyet') return r.p.done === 0;
      if (d === 'partial') return r.p.state === 'partial';
      return r.p.state === 'complete';
    })
    .filter((r) => !f.group.value || r.distribution.some((d) => d.groupId === f.group.value && (d.target || d.published)));
  const s = f.sort.value;
  const time = (d) => (d ? d.getTime() : 0);
  list.sort((a, b) => {
    if (s === 'number') return (a.tip.number ?? Infinity) - (b.tip.number ?? Infinity);
    if (s === 'title') return a.tip.title.localeCompare(b.tip.title, 'he');
    if (s === 'published') return time(b.tip.websitePublishedAt) - time(a.tip.websitePublishedAt);
    return time(b.tip.updatedAt) - time(a.tip.updatedAt);
  });
  return list;
}

function render() {
  const list = filtered();
  $('#tips-count').textContent = `מוצגים ${list.length} מתוך ${rows.length} טיפים`;
  clear(tableBox);
  if (!list.length) { tableBox.append(stateBox('empty', rows.length ? 'אין טיפים שתואמים לסינון' : 'עדיין אין טיפים', '', rows.length ? null : h('a', { class: 'btn btn--primary', href: '/admin/tip-edit.html' }, '+ טיפ ראשון'))); return; }
  tableBox.append(h('table', { class: 'data-table' },
    h('caption', { class: 'visually-hidden' }, 'רשימת טיפים'),
    h('thead', {}, h('tr', {}, ['', 'מספר', 'כותרת', 'קטגוריה', 'סטטוס אתר', 'הפצה', 'עודכן', 'פעולות'].map((x, i) => h('th', { scope: 'col' }, i === 0 ? h('span', { class: 'visually-hidden' }, 'תמונה') : x)))),
    h('tbody', {}, list.map(({ tip, p }) => h('tr', {},
      h('td', {}, tip.poster ? h('img', { class: 'thumb', src: tip.poster.url, alt: '', loading: 'lazy', width: 56, height: 56 }) : h('div', { class: 'thumb', 'aria-hidden': 'true' }, '💡')),
      h('td', {}, tip.number != null ? `#${tip.number}` : '—'),
      h('td', { class: 'title-cell' }, h('a', { href: `/admin/tip-edit.html?id=${encodeURIComponent(tip.id)}` }, tip.title || '(ללא כותרת)'),
        tip.featured ? h('span', { title: 'נבחר', 'aria-label': 'טיפ נבחר' }, ' ⭐') : null, h('span', { class: 'slug' }, tip.slug)),
      h('td', {}, catMap.get(tip.categoryId)?.name || '—'),
      h('td', {}, h('span', { class: `badge badge--${tip.status}` }, tip.status === 'published' ? 'מפורסם' : 'טיוטה')),
      h('td', {}, h('span', { class: `badge badge--${p.state}`, title: p.label }, p.total ? `${p.done}/${p.total}` : '—'), h('span', { class: 'visually-hidden' }, p.label)),
      h('td', {}, formatDate(tip.updatedAt)),
      h('td', {}, h('div', { class: 'row-actions' },
        h('a', { class: 'btn btn--small btn--secondary', href: `/admin/tip-edit.html?id=${encodeURIComponent(tip.id)}`, 'aria-label': `עריכת ${tip.title}` }, 'עריכה'),
        h('a', { class: 'btn btn--small btn--ghost', target: '_blank', rel: 'noopener', href: tip.status === 'published' ? tipPath(tip.slug) : `/tip.html?preview=1&id=${encodeURIComponent(tip.id)}`, 'aria-label': `צפייה ב${tip.title} (חלון חדש)` }, 'צפייה'),
        h('button', { type: 'button', class: 'btn btn--small btn--danger', 'aria-label': `מחיקת ${tip.title}`, onclick: () => remove(tip) }, 'מחיקה'))))))));
}

async function remove(tip) {
  if (!confirmAction(`למחוק את הטיפ "${tip.title}"?\nהפעולה תמחק גם את הפוסטר והתמונות, ואינה הפיכה.`)) return;
  try { await api.deleteTip(tip.id); rows = rows.filter((r) => r.tip.id !== tip.id); render(); showToast('הטיפ נמחק'); }
  catch (e) { showToast(e.message, 'error', 5000); }
}

async function load() {
  clear(tableBox).append(stateBox('loading', 'טוען טיפים…', ''));
  try {
    const [r, cats, groups] = await Promise.all([api.listAllTipsAdmin(), api.listAllCategories(), api.listGroups()]);
    rows = r; catMap = new Map(cats.map((c) => [c.id, c]));
    cats.forEach((c) => f.cat.append(h('option', { value: c.id }, c.name)));
    groups.forEach((g) => f.group.append(h('option', { value: g.id }, g.archived ? `${g.name} (ארכיון)` : g.name)));
    render();
  } catch (e) {
    clear(tableBox).append(stateBox('error', 'טעינת הטיפים נכשלה', e.message, h('button', { type: 'button', class: 'btn btn--primary', onclick: load }, 'נסו שוב')));
  }
}

$('#tip-filters').addEventListener('submit', (e) => e.preventDefault());
f.q.addEventListener('input', debounce(render, 200));
[f.status, f.cat, f.dist, f.group, f.sort].forEach((s) => s.addEventListener('change', render));
load();
