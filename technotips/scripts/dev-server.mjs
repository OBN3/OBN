// שרת פיתוח מקומי ללא תלויות: מגיש את הקבצים מהשורש ותומך גם ב-/tips/{slug} וב-/tips.
// שימוש: npm run dev  →  http://localhost:5173
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 5173;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };
const BLOCKED = /^\/(scripts|api|node_modules|dist)\/|^\/\.|service-account/;

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (BLOCKED.test(path)) { res.writeHead(404); return res.end('Not found'); }
  if (/^\/tips\/[^/]+\/?$/.test(path)) path = '/tip.html';
  else if (path === '/tips') path = '/tips.html';
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  try {
    if ((await stat(file)).isDirectory()) { res.writeHead(302, { Location: `${path}/` }); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(await readFile(join(ROOT, '404.html')));
  }
}).listen(PORT, () => console.log(`טכנוטיפים פועל בכתובת http://localhost:${PORT}  (ניהול: /admin/)`));
