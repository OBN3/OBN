import { initLayout, stateBox } from '../components/layout.js';
import { getCategories } from '../api/index.js';
import { h, clear, $, getParam } from '../utils/dom.js';
import { createTipList } from '../components/tip-list.js';
import { setSeo } from '../components/seo.js';
import { siteOrigin, categoryPath } from '../utils/tip-logic.js';

initLayout({ active: 'tips' });

(async () => {
  const slug = getParam('slug') || '';
  const listRoot = $('#list');
  try {
    const cats = await getCategories();
    const cat = cats.find((c) => c.slug === slug);
    if (!cat) {
      $('#cat-title').textContent = 'הקטגוריה לא נמצאה';
      $('#crumb-cat').textContent = 'לא נמצא';
      document.querySelector('.filters').hidden = true;
      clear(listRoot).append(stateBox('notfound', 'הקטגוריה לא קיימת', 'ייתכן שהקישור שגוי.', h('a', { class: 'btn btn--primary', href: '/tips.html' }, 'לכל הטיפים')));
      setSeo({ title: 'קטגוריה לא נמצאה', description: '', noindex: true });
      return;
    }
    $('#cat-title').textContent = cat.name;
    $('#crumb-cat').textContent = cat.name;
    $('#cat-desc').textContent = cat.description || '';
    setSeo({ title: `טיפים בנושא ${cat.name}`, description: cat.description || `כל הטיפים בנושא ${cat.name}`, url: siteOrigin() + categoryPath(cat.slug) });
    const list = createTipList(listRoot);
    const sortSel = $('#c-sort');
    const run = () => list.setParams({ categoryId: cat.id, sort: sortSel.value });
    sortSel.addEventListener('change', run);
    run();
  } catch (e) {
    clear(listRoot).append(stateBox('error', 'שגיאה בטעינת הקטגוריה', e.message,
      h('button', { type: 'button', class: 'btn btn--primary', onclick: () => location.reload() }, 'נסו שוב')));
  }
})();
