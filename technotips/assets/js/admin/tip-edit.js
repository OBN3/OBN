// יצירה ועריכה של טיפ: פרטים, תוכן עשיר, פוסטר, גלריה, תכנים משלימים, WhatsApp, SEO, פרסום והפצה.
import { initAdmin, confirmAction } from './common.js';
import { isDemo } from '../api/index.js';
import { prepareTip, validateTipForSave, prepareDistribution } from '../api/shared.js';
import { h, clear, $, getParam } from '../utils/dom.js';
import { slugify, parseTags } from '../utils/text.js';
import { emptyTip, distributionProgress, EXTRA_TYPES, whatsappMessage, defaultWhatsappDraft, tipPath } from '../utils/tip-logic.js';
import { toDatetimeLocal, fromDatetimeLocal, formatDateTime } from '../utils/format.js';
import { validateImageFile, processImage, ACCEPT, uid } from '../utils/image.js';
import { createRichEditor } from '../components/rich-editor.js';
import { showToast, copyText } from '../components/toast.js';
import { stateBox } from '../components/layout.js';

const paramId = getParam('id');
const { api } = await initAdmin(paramId ? 'tips' : 'new');
const root = $('#edit-root');
const errorSummary = $('#error-summary');

let id = paramId;
let isNew = !paramId;
let tip, distribution = [], categories = [], groups = [];
let editor;
let dirty = false;
let saving = false;
let slugTouched = false;
const pendingDeletes = new Set();   // קבצים שהוסרו מטיפ שמור – יימחקו אחרי שמירה מוצלחת
const sessionUploads = new Set();   // קבצים שהועלו בסשן זה וטרם נשמרו
const imgOpts = isDemo ? { maxDim: 1000, quality: 0.78 } : { maxDim: 1600, quality: 0.85 };

/* ---------- עזרים ---------- */
function markDirty() { if (!dirty) { dirty = true; renderStatus(); } }
window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

function field(label, input, { hint, id: fid, span2 = false, counter } = {}) {
  const hintId = hint ? `${fid}-hint` : null;
  if (hintId) input.setAttribute('aria-describedby', hintId);
  return h('div', { class: `field${span2 ? ' span-2' : ''}` },
    h('label', { for: fid }, label), input,
    hint ? h('p', { class: 'hint', id: hintId }, hint) : null, counter || null);
}

function withCounter(input, max) {
  const c = h('p', { class: 'counter', 'aria-live': 'off' });
  const upd = () => { c.textContent = `${input.value.length}/${max}`; c.classList.toggle('is-over', input.value.length > max); };
  input.addEventListener('input', upd); upd();
  return c;
}

function discardFile(f) {
  if (!f?.storagePath) return;
  if (sessionUploads.has(f.storagePath)) { sessionUploads.delete(f.storagePath); api.deleteFiles([f.storagePath]); }
  else pendingDeletes.add(f.storagePath);
}

async function uploadFile(file, kind, statusEl, progressEl) {
  const err = validateImageFile(file);
  if (err) throw new Error(err);
  statusEl.textContent = `מעבד את ${file.name}…`;
  const p = await processImage(file, imgOpts);
  progressEl.hidden = false; progressEl.value = 0;
  statusEl.textContent = `מעלה את ${file.name}…`;
  const res = await api.uploadImage(id, kind, p.blob, p.ext, (v) => { progressEl.value = v; });
  sessionUploads.add(res.storagePath);
  progressEl.hidden = true;
  statusEl.textContent = '';
  return { ...res, width: p.width, height: p.height };
}

/** החזרת פוקוס אחרי רינדור מחדש; אם כפתור ההזזה הפך ללא זמין – לכפתור ההזזה השני של אותו פריט. */
function focusIn(box, sel) {
  if (!sel) return;
  let el = box.querySelector(sel);
  if (el?.disabled) el = el.parentElement.querySelector('[data-move]:not([disabled])') || el.parentElement.querySelector('button:not([disabled])');
  el?.focus();
}

function moveItem(arr, i, d) { const j = i + d; if (j < 0 || j >= arr.length) return false; [arr[i], arr[j]] = [arr[j], arr[i]]; return true; }

/* ---------- טעינה ---------- */
async function load() {
  try {
    [categories, groups] = await Promise.all([api.listAllCategories(), api.listGroups()]);
    if (isNew) {
      id = await api.newTipId();
      tip = emptyTip(id);
      tip.authorName = 'אופיר';
    } else {
      const res = await api.getTipForAdmin(id);
      if (!res) {
        clear(root).append(stateBox('notfound', 'הטיפ לא נמצא', 'ייתכן שהוא נמחק.', h('a', { class: 'btn btn--primary', href: '/admin/tips.html' }, 'חזרה לרשימה')));
        root.setAttribute('aria-busy', 'false'); return;
      }
      tip = res.tip; distribution = res.distribution; slugTouched = true;
    }
    build();
    if (location.hash === '#distribution') $('#distribution')?.scrollIntoView();
  } catch (e) {
    clear(root).append(stateBox('error', 'טעינת הטיפ נכשלה', e.message, h('button', { type: 'button', class: 'btn btn--primary', onclick: load }, 'נסו שוב')));
  } finally { root.setAttribute('aria-busy', 'false'); }
}

