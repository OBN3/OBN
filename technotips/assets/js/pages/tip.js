import { initLayout, stateBox } from '../components/layout.js';
import { getApi, getCategoryMap } from '../api/index.js';
import { h, clear, $, getParam } from '../utils/dom.js';
import { sanitizeHtml } from '../utils/sanitize.js';
import { formatDate } from '../utils/format.js';
import { tipUrl, tipPath, categoryPath, whatsappMessage, isVisibleExtra, EXTRA_TYPES, siteOrigin } from '../utils/tip-logic.js';
import { copyText } from '../components/toast.js';
import { openLightbox } from '../components/lightbox.js';
import { tipCard } from '../components/tip-card.js';
import { setSeo } from '../components/seo.js';
import { siteConfig } from '../firebase-config.js';

initLayout({ active: 'tips' });

const root = $('#tip-root');
const article = $('#tip');

function slugFromLocation() {
  const q = getParam('slug');
  if (q) return q;
  const m = location.pathname.match(/^\/tips\/([^/]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : '';
}

function paragraphs(text) {
  return String(text).split(/\n{2,}/).map((p) => h('p', {}, p.split('\n').flatMap((line, i) => (i ? [h('br'), line] : [line]))));
}

function renderExtra(e) {
  const title = e.title || EXTRA_TYPES[e.type];
  if (e.type === 'prompt') {
    const pre = h('pre', { class: 'prompt__text', dir: 'auto', tabindex: '0' }, e.content);
    return h('section', { class: 'extra prompt', 'aria-label': title },
      h('div', { class: 'prompt__head' },
        h('h2', { class: 'extra__title' }, h('span', { 'aria-hidden': 'true' }, '✨ '), title),
        h('button', { type: 'button', class: 'btn btn--small btn--primary', onclick: () => copyText(e.content, 'הפרומפט הועתק ✓') }, 'העתק פרומפט')),
      pre);
  }
  if (e.type === 'note') {
    return h('aside', { class: 'extra callout' }, h('h2', { class: 'extra__title' }, h('span', { 'aria-hidden': 'true' }, '📌 '), title), paragraphs(e.content));
  }
  if (e.type === 'link') {
    let host = '';
    try { host = new URL(e.url).hostname.replace(/^www\./, ''); } catch { return null; }
    if (!/^https?:/i.test(e.url)) return null;
    return h('a', { class: 'extra link-card', href: e.url, target: '_blank', rel: 'noopener noreferrer' },
      h('span', { class: 'link-card__icon', 'aria-hidden': 'true' }, '🔗'),
      h('span', { class: 'link-card__body' }, h('strong', {}, e.title || e.url), h('span', { class: 'muted' }, host)),
      h('span', { class: 'visually-hidden' }, ' (נפתח בחלון חדש)'));
  }
  return h('section', { class: 'extra extra--text' }, e.title ? h('h2', { class: 'extra__title' }, e.title) : null, paragraphs(e.content));
}

function renderShare(tip) {
  const url = tipUrl(tip.slug);
  const wa = `https://wa.me/?text=${encodeURIComponent(whatsappMessage(tip))}`;
  const box = h('div', { class: 'share' },
    h('h2', { class: 'share__title' }, 'שיתוף'),
    h('div', { class: 'share__actions' },
      h('a', { class: 'btn btn--whatsapp', href: wa, target: '_blank', rel: 'noopener noreferrer' }, h('span', { 'aria-hidden': 'true' }, '💬 '), 'שיתוף ב-WhatsApp'),
      h('button', { type: 'button', class: 'btn btn--secondary', onclick: () => copyText(url, 'הקישור הועתק ✓') }, h('span', { 'aria-hidden': 'true' }, '🔗 '), 'העתק קישור'),
      h('button', { type: 'button', class: 'btn btn--secondary', onclick: () => copyText(whatsappMessage(tip), 'נוסח השיתוף הועתק ✓') }, h('span', { 'aria-hidden': 'true' }, '📋 '), 'העתק נוסח לשיתוף')));
  if (navigator.share) {
    box.querySelector('.share__actions').append(h('button', {
      type: 'button', class: 'btn btn--secondary',
      onclick: async () => {
        try { await navigator.share({ title: tip.title, text: tip.summary, url }); }
        catch (e) { if (e.name !== 'AbortError') copyText(url, 'הקישור הועתק ✓'); }
      }
    }, h('span', { 'aria-hidden': 'true' }, '📤 '), 'שיתוף…'));
  }
  return box;
}

function renderTip(tip, cat, preview) {
  const content = sanitizeHtml(tip.contentHtml);
  const body = h('div', { class: 'tip-content prose' });
  body.innerHTML = content; // מסונן ע"י sanitizeHtml (allowlist)

  const extras = tip.extras.filter(isVisibleExtra).map(renderExtra).filter(Boolean);
  const gallery = tip.images.length ? h('section', { class: 'gallery', 'aria-labelledby': 'gallery-title' },
    h('h2', { id: 'gallery-title', class: 'extra__title' }, 'גלריה'),
    h('ul', { class: 'gallery__grid' }, tip.images.map((im, i) => h('li', {},
      h('figure', {},
        h('button', { type: 'button', class: 'gallery__btn', 'aria-label': `הגדלת תמונה: ${im.alt || `תמונה ${i + 1}`}`, onclick: (ev) => openLightbox(tip.images, i, ev.currentTarget) },
          h('img', { src: im.url, alt: im.alt || '', loading: 'lazy', decoding: 'async', width: im.width || 600, height: im.height || 400 })),
        im.caption ? h('figcaption', {}, im.caption) : null))))) : null;

  const poster = tip.poster ? h('figure', { class: 'tip-poster' },
    h('button', { type: 'button', class: 'tip-poster__btn', 'aria-label': `הגדלת הפוסטר: ${tip.poster.alt}`, onclick: (ev) => openLightbox([{ ...tip.poster, caption: '' }], 0, ev.currentTarget) },
      h('img', { src: tip.poster.url, alt: tip.poster.alt || '', width: tip.poster.width || 800, height: tip.poster.height || 1000, fetchpriority: 'high', decoding: 'async' }))) : null;

  clear(root).append(
    preview ? h('div', { class: 'preview-banner', role: 'note' }, `תצוגה מקדימה למנהל · סטטוס: ${tip.status === 'published' ? 'מפורסם' : 'טיוטה'}`) : null,
    h('nav', { class: 'breadcrumb', 'aria-label': 'פירורי לחם' }, h('ol', {},
      h('li', {}, h('a', { href: '/' }, 'בית')),
      h('li', {}, h('a', { href: '/tips.html' }, 'כל הטיפים')),
      cat ? h('li', {}, h('a', { href: categoryPath(cat.slug) }, cat.name)) : null,
      h('li', { 'aria-current': 'page' }, tip.title))),
    h('header', { class: 'tip-header' },
      h('div', { class: 'tip-meta' },
        cat ? h('a', { class: 'chip chip--category', href: categoryPath(cat.slug) }, cat.name) : null,
        tip.number != null ? h('span', { class: 'tip-number' }, `טיפ #${tip.number}`) : null,
        tip.websitePublishedAt ? h('time', { class: 'muted', datetime: tip.websitePublishedAt.toISOString() }, formatDate(tip.websitePublishedAt)) : null),
      h('h1', { class: 'tip-title' }, tip.title),
      tip.summary ? h('p', { class: 'tip-summary' }, tip.summary) : null),
    poster,
    content ? body : null,
    extras.length ? h('div', { class: 'extras' }, extras) : null,
    gallery,
    renderShare(tip),
    tip.tags.length ? h('div', { class: 'tip-tags' }, h('h2', { class: 'visually-hidden' }, 'תגיות'),
      h('ul', { class: 'tag-list' }, tip.tags.map((t) => h('li', {}, h('a', { class: 'tag tag--link', href: `/tips.html?tag=${encodeURIComponent(t)}` }, `#${t}`))))) : null
  );

  const url = tipUrl(tip.slug);
  setSeo({
    title: tip.seo.title || tip.title,
    description: tip.seo.description || tip.summary,
    url, image: tip.poster?.url, type: 'article', noindex: preview,
    jsonLd: {
      '@context': 'https://schema.org', '@type': 'BlogPosting',
      headline: tip.title, description: tip.summary, inLanguage: 'he',
      image: tip.poster?.url ? [tip.poster.url] : undefined,
      datePublished: tip.websitePublishedAt?.toISOString(), dateModified: (tip.updatedAt || tip.websitePublishedAt)?.toISOString(),
      author: tip.authorName ? { '@type': 'Person', name: tip.authorName } : { '@type': 'Organization', name: siteConfig.siteName },
      publisher: { '@type': 'Organization', name: siteConfig.siteName, logo: { '@type': 'ImageObject', url: `${siteOrigin()}/media/og-default.png` } },
      mainEntityOfPage: url, keywords: tip.tags.join(', ')
    }
  });
}

async function loadRelated(api, tip, catMap) {
  try {
    const related = await api.getRelatedTips(tip);
    if (!related.length) return;
    $('#related').append(h('div', { class: 'tip-grid' }, related.map((t) => tipCard(t, catMap, { headingLevel: 3 }))));
    $('#related-section').hidden = false;
  } catch (e) { console.warn('related failed', e); }
}


/** כפתור עריכה למנהל מחובר. נבדק רק אם הדפדפן כבר נכנס בעבר לממשק הניהול, כדי שמבקרים רגילים לא יטענו קוד התחברות. */
async function addAdminEditButton(api, tip) {
  if (localStorage.getItem('technotips-admin') !== '1') return;
  const user = await new Promise((resolve) => { const off = api.onAuthChange((u) => { resolve(u); queueMicrotask(() => off?.()); }); });
  if (!user?.isAdmin) return;
  root.querySelector('.tip-header')?.prepend(
    h('a', { class: 'btn btn--small btn--secondary admin-edit-link', href: `/admin/tip-edit.html?id=${encodeURIComponent(tip.id)}` }, '✏️ עריכת הטיפ'));
}


async function loadPreviewTip(api, id) {
  const user = await new Promise((resolve) => { const off = api.onAuthChange((u) => { resolve(u); queueMicrotask(() => off?.()); }); });
  if (!user?.isAdmin) return null;
  return (await api.getTipForAdmin(id))?.tip || null;
}

async function main() {
  const slug = slugFromLocation();
  const previewId = getParam('preview') === '1' ? getParam('id') : null;
  try {
    const api = await getApi();
    const [catMap, tip] = await Promise.all([
      getCategoryMap().catch(() => new Map()),
      previewId ? loadPreviewTip(api, previewId) : slug ? api.getPublishedTipBySlug(slug) : null
    ]);
    if (!tip) {
      setSeo({ title: 'הטיפ לא נמצא', description: '', noindex: true });
      clear(root).append(stateBox('notfound', 'הטיפ לא נמצא', 'ייתכן שהקישור שגוי, או שהטיפ עדיין לא פורסם.', h('a', { class: 'btn btn--primary', href: '/tips.html' }, 'לכל הטיפים')));
      return;
    }
    // הפניה מכתובת ישנה לכתובת הקנונית ללא טעינה מחדש
    if (!previewId && !siteConfig.prettyUrls && location.pathname.startsWith('/tips/')) history.replaceState(null, '', tipPath(tip.slug));
    renderTip(tip, catMap.get(tip.categoryId), !!previewId);
    if (!previewId) loadRelated(api, tip, catMap);
    addAdminEditButton(api, tip).catch(() => {});
  } catch (e) {
    console.warn(e);
    clear(root).append(stateBox('error', 'לא הצלחנו לטעון את הטיפ', navigator.onLine ? e.message : 'נראה שאין חיבור לאינטרנט.',
      h('button', { type: 'button', class: 'btn btn--primary', onclick: () => { clear(root); main(); } }, 'נסו שוב')));
  } finally {
    article.setAttribute('aria-busy', 'false');
  }
}
main();
