// מסנן HTML מבוסס allowlist. כל HTML עשיר עובר כאן לפני שמירה ולפני הצגה.
const ALLOWED = {
  P: [], BR: [], H2: [], H3: [], H4: [], STRONG: [], B: [], EM: [], I: [], U: [], S: [],
  UL: [], OL: [], LI: [], A: ['href', 'title'], BLOCKQUOTE: [], CODE: [], PRE: [], HR: []
};
const RENAME = { B: 'strong', I: 'em' };
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'MATH',
  'FORM', 'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'LINK', 'META', 'HEAD', 'TITLE', 'IMG', 'VIDEO', 'AUDIO', 'CANVAS', 'FRAME', 'FRAMESET']);
const BLOCKS = new Set(['P', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'HR', 'DIV', 'TABLE', 'SECTION', 'ARTICLE']);
const SAFE_URL = /^(https?:|mailto:|tel:|\/(?!\/)|#)/i;

export function isSafeUrl(url) {
  const u = String(url || '').trim();
  return SAFE_URL.test(u);
}

export function sanitizeHtml(html) {
  if (!html) return '';
  if (typeof DOMParser === 'undefined') return stripTags(html); // סביבת Node
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html');
  const out = doc.createElement('div');
  walk(doc.body, out, doc);
  // הסרת פסקאות ריקות לגמרי
  out.querySelectorAll('p').forEach((p) => { if (!p.textContent.trim() && !p.querySelector('br')) p.remove(); });
  return out.innerHTML.trim();
}

function walk(src, dest, doc) {
  for (const node of src.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) { dest.append(doc.createTextNode(node.nodeValue)); continue; }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const tag = node.tagName.toUpperCase();
    if (DROP.has(tag)) continue;
    if (tag === 'DIV') {
      const hasBlock = [...node.children].some((c) => BLOCKS.has(c.tagName.toUpperCase()));
      if (hasBlock || dest.tagName === 'LI' || dest.tagName === 'P') { walk(node, dest, doc); }
      else { const p = doc.createElement('p'); walk(node, p, doc); dest.append(p); }
      continue;
    }
    if (!(tag in ALLOWED)) { walk(node, dest, doc); continue; }
    const el = doc.createElement(RENAME[tag] || tag.toLowerCase());
    if (tag === 'A') {
      const href = (node.getAttribute('href') || '').trim();
      if (!isSafeUrl(href)) { walk(node, dest, doc); continue; }
      el.setAttribute('href', href);
      const title = node.getAttribute('title');
      if (title) el.setAttribute('title', title.slice(0, 200));
      if (/^https?:/i.test(href)) { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer'); }
    }
    walk(node, el, doc);
    dest.append(el);
  }
}

export function stripTags(html) {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h\d|li|div)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

export function htmlToText(html) {
  if (!html) return '';
  if (typeof DOMParser === 'undefined') return stripTags(html);
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  doc.querySelectorAll('script,style').forEach((n) => n.remove());
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}
