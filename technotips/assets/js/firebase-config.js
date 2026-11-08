// הגדרות Firebase ציבוריות (מותר בצד לקוח – ההגנה האמיתית היא ב-Rules).
// ב-Vercel הקובץ נוצר אוטומטית מתוך משתני הסביבה (scripts/build.mjs).
// מקומית: הריצו `npm run config` (קורא את .env) או ערכו ידנית.
// כאשר apiKey/projectId ריקים – האפליקציה עובדת במצב הדגמה (נתונים בדפדפן בלבד).
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

export const siteConfig = {
  siteName: "טכנוטיפים",
  siteUrl: "",
  prettyUrls: false,
  forceDemo: false
};