/* ---------- בניית הטופס ---------- */
const inputs = {};
function build() {
  $('#edit-title').textContent = isNew ? 'טיפ חדש' : `עריכה: ${tip.title}`;
  document.title = `${isNew ? 'טיפ חדש' : `עריכה: ${tip.title}`} | ניהול טכנוטיפים`;

  inputs.number = h('input', { id: 'f-number', type: 'number', min: '0', step: '1', value: tip.number ?? '', inputmode: 'numeric' });
  inputs.title = h('input', { id: 'f-title', type: 'text', required: true, maxlength: '200', value: tip.title });
  inputs.slug = h('input', { id: 'f-slug', type: 'text', required: true, dir: 'ltr', maxlength: '80', value: tip.slug, autocomplete: 'off' });
  inputs.summary = h('textarea', { id: 'f-summary', maxlength: '500', rows: '3', value: tip.summary });
  inputs.category = h('select', { id: 'f-category', required: true },
    h('option', { value: '' }, '— בחירת קטגוריה —'),
    categories.map((c) => h('option', { value: c.id, selected: c.id === tip.categoryId }, c.active ? c.name : `${c.name} (מוסתרת)`)));
  inputs.tags = h('input', { id: 'f-tags', type: 'text', value: tip.tags.join(', '), autocomplete: 'off' });
  const tagPreview = h('div', { class: 'tag-preview', 'aria-hidden': 'true' });
  const renderTags = () => { clear(tagPreview).append(...parseTags(inputs.tags.value).map((t) => h('span', { class: 'tag' }, `#${t}`))); };
  inputs.tags.addEventListener('input', renderTags); renderTags();

  inputs.title.addEventListener('input', () => { if (!slugTouched) autoSlug(); });
  inputs.number.addEventListener('input', () => { if (!slugTouched) autoSlug(); });
  inputs.slug.addEventListener('input', () => { slugTouched = true; });

  editor = createRichEditor({ id: 'f-content', labelId: 'content-label', initialHtml: tip.contentHtml, placeholder: 'כתבו כאן את תוכן הטיפ…', onChange: markDirty });

  inputs.whatsapp = h('textarea', { id: 'f-whatsapp', rows: '7', class: 'mono-ish', value: tip.whatsappText, dir: 'rtl' });
  const waPreview = h('div', { class: 'whatsapp-preview', id: 'wa-preview' });
const updateWa = () => { waPreview.textContent = whatsappMessage(collect(), { withLink: false }); };
  inputs.whatsapp.addEventListener('input', updateWa);

  inputs.seoTitle = h('input', { id: 'f-seo-title', type: 'text', maxlength: '90', value: tip.seo.title, placeholder: 'ברירת מחדל: כותרת הטיפ' });
  inputs.seoDesc = h('textarea', { id: 'f-seo-desc', rows: '2', maxlength: '200', value: tip.seo.description, placeholder: 'ברירת מחדל: התקציר' });
  inputs.featured = h('input', { id: 'f-featured', type: 'checkbox', checked: tip.featured });
  inputs.publishedAt = h('input', { id: 'f-published-at', type: 'datetime-local', value: toDatetimeLocal(tip.websitePublishedAt) });
  inputs.author = h('input', { id: 'f-author', type: 'text', maxlength: '80', value: tip.authorName });

  const posterBox = h('div', { id: 'poster-box' });
  const galleryBox = h('div', { id: 'gallery-box' });
  const extrasBox = h('div', { id: 'extras-box' });
  const distBox = h('div', { id: 'dist-box' });

  const form = h('form', { id: 'tip-form', novalidate: true, onsubmit: (e) => e.preventDefault() },
    h('fieldset', { class: 'edit-section' }, h('legend', {}, 'פרטים בסיסיים'),
      h('div', { class: 'form-grid' },
        field('כותרת *', inputs.title, { id: 'f-title', span2: true }),
        field('מספר טיפ', inputs.number, { id: 'f-number', hint: 'אופציונלי. מוצג כ"טיפ #12".' }),
        field('קטגוריה *', inputs.category, { id: 'f-category' }),
        h('div', { class: 'field span-2' }, h('label', { for: 'f-slug' }, 'כתובת (slug)'),
          h('div', { class: 'slug-row' }, inputs.slug,
            h('button', { type: 'button', class: 'btn btn--secondary btn--small', onclick: () => { slugTouched = false; autoSlug(); markDirty(); } }, 'יצירה אוטומטית')),
          h('p', { class: 'hint', id: 'f-slug-hint' }, 'אופציונלי. אם נשאר ריק – תיווצר אוטומטית לפי מספר הטיפ. עדיף לא לשנות אחרי שיתוף.')),
        field('תקציר', inputs.summary, { id: 'f-summary', span2: true, hint: 'אופציונלי. אם נשאר ריק – ייווצר אוטומטית מתחילת התוכן.', counter: withCounter(inputs.summary, 500) }),
        h('div', { class: 'field span-2' }, h('label', { for: 'f-tags' }, 'תגיות'), inputs.tags,
          h('p', { class: 'hint', id: 'f-tags-hint' }, 'הפרידו בפסיקים. למשל: Copilot, Outlook, מיילים'), tagPreview))),

    h('fieldset', { class: 'edit-section' }, h('legend', { id: 'content-label' }, 'תוכן ראשי'), editor.el),

    h('fieldset', { class: 'edit-section' }, h('legend', {}, 'פוסטר'), posterBox),
    h('fieldset', { class: 'edit-section' }, h('legend', {}, 'גלריית תמונות'), galleryBox),
    h('fieldset', { class: 'edit-section' }, h('legend', {}, 'תכנים משלימים (פרומפטים, הערות, קישורים)'), extrasBox),

    h('fieldset', { class: 'edit-section' }, h('legend', {}, 'נוסח WhatsApp'),
      field('נוסח להפצה', inputs.whatsapp, { id: 'f-whatsapp', hint: 'עיצוב WhatsApp: *מודגש*, _נטוי_, ~קו חוצה~. ' }),
      h('div', { class: 'form-actions' },
        h('button', { type: 'button', class: 'btn btn--secondary btn--small', onclick: () => {
          if (inputs.whatsapp.value.trim() && !confirmAction('להחליף את הנוסח הקיים בנוסח שנוצר מהטיפ?')) return;
          inputs.whatsapp.value = defaultWhatsappDraft(collect()); updateWa(); markDirty();
        } }, '✍️ יצירת נוסח מתוך הטיפ'),
        h('button', { type: 'button', class: 'btn btn--whatsapp btn--small', onclick: () => copyText(whatsappMessage(collect(), { withLink: false }), 'נוסח WhatsApp הועתק ✓') }, '📋 העתקת נוסח WhatsApp')),
      h('p', { class: 'label', style: 'margin-top:1rem' }, 'תצוגה מקדימה:'), waPreview),

    h('fieldset', { class: 'edit-section' }, h('legend', {}, 'SEO'),
      h('div', { class: 'form-grid' },
        field('כותרת SEO', inputs.seoTitle, { id: 'f-seo-title', span2: true, counter: withCounter(inputs.seoTitle, 70) }),
        field('תיאור SEO', inputs.seoDesc, { id: 'f-seo-desc', span2: true, counter: withCounter(inputs.seoDesc, 160) }))),

    h('fieldset', { class: 'edit-section' }, h('legend', {}, 'פרסום באתר'),
      h('div', { class: 'form-grid' },
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'סטטוס נוכחי'), h('div', { id: 'status-badge' })),
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'הצגה בדף הבית'), h('label', { class: 'check' }, inputs.featured, ' טיפ נבחר ⭐')),
        field('מועד פרסום באתר', inputs.publishedAt, { id: 'f-published-at', hint: 'נקבע אוטומטית בפרסום הראשון. ניתן לשנות ידנית (משפיע על המיון).' }),
        field('שם הכותב/ת', inputs.author, { id: 'f-author' }))),

    h('fieldset', { class: 'edit-section', id: 'distribution' }, h('legend', {}, 'הפצה לקבוצות'),
      h('p', { class: 'muted' }, 'הפצה לקבוצות נפרדת מפרסום באתר. סמנו קבוצות יעד, ואז סמנו בכל קבוצה כשהטיפ נשלח בפועל.'),
      distBox),

    h('div', { class: 'action-bar', role: 'region', 'aria-label': 'פעולות שמירה' },
      h('div', { class: 'action-bar__status', id: 'action-status', 'aria-live': 'polite' }),
      h('div', { id: 'action-buttons', class: 'form-actions', style: 'margin:0' })));

  form.addEventListener('input', markDirty);
  form.addEventListener('change', markDirty);
  clear(root).append(form);
  renderPoster(); renderGallery(); renderExtras(); renderDistribution(); renderStatus(); updateWa();
  dirty = false; renderStatus();
}

