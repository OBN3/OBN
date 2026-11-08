// /tips/{slug} – מחזיר את tip.html עם מטא-תגיות SEO/Open Graph מוזרקות בצד השרת,
// כדי שתצוגה מקדימה של קישור ב-WhatsApp / פייסבוק / לינקדאין תציג כותרת, תקציר ופוסטר.
// התוכן עצמו ממשיך להיטען בצד הלקוח (tip.js).
import { isConfigured, getPublishedTipBySlug, originFrom, esc } from './_firestore.js';

let templateCache = null;
const SITE_NAME = 'טכנוטיפים';

async function getTemplate(origin) {
  if (templateCache) return templateCache;
  const res = await fetch(`${origin}/tip.html`);
  if (!res.ok) throw new Error(`template ${res.status}`);
  templateCache = await res.text();
  return templateCache;
}

function seoBlock(tip, origin, url) {
  const title = `${tip.seo?.title || tip.title} | ${SITE_NAME}`;
  const desc = tip.seo?.description || tip.summary || '';
  const poster = tip.poster?.url && /^https?:/.test(tip.poster.url) && !/\.svg(\?|$)/i.test(tip.poster.url) ? tip.poster.url : `${origin}/media/og-default.png`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: tip.title, description: desc, inLanguage: 'he',
    image: [poster], datePublished: tip.websitePublishedAt || undefined, dateModified: tip.updatedAt || tip.websitePublishedAt || undefined,
    author: tip.authorName ? { '@type': 'Person', name: tip.authorName } : { '@type': 'Organization', name: SITE_NAME },
    publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: `${origin}/media/og-default.png` } },
    mainEntityOfPage: url, keywords: (tip.tags || []).join(', ')
  };
  return `<!--SEO:START-->
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${esc(url)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:image" content="${esc(poster)}">
  <meta property="og:locale" content="he_IL">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image" content="${esc(poster)}">
  <script type="application/ld+json" id="ld-json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
  <!--SEO:END-->`;
}

export default async function handler(req, res) {
  const origin = originFrom(req);
  const slug = String(req.query.slug || '').toLowerCase();
  let html;
  try { html = await getTemplate(origin); }
  catch { res.writeHead(302, { Location: `/tip.html?slug=${encodeURIComponent(slug)}` }); return res.end(); }

  let status = 200;
  try {
    if (isConfigured() && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      const tip = await getPublishedTipBySlug(slug);
      if (tip) html = html.replace(/<!--SEO:START-->[\s\S]*?<!--SEO:END-->/, seoBlock(tip, origin, `${origin}/tips/${slug}`));
      else status = 404;
    }
  } catch (e) {
    console.error('tip-page', e); // נכשל בשקט – הדף ימשיך לעבוד בצד הלקוח
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
  res.end(html);
}
