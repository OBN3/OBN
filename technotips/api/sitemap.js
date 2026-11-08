// /sitemap.xml – דפים ציבוריים + טיפים במצב published בלבד.
import { isConfigured, listPublishedTipsForSitemap, listActiveCategories, originFrom, esc } from './_firestore.js';

export default async function handler(req, res) {
  const origin = originFrom(req);
  const urls = [
    { loc: `${origin}/`, priority: '1.0' },
    { loc: `${origin}/tips`, priority: '0.9' },
    { loc: `${origin}/about.html`, priority: '0.3' }
  ];
  try {
    if (isConfigured()) {
      const [tips, cats] = await Promise.all([listPublishedTipsForSitemap(), listActiveCategories()]);
      cats.forEach((c) => urls.push({ loc: `${origin}/category.html?slug=${encodeURIComponent(c.slug)}`, priority: '0.6' }));
      tips.forEach((t) => urls.push({ loc: `${origin}/tips/${encodeURIComponent(t.slug)}`, lastmod: (t.updatedAt || t.websitePublishedAt || '').slice(0, 10), priority: '0.8' }));
    }
  } catch (e) { console.error('sitemap', e); }
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) =>
    `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`).join('\n')}\n</urlset>\n`;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.end(body);
}
