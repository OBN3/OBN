// תצוגה מוגדלת נגישה מבוססת <dialog>: Esc לסגירה, חצים לדפדוף, החזרת פוקוס.
import { h } from '../utils/dom.js';

let dialog, imgEl, capEl, counterEl, items = [], index = 0, opener = null;

function build() {
  imgEl = h('img', { class: 'lightbox__img', alt: '' });
  capEl = h('p', { class: 'lightbox__caption' });
  counterEl = h('span', { class: 'lightbox__counter', 'aria-live': 'polite' });
  dialog = h('dialog', { class: 'lightbox', 'aria-label': 'תצוגת תמונה מוגדלת' },
    h('div', { class: 'lightbox__bar' },
      counterEl,
      h('button', { type: 'button', class: 'btn btn--icon lightbox__close', 'aria-label': 'סגירה', onclick: () => dialog.close() }, '✕')),
    h('figure', { class: 'lightbox__figure' }, imgEl, capEl),
    h('div', { class: 'lightbox__nav' },
      h('button', { type: 'button', class: 'btn btn--ghost', 'data-prev': '', onclick: () => go(-1) }, '→ הקודמת'),
      h('button', { type: 'button', class: 'btn btn--ghost', 'data-next': '', onclick: () => go(1) }, 'הבאה ←')));
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') go(1);
    if (e.key === 'ArrowRight') go(-1);
  });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => opener?.focus());
  document.body.append(dialog);
}

function render() {
  const it = items[index];
  imgEl.src = it.url; imgEl.alt = it.alt || '';
  capEl.textContent = it.caption || '';
  capEl.hidden = !it.caption;
  counterEl.textContent = items.length > 1 ? `תמונה ${index + 1} מתוך ${items.length}` : '';
  dialog.querySelector('.lightbox__nav').hidden = items.length < 2;
}
function go(d) { index = (index + d + items.length) % items.length; render(); }

export function openLightbox(list, start = 0, trigger = document.activeElement) {
  if (!dialog) build();
  items = list; index = start; opener = trigger;
  render();
  dialog.showModal();
  dialog.querySelector('.lightbox__close').focus();
}
