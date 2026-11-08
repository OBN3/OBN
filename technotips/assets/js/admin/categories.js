import { initAdmin, confirmAction } from './common.js';
import { h, clear, $ } from '../utils/dom.js';
import { slugify, SLUG_RE } from '../utils/text.js';
import { stateBox } from '../components/layout.js';
import { showToast } from '../components/toast.js';
import { categoryPath } from '../utils/tip-logic.js';

const { api } = await initAdmin('categories');
const form = $('#cat-form');
const el = { id: $('#cat-id'), name: $('#cat-name'), slug: $('#cat-slug'), desc: $('#cat-desc'), order: $('#cat-order'), active: $('#cat-active'), err: $('#cat-error'), submit: $('#cat-submit'), cancel: $('#cat-cancel'), title: $('#cat-form-title') };
let cats = [];
let slugTouched = false;

function resetForm() {
  form.reset(); el.id.value = ''; el.active.checked = true; slugTouched = false;
  el.order.value = String((cats.at(-1)?.order ?? 0) + 1);
  el.title.textContent = 'קטגוריה חדשה'; el.submit.textContent = 'הוספת קטגוריה'; el.cancel.hidden = true; el.err.textContent = '';
}

function edit(c) {
  el.id.value = c.id; el.name.value = c.name; el.slug.value = c.slug; el.desc.value = c.description || '';
  el.order.value = c.order ?? 0; el.active.checked = !!c.active; slugTouched = true;
  el.title.textContent = `עריכת קטגוריה: ${c.name}`; el.submit.textContent = 'שמירת שינויים'; el.cancel.hidden = false;
  el.name.focus();
}

function render() {
  const box = $('#cat-list');
  clear(box);
  if (!cats.length) { box.append(stateBox('empty', 'אין קטגוריות עדיין', 'הוסיפו קטגוריה בטופס.')); return; }
  box.append(h('table', { class: 'data-table' },
    h('thead', {}, h('tr', {}, ['סדר', 'שם', 'כתובת', 'סטטוס', 'פעולות'].map((x) => h('th', { scope: 'col' }, x)))),
    h('tbody', {}, cats.map((c) => h('tr', {},
      h('td', {}, String(c.order ?? '')),
      h('td', { class: 'title-cell' }, h('strong', {}, c.name), c.description ? h('span', { class: 'slug', style: 'direction:rtl' }, c.description) : null),
      h('td', {}, h('a', { href: categoryPath(c.slug), target: '_blank', rel: 'noopener', class: 'ltr' }, c.slug)),
      h('td', {}, h('span', { class: `badge badge--${c.active ? 'published' : 'draft'}` }, c.active ? 'פעילה' : 'מוסתרת')),
      h('td', {}, h('div', { class: 'row-actions' },
        h('button', { type: 'button', class: 'btn btn--small btn--secondary', onclick: () => edit(c), 'aria-label': `עריכת ${c.name}` }, 'עריכה'),
        h('button', { type: 'button', class: 'btn btn--small btn--danger', onclick: () => remove(c), 'aria-label': `מחיקת ${c.name}` }, 'מחיקה'))))))));
}

async function remove(c) {
  if (!confirmAction(`למחוק את הקטגוריה "${c.name}"?`)) return;
  try { await api.deleteCategory(c.id); showToast('הקטגוריה נמחקה'); await load(); }
  catch (e) { showToast(e.message, 'error', 6000); }
}

async function load() {
  try { cats = await api.listAllCategories(); render(); if (!el.id.value) resetForm(); }
  catch (e) { clear($('#cat-list')).append(stateBox('error', 'טעינה נכשלה', e.message)); }
}

el.name.addEventListener('input', () => { if (!slugTouched) el.slug.value = slugify(el.name.value); });
el.slug.addEventListener('input', () => { slugTouched = true; });
el.cancel.addEventListener('click', resetForm);
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  el.err.textContent = '';
  [el.name, el.slug].forEach((x) => x.removeAttribute('aria-invalid'));
  const data = { id: el.id.value || undefined, name: el.name.value.trim(), slug: el.slug.value.trim().toLowerCase(), description: el.desc.value.trim(), order: Number(el.order.value) || 0, active: el.active.checked };
  if (!data.name) { el.err.textContent = 'יש להזין שם.'; el.name.setAttribute('aria-invalid', 'true'); el.name.focus(); return; }
  if (!SLUG_RE.test(data.slug)) { el.err.textContent = 'כתובת לא תקינה – רק אותיות באנגלית קטנות, ספרות ומקפים (למשל: copilot-tips).'; el.slug.setAttribute('aria-invalid', 'true'); el.slug.focus(); return; }
  el.submit.disabled = true;
  try {
    if (await api.isCategorySlugTaken(data.slug, data.id)) { el.err.textContent = 'כתובת זו כבר בשימוש בקטגוריה אחרת.'; el.slug.setAttribute('aria-invalid', 'true'); el.slug.focus(); return; }
    await api.saveCategory(data);
    showToast(data.id ? 'הקטגוריה עודכנה' : 'הקטגוריה נוספה');
    el.id.value = ''; await load(); resetForm();
  } catch (err) { el.err.textContent = err.message; }
  finally { el.submit.disabled = false; }
});
load();
