// לוגיקה עסקית משותפת: נרמול טיפ, התקדמות הפצה, טיפים קשורים, נוסח WhatsApp, URL.
import { siteConfig } from '../firebase-config.js';
import { toDate } from './format.js';

export const EXTRA_TYPES = {
  prompt: 'פרומפט',
  note: 'הערה',
  text: 'טקסט',
  link: 'קישור'
};

export function emptyTip(id) {
  return normalizeTip({ id, status: 'draft', featured: false });
}

export function normalizeTip(t = {}) {
  return {
    id: t.id,
    number: t.number === '' || t.number == null ? null : Number(t.number),
    title: t.title || '',
    slug: t.slug || '',
    summary: t.summary || '',
    contentHtml: t.contentHtml || '',
    poster: t.poster && t.poster.url ? { url: t.poster.url, storagePath: t.poster.storagePath || null, alt: t.poster.alt || '', width: t.poster.width || null, height: t.poster.height || null } : null,
    images: [...(t.images || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    extras: [...(t.extras || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    categoryId: t.categoryId || '',
    tags: t.tags || [],
    authorName: t.authorName || '',
    status: t.status === 'published' ? 'published' : 'draft',
    featured: !!t.featured,
    websitePublishedAt: toDate(t.websitePublishedAt),
    whatsappText: t.whatsappText || '',
    seo: { title: t.seo?.title || '', description: t.seo?.description || '' },
    searchTokens: t.searchTokens || [],
    createdAt: toDate(t.createdAt),
    updatedAt: toDate(t.updatedAt)
  };
}

export function normalizeDistribution(list = []) {
  return list.map((d) => ({
    groupId: d.groupId,
    target: !!d.target,
    published: !!d.published,
    publishedAt: toDate(d.publishedAt),
    notes: d.notes || ''
  }));
}

/** התקדמות לפי קבוצות היעד בלבד (למשל 2/3 ולא 2/8). */
export function distributionProgress(distribution = []) {
  const targets = distribution.filter((d) => d.target);
  const done = targets.filter((d) => d.published).length;
  const total = targets.length;
  let state = 'none';
  if (total > 0) state = done === total ? 'complete' : done > 0 ? 'partial' : 'pending';
  const label = { none: 'אין קבוצות יעד', pending: 'טרם הופץ', partial: 'הופץ חלקית', complete: 'הופץ לכל היעדים' }[state];
  return { total, done, state, label };
}

export function isVisibleExtra(e) {
  if (!e) return false;
  if (e.type === 'link') return !!(e.url && e.url.trim());
  return !!(e.content && e.content.trim());
}

export function tipPath(slug) {
  const s = encodeURIComponent(slug);
  return siteConfig.prettyUrls ? `/tips/${s}` : `/tip.html?slug=${s}`;
}

export function siteOrigin() {
  return (siteConfig.siteUrl || (typeof location !== 'undefined' ? location.origin : '')).replace(/\/$/, '');
}

export function tipUrl(slug) { return siteOrigin() + tipPath(slug); }

export function categoryPath(slug) { return `/category.html?slug=${encodeURIComponent(slug)}`; }

export function whatsappMessage(tip) {
  const url = tipUrl(tip.slug);
  if (tip.whatsappText && tip.whatsappText.trim()) return `${tip.whatsappText.trim()}\n\n${url}`;
  return [`*${tip.title}*`, tip.summary, url].filter(Boolean).join('\n\n');
}

export function defaultWhatsappDraft(tip) {
  const num = tip.number != null ? `טכנוטיפ #${tip.number} 💡\n` : '💡 ';
  return `${num}*${tip.title || ''}*\n\n${tip.summary || ''}`.trim();
}

/** ניקוד טיפים קשורים לפי קטגוריה ותגיות משותפות. */
export function rankRelated(tip, candidates, max = 3) {
  const tags = new Set((tip.tags || []).map((t) => t.toLowerCase()));
  return candidates
    .filter((c) => c.id !== tip.id)
    .map((c) => {
      const shared = (c.tags || []).filter((t) => tags.has(t.toLowerCase())).length;
      return { c, score: shared * 2 + (c.categoryId === tip.categoryId ? 3 : 0) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (b.c.websitePublishedAt?.getTime?.() || 0) - (a.c.websitePublishedAt?.getTime?.() || 0))
    .slice(0, max)
    .map((x) => x.c);
}

export function compareBySort(sort) {
  const t = (d) => (d ? d.getTime() : 0);
  if (sort === 'oldest') return (a, b) => t(a.websitePublishedAt) - t(b.websitePublishedAt);
  if (sort === 'number') return (a, b) => (a.number ?? Infinity) - (b.number ?? Infinity);
  return (a, b) => t(b.websitePublishedAt) - t(a.websitePublishedAt);
}