function autoSlug() {
  let s = slugify(inputs.title.value);
  if (!s) s = inputs.number.value ? `tip-${inputs.number.value}` : `tip-${id.slice(-6).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  inputs.slug.value = s;
}

function collect() {
  return {
    ...tip,
    number: inputs.number.value === '' ? null : Number(inputs.number.value),
    title: inputs.title.value, slug: inputs.slug.value.trim().toLowerCase(), summary: inputs.summary.value,
    categoryId: inputs.category.value, tags: parseTags(inputs.tags.value), contentHtml: editor.getHtml(),
    whatsappText: inputs.whatsapp.value, seo: { title: inputs.seoTitle.value, description: inputs.seoDesc.value },
    featured: inputs.featured.checked, websitePublishedAt: fromDatetimeLocal(inputs.publishedAt.value), authorName: inputs.author.value
  };
}

/* ---------- פוסטר ---------- */
function renderPoster() {
  const box = $('#poster-box');
  const status = h('p', { class: 'upload-status', 'aria-live': 'polite' });
  const progress = h('progress', { class: 'progress', max: '100', value: '0', hidden: true, 'aria-label': 'התקדמות העלאת הפוסטר' });
  const fileInput = h('input', { type: 'file', accept: ACCEPT, id: 'f-poster-file', 'aria-label': tip.poster ? 'החלפת פוסטר' : 'העלאת פוסטר' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0]; if (!file) return;
    fileInput.disabled = true;
    try {
      const res = await uploadFile(file, 'poster', status, progress);
      const old = tip.poster;
      tip.poster = { url: res.url, storagePath: res.storagePath, alt: old?.alt || '', width: res.width, height: res.height };
      discardFile(old);
      markDirty(); renderPoster();
      $('#f-poster-alt')?.focus();
    } catch (e) { status.textContent = ''; progress.hidden = true; showToast(e.message, 'error', 6000); fileInput.disabled = false; fileInput.value = ''; }
  });
  const alt = h('input', { id: 'f-poster-alt', type: 'text', maxlength: '200', value: tip.poster?.alt || '', placeholder: 'תיאור קצר של מה שרואים בפוסטר' });
  alt.addEventListener('input', () => { if (tip.poster) tip.poster.alt = alt.value; });
  clear(box).append(h('div', { class: 'media-poster' },
    h('div', { class: 'media-preview' }, tip.poster ? h('img', { src: tip.poster.url, alt: tip.poster.alt || 'תצוגה מקדימה של הפוסטר' }) : h('span', {}, 'אין פוסטר. הפוסטר אופציונלי.')),
    h('div', {},
      h('div', { class: 'form-actions', style: 'margin-top:0' },
        h('span', { class: 'btn btn--secondary file-btn' }, tip.poster ? '🔄 החלפת פוסטר' : '⬆️ העלאת פוסטר', fileInput),
        tip.poster ? h('button', { type: 'button', class: 'btn btn--danger', onclick: () => {
          if (!confirmAction('להסיר את הפוסטר?')) return;
          discardFile(tip.poster); tip.poster = null; markDirty(); renderPoster();
        } }, 'הסרת פוסטר') : null),
      h('p', { class: 'hint' }, 'JPG, PNG או WebP עד 10MB. התמונה מוקטנת ומומרת אוטומטית.'),
      progress, status,
      tip.poster ? field('טקסט חלופי (alt)', alt, { id: 'f-poster-alt', hint: 'אופציונלי. אם נשאר ריק – תשמש כותרת הטיפ.' }) : null)));
}

/* ---------- גלריה ---------- */
function renderGallery(focusSel) {
  const box = $('#gallery-box');
  const status = h('p', { class: 'upload-status', 'aria-live': 'polite' });
  const progress = h('progress', { class: 'progress', max: '100', value: '0', hidden: true, 'aria-label': 'התקדמות העלאת תמונות' });
  const fileInput = h('input', { type: 'file', accept: ACCEPT, multiple: true, 'aria-label': 'הוספת תמונות לגלריה' });
  fileInput.addEventListener('change', async () => {
    const files = [...fileInput.files]; if (!files.length) return;
    fileInput.disabled = true;
    let added = 0;
    for (const [i, file] of files.entries()) {
      try {
        status.textContent = `תמונה ${i + 1} מתוך ${files.length}`;
        const res = await uploadFile(file, 'gallery', status, progress);
        tip.images.push({ id: uid('img_'), url: res.url, storagePath: res.storagePath, alt: '', caption: '', width: res.width, height: res.height, order: tip.images.length });
        added++;
      } catch (e) { showToast(e.message, 'error', 6000); progress.hidden = true; }
    }
    if (added) { markDirty(); showToast(`נוספו ${added} תמונות. אל תשכחו למלא טקסט חלופי.`); }
    renderGallery(added ? `#imageAlt-${tip.images[tip.images.length - added].id}` : null);
  });

  const list = h('ul', { class: 'gallery-list' }, tip.images.map((im, i) => {
    const alt = h('input', { id: `imageAlt-${im.id}`, type: 'text', maxlength: '200', value: im.alt, placeholder: 'מה רואים בתמונה?' });
    alt.addEventListener('input', () => { im.alt = alt.value; });
    const cap = h('input', { id: `imageCap-${im.id}`, type: 'text', maxlength: '200', value: im.caption, placeholder: 'כיתוב שיוצג מתחת לתמונה (אופציונלי)' });
    cap.addEventListener('input', () => { im.caption = cap.value; });


    const replaceInput = h('input', { type: 'file', accept: ACCEPT, 'aria-label': `החלפת תמונה ${i + 1}` });
    replaceInput.addEventListener('change', async () => {
      const file = replaceInput.files[0]; if (!file) return;
      replaceInput.disabled = true;
      try {
        const res = await uploadFile(file, 'gallery', status, progress);
        discardFile(im); // הקובץ הישן יימחק רק אחרי שמירה מוצלחת
        Object.assign(im, { url: res.url, storagePath: res.storagePath, width: res.width, height: res.height });
        markDirty();
        renderGallery(`#imageAlt-${im.id}`);
        showToast('התמונה הוחלפה. בדקו שהטקסט החלופי עדיין מתאים.');
      } catch (e) {
        status.textContent = ''; progress.hidden = true;
        showToast(e.message, 'error', 6000);
        replaceInput.disabled = false; replaceInput.value = '';
      }
    });


    return h('li', { class: 'gallery-item' },
      h('img', { src: im.url, alt: '', width: 96, height: 96 }),
      h('div', { class: 'fields' },
        h('div', { class: 'field', style: 'margin:0' }, h('label', { for: `imageAlt-${im.id}` }, `טקסט חלופי לתמונה ${i + 1}`), alt),
        h('div', { class: 'field', style: 'margin:0' }, h('label', { for: `imageCap-${im.id}` }, 'כיתוב'), cap)),
      h('div', { class: 'item-tools' },
        h('button', { type: 'button', class: 'btn btn--small btn--ghost', 'data-move': `img-up-${im.id}`, disabled: i === 0, 'aria-label': `הזזת תמונה ${i + 1} למעלה`, onclick: () => { moveItem(tip.images, i, -1); markDirty(); renderGallery(`[data-move="img-up-${im.id}"]`); } }, '▲'),
        h('button', { type: 'button', class: 'btn btn--small btn--ghost', 'data-move': `img-down-${im.id}`, disabled: i === tip.images.length - 1, 'aria-label': `הזזת תמונה ${i + 1} למטה`, onclick: () => { moveItem(tip.images, i, 1); markDirty(); renderGallery(`[data-move="img-down-${im.id}"]`); } }, '▼'),
        h('span', { class: 'btn btn--small btn--secondary file-btn', title: 'החלפת תמונה' }, '🔄', replaceInput),
        h('button', { type: 'button', class: 'btn btn--small btn--danger', 'aria-label': `מחיקת תמונה ${i + 1}`, onclick: () => {
          if (!confirmAction('למחוק את התמונה מהגלריה?')) return;
          discardFile(im); tip.images.splice(i, 1); markDirty(); renderGallery();
        } }, '🗑')));
  }));

  clear(box).append(
    tip.images.length ? list : h('p', { class: 'muted' }, 'אין תמונות בגלריה.'),
    h('span', { class: 'btn btn--secondary file-btn' }, '⬆️ הוספת תמונות', fileInput),
    h('p', { class: 'hint' }, 'ניתן לבחור כמה קבצים יחד. JPG, PNG או WebP עד 10MB לקובץ.'),
    progress, status);
  focusIn(box, focusSel);
}

