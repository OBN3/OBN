# טכנוטיפים – אפליקציית Web ציבורית

אתר ציבורי להצגה, חיפוש ושיתוף של טיפים קצרים בנושאי טכנולוגיה, AI ו-Microsoft Copilot, עם ממשק ניהול מאובטח ליצירה, פרסום ומעקב הפצה לקבוצות.

**Stack:** HTML5 סמנטי · CSS3 מודולרי · Vanilla JavaScript (ES Modules) · Firebase Firestore / Storage / Authentication · Vercel.
ללא Framework, ללא שלב קומפילציה, ללא תלויות npm בצד הלקוח.

---

## 1. התחלה מהירה (מצב הדגמה – 2 דקות)

כשאין הגדרות Firebase, האפליקציה עובדת אוטומטית ב**מצב הדגמה**: הנתונים (7 טיפים, 11 קטגוריות, 8 קבוצות) נשמרים ב-localStorage של הדפדפן בלבד.

```bash
npm run dev          # http://localhost:5173
```

- אתר ציבורי: `http://localhost:5173`
- ניהול: `http://localhost:5173/admin/` – פרטי כניסה בהדגמה: `admin@demo.local` / `demo1234`
- איפוס נתוני ההדגמה: כפתור "איפוס נתוני הדגמה" בלוח הבקרה.

> אפשר גם `python3 -m http.server`, אבל אז כתובות `/tips/{slug}` לא יעבדו מקומית (`/tip.html?slug=` כן).

---

## 2. מבנה הפרויקט

```
index.html  tips.html  tip.html  category.html  about.html  404.html
admin/       index.html (Dashboard) · login · tips · tip-edit · categories · groups
assets/
  css/       base · components · public · admin
  js/
    firebase-config.js      הגדרות ציבוריות (נוצר אוטומטית ב-build)
    api/                    שכבת נתונים: index (בחירת מתאם) · firebase-adapter · demo-adapter · shared
    components/             tip-card · tip-list · lightbox · toast · seo · rich-editor · layout
    pages/                  home · tips · tip · category · about
    admin/                  common · login · dashboard · tips-list · tip-edit · categories · groups
    utils/                  dom · sanitize · text (חיפוש/slug) · tip-logic · image · format
api/                        פונקציות Vercel: tip-page (SEO/OG בצד שרת) · sitemap · robots
media/                      favicon · og-default.png · תמונות seed (SVG)
seed/seed-data.json         נתוני דוגמה
scripts/                    build · dev-server · check  +  סקריפטי Admin SDK (set-admin · seed · import · cleanup)
firestore.rules  storage.rules  firestore.indexes.json  firebase.json  vercel.json  .env.example
```

### מודל הנתונים (Firestore)

| Collection | גישה | תוכן |
|---|---|---|
| `tips/{id}` | ציבורי רק כש-`status == 'published'` | כל שדות ה-Tip לפי ה-PRD + `searchTokens`, `numberSort` |
| `tipAdmin/{id}` | מנהל בלבד | `distribution[]` – `{ groupId, target, published, publishedAt, notes }` |
| `categories/{id}` | ציבורי רק כש-`active == true` | `name, slug, description, order, active` |
| `distributionGroups/{id}` | מנהל בלבד | `name, description, active, order, archived` |
| `admins/{uid}` | המשתמש עצמו בלבד; כתיבה רק מ-Admin SDK | רשימת מנהלים מורשים |
| `cleanupQueue/pending` | מנהל בלבד | נתיבי קבצים שמחיקתם נכשלה |

**חריגה מכוונת מה-PRD:** `distribution` לא נשמר בתוך מסמך הטיפ הציבורי אלא ב-`tipAdmin/{id}`. אחרת, כל מבקר באתר היה יכול לקרוא את שמות מזהי הקבוצות, ההערות ומועדי השליחה. הממשק והלוגיקה זהים ל-PRD. שתי הכתיבות מתבצעות ב-batch אטומי.

**הרחבה עתידית להיסטוריית הפצה:** אפשר להוסיף `publications: [{ at, notes }]` לכל רשומה ב-`distribution` בלי לשנות את הממשק, כי `publishedAt` ימשיך לשמש כ"פרסום אחרון".

---

## 3. הקמת Firebase

