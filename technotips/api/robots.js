// /robots.txt – חוסם את ממשק הניהול ומפנה ל-sitemap עם כתובת מלאה.
import { originFrom } from './_firestore.js';

export default function handler(req, res) {
  const origin = originFrom(req);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=86400');
  res.end(`User-agent: *\nDisallow: /admin\nDisallow: /admin/\nDisallow: /api/\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
}