/* ---------- תכנים משלימים ---------- */
function renderExtras(focusSel) {
  const box = $('#extras-box');
  const list = h('ul', { class: 'extras-list' }, tip.extras.map((x, i) => {
    const typeSel = h('select', { id: `extraType-${x.id}` }, Object.entries(EXTRA_TYPES).map(([k, v]) => h('option', { value: k, selected: k === x.type }, v)));
    typeSel.addEventListener('change', () => { x.type = typeSel.value; markDirty(); renderExtras(`#extraType-${x.id}`); });
    const title = h('input', { id: `extraTitle-${x.id}`, type: 'text', maxlength: '120', value: x.title, placeholder: x.type === 'prompt' ? 'למשל: פרומפט לדוגמה' : 'כותרת (אופציונלי)' });
    title.addEventListener('input', () => { x.title = title.value; });
    const content = h('textarea', { id: `extraContent-${x.id}`, rows: x.type === 'prompt' ? '6' : '4', value: x.content, dir: 'auto' });
    content.addEventListener('input', () => { x.content = content.value; });
    const url = h('input', { id: `extraUrl-${x.id}`, type: 'url', dir: 'ltr', value: x.url, placeholder: 'https://' });
    url.addEventListener('input', () => { x.url = url.value; });
    return h('li', { class: `extra-item extra-item--${x.type}` },
      h('div', { class: 'extra-item__head' },
        h('div', { class: 'field', style: 'margin:0' }, h('label', { for: `extraType-${x.id}` }, `בלוק ${i + 1} · סוג`), typeSel),
        h('div', { class: 'row-actions' },
          h('button', { type: 'button', class: 'btn btn--small btn--ghost', 'data-move': `x-up-${x.id}`, disabled: i === 0, 'aria-label': `הזזת בלוק ${i + 1} למעלה`, onclick: () => { moveItem(tip.extras, i, -1); markDirty(); renderExtras(`[data-move="x-up-${x.id}"]`); } }, '▲'),
          h('button', { type: 'button', class: 'btn btn--small btn--ghost', 'data-move': `x-down-${x.id}`, disabled: i === tip.extras.length - 1, 'aria-label': `הזזת בלוק ${i + 1} למטה`, onclick: () => { moveItem(tip.extras, i, 1); markDirty(); renderExtras(`[data-move="x-down-${x.id}"]`); } }, '▼'),
          h('button', { type: 'button', class: 'btn btn--small btn--danger', 'aria-label': `מחיקת בלוק ${i + 1}`, onclick: () => {
            if ((x.content || x.url) && !confirmAction('למחוק את הבלוק?')) return;
            tip.extras.splice(i, 1); markDirty(); renderExtras();
          } }, '🗑'))),
      h('div', { class: 'fields' },
        h('div', { class: 'field', style: 'margin:0' }, h('label', { for: `extraTitle-${x.id}` }, 'כותרת'), title),
        x.type === 'link'
          ? h('div', { class: 'field', style: 'margin:0' }, h('label', { for: `extraUrl-${x.id}` }, 'כתובת הקישור'), url)
          : h('div', { class: 'field', style: 'margin:0' }, h('label', { for: `extraContent-${x.id}` }, x.type === 'prompt' ? 'טקסט הפרומפט (יוצג עם כפתור העתקה)' : 'תוכן'), content)));
  }));
  const add = (type) => { const x = { id: uid('x_'), type, title: '', content: '', url: '', order: tip.extras.length }; tip.extras.push(x); markDirty(); renderExtras(`#extraTitle-${x.id}`); };
  clear(box).append(
    tip.extras.length ? list : h('p', { class: 'muted' }, 'אין תכנים משלימים. בלוקים ריקים לא יוצגו באתר.'),
    h('div', { class: 'add-row' },
      h('button', { type: 'button', class: 'btn btn--secondary btn--small', onclick: () => add('prompt') }, '+ פרומפט'),
      h('button', { type: 'button', class: 'btn btn--secondary btn--small', onclick: () => add('note') }, '+ הערה'),
      h('button', { type: 'button', class: 'btn btn--secondary btn--small', onclick: () => add('text') }, '+ טקסט'),
      h('button', { type: 'button', class: 'btn btn--secondary btn--small', onclick: () => add('link') }, '+ קישור')));
  focusIn(box, focusSel);
}

