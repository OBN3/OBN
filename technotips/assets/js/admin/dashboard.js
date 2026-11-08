import { initAdmin, confirmAction } from './common.js';
import { isDemo } from '../api/index.js';
import { h, clear, $ } from '../utils/dom.js';
import { distributionProgress } from '../utils/tip-logic.js';
import { formatDate } from '../utils/format.js';
import { stateBox } from '../components/layout.js';

const { api } = await initAdmin('dashboard');

function stat(num, label) {
  return h('div', { class: 'stat' }, h('div', { class: 'stat__num' }, String(num)), h('div', { class: 'stat__label' }, label));
}

async function load() {
  try {
    const [rows, groups] = await Promise.all([api.listAllTipsAdmin(), api.listGroups()]);
    const gName = new Map(groups.map((g) => [g.id, g.name]));
    const tips = rows.map((r) => r.tip);
    const statsBox = $('#stats');
    clear(statsBox).append(
      stat(tips.length, 'סה"כ טיפים'),
      stat(tips.filter((t) => t.status === 'draft').length, 'טיוטות'),
      stat(tips.filter((t) => t.status === 'published').length, 'מפורסמים באתר'),
      stat(tips.filter((t) => t.featured).length, 'נבחרים'));
    statsBox.setAttribute('aria-busy', 'false');

    const pending = rows.map((r) => ({ ...r, p: distributionProgress(r.distribution) }))
      .filter((r) => r.p.total > 0 && r.p.done < r.p.total);
    const box = $('#pending');
    clear(box);
    if (!pending.length) { box.append(stateBox('empty', 'אין טיפים שממתינים להפצה 🎉', '')); return; }
    box.append(h('div', { class: 'table-wrap' }, h('table', { class: 'data-table' },
      h('caption', { class: 'visually-hidden' }, 'טיפים שממתינים להפצה'),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'טיפ'), h('th', { scope: 'col' }, 'התקדמות'), h('th', { scope: 'col' }, 'ממתין ל־'), h('th', { scope: 'col' }, 'פעולה'))),
      h('tbody', {}, pending.map((r) => h('tr', {},
        h('td', { class: 'title-cell' }, h('a', { href: `/admin/tip-edit.html?id=${encodeURIComponent(r.tip.id)}` }, (r.tip.number != null ? `#${r.tip.number} · ` : '') + r.tip.title),
          h('span', { class: 'muted' }, r.tip.status === 'published' ? ` · פורסם באתר ${formatDate(r.tip.websitePublishedAt)}` : ' · טיוטה')),
        h('td', {}, h('span', { class: `badge badge--${r.p.state}` }, `${r.p.done}/${r.p.total}`)),
        h('td', {}, r.distribution.filter((d) => d.target && !d.published).map((d) => gName.get(d.groupId) || 'קבוצה שנמחקה').join(', ')),
        h('td', {}, h('a', { class: 'btn btn--small btn--secondary', href: `/admin/tip-edit.html?id=${encodeURIComponent(r.tip.id)}#distribution` }, 'עדכון הפצה'))))))));
  } catch (e) {
    clear($('#stats')).append(stateBox('error', 'טעינת הנתונים נכשלה', e.message, h('button', { class: 'btn btn--primary', type: 'button', onclick: load }, 'נסו שוב')));
  }
}

if (isDemo) {
  $('#demo-tools').append(h('button', {
    type: 'button', class: 'btn btn--danger btn--block',
    onclick: async () => {
      if (!confirmAction('לאפס את נתוני ההדגמה? כל השינויים בדפדפן זה יימחקו.')) return;
      const m = await import('../api/demo-adapter.js'); m.resetDemo(); location.href = '/admin/login.html';
    }
  }, '↺ איפוס נתוני הדגמה'));
}
load();
