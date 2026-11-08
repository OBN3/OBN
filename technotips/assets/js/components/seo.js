// עדכון מטא-תגיות בצד הלקוח. בייצור (Vercel) הפונקציה api/tip-page מזריקה אותן גם בצד השרת
// כדי שתצוגה מקדימה ב-WhatsApp/פייסבוק תעבוד (סורקים אלה אינם מריצים JavaScript).
import { siteConfig } from '../firebase-config.js';
import { siteOrigin } from '../utils/tip-logic.js';

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.append(el); }
  el.setAttribute('content', content || '');
}
function setLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) { el = document.createElement('link'); el.rel = rel; document.head.append(el); }
  el.href = href;
}

export function setSeo({ title, description, url, image, type = 'website', jsonLd, noindex = false }) {
  const fullTitle = title ? `${title} | ${siteConfig.siteName}` : siteConfig.siteName;
  document.title = fullTitle;
  const img = image && /^https?:/.test(image) && !/\.svg(\?|$)/i.test(image) ? image : `${siteOrigin()}/media/og-default.png`;
  setMeta('name', 'description', description);
  setMeta('property', 'og:title', fullTitle);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:type', type);
  setMeta('property', 'og:image', img);
  setMeta('property', 'og:locale', 'he_IL');
  setMeta('property', 'og:site_name', siteConfig.siteName);
  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', fullTitle);
  setMeta('name', 'twitter:description', description);
  setMeta('name', 'twitter:image', img);
  if (url) { setLink('canonical', url); setMeta('property', 'og:url', url); }
  if (noindex) setMeta('name', 'robots', 'noindex');
  document.getElementById('ld-json')?.remove();
  if (jsonLd) {
    const s = document.createElement('script');
    s.type = 'application/ld+json'; s.id = 'ld-json';
    s.textContent = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
    document.head.append(s);
  }
}