/* ---------- הפצה ---------- */
function distFor(groupId) {
  let d = distribution.find((x) => x.groupId === groupId);
  if (!d) { d = { groupId, target: false, published: false, publishedAt: null, notes: '' }; distribution.push(d); }
  return d;
}

function renderDistribution() {
  const box = $('#dist-box');
  const used = new Set(distribution.filter((d) => d.target || d.published).map((d) => d.groupId));
  const visible = groups.filter((g) => (g.active && !g.archived) || used.has(g.id));
  const p = distributionProgress(distribution);
  const badge = h('span', { class: `badge badge--${p.state}`, id: 'dist-progress' }, p.total ? `${p.label} · ${p.done}/${p.total}` : p.label);

  const bulk = (fn, msg) => () => { visible.filter((g) => g.active && !g.archived).forEach((g) => fn(distFor(g.id))); markDirty(); renderDistribution(); showToast(msg); };
  const toolbar = h('div', { class: 'dist-toolbar' },
    h('button', { type: 'button', class: 'btn btn--small btn--secondary', onclick: bulk((d) => { d.target = true; }, 'כל הקבוצות הפעילות סומנו כיעד') }, 'סמן את כל קבוצות היעד'),
    h('button', { type: 'button', class: 'btn btn--small btn--secondary', onclick: () => { distribution.forEach((d) => { if (!d.published) d.target = false; }); markDirty(); renderDistribution(); showToast('היעדים נוקו (קבוצות שכבר נשלחו נשמרו)'); } }, 'נקה יעדים'),
    h('button', { type: 'button', class: 'btn btn--small btn--secondary', onclick: () => { const now = new Date(); distribution.filter((d) => d.target && !d.published).forEach((d) => { d.published = true; d.publishedAt = now; }); markDirty(); renderDistribution(); showToast('כל קבוצות היעד סומנו כפורסמו'); } }, 'סמן כפורסם בכל היעדים'),
    h('button', { type: 'button', class: 'btn btn--small btn--ghost', onclick: () => { if (!confirmAction('לבטל את סימון "פורסם" בכל הקבוצות?')) return; distribution.forEach((d) => { d.published = false; d.publishedAt = null; }); markDirty(); renderDistribution(); } }, 'בטל סימון פרסום'),
    badge);

  if (!visible.length) {
    clear(box).append(stateBox('empty', 'אין קבוצות הפצה', 'הוסיפו קבוצות במסך קבוצות ההפצה.', h('a', { class: 'btn btn--secondary', href: '/admin/groups.html' }, 'לניהול קבוצות')));
    return;
  }

  const rows = visible.map((g) => {
    const d = distribution.find((x) => x.groupId === g.id) || { target: false, published: false, publishedAt: null, notes: '' };
    const tId = `dist-t-${g.id}`, pId = `dist-p-${g.id}`, aId = `dist-a-${g.id}`, nId = `dist-n-${g.id}`;
    const target = h('input', { type: 'checkbox', id: tId, checked: d.target });
    const pub = h('input', { type: 'checkbox', id: pId, checked: d.published });
    const at = h('input', { type: 'datetime-local', id: aId, value: toDatetimeLocal(d.publishedAt), disabled: !d.published, 'aria-label': `מועד שליחה ל${g.name}` });
    const notes = h('input', { type: 'text', id: nId, value: d.notes, maxlength: '200', placeholder: 'הערה', 'aria-label': `הערה עבור ${g.name}` });
    target.addEventListener('change', () => { const x = distFor(g.id); x.target = target.checked; markDirty(); renderDistribution(); $(`#${tId}`)?.focus(); });
    pub.addEventListener('change', () => {
      const x = distFor(g.id); x.published = pub.checked;
      if (pub.checked) { x.target = true; x.publishedAt = x.publishedAt || new Date(); } else x.publishedAt = null;
      markDirty(); renderDistribution(); $(`#${pId}`)?.focus();
    });
    at.addEventListener('change', () => { distFor(g.id).publishedAt = fromDatetimeLocal(at.value) || new Date(); markDirty(); });
    notes.addEventListener('input', () => { distFor(g.id).notes = notes.value; });
    return h('tr', { class: g.archived ? 'is-archived' : null },
      h('th', { scope: 'row', class: 'dist-group-name' }, g.name, g.archived ? h('span', { class: 'muted' }, ' (ארכיון)') : !g.active ? h('span', { class: 'muted' }, ' (לא פעילה)') : null),
      h('td', {}, h('label', { class: 'check' }, target, h('span', {}, 'יעד'), h('span', { class: 'visually-hidden' }, ` – ${g.name}`))),
      h('td', {}, h('label', { class: 'check' }, pub, h('span', {}, 'נשלח'), h('span', { class: 'visually-hidden' }, ` – ${g.name}`))),
      h('td', {}, at),
      h('td', {}, notes));
  });
  clear(box).append(toolbar, h('div', { class: 'table-wrap' }, h('table', { class: 'data-table dist-table' },
    h('caption', { class: 'visually-hidden' }, 'סטטוס הפצה לפי קבוצה'),
    h('thead', {}, h('tr', {}, ['קבוצה', 'קבוצת יעד', 'פורסם', 'מועד שליחה', 'הערות'].map((x) => h('th', { scope: 'col' }, x)))),
    h('tbody', {}, rows))));
}

