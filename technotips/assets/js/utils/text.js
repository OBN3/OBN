// נרמול טקסט, slug ואינדקס חיפוש (searchTokens) – משותף לדפדפן ולסקריפטים ב-Node.
import { htmlToText } from './sanitize.js';

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEB_PREFIXES = 'והבלמשכ';
const MAX_PREFIX = 15;
const MAX_TOKENS = 2000;

export function normalizeText(s) {
  return String(s ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u0591-\u05C7]/g, '')          // ניקוד וטעמים
    .replace(/[״׳"'`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function tokenize(s) { return normalizeText(s).split(/\s+/).filter(Boolean); }

function addWord(set, w) {
  if (w.length < 2) return;
  const max = Math.min(w.length, MAX_PREFIX);
  for (let i = 2; i <= max; i++) set.add(w.slice(0, i));
}

export function buildSearchTokens(tip, categoryName = '') {
  const parts = [
    tip.title, tip.summary, htmlToText(tip.contentHtml), (tip.tags || []).join(' '), categoryName,
    ...(tip.extras || []).map((e) => `${e.title || ''} ${e.content || ''}`),
    tip.number != null ? String(tip.number) : ''
  ];
  const set = new Set();
  for (const w of tokenize(parts.join(' '))) {
    addWord(set, w);
    if (w.length > 3 && /^[\u05D0-\u05EA]/.test(w) && HEB_PREFIXES.includes(w[0])) addWord(set, w.slice(1));
  }
  // עדיפות לטוקנים מהכותרת/תגיות כשחורגים מהמגבלה
  return [...set].slice(0, MAX_TOKENS);
}

export function queryTokens(q) {
  return tokenize(q).filter((t) => t.length >= 2).map((t) => t.slice(0, MAX_PREFIX));
}

export function matchesTokens(tip, tokens) {
  if (!tokens.length) return true;
  const set = new Set(tip.searchTokens || []);
  return tokens.every((t) => set.has(t));
}

export function slugify(s) {
  return String(s ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/g, '');
}

export function parseTags(input) {
  const arr = Array.isArray(input) ? input : String(input || '').split(/[,،\n]/);
  const seen = new Set();
  const out = [];
  for (const raw of arr) {
    const t = String(raw).trim().replace(/^#/, '').slice(0, 40);
    const key = t.toLowerCase();
    if (t && !seen.has(key)) { seen.add(key); out.push(t); }
  }
  return out.slice(0, 30);
}

export function truncate(s, n) {
  const str = String(s || '');
  return str.length > n ? `${str.slice(0, n - 1).trimEnd()}…` : str;
}
