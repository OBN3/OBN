import { initLayout } from '../components/layout.js';
import { getCategories } from '../api/index.js';
import { h, clear, $, debounce } from '../utils/dom.js';
import { createTipList } from '../components/tip-list.js';

initLayout({ active: 'tips' });

const form = $('#filters');
const qInput = $('#f-q'), catSel = $('#f-cat'), sortSel = $('#f-sort');
const activeBox = $('#active-filters');
const list = createTipList($('#list'));
let cats = [];
let tag = '';

function readUrl() {
  const p = new URLSearchParams(location.search);
  qInput.value = p.get('q') || '';
  sortSel.value = ['newest', 'oldest', 'number'].includes(p.get('sort')) ? p.get('sort') : 'newest';
  catSel.value = p.get('category') || '';
  tag = p.get('tag') || '';
  const hq = $('#header-q'); if (hq) hq.value = qInput.value;
}

function writeUrl() {
  const p = new URLSearchParams();
  if (qInput.value.trim()) p.set('q', qInput.value.trim());
  if (catSel.value) p.set('category', catSel.value);
  if (tag) p.set('tag', tag);
  if (sortSel.value !== 'newest') p.set('sort', sortSel.value);
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function renderActive() {
  clear(activeBox);
  if (!tag) return;
  activeBox.append(h('span', { class: 'muted' }, 'מסונן לפי תגית: '),
    h('button', { type: 'button', class: 'chip chip--removable', 'aria-label': `הסרת סינון לפי התגית ${tag}`, onclick: () => { tag = ''; apply(); } }, `#${tag} ✕`));
}

function apply() {
  writeUrl(); renderActive();
  const cat = cats.find((c) => c.slug === catSel.value);
  list.setParams({ q: qInput.value.trim(), categoryId: cat?.id || '', tag, sort: sortSel.value });
}

form.addEventListener('submit', (e) => { e.preventDefault(); apply(); });
qInput.addEventListener('input', debounce(apply, 400));
catSel.addEventListener('change', apply);
sortSel.addEventListener('change', apply);

(async () => {
  try {
    cats = await getCategories();
    cats.forEach((c) => catSel.append(h('option', { value: c.slug }, c.name)));
  } catch { /* הרשימה תעבוד גם ללא קטגוריות */ }
  readUrl();
  apply();
})();