/* ---------- סטטוס ופעולות ---------- */
function renderStatus() {
  const badge = $('#status-badge');
  if (badge) clear(badge).append(h('span', { class: `badge badge--${tip.status}` }, tip.status === 'published' ? 'מפורסם באתר' : 'טיוטה'),
    tip.status === 'published' ? h('a', { href: tipPath(tip.slug), target: '_blank', rel: 'noopener', style: 'margin-inline-start:.5rem' }, 'לצפייה באתר ↗') : null);
  const st = $('#action-status');
  if (st) clear(st).append(h('span', { class: `badge badge--${tip.status}` }, tip.status === 'published' ? 'מפורסם' : 'טיוטה'),
    dirty ? h('span', { class: 'dirty-dot' }, '● שינויים שלא נשמרו') : (tip.updatedAt ? h('span', { class: 'muted' }, `נשמר ${formatDateTime(tip.updatedAt)}`) : null));
  const meta = $('#edit-meta');
  if (meta && !isNew) clear(meta).append(h('a', { class: 'btn btn--small btn--ghost', target: '_blank', rel: 'noopener', href: `/tip.html?preview=1&id=${encodeURIComponent(id)}` }, 'תצוגה מקדימה (גרסה שמורה) ↗'));
  const btns = $('#action-buttons');
  if (!btns) return;
  const pub = tip.status === 'published';
  clear(btns).append(
    h('button', { type: 'button', class: 'btn btn--ghost', onclick: cancel }, isNew ? 'ביטול' : 'חזרה לרשימה'),
    !isNew ? h('button', { type: 'button', class: 'btn btn--danger', onclick: removeTip }, 'מחיקה') : null,
    pub
      ? h('button', { type: 'button', class: 'btn btn--secondary', onclick: () => save('draft') }, 'העבר לטיוטה')
      : h('button', { type: 'button', class: 'btn btn--secondary', onclick: () => save('draft') }, 'שמירת טיוטה'),
    h('button', { type: 'button', class: 'btn btn--primary', onclick: () => save('published') }, pub ? 'שמירת שינויים' : 'פרסום באתר'));
}

