// עורך טקסט קל-משקל מבוסס contenteditable. הפלט תמיד עובר sanitizeHtml.
import { h } from '../utils/dom.js';
import { sanitizeHtml, isSafeUrl } from '../utils/sanitize.js';

const EMOJIS = ['💡', '✅', '👉', '⭐', '🚀', '📌', '📝', '📊', '✉️', '📅', '🔍', '⚡', '🎯', '🤖', '✨', '⚠️', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '🙂', '👏', '🔗'];

export function createRichEditor({ id, labelId, initialHtml = '', placeholder = '', onChange }) {
  const area = h('div', {
    id, class: 'rte__area prose', contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true',
    'aria-labelledby': labelId, 'data-placeholder': placeholder, dir: 'rtl', spellcheck: 'true'
  });
  area.innerHTML = sanitizeHtml(initialHtml); // מסונן

  const exec = (cmd, val = null) => { area.focus(); document.execCommand(cmd, false, val); update(); };
  const btn = (label, title, action, state) => {
    const b = h('button', { type: 'button', class: 'rte__btn', title, 'aria-label': title, onmousedown: (e) => e.preventDefault(), onclick: action }, label);
    if (state) b.dataset.state = state;
    return b;
  };
  let emojiPop = null;
  const toggleEmoji = (anchor) => {
    if (emojiPop) { emojiPop.remove(); emojiPop = null; anchor.setAttribute('aria-expanded', 'false'); return; }
    emojiPop = h('div', { class: 'emoji-pop', role: 'group', 'aria-label': 'בחירת אימוג\'י' },
      EMOJIS.map((em) => h('button', { type: 'button', 'aria-label': `הוספת ${em}`, onmousedown: (e) => e.preventDefault(), onclick: () => { exec('insertText', em); toggleEmoji(anchor); } }, em)));
    emojiPop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { toggleEmoji(anchor); anchor.focus(); } });
    anchor.after(emojiPop);
    anchor.setAttribute('aria-expanded', 'true');
    emojiPop.querySelector('button').focus();
  };

  const emojiBtn = btn('😊', 'אימוג\'י', () => toggleEmoji(emojiBtn));
  emojiBtn.setAttribute('aria-expanded', 'false');
  const toolbar = h('div', { class: 'rte__toolbar', role: 'toolbar', 'aria-label': 'עיצוב טקסט', 'aria-controls': id },
    btn('B', 'מודגש (Ctrl+B)', () => exec('bold'), 'bold'),
    btn(h('i', {}, 'I'), 'נטוי (Ctrl+I)', () => exec('italic'), 'italic'),
    h('span', { class: 'rte__sep', 'aria-hidden': 'true' }),
    btn('H2', 'כותרת', () => exec('formatBlock', '<h2>')),
    btn('H3', 'כותרת משנה', () => exec('formatBlock', '<h3>')),
    btn('¶', 'פסקה רגילה', () => exec('formatBlock', '<p>')),
    h('span', { class: 'rte__sep', 'aria-hidden': 'true' }),
    btn('•', 'רשימה', () => exec('insertUnorderedList'), 'insertUnorderedList'),
    btn('1.', 'רשימה ממוספרת', () => exec('insertOrderedList'), 'insertOrderedList'),
    btn('❝', 'ציטוט', () => exec('formatBlock', '<blockquote>')),
    h('span', { class: 'rte__sep', 'aria-hidden': 'true' }),
    btn('🔗', 'הוספת קישור', () => {
      const url = window.prompt('כתובת הקישור (https://…)', 'https://');
      if (!url) return;
      if (!isSafeUrl(url) || url === 'https://') { window.alert('כתובת לא תקינה. השתמשו בכתובת שמתחילה ב-https://'); return; }
      exec('createLink', url.trim());
    }),
    btn('⛓️‍💥', 'הסרת קישור', () => exec('unlink')),
    btn('↵', 'שבירת שורה (Shift+Enter)', () => exec('insertLineBreak')),
    emojiBtn,
    btn('⌫', 'ניקוי עיצוב', () => { exec('removeFormat'); exec('formatBlock', '<p>'); }));

  function updateState() {
    toolbar.querySelectorAll('[data-state]').forEach((b) => {
      let on = false; try { on = document.queryCommandState(b.dataset.state); } catch { /* */ }
      b.setAttribute('aria-pressed', String(on));
    });
  }
  function update() { updateState(); onChange?.(); }

  area.addEventListener('input', update);
  area.addEventListener('keyup', updateState);
  area.addEventListener('mouseup', updateState);
  // הדבקה: ניקוי HTML מבחוץ (Word, אתרים) לפני הכנסה
  area.addEventListener('paste', (e) => {
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    e.preventDefault();
    if (html) document.execCommand('insertHTML', false, sanitizeHtml(html));
    else document.execCommand('insertText', false, text);
    update();
  });
  area.addEventListener('drop', (e) => e.preventDefault());
  document.addEventListener('click', (e) => { if (emojiPop && !emojiPop.contains(e.target) && e.target !== emojiBtn) { emojiPop.remove(); emojiPop = null; emojiBtn.setAttribute('aria-expanded', 'false'); } });

  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* */ }

  return {
    el: h('div', { class: 'rte' }, toolbar, area),
    getHtml: () => sanitizeHtml(area.innerHTML),
    focus: () => area.focus()
  };
}
