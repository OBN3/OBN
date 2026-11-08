import { h } from '../utils/dom.js';
import { tipPath } from '../utils/tip-logic.js';
import { truncate } from '../utils/text.js';

export function tipCard(tip, categoryMap, { headingLevel = 3 } = {}) {
  const cat = categoryMap?.get(tip.categoryId);
  const media = tip.poster
    ? h('img', { src: tip.poster.url, alt: '', loading: 'lazy', decoding: 'async', width: tip.poster.width || 800, height: tip.poster.height || 1000 })
    : h('div', { class: 'tip-card__placeholder', 'aria-hidden': 'true' }, h('span', {}, '💡'));
  return h('article', { class: 'tip-card' },
    h('div', { class: 'tip-card__media' }, media,
      tip.number != null ? h('span', { class: 'tip-card__number' }, `טיפ #${tip.number}`) : null),
    h('div', { class: 'tip-card__body' },
      cat ? h('span', { class: 'chip chip--category' }, cat.name) : null,
      h(`h${headingLevel}`, { class: 'tip-card__title' }, h('a', { href: tipPath(tip.slug), class: 'stretched-link' }, tip.title)),
      tip.summary ? h('p', { class: 'tip-card__summary' }, truncate(tip.summary, 160)) : null,
      tip.tags?.length ? h('ul', { class: 'tag-list', 'aria-label': 'תגיות' }, tip.tags.slice(0, 4).map((t) => h('li', { class: 'tag' }, `#${t}`))) : null));
}