function showErrors(errors) {
  root.querySelectorAll('[aria-invalid="true"]').forEach((el) => el.removeAttribute('aria-invalid'));
  if (!errors.length) { errorSummary.hidden = true; clear(errorSummary); return; }
  const idMap = { title: 'f-title', slug: 'f-slug', categoryId: 'f-category', summary: 'f-summary', posterAlt: 'f-poster-alt' };
  clear(errorSummary).append(h('h2', {}, `לא ניתן לשמור – יש לתקן ${errors.length} שדות:`),
    h('ul', {}, errors.map((e) => {
      const fid = idMap[e.field] || e.field;
      document.getElementById(fid)?.setAttribute('aria-invalid', 'true');
      return h('li', {}, h('a', { href: `#${fid}`, onclick: (ev) => { ev.preventDefault(); const el = document.getElementById(fid); el?.scrollIntoView({ block: 'center' }); el?.focus(); } }, e.message));
    })));
  errorSummary.hidden = false;
  errorSummary.focus();
  errorSummary.scrollIntoView({ block: 'start' });
}

async function save(status) {
  if (saving) return;
  const draft = collect();
  draft.status = status;
  const cat = categories.find((c) => c.id === draft.categoryId);
  const prepared = prepareTip(draft, cat?.name || '');
    if (!prepared.slug) {
    prepared.slug = prepared.number != null ? `tip-${prepared.number}` : `tip-${String(id).toLowerCase().replace(/[^a-z0-9]/g, '').slice(-8)}`;
  }
  const errors = validateTipForSave(prepared);
  saving = true;
  root.setAttribute('aria-busy', 'true');
  $('#action-buttons')?.querySelectorAll('button').forEach((b) => { b.disabled = true; });
  try {
    if (prepared.slug && !errors.some((e) => e.field === 'slug')) {
      const base = prepared.slug;
      let n = 2;
      while (await api.isSlugTaken(prepared.slug, id)) prepared.slug = `${base}-${n++}`;
      inputs.slug.value = prepared.slug;
    }
    showErrors(errors);
    if (errors.length) return;
    if (prepared.number != null) {
      const dup = await api.findTipsByNumber(prepared.number, id);
      if (dup.length && !confirmAction(`מספר טיפ ${prepared.number} כבר קיים ("${dup[0].title}"). לשמור בכל זאת?`)) return;
    }
    await api.saveTip(id, prepared, prepareDistribution(distribution), { isNew, createdAt: tip.createdAt });
    const wasNew = isNew;
    const prevStatus = tip.status;
    tip = { ...tip, ...prepared, websitePublishedAt: prepared.websitePublishedAt, updatedAt: new Date() };
    if (prepared.websitePublishedAt) inputs.publishedAt.value = toDatetimeLocal(prepared.websitePublishedAt);
    isNew = false; dirty = false;
    sessionUploads.clear();
    if (pendingDeletes.size) { await api.deleteFiles([...pendingDeletes]); pendingDeletes.clear(); }
    if (wasNew) {
  dirty = false;

  showToast(
    status === 'published'
      ? 'הטיפ פורסם. פותח טופס חדש…'
      : 'הטיוטה נשמרה. פותח טופס חדש…'
  );

  setTimeout(() => {
    location.href = '/admin/tip-edit.html';
  }, 700);

  return;
}
    $('#edit-title').textContent = `עריכה: ${tip.title}`;
    showToast(status === 'published' ? (prevStatus !== 'published' ? 'הטיפ פורסם באתר 🎉' : 'השינויים נשמרו') : 'נשמר כטיוטה');
  } catch (e) {
    showToast(e.message || 'השמירה נכשלה', 'error', 6000);
  } finally {
    saving = false;
    root.setAttribute('aria-busy', 'false');
    renderStatus();
  }
}

async function cancel() {
  if (dirty && !confirmAction('יש שינויים שלא נשמרו. לצאת בכל זאת?')) return;
  if (sessionUploads.size) await api.deleteFiles([...sessionUploads]).catch(() => {});
  dirty = false;
  location.href = '/admin/tips.html';
}

async function removeTip() {
  if (!confirmAction(`למחוק את הטיפ "${tip.title}"?\nהפעולה תמחק גם את הפוסטר והתמונות, ואינה הפיכה.`)) return;
  try {
    await api.deleteTip(id);
    if (sessionUploads.size) await api.deleteFiles([...sessionUploads]).catch(() => {});
    dirty = false; location.href = '/admin/tips.html';
  } catch (e) { showToast(e.message, 'error', 6000); }
}

load();
