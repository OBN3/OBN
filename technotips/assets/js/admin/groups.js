import { initAdmin, confirmAction } from './common.js';
import { h, clear, $ } from '../utils/dom.js';
import { stateBox } from '../components/layout.js';
import { showToast } from '../components/toast.js';

const { api } = await initAdmin('groups');
const form = $('#grp-form');
const el = { id: $('#grp-id'), name: $('#grp-name'), desc: $('#grp-desc'), order: $('#grp-order'), active: $('#grp-active'), archived: $('#grp-archived'), err: $('#grp-error'), submit: $('#grp-submit'), cancel: $('#grp-cancel'), title: $('#grp-form-title') };
const showArchived = $('#show-archived');
let groups = [];

function resetForm() {
  form.reset(); el.id.value = ''; el.active.checked = true; el.archived.checked = false;
  el.order.value = String((groups.at(-1)?.order ?? 0) + 1);
  el.title.textContent = 'קבוצה חדשה'; el.submit.textContent = 'הוספת קבוצה'; el.cancel.hidden = true; el.err.textContent = '';
}
function edit(g) {
  el.id.value = g.id; el.name.value = g.name; el.desc.value = g.description || ''; el.order.value = g.order ?? 0;
  el.active.checked = !!g.active; el.archived.checked = !!g.archived;
  el.title.textContent = `עריכת קבוצה: ${g.name}`; el.submit.textContent = 'שמירת שינויים'; el.cancel.hidden = false; el.name.focus();
}

function render() {
  const box = $('#grp-list');
  const list = groups.filter((g) => showArchived.checked || !g.archived);
  clear(box);
  if (!list.length) { box.append(stateBox('empty', 'אין קבוצות להצגה', 'הוסיפו קבוצה בטופס.')); return; }
  box.append(h('table', { class: 'data-table' },
    h('thead', {}, h('tr', {}, ['סדר', 'שם', 'סטטוס', 'פעולות'].map((x) => h('th', { scope: 'col' }, x)))),
    h('tbody', {}, list.map((g) => h('tr', { class: g.archived ? 'is-archived' : null },
      h('td', {}, String(g.order ?? '')),
      h('td', { class: 'title-cell' }, h('strong', {}, g.name), g.description ? h('span', { class: 'slug', style: 'direction:rtl' }, g.description) : null),
      h('td', {}, h('span', { class: `badge badge--${g.archived ? 'none' : g.active ? 'published' : 'draft'}` }, g.archived ? 'בארכיון' : g.active ? 'פעילה' : 'לא פעילה')),
      h('td', {}, h('div', { class: 'row-actions' },
        h('button', { type: 'button', class: 'btn btn--small btn--secondary', onclick: () => edit(g), 'aria-label': `עריכת ${g.name}` }, 'עריכה'),
        g.archived
          ? h('button', { type: 'button', class: 'btn btn--small btn--ghost', onclick: () => restore(g), 'aria-label': `שחזור ${g.name}` }, 'שחזור')
          : h('button', { type: 'button', class: 'btn btn--small btn--danger', onclick: () => remove(g), 'aria-label': `מחיקת ${g.name}` }, 'מחיקה'))))))));
}

async function remove(g) {
  if (!confirmAction(`למחוק את הקבוצה "${g.name}"?\nאם הקבוצה כבר שימשה בהפצה – היא תועבר לארכיון כדי לשמור על ההיסטוריה.`)) return;
  try { const r = await api.deleteOrArchiveGroup(g.id); showToast(r === 'archived' ? 'הקבוצה הועברה לארכיון (יש לה היסטוריית הפצה)' : 'הקבוצה נמחקה'); await load(); }
  catch (e) { showToast(e.message, 'error', 5000); }
}
async function restore(g) {
  try { await api.saveGroup({ id: g.id, archived: false, active: true }); showToast('הקבוצה שוחזרה'); await load(); }
  catch (e) { showToast(e.message, 'error', 5000); }
}
async function load() {
  try { groups = await api.listGroups(); render(); if (!el.id.value) resetForm(); }
  catch (e) { clear($('#grp-list')).append(stateBox('error', 'טעינה נכשלה', e.message)); }
}

showArchived.addEventListener('change', render);
el.cancel.addEventListener('click', resetForm);
el.archived.addEventListener('change', () => { if (el.archived.checked) el.active.checked = false; });
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  el.err.textContent = ''; el.name.removeAttribute('aria-invalid');
  const data = { id: el.id.value || undefined, name: el.name.value.trim(), description: el.desc.value.trim(), order: Number(el.order.value) || 0, active: el.active.checked && !el.archived.checked, archived: el.archived.checked };
  if (!data.name) { el.err.textContent = 'יש להזין שם קבוצה.'; el.name.setAttribute('aria-invalid', 'true'); el.name.focus(); return; }
  if (groups.some((g) => g.name.trim() === data.name && g.id !== data.id)) { el.err.textContent = 'כבר קיימת קבוצה בשם זה.'; el.name.setAttribute('aria-invalid', 'true'); return; }
  el.submit.disabled = true;
  try { await api.saveGroup(data); showToast(data.id ? 'הקבוצה עודכנה' : 'הקבוצה נוספה'); el.id.value = ''; await load(); resetForm(); }
  catch (err) { el.err.textContent = err.message; }
  finally { el.submit.disabled = false; }
});
load();
