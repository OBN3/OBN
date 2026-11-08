// נקודת כניסה לשכבת הנתונים. בוחרת Firebase או מצב הדגמה (localStorage) באופן שקוף.
// הממשק זהה בשני המתאמים, ולכן ניתן בעתיד להחליף מנוע חיפוש (Algolia/Typesense) במקום אחד.
import { firebaseConfig, siteConfig } from '../firebase-config.js';

export const isDemo = !!siteConfig.forceDemo || !(firebaseConfig.apiKey && firebaseConfig.projectId);

let adapterPromise;
export function getApi() {
  if (!adapterPromise) {
    adapterPromise = (isDemo ? import('./demo-adapter.js') : import('./firebase-adapter.js'))
      .then(async (m) => { await m.init?.(); return m; });
  }
  return adapterPromise;
}

let categoriesPromise;
/** קטגוריות פעילות – נטענות פעם אחת ומשמשות כמפה, כדי למנוע קריאות N+1. */
export function getCategories() {
  if (!categoriesPromise) {
    categoriesPromise = getApi().then((api) => api.listActiveCategories())
      .catch((e) => { categoriesPromise = null; throw e; });
  }
  return categoriesPromise;
}
export async function getCategoryMap() {
  const cats = await getCategories();
  return new Map(cats.map((c) => [c.id, c]));
}