1. **יצירת פרויקט** ב-[Firebase Console](https://console.firebase.google.com) → Add project.
2. **Web App:** Project settings → General → Your apps → `</>` → רישום אפליקציה → העתיקו את ערכי `firebaseConfig`.
3. **Authentication:** Build → Authentication → Get started → Sign-in method → **Email/Password** → Enable.
   - מומלץ: Settings → User actions → לבטל את **Enable create (sign-up)**, כך שאי אפשר לפתוח חשבונות מהדפדפן.
   - Settings → Authorized domains → להוסיף את הדומיין של Vercel.
4. **Firestore:** Build → Firestore Database → Create database → Production mode → בחירת אזור (למשל `europe-west1`).
5. **Storage:** (אחרי שדרוג ל-Blaze) Build → Storage → Get started → Production mode → אזור **`us-central1`** (או `us-east1`/`us-west1`). רק באזורים אלה חלה המכסה החינמית.
   > פרויקטים חדשים צריכים תוכנית **Blaze** כדי להשתמש ב-Storage. בשימוש של MVP העלות צפויה להיות זניחה, אבל מומלץ להגדיר **Budget alert**.

### פריסת Rules ואינדקסים

```bash
npm i -g firebase-tools
firebase login
cp .firebaserc.example .firebaserc     # ערכו את project id
firebase deploy --only firestore:rules,firestore:indexes,storage
```

> בניית האינדקסים לוקחת כמה דקות. אם שאילתה נכשלת עם `failed-precondition`, האינדקס עדיין נבנה. בקונסול של הדפדפן יופיע קישור ישיר ליצירת האינדקס החסר.

**Storage Rules ו-Firestore:** `storage.rules` בודק אם משתמש הוא מנהל דרך `firestore.exists(...)`. בפריסה הראשונה, ה-CLI יבקש לאשר הרשאה ל-Storage לקרוא מ-Firestore. יש לאשר.

---

## 4. יצירת המנהל הראשון

ההרשאה לניהול נקבעת בצד השרת בלבד, באמצעות custom claim בשם `admin` ומסמך `admins/{uid}`. אי אפשר להעניק אותה מהדפדפן.

1. Firebase Console → Project settings → **Service accounts** → Generate new private key.
   שמרו את הקובץ כ-`service-account.json` בשורש הפרויקט. הקובץ כבר מוחרג ב-`.gitignore`.
   ⚠️ הקובץ מעניק הרשאות מלאות לפרויקט. **אסור** להעלות אותו ל-Git, ל-Vercel או לדפדפן.
2. הגדירו `.env`:
   ```bash
   cp .env.example .env    # מלאו FIREBASE_* ו-GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
   ```
3. הריצו:
   ```bash
   cd scripts && npm install
   node set-admin.mjs ofir@example.com 'סיסמה-חזקה-של-12-תווים-לפחות'   # יוצר משתמש ומגדיר כמנהל
   # למשתמש קיים:   node set-admin.mjs ofir@example.com
   # להסרת הרשאה:   node set-admin.mjs ofir@example.com --revoke
   ```
4. טעינת נתוני הדוגמה (אופציונלי):
   ```bash
   node seed.mjs            # לא דורס מסמכים קיימים;  --force לדריסה
   ```

---

## 5. פיתוח מקומי מול Firebase

```bash
npm run config     # יוצר assets/js/firebase-config.js מתוך .env
npm run dev
npm run check      # בדיקת תחביר + בדיקות יחידה (חיפוש, slug, התקדמות הפצה, טיפים קשורים)
```

לחזרה למצב הדגמה, רוקנו את `apiKey` בקובץ `assets/js/firebase-config.js` או הגדירו `FORCE_DEMO=true`.

---

## 6. פריסה ל-Vercel

1. העלו את הריפו ל-GitHub, בלי `service-account.json` ובלי `.env`.
2. ב-Vercel: Add New → Project → Import. אין צורך לבחור Framework (Other). ההגדרות נקראות מ-`vercel.json`:
   - Build: `node scripts/build.mjs` – יוצר את קובץ ההגדרות ממשתני הסביבה ומעתיק את האתר ל-`dist/` עם תיקיית assets מגורסת (`/assets/v<hash>/`).
   - Output: `dist`
3. Settings → **Environment Variables** – הוסיפו את המשתנים מ-`.env.example`:
   `FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID, SITE_URL, PRETTY_URLS=true`
   (**לא** להוסיף `GOOGLE_APPLICATION_CREDENTIALS`)
4. Deploy. אחר כך הוסיפו את הדומיין ל-Authorized domains ב-Firebase Auth.

### מה Vercel מוסיף מעבר לאירוח סטטי

| נתיב | מטפל | מטרה |
|---|---|---|
| `/tips/{slug}` | `api/tip-page.js` | מזריק title, description, canonical, Open Graph, Twitter Card ו-JSON-LD **בצד השרת**, כדי שתצוגה מקדימה ב-WhatsApp, בפייסבוק ובלינקדאין תעבוד (הסורקים שלהן לא מריצים JS). מחזיר 404 לטיפ שלא קיים. |
| `/sitemap.xml` | `api/sitemap.js` | דפים ציבוריים + טיפים `published` בלבד |
| `/robots.txt` | `api/robots.js` | חוסם `/admin` ו-`/api`, ומפנה ל-sitemap |
| `/tips` | rewrite | `tips.html` |

**Fallback סטטי:** בכל אירוח סטטי `/tip.html?slug=...` עובד, וכך גם קישורי השיתוף כש-`PRETTY_URLS=false`.
הפונקציות קוראות מ-Firestore דרך REST כמשתמש אנונימי, ולכן כפופות לאותם Rules. הן לא משתמשות בסודות.

**Cache:** קבצי `/assets/v<hash>/` נשמרים ל-Cache ל-שנה (`immutable`). כל build עם שינוי מייצר hash חדש. HTML לא נשמר ל-Cache. `/admin` מוגדר `no-store` + `noindex`.

**Content-Security-Policy:** מוגדר ב-`vercel.json`. אם מוסיפים שירות חיצוני, כמו Analytics, צריך לעדכן אותו.

---

## 7. אבטחה – נקודות חשובות

- **Rules הן שכבת ההגנה.** בדיקות הרשאה בצד הלקוח נועדו לחוויית משתמש בלבד. גם עם קריאה ישירה ל-API, משתמש שאינו מנהל לא יכול לקרוא טיוטות או נתוני הפצה, ולא יכול לכתוב.
- **Firebase config ציבורי** – זה תקין ומתועד. אין `service account` בקוד הדפדפן.
- **HTML עשיר** עובר sanitization עם allowlist (`utils/sanitize.js`) גם בשמירה וגם בהצגה. תגיות script, iframe, style ו-event handlers מוסרים, ומותרים רק קישורים מסוג `http(s)`, `mailto` ו-`tel`. הדבקה מ-Word או מאתרים מנוקה.
- **כל שאר הטקסט** מוכנס ל-DOM דרך `textContent` (`utils/dom.js → h()`), ולא דרך `innerHTML`.
- **קבצים:** נבדקים MIME, סיומת ו-10MB בלקוח וב-Storage Rules. כל תמונה מקודדת מחדש ל-WebP/JPEG בדפדפן, ולכן גם **מוסר EXIF/GPS** (פרטיות).
- **Session:** ההתחברות נשמרת ל-session של הדפדפן בלבד (`browserSessionPersistence`).
- **Open redirect:** פרמטר `next` בהתחברות מוגבל לנתיבי `/admin/`.
- **מדיה של טיוטות** ניתנת לקריאה ציבורית למי שיש לו את ה-URL. ה-URL כולל token שקשה לנחש, אבל לא כדאי להעלות לטיוטה תמונה רגישה.
- מומלץ להפעיל **Firebase App Check** כשכבת הגנה נוספת מפני שימוש לרעה במכסות.

---

## 8. ייבוא טיפים בכמות

```bash
cd scripts
node import.mjs ../my-tips.csv --dry-run     # בדיקה בלבד
node import.mjs ../my-tips.csv               # ייבוא כטיוטות
node import.mjs ../my-tips.csv --publish     # ייבוא ופרסום
```

עמודות CSV (UTF-8, רק `title` ו-`category` חובה):
`number,title,slug,summary,content,category,tags,whatsappText,prompt,promptTitle,status`
- `category` = slug של קטגוריה קיימת · `tags` מופרדים ב-`|` · `content` יכול להיות טקסט עם שורות או HTML בסיסי.
- slug כפול מקבל סיומת אוטומטית (`-2`). מתקבל גם JSON במבנה של `seed/seed-data.json`.

**ניקוי קבצים יתומים** (העלאות שלא נשמרו, או מחיקות שנכשלו):
```bash
node cleanup.mjs --scan --dry-run   # ואז בלי --dry-run
```

---

## 9. חיפוש – איך זה עובד

בכל שמירה נבנה `searchTokens`: תחיליות של כל מילה (2–15 תווים), מנורמלות לאותיות קטנות וללא ניקוד, מתוך הכותרת, התקציר, התוכן, התגיות, הקטגוריה, ה-extras והמספר. למילים בעברית מתווספת גם גרסה ללא אות שימוש (ו/ה/ב/ל/מ/ש/כ).
השאילתה שולחת ל-Firestore את המילה הארוכה ביותר (`array-contains`), ושאר המילים מסוננות בצד הלקוח. העימוד מבוסס cursor ("טען עוד").

**מגבלה:** בחיפוש עם כמה מילים, דף תוצאות יכול להכיל פחות מ-12 פריטים. בקנה מידה של אלפי טיפים, או כשנדרשים חיפוש fuzzy ודירוג, מומלץ לעבור ל-**Algolia** או **Typesense**. ההחלפה נעשית רק בפונקציה `listPublishedTips` במתאם.

---

## 10. נגישות ו-SEO

- `lang="he" dir="rtl"` · קישור "דילוג לתוכן" · focus גלוי · כפתורים אמיתיים · labels לכל שדה · `aria-live` להודעות העתקה ושמירה · lightbox מבוסס `<dialog>` (Esc, חצים, החזרת פוקוס) · סיכום שגיאות עם קישורים לשדות · `prefers-reduced-motion`.
- alt חובה לפוסטר ולתמונות (נאכף בשמירה).
- title, description, canonical, OG ו-Twitter לכל טיפ, `BlogPosting` JSON-LD, sitemap ו-robots.

---

## 11. מה נבדק ומה לא

**נבדק אוטומטית (Chromium headless, מצב הדגמה):** דף בית, חיפוש בעברית ובאנגלית, סינון לפי קטגוריה ותגית, מיון, עמוד קטגוריה ו-404, עמוד טיפ (העתקת פרומפט, WhatsApp, טיפים קשורים, lightbox במקלדת), טיוטה שאינה נגישה לציבור, הפניה ל-login, שגיאת התחברות, Dashboard, יצירת טיפ מלא (פוסטר, גלריה, פרומפט, קישור, WhatsApp, הפצה), ולידציות (alt, URL, slug כפול), פרסום, מחיקה, קטגוריות (חסימת מחיקה בשימוש), קבוצות (ארכוב במקום מחיקה), תצוגת מובייל. לא נמצאו שגיאות JavaScript בקונסול.
**נבדק עם stubs:** טעינת מתאם Firebase, וטעינה עצלה של Auth ו-Storage (הם לא נטענים בדפים הציבוריים).

**לא נבדק – לבדוק אחרי ההקמה:**
1. זרימה מלאה מול פרויקט Firebase אמיתי: Rules, אינדקסים, העלאה ל-Storage.
2. Lighthouse (Performance, Accessibility, Best Practices, SEO) על הדומיין ב-Vercel.
3. תצוגה מקדימה של קישור ב-WhatsApp (שליחת קישור `/tips/{slug}` לעצמכם).
4. Firebase Emulator Suite לבדיקות Rules: `firebase emulators:start`.

---

## 12. מחוץ ל-MVP (המלצות להמשך)

- תזמון פרסום עתידי (כרגע "מועד פרסום" משמש לתצוגה ולמיון בלבד).
- היסטוריית פרסומים חוזרים לכל קבוצה (`publications[]`).
- Algolia או Typesense לחיפוש מתקדם · App Check · Analytics שמכבד פרטיות.
- Cloud Function ל-cleanup אוטומטי ולמחיקת קבצים בצד שרת.
- ייבוא CSV מתוך ממשק הניהול · שכפול טיפ · תצוגה מקדימה לפני שמירה.
- גרסאות תמונה מרובות (`srcset`) באמצעות Firebase Extension (Resize Images).
