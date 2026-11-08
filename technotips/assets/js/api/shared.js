// הכנת טיפ לשמירה – משותף לשני המתאמים.
import { sanitizeHtml } from '../utils/sanitize.js';
import { buildSearchTokens, parseTags, SLUG_RE } from '../utils/text.js';
import { normalizeDistribution } from '../utils/tip-logic.js';

export const NUMBER_SORT_EMPTY = 999999999;

export function prepareTip(tip, categoryName = '') {
  const clean = {
    number: tip.number == null || tip.number === '' || isNaN(Number(tip.number)) ? null : Number(tip.number),
    title: String(tip.title || '').trim().slice(0, 200),
    slug: String(tip.slug || '').trim().toLowerCase(),
    summary: String(tip.summary || '').trim().slice(0, 500),
    contentHtml: sanitizeHtml(tip.contentHtml || ''),
    poster: tip.poster?.url ? {
      url: tip.poster.url, storagePath: tip.poster.storagePath || null, alt: String(tip.poster.alt || '').trim(),
      width: tip.poster.width || null, height: tip.poster.height || null
    } : null,
    images: (tip.images || []).map((im, i) => ({
      id: im.id, url: im.url, storagePath: im.storagePath || null, alt: String(im.alt || '').trim(),
      caption: String(im.caption || '').trim(), width: im.width || null, height: im.height || null, order: i
    })),
    extras: (tip.extras || []).map((e, i) => ({
      id: e.id, type: ['prompt', 'note', 'text', 'link'].includes(e.type) ? e.type : 'text',
      title: String(e.title || '').trim(), content: String(e.content || ''), url: String(e.url || '').trim(), order: i
    })),
    categoryId: tip.categoryId || '',
    tags: parseTags(tip.tags),
    authorName: String(tip.authorName || '').trim(),
    status: tip.status === 'published' ? 'published' : 'draft',
    featured: !!tip.featured,
    websitePublishedAt: tip.websitePublishedAt || null,
    whatsappText: String(tip.whatsappText || ''),
    seo: { title: String(tip.seo?.title || '').trim(), description: String(tip.seo?.description || '').trim() }
  };
  if (clean.status === 'published' && !clean.websitePublishedAt) clean.websitePublishedAt = new Date();
  clean.numberSort = clean.number ?? NUMBER_SORT_EMPTY;
  clean.searchTokens = buildSearchTokens(clean, categoryName);
  return clean;
}

export function validateTipForSave(tip) {
  const errors = [];
  if (!tip.title) errors.push({ field: 'title', message: 'יש להזין כותרת.' });
  if (!tip.slug) errors.push({ field: 'slug', message: 'יש להזין כתובת (slug).' });
  else if (!SLUG_RE.test(tip.slug)) errors.push({ field: 'slug', message: 'כתובת (slug) יכולה לכלול רק אותיות באנגלית קטנות, ספרות ומקפים.' });
  if (!tip.categoryId) errors.push({ field: 'categoryId', message: 'יש לבחור קטגוריה.' });
  if (tip.status === 'published' && !tip.summary) errors.push({ field: 'summary', message: 'לפרסום באתר נדרש תקציר.' });
  if (tip.poster && !tip.poster.alt) errors.push({ field: 'posterAlt', message: 'יש להזין טקסט חלופי (alt) לפוסטר.' });
  tip.images.forEach((im, i) => { if (!im.alt) errors.push({ field: `imageAlt-${im.id}`, message: `יש להזין טקסט חלופי (alt) לתמונה ${i + 1} בגלריה.` }); });
  tip.extras.forEach((e, i) => {
    if (e.type === 'link' && e.url && !/^https?:\/\//i.test(e.url)) errors.push({ field: `extraUrl-${e.id}`, message: `הקישור בבלוק ${i + 1} חייב להתחיל ב-http:// או https://.` });
  });
  return errors;
}

export function prepareDistribution(list) {
  return normalizeDistribution(list).filter((d) => d.target || d.published || d.notes)
    .map((d) => ({ ...d, publishedAt: d.published ? (d.publishedAt || new Date()) : null }));
}
