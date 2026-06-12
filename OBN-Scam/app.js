/**
 * ============================================================
 * app.js — בודקים לפני שלוחצים | Check Before You Click
 * אפליקציית Web לזיהוי סימני אזהרה בפרסומים חשודים
 * מיועדת למבוגרים וזקנים | i18n Ready | 0-10 Scale
 *
 * גרסה: 1.4.0  |  שאלון: 1.0
 * ============================================================
 */

import { initializeApp }          from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } 
                                  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAV5a3n5uB_AvCx5e6SBIr-w8ONBwAmnlk",
  authDomain: "obn-scam.firebaseapp.com",
  projectId: "obn-scam",
  storageBucket: "obn-scam.firebasestorage.app",
  messagingSenderId: "721961912892",
  appId: "1:721961912892:web:7417610692f30733071139"
};

const APP_VERSION           = "1.4.0";
const QUESTIONNAIRE_VERSION = "1.0";
let db = null;

function initFirebase() {
  try {
    if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
      const app = initializeApp(firebaseConfig);
      db = getFirestore(app);
    }
  } catch (err) { console.warn("Firebase init failed:", err); }
}
initFirebase();

// ============================================================
// State & Navigation
// ============================================================
const state = {
  lang: localStorage.getItem("user_lang") || "he",
  step: "intro",
  currentQuestionIndex: 0,
  demographics: { ageGroup: null, gender: null, region: null },
  channel: null,
  answers: {},
  result: { score: 0, score10: 0, level: null, detectedSignals: [], triggeredCombinations: [] }
};

// ============================================================
// לוגיקת השאלות
// ============================================================
const QUESTIONS_CONFIG = [
  { key: "urgentAction",           score: { yes: 2, not_sure: 1, no: 0 }, rev: false, str: "medium", conditional: false },
  { key: "fearThreat",             score: { yes: 3, not_sure: 1, no: 0 }, rev: false, str: "high",   conditional: false },
  { key: "personalDetails",        score: { yes: 3, not_sure: 1, no: 0 }, rev: false, str: "high",   conditional: false },
  { key: "moneyPayment",           score: { yes: 3, not_sure: 1, no: 0 }, rev: false, str: "high",   conditional: false },
  { key: "linkIncluded",           score: { yes: 2, not_sure: 1, no: 0 }, rev: false, str: "medium", conditional: false },
  { key: "senderKnown",            score: { yes: 0, not_sure: 1, no: 2 }, rev: true,  str: "medium", conditional: false },
  { key: "knownOrganization",      score: { yes: 2, not_sure: 1, no: 0 }, rev: false, str: "medium", conditional: false },
  { key: "tooGoodToBeTrue",        score: { yes: 2, not_sure: 1, no: 0 }, rev: false, str: "medium", conditional: false },
  { key: "strangeLanguage",        score: { yes: 1, not_sure: 0, no: 0 }, rev: false, str: "low",    conditional: false },
  { key: "checkedOfficialChannel", score: { yes: 0, not_sure: 1, no: 1 }, rev: true,  str: "low",    conditional: false },
  { key: "consultedSomeone",       score: { yes: 0, not_sure: 0, no: 0 }, rev: true,  str: "low",    conditional: true },
  { key: "alreadyActed",           score: { yes: 3, not_sure: 1, no: 0 }, rev: false, str: "high",   conditional: false }
];

// ============================================================
// Localization Dictionary (I18N)
// ============================================================
const I18N = {
  he: {
    dir: "rtl",
    headerTitle: "בודקים לפני שלוחצים",
    langLabel: "להחלפת שפה:",
    footerText: `האפליקציה אוספת רק תשובות כלליות ואנונימיות לצורכי למידה ושיפור בלבד.<br />לא נאספים שם, טלפון, כתובת, מספר תעודת זהות, אימייל או תוכן ההודעה שקיבלת.<br /><br />פותח על ידי OBN - <a href="https://linktr.ee/ofirbn" target="_blank" rel="noopener">להערות והצעות לחצו</a>`,
    ui: {
      next: "המשך ←", back: "← חזרה", start: "🔍 התחל/י בדיקה", showResult: "ראה תוצאה 🔍", restart: "🔄 בדיקה חדשה", share: "📤 שתף את האפליקציה", printBtn: "הדפס / שמור כ-PDF",
      yes: "✓ כן", no: "✗ לא", notSure: "🤔 לא בטוח/ה", req: "כדי להמשיך, יש לבחור תשובה.", offline: "⚠️ נראה שאין חיבור לאינטרנט. התשובות לא יישמרו.",
      qProgress: (curr, tot) => `שאלה ${curr} מתוך ${tot}`,
      qNext: "השאלה הבאה ←", qFinish: "המשך לקבלת התוצאה 🔍",
      scoreStr: (s, l) => `רמת סיכון על פי התשובות בדוח: <strong>${s} מתוך 10</strong> (${l})`
    },
    intro: {
      title: "👋 ברוכות וברוכים הבאים!",
      text: "קיבלתם הודעה, פרסום, שיחה או הצעה שנראים לכם קצת חשודים?<br />ענו על כמה שאלות קצרות ותקבלו הסבר האם יש סימני אזהרה, ומה כדאי לעשות עכשיו.",
      warn1: "<strong>חשוב לדעת:</strong><br />האפליקציה לא קובעת בוודאות אם מדובר בהונאה!<br />היא עוזרת לזהות סימנים מחשידים וללמוד איך להיזהר.",
      warn2: "<strong>🔒 פרטיות:</strong><br />המידע נאסף בצורה אנונימית לצורכי למידה ושיפור בלבד. בכל מקרה איננו מבקשים פרטים אישיים מזהים."
    },
    channel: {
      title: "איפה ראית או קיבלת את הפרסום או ההודעה?", sub: "בחר/י את הערוץ שדרכו הגיעה ההודעה, הפרסום או הצעה.",
      options: { whatsapp:"WhatsApp", sms:"SMS", email:"מייל", social:"Facebook / Instagram", website:"אתר אינטרנט", phone_call:"שיחת טלפון", official_msg:"הודעה מגוף רשמי", investment:"הצעת השקעה / זכייה", ad:"מודעה / פרסום כללי", other:"אחר / לא בטוח" }
    },
    demo: {
      title: "רק עוד 3 שאלות כלליות", sub: "לפני שמציגים את התוצאות, נשמח לכמה פרטים כלליים שיעזרו לנו לשפר את הכלי עבור אנשים שונים.",
      ageLabel: "מה הגיל שלך?", ageOpts: ["פחות מ-50","50–59","60–69","70–79","80+","מעדיף/ה לא לומר"],
      genLabel: "מין", genOpts: ["אישה","גבר","אחר","מעדיף/ה לא לומר"],
      regLabel: "אזור בארץ (לא חובה)", regOpts: ["צפון","מרכז","ירושלים והסביבה","דרום","יהודה ושומרון","אחר","מעדיף/ה לא לומר"],
      disclaimer: "בלחיצה על 'הצג תוצאה' את/ה מאשר/ת שניתן לשמור את התשובות האנונימיות לצורכי למידה."
    },
    questions: {
      urgentAction: { t: "האם בהודעה ביקשו ממך לפעול מיד?", s: "למשל: \"דחוף\", \"היום בלבד\", \"החשבון ייחסם\", \"נותרו כמה דקות\".", e: "הפעלת לחץ לפעולה מיידית הוא סימן נפוץ בהונאות.", n: "הפעלת לחץ לפעולה מיידית" },
      fearThreat: { t: "האם בהודעה ניסו להפחיד אותך?", s: "למשל: החשבון שלך יחסם, צפי לקנס, חוב, או סכנה מיידית - במידה ולא תבצעו פעולה שמבקשים בהודעה.", e: "הודעות שמפחידות אותנו גורמות להחלטות שלא התכוונו אליהן.", n: "איום או הפחדה" },
      personalDetails: { t: "האם ביקשו ממך למסור פרטים אישיים?", s: "למשל: סיסמה, קוד בטלפון, ת.ז או פרטי אשראי.", e: "בקשה לפרטים רגישים (סיסמה, קוד, ת.ז., פרטי אשראי) דרך קישור היא סימן אזהרה.", n: "בקשה לפרטים אישיים" },
      moneyPayment: { t: "האם ביקשו ממך לשלם, להעביר כסף, או הציעו לך להשקיע כסף?", s: "למשל: שלמו את המס על מנת לשחרר חבילה מהדואר או מהמכס.", e: "כאשר מבקשים כסף דרך הודעה, חשוב לבדוק היטב. ברוב המקרים מדובר בהונאה", n: "בקשה לכסף או תשלום" },
      linkIncluded: { t: "האם היה בהודעה קישור או קובץ שהתבקשת ללחוץ עליו, או שלחצת עליו?", s: "", e: "קישורים עלולים להוביל לאתרים מתחזים. קבצים עלולים להכיל תוכן מסוכן, כמו תוכנות מעקב, וירוסים ועוד", n: "קישור חשוד" },
      senderKnown: { t: "האם אתם יודעים בודאות מי שלח את ההודעה?", s: "", e: "מקור לא ידוע דורש זהירות כפולה. כדאי להיזהר גם כאשר המקור נראה לנו ידוע, אבל ההודעה מעוררת חשד", n: "מקור לא ברור" },
      knownOrganization: { t: "האם ההודעה שקיבלתם נראתה כאילו היא מגיעה מגוף מוכר?", s: "למשל: בנק, דואר, משטרה, ביטוח לאומי.", e: "הונאות משתמשות בשמות מוכרים ליצירת אמון. תוקפים יכולים די בקלות להציג כאילו ההודעה נשלחה בשם גוף מוכר", n: "התחזות לגוף מוכר" },
      tooGoodToBeTrue: { t: "האם הציעו לך בהודעה משהו שנשמע טוב מדי?", s: "למשל: פרס, זכייה, החזר כספי או רווח מהיר.", e: "הצעות של רווח מפתיע או טוב מדי עלולות להיות הונאה. זכרו - אין מתנות חינם!", n: "הצעה טובה מדי" },
      strangeLanguage: { t: "האם היו שגיאות כתיב או ניסוח משובש או מוזר?", s: "", e: "שגיאות כתיב או ניסוח לא מקצועי יכולות להיות סימן מחשיד כשהן מצורפות לסימנים אחרים.", n: "ניסוח מוזר או שגיאות כתיב" },
      checkedOfficialChannel: { t: "האם בדקת את נכונות פרטי ההודעה דרך אתר או מספר רשמי של הגוף השולח? (למשל - נכנסת לאתר הבנק (לא דרך הקישור בהודעה!) - כדי לבדוק אם ההודעה מופיעה בו)", s: "", e: "בדיקה בערוץ רשמי, שמגיעים אליו באופן עצמאי, דרך קישור או טלפון שאתם מכירים, ולא דרך קישור בהודעה החשודה - היא דרך טובה להפחית סיכון.", n: "לא נבדק בערוץ רשמי" },
      consultedSomeone: { t: "האם התייעצת עם אדם נוסף לגבי תוכן ההודעה או ההצעה בהודעה לפני שפעלת?", s: "", e: "התייעצות היא אחת ההגנות הטובות ביותר.", n: "לא התייעץ עם אחר" },
      alreadyActed: { t: "האם כבר לחצת בהודעה שקיבלת על קישור, או מסרת פרטים כלשהם, או שילמת תשלום כלשהו?", s: "", e: "פעולה שבוצעה דורשת טיפול מיידי. אם כבר לחצת על קישור או פתחת קובץ בהודעה - כדאי לדווח על כך במהירות (למשטרה, לקו הסיוע של איגוד האינטרנט הישראלי https://www.isoc.org.il/digital-literacy/report, למוקד 119 של מערך הסייבר, או לקרוב משפחה, ", n: "פעולה שכבר בוצעה" }
    },
    results: {
      lowTitle: "רמת חשד נמוכה", lowDesc: "לא זוהו הרבה סימני אזהרה לפי התשובות שלך.<br />תמיד כדאי לבדוק בערוץ רשמי.",
      medTitle: "פעלת נכון, אך ישנן נורות אזהרה", medDesc: "<strong>כל הכבוד שעצרת לבדוק!</strong><br />את רוב הדברים עשית בסדר, אבל המערכת זיהתה כמה סימנים קטנים שעלולים להיות מחשידים. מומלץ לא למהר, ולעשות בדיקה קצרה בערוץ הרשמי של הגוף שממנו נראה שהתקבלה ההודעה.",
      medTitle: "פעלת נכון, אך ישנן נורות אזהרה", medDesc: "<strong>כל הכבוד שעצרת לבדוק!</strong><br />את רוב הדברים עשית בסדר, אבל המערכת זיהתה כמה סימנים שעלולים להיות מחשידים. מומלץ לא למהר, ולעשות בדיקה קצרה בערוץ הרשמי של הגוף שממנו נראה שהתקבלה ההודעה.",
      highTitle: "רמת חשד גבוהה", highDesc: "הפרסום כולל כמה סימני אזהרה משמעותיים.<br />מומלץ לא ללחוץ על קישורים, לא למסור פרטים, ולבדוק בערוץ רשמי של הגוף שממנו נראה שהתקבלה ההודעה.",
      signalsTitle: (num) => `🔎 זיהינו ${num} סימן/י אזהרה:`,
      recsTitle: "✅ מה כדאי לעשות עכשיו?",
      recsOpts: ["לא ללחוץ על קישורים חשודים.","לא למסור סיסמאות או קודים.","לא להעביר כסף לפני בדיקה.","להיכנס בעצמך לאתר הרשמי.","להתקשר רק למספר רשמי שמצאת.","אם יש ספק — להתייעץ."],
      learnTitle: "📚 מה למדנו?",
      learnRemember: "זכרו: הונאות נבנות כדי להטעות. עצירה, בדיקה והתייעצות יכולות לצמצם את הסיכון לפגיעה.",
      emgTitle: "⚠️ פעולה מיידית מומלצת",
      emgSub: "מכיוון שכבר לחצת, מסרת פרטים או שילמת:",
      emgOpts: ["צרו קשר עם הגורם הרשמי שלכאורה שלח את ההודעה (למשל - אם נראה שההודעה נשלחה מקופת החולים או הבנק שלכם - פנו אליו באופן עצמאי).","פנו לגורם דרך מספר טלפון רשמי, או כתובת האינטרנט ששאתם בטוחים בה (עשו חיפוש באינטרנט ותוודאו שזה נראה אתר רשמי).","אם מסרתם סיסמה — החליפו אותה מייד.","אם מסרתם קוד — פנו לגוף הרלוונטי הרשמי.","פנו למוקד 119 של מערך הסייבר.","לקו הסיוע של איגוד האינטרנט הישראלי https://www.isoc.org.il/digital-literacy/report","התייעצו עם גורם מקצועי."],
      emgDisc: "ההמלצות הן כלליות בלבד."
    }
  },
  en: {
    dir: "ltr",
    headerTitle: "Check Before You Click",
    langLabel: "Change language:",
    footerText: `The app collects only general, anonymous answers for learning purposes.<br />No names, phone numbers, IDs, or message contents are collected.<br /><br />Developed by OBN - <a href="https://linktr.ee/ofirbn" target="_blank" rel="noopener">Click here for comments and suggestions</a>`,
    ui: {
      next: "Next →", back: "← Back", start: "🔍 Start Check", showResult: "Show Results 🔍", restart: "🔄 New Check", share: "📤 Share App", printBtn: "Print / Save as PDF",
      yes: "✓ Yes", no: "✗ No", notSure: "🤔 Not Sure", req: "Please select an answer to continue.", offline: "⚠️ No internet connection. Answers won't be saved.",
      qProgress: (curr, tot) => `Question ${curr} of ${tot}`,
      qNext: "Next Question →", qFinish: "Get Results 🔍",
      scoreStr: (s, l) => `Risk level based on report: <strong>${s} out of 10</strong> (${l})`
    },
    intro: {
      title: "👋 Welcome!",
      text: "Received a suspicious message, ad, call, or offer?<br />Answer a few short questions to find out if there are warning signs and what to do next.",
      warn1: "<strong>Note:</strong><br />This app doesn't determine fraud with certainty! It helps identify red flags and learn how to stay safe.",
      warn2: "<strong>🔒 Privacy:</strong><br />Information is collected anonymously for improvement. We never ask for personal identifying details."
    },
    channel: {
      title: "Where did you receive the message or ad?", sub: "Select the channel through which the offer arrived.",
      options: { whatsapp:"WhatsApp", sms:"SMS", email:"Email", social:"Facebook / Instagram", website:"Website", phone_call:"Phone Call", official_msg:"Official Org. Message", investment:"Investment / Prize Offer", ad:"General Ad", other:"Other / Not Sure" }
    },
    demo: {
      title: "Just 3 general questions", sub: "Before showing results, please provide some general details to help us improve. **No identification needed.**",
      ageLabel: "What is your age?", ageOpts: ["Under 50","50–59","60–69","70–79","80+","Prefer not to say"],
      genLabel: "Gender", genOpts: ["Female","Male","Other","Prefer not to say"],
      regLabel: "Region (Optional)", regOpts: ["North","Center","Jerusalem & surroundings","South","Judea and Samaria","Other","Prefer not to say"],
      disclaimer: "By clicking 'Show Results' you agree that anonymous answers may be saved for learning purposes."
    },
    questions: {
      urgentAction: { t: "Were you asked to act immediately?", s: "E.g., \"Urgent\", \"Today only\", \"Account will be blocked\".", e: "Pressure to act quickly is a common sign of fraud.", n: "Urgent Action Required" },
      fearThreat: { t: "Did the message try to scare you?", s: "E.g., Fine, debt, bank issue, or immediate danger.", e: "Messages that scare us cause rushed decisions.", n: "Threat or Fear Tactics" },
      personalDetails: { t: "Were you asked for personal details?", s: "E.g., Password, SMS code, ID, or credit card info.", e: "Requests for sensitive details via links are a major red flag.", n: "Request for Personal Details" },
      moneyPayment: { t: "Were you asked to pay, transfer money, or invest?", s: "", e: "Always double-check before transferring money based on a message.", n: "Request for Money/Payment" },
      linkIncluded: { t: "Was there a link or a document you were asked to click?", s: "", e: "Links can lead to fake websites mimicking real ones. Files might contain dangerous content", n: "Suspicious Link" },
      senderKnown: { t: "Are you sure who sent the message?", s: "", e: "Unknown sources require double caution.", n: "Unknown Sender" },
      knownOrganization: { t: "Did the message look like it came from a known organization?", s: "E.g., Bank, post office, police, government.", e: "Scams use familiar names to build trust.", n: "Impersonating Known Entity" },
      tooGoodToBeTrue: { t: "Were you offered something that sounds too good to be true?", s: "E.g., Prize, fast profit, guaranteed investment.", e: "Surprise profit offers are often scams.", n: "Too Good To Be True" },
      strangeLanguage: { t: "Were there spelling mistakes or strange phrasing?", s: "", e: "Errors can be a red flag when combined with other signs.", n: "Strange Language/Typos" },
      checkedOfficialChannel: { t: "Did you verify via an official site or number you found yourself?", s: "", e: "Checking an official channel reduces risk.", n: "Not Verified Officially" },
      consultedSomeone: { t: "Did you consult someone before acting?", s: "", e: "Consulting someone is one of the best defenses.", n: "Did Not Consult" },
      alreadyActed: { t: "Did you already click, provide details, or pay?", s: "", e: "Actions already taken require immediate response.", n: "Already Acted" }
    },
    results: {
      lowTitle: "Low Suspicion Level", lowDesc: "Not many warning signs detected based on your answers.<br />However, always verify through official channels.",
      medTitle: "You Acted Right, But Keep an Eye Out", medDesc: "<strong>Good job stopping to check!</strong><br />You did most things right, but we noticed a few minor red flags. Don't rush, and verify via official channels.",
      highTitle: "High Suspicion Level", highDesc: "The message contains significant warning signs.<br />Do not click links, provide details, or pay. Verify officially.",
      signalsTitle: (num) => `🔎 We detected ${num} warning sign(s):`,
      recsTitle: "✅ What to do next?",
      recsOpts: ["Do not click suspicious links.","Do not share passwords or codes.","Do not transfer money before verifying.","Visit the official website yourself.","Call only an official number you found yourself.","When in doubt, consult someone."],
      learnTitle: "📚 What did we learn?",
      learnRemember: "Remember: Scams are built to deceive. Stopping to check is a sign of wisdom.",
      emgTitle: "⚠️ Immediate Action Recommended",
      emgSub: "Since you already clicked, shared details, or paid:",
      emgOpts: ["Stop contact with the sender.","Contact your bank via an official number.","If you shared a password, change it immediately.","If you shared an SMS code, contact the relevant entity.","Consult a professional or family member."],
      emgDisc: "These recommendations are general and do not replace professional advice."
    }
  },

  ar: {
    dir: "rtl",
    headerTitle: "تحقق قبل أن تنقر",
    langLabel: "تغيير اللغة:",
    footerText: `يجمع التطبيق إجابات عامة ومجهولة المصدر لأغراض التعلم والتحسين فقط.<br />لا يتم جمع الاسم، رقم الهاتف، العنوان، رقم الهوية، البريد الإلكتروني أو محتوى الرسالة.<br /><br />تم التطوير بواسطة OBN - <a href="https://linktr.ee/ofirbn" target="_blank" rel="noopener">للملاحظات والاقتراحات اضغط هنا</a>`,
    ui: {
      next: "التالي ←", back: "→ عودة", start: "🔍 ابدأ الفحص", showResult: "عرض النتيجة 🔍", restart: "🔄 فحص جديد", share: "📤 شارك التطبيق", printBtn: "طباعة / حفظ كـ PDF",
      yes: "✓ نعم", no: "✗ لا", notSure: "🤔 لست متأكدًا", req: "للمتابعة، يجب اختيار إجابة.", offline: "⚠️ لا يوجد اتصال بالإنترنت. لن يتم حفظ الإجابات.",
      qProgress: (curr, tot) => `السؤال ${curr} من ${tot}`,
      qNext: "السؤال التالي ←", qFinish: "المتابعة للحصول على النتيجة 🔍",
      scoreStr: (s, l) => `مستوى الخطر بناءً على التقرير: <strong>${s} من 10</strong> (${l})`
    },
    intro: {
      title: "👋 أهلاً بك!",
      text: "هل تلقيت رسالة، إعلان، مكالمة أو عرض يبدو مشبوهًا بعض الشيء؟<br />أجب عن بضعة أسئلة قصيرة وسنوضح لك ما إذا كانت هناك علامات تحذيرية، وما يجب عليك فعله الآن.",
      warn1: "<strong>هام جداً:</strong><br />التطبيق لا يحدد بيقين مطلق ما إذا كان الأمر احتيالاً!<br />إنه يساعد في التعرف على العلامات المشبوهة وتعلم كيفية الحذر.",
      warn2: "<strong>🔒 الخصوصية:</strong><br />يتم جمع المعلومات بشكل مجهول لأغراض التعلم والتحسين فقط. لا نطلب أبدًا تفاصيل شخصية للتعرف عليك."
    },
    channel: {
      title: "أين رأيت أو تلقيت الإعلان أو الرسالة؟", sub: "اختر القناة التي وصلتك من خلالها الرسالة، الإعلان أو العرض.",
      options: { whatsapp:"WhatsApp", sms:"رسالة نصية (SMS)", email:"البريد الإلكتروني", social:"Facebook / Instagram", website:"موقع إلكتروني", phone_call:"مكالمة هاتفية", official_msg:"رسالة من جهة رسمية", investment:"عرض استثمار / جائزة", ad:"إعلان عام", other:"آخر / لست متأكدًا" }
    },
    demo: {
      title: "فقط 3 أسئلة عامة", sub: "قبل عرض النتائج، نود الحصول على بعض التفاصيل العامة التي ستساعدنا في تحسين الأداة. **لا حاجة للكشف عن الهوية.**",
      ageLabel: "ما هو عمرك؟", ageOpts: ["أقل من 50","50–59","60–69","70–79","80+","أفضل عدم الإجابة"],
      genLabel: "الجنس", genOpts: ["أنثى","ذكر","آخر","أفضل عدم الإجابة"],
      regLabel: "المنطقة (اختياري)", regOpts: ["الشمال","المركز","القدس ومحيطها","الجنوب","الضفة الغربية","آخر","أفضل عدم الإجابة"],
      disclaimer: "بالضغط على 'عرض النتيجة' أنت توافق على حفظ الإجابات المجهولة لأغراض التعلم."
    },
    questions: {
      urgentAction: { t: "هل طُلب منك التصرف فوراً؟", s: "مثال: \"عاجل\"، \"اليوم فقط\"، \"سيتم حظر الحساب\".", e: "الضغط لاتخاذ إجراء فوري هو علامة شائعة للاحتيال.", n: "الضغط لاتخاذ إجراء فوري" },
      fearThreat: { t: "هل حاولت الرسالة إخافتك؟", s: "مثال: حظر حساب، غرامة، دين، أو خطر فوري.", e: "الرسائل التي تخيفنا تجعلنا نتخذ قرارات متسرعة.", n: "تهديد أو تخويف" },
      personalDetails: { t: "هل طُلب منك تقديم تفاصيل شخصية؟", s: "مثال: كلمة المرور، كود وصلك على الهاتف، أو تفاصيل بطاقة الائتمان.", e: "طلب تفاصيل حساسة عبر رابط هو علامة تحذير كبيرة.", n: "طلب تفاصيل شخصية" },
      moneyPayment: { t: "هل طُلب منك الدفع، تحويل الأموال أو الاستثمار؟", s: "", e: "عندما يُطلب منك الدفع عبر رسالة، من المهم التحقق جيداً.", n: "طلب أموال أو دفع" },
      linkIncluded: { t: "هل كان هناك رابط أو ملف في الرسالة قمت بالنقر عليه أو طُلب منك النقر عليه؟", s: "", e: "قد تؤدي الروابط إلى مواقع احتيالية. قد تحتوي الملفات على محتوى خطير.", n: "رابط مشبوه" },
      senderKnown: { t: "هل أنت متأكد من هوية مرسل الرسالة؟", s: "", e: "مصدر غير معروف يتطلب حذراً مضاعفاً.", n: "مصدر غير معروف" },
      knownOrganization: { t: "هل بدت الرسالة وكأنها من جهة معروفة؟", s: "مثال: بنك، بريد، شرطة، تأمين وطني.", e: "يستخدم المحتالون أسماء معروفة لكسب الثقة.", n: "انتحال صفة جهة معروفة" },
      tooGoodToBeTrue: { t: "هل عُرض عليك شيء يبدو جيداً لدرجة يصعب تصديقها؟", s: "مثال: جائزة، ربح سريع، استثمار مضمون.", e: "عروض الربح المفاجئ غالباً ما تكون احتيالاً.", n: "عرض مغرٍ جداً" },
      strangeLanguage: { t: "هل كانت هناك أخطاء إملائية أو صياغة غريبة؟", s: "", e: "قد تكون الأخطاء علامة مشبوهة عند اقترانها بعلامات أخرى.", n: "صياغة غريبة أو أخطاء" },
      checkedOfficialChannel: { t: "هل تحققت عبر موقع رسمي أو رقم هاتف وجدته بنفسك؟", s: "", e: "التحقق عبر قناة رسمية يقلل المخاطر.", n: "لم يتم التحقق بقناة رسمية" },
      consultedSomeone: { t: "هل تشاورت مع شخص آخر قبل أن تتصرف؟", s: "", e: "الاستشارة هي أحد أفضل وسائل الحماية.", n: "لم يتشاور مع أحد" },
      alreadyActed: { t: "هل قمت بالفعل بالضغط على رابط، تقديم تفاصيل أو الدفع؟", s: "", e: "الإجراء الذي تم اتخاذه يتطلب تدخلاً فورياً.", n: "إجراء تم اتخاذه بالفعل" }
    },
    results: {
      lowTitle: "مستوى اشتباه منخفض", lowDesc: "لم يتم رصد الكثير من العلامات التحذيرية.<br />يُنصح دائماً بالتحقق من خلال القنوات الرسمية.",
      medTitle: "لقد تصرفت بشكل صحيح، ولكن هناك نُذُر تحذيرية", medDesc: "<strong>أحسنت بالتوقف للتحقق!</strong><br />لقد فعلت معظم الأشياء بشكل صحيح، لكن النظام رصد بعض العلامات. لا تتسرع، وتحقق في القناة الرسمية.",
      highTitle: "مستوى اشتباه مرتفع", highDesc: "تحتوي الرسالة على عدة علامات تحذيرية هامة.<br />لا تضغط على الروابط، ولا تقدم تفاصيل أو الدفع. تحقق عبر الجهة الرسمية.",
      signalsTitle: (num) => `🔎 لقد رصدنا ${num} علامة تحذيرية:`,
      recsTitle: "✅ ماذا يجب أن تفعل الآن؟",
      recsOpts: ["لا تضغط على روابط مشبوهة.","لا تقدم كلمات المرور أو الأكواد.","لا تحول الأموال قبل التحقق.","ادخل بنفسك إلى الموقع الرسمي.","اتصل برقم رسمي وجدته بنفسك.","عند الشك — استشر شخصاً آخر."],
      learnTitle: "📚 ماذا تعلمنا؟",
      learnRemember: "تذكر: عمليات الاحتيال مبنية للخداع. التوقف للتحقق هو دليل الحكمة.",
      emgTitle: "⚠️ يُوصى باتخاذ إجراء فوري",
      emgSub: "بما أنك قمت بالفعل بالضغط أو تقديم تفاصيل أو الدفع:",
      emgOpts: ["أوقف التواصل مع الجهة المرسلة.","تواصل مع البنك عبر رقم رسمي.","إذا قدمت كلمة مرور — قم بتغييرها.","إذا قدمت كوداً — تواصل مع الجهة المعنية.","استشر مختصاً أو فرداً من العائلة."],
      emgDisc: "التوصيات هنا عامة ولا تحل محل الاستشارة المهنية."
    }
  },

  ru: {
    dir: "ltr",
    langLabel: "Сменить язык:",
    headerTitle: "Проверь перед кликом",
    footerText: `Приложение собирает только общие и анонимные ответы для обучения.<br />Имена, телефоны или содержание сообщений не сохраняются.<br /><br />Разработано OBN - <a href="https://linktr.ee/ofirbn" target="_blank" rel="noopener">Нажмите для замечаний и предложений</a>`,
    ui: {
      next: "Далее →", back: "← Назад", start: "🔍 Начать проверку", showResult: "Показать результат 🔍", restart: "🔄 Новая проверка", share: "📤 Поделиться", printBtn: "Печать / Сохранить как PDF",
      yes: "✓ Да", no: "✗ Нет", notSure: "🤔 Не уверен(а)", req: "Пожалуйста, выберите ответ, чтобы продолжить.", offline: "⚠️ Нет интернета. Ответы не будут сохранены.",
      qProgress: (curr, tot) => `Вопрос ${curr} из ${tot}`,
      qNext: "Следующий вопрос →", qFinish: "Получить результат 🔍",
      scoreStr: (s, l) => `Уровень риска по ответам: <strong>${s} из 10</strong> (${l})`
    },
    intro: {
      title: "👋 Добро пожаловать!",
      text: "Получили подозрительное сообщение, рекламу или звонок?<br />Ответьте на несколько коротких вопросов, чтобы узнать, есть ли поводы для беспокойства.",
      warn1: "<strong>Важно:</strong><br />Приложение не определяет мошенничество со 100% точностью! Оно помогает распознать тревожные сигналы.",
      warn2: "<strong>🔒 Конфиденциальность:</strong><br />Данные собираются анонимно для улучшения сервиса. Мы не просим личные данные."
    },
    channel: {
      title: "Где вы увидели сообщение или рекламу?", sub: "Выберите канал связи.",
      options: { whatsapp:"WhatsApp", sms:"SMS", email:"Эл. почта", social:"Facebook / Instagram", website:"Сайт", phone_call:"Телефонный звонок", official_msg:"Сообщение от офиц. лица", investment:"Инвестиции / Приз", ad:"Общая реклама", other:"Другое / Не уверен(а)" }
    },
    demo: {
      title: "Ещё 3 общих вопроса", sub: "Перед показом результатов, пожалуйста, укажите общие данные для улучшения инструмента. **Анонимно.**",
      ageLabel: "Ваш возраст?", ageOpts: ["Младше 50","50–59","60–69","70–79","80+","Предпочитаю не указывать"],
      genLabel: "Пол", genOpts: ["Женский","Мужской","Другой","Предпочитаю не указывать"],
      regLabel: "Регион (Необязательно)", regOpts: ["Север","Центр","Иерусалим и окрестности","Юг","Иудея и Самария","Другое","Предпочитаю не указывать"],
      disclaimer: "Нажимая 'Показать результат', вы соглашаетесь с анонимным сохранением ответов."
    },
    questions: {
      urgentAction: { t: "От вас требовали действовать немедленно?", s: "Например: \"Срочно\", \"Только сегодня\", \"Аккаунт будет заблокирован\".", e: "Давление — частый признак мошенничества.", n: "Срочное действие" },
      fearThreat: { t: "Пыталось ли сообщение вас напугать?", s: "Например: штраф, долг, проблема в банке.", e: "Запугивание заставляет принимать поспешные решения.", n: "Угроза или запугивание" },
      personalDetails: { t: "У вас просили личные данные?", s: "Например: пароль, код из SMS, номер паспорта.", e: "Запрос конфиденциальных данных по ссылке — тревожный сигнал.", n: "Запрос личных данных" },
      moneyPayment: { t: "Вас просили заплатить, перевести деньги или инвестировать?", s: "", e: "Всегда перепроверяйте перед переводом денег.", n: "Запрос денег" },
      linkIncluded: { t: "В сообщении была ссылка или файл, на которые вы нажали или на которые вас попросили нажать?", s: "", e: "Ссылки могут вести на мошеннические сайты. Файлы могут содержать опасный контент.", n: "Подозрительная ссылка" },
      senderKnown: { t: "Вы уверены, кто отправил сообщение?", s: "", e: "Неизвестный источник требует осторожности.", n: "Неизвестный отправитель" },
      knownOrganization: { t: "Сообщение выглядело как от известной организации?", s: "Например: банк, почта, полиция.", e: "Мошенники используют известные имена для доверия.", n: "Выдача себя за организацию" },
      tooGoodToBeTrue: { t: "Вам предложили что-то слишком хорошее, чтобы быть правдой?", s: "Например: приз, быстрый заработок.", e: "Неожиданная выгода часто оказывается обманом.", n: "Слишком хорошее предложение" },
      strangeLanguage: { t: "Были ли ошибки или странные формулировки?", s: "", e: "Ошибки могут быть признаком обмана.", n: "Странный язык / Ошибки" },
      checkedOfficialChannel: { t: "Проверяли ли вы информацию через официальный сайт или номер?", s: "", e: "Проверка снижает риски.", n: "Не проверено официально" },
      consultedSomeone: { t: "Вы советовались с кем-то перед действием?", s: "", e: "Консультация — одна из лучших защит.", n: "Не посоветовался" },
      alreadyActed: { t: "Вы уже перешли по ссылке, передали данные или заплатили?", s: "", e: "Уже совершенное действие требует немедленной реакции.", n: "Уже действовал" }
    },
    results: {
      lowTitle: "Низкий уровень подозрений", lowDesc: "Тревожных сигналов не обнаружено.<br />Но всегда проверяйте информацию по официальным каналам.",
      medTitle: "Вы поступили верно, но будьте внимательны", medDesc: "<strong>Отлично, что остановились проверить!</strong><br />Мы заметили несколько мелких сигналов. Не спешите и проверьте по официальным каналам.",
      highTitle: "Высокий уровень подозрений", highDesc: "В сообщении есть серьезные тревожные сигналы.<br />Не переходите по ссылкам и не платите. Проверьте официально.",
      signalsTitle: (num) => `🔎 Мы нашли ${num} тревожный(х) сигнал(а):`,
      recsTitle: "✅ Что делать дальше?",
      recsOpts: ["Не переходить по ссылкам.","Не передавать пароли или коды.","Не переводить деньги до проверки.","Самостоятельно зайти на официальный сайт.","Звонить только по официально найденному номеру.","При сомнениях — посоветоваться."],
      learnTitle: "📚 Что мы узнали?",
      learnRemember: "Помните: мошенники хотят вас обмануть. Остановка для проверки — признак мудрости.",
      emgTitle: "⚠️ Рекомендуется немедленное действие",
      emgSub: "Так как вы уже нажали, передали данные или заплатили:",
      emgOpts: ["Прекратите контакт с отправителем.","Свяжитесь с банком по официальному номеру.","Если передали пароль — смените его.","Если передали код — обратитесь в соответствующий орган.","Посоветуйтесь со специалистом."],
      emgDisc: "Эти рекомендации носят общий характер."
    }
  }
};

// ============================================================
// מנגנון החלפת שפה
// ============================================================
function setLanguage(langKey) {
  state.lang = langKey;
  localStorage.setItem("user_lang", langKey);
  
  document.documentElement.lang = langKey;
  document.documentElement.dir  = I18N[langKey].dir;
  
  const t = I18N[langKey];
  document.getElementById("ui-header-title").textContent = t.headerTitle;
  document.getElementById("ui-footer-text").innerHTML = t.footerText;
  document.getElementById("ui-lang-label").textContent = t.langLabel;
  document.getElementById("lang-select").value = langKey;
  
  renderScreen();
}

document.getElementById("lang-select").addEventListener("change", (e) => {
  setLanguage(e.target.value);
});

// ============================================================
// לוגיקת חישוב ונרמול סיכון 
// ============================================================
function calculateRisk() {
  const a = state.answers;
  let score = 0;
  const detectedSignals = [];
  const triggeredCombinations = [];

  // חישוב ניקוד פנימי
  QUESTIONS_CONFIG.forEach(q => {
    if (q.conditional) return;
    const ans = a[q.key];
    if (!ans) return;
    const pts = q.score[ans] ?? 0;
    if (pts > 0) { score += pts; detectedSignals.push(q.key); }
  });

  if (a.linkIncluded === "yes" && a.personalDetails === "yes") { score += 3; triggeredCombinations.push("link_plus_personal_details"); }
  if (a.knownOrganization === "yes" && a.linkIncluded === "yes" && a.urgentAction === "yes") { score += 3; triggeredCombinations.push("known_org_plus_link_plus_urgency"); }
  if (a.moneyPayment === "yes" && a.tooGoodToBeTrue === "yes") { score += 3; triggeredCombinations.push("money_plus_too_good"); }
  if (a.fearThreat === "yes" && a.personalDetails === "yes") { score += 3; triggeredCombinations.push("threat_plus_personal_details"); }
  if (a.alreadyActed === "yes") { score += 4; triggeredCombinations.push("already_acted"); }
  if (score >= 4 && a.consultedSomeone === "no") { score += 1; detectedSignals.push("consultedSomeone"); }

  const level = score <= 3 ? "low" : score <= 8 ? "medium" : "high";

  // נרמול הציון לסולם מובן של 0 עד 10
  let score10 = 0;
  if (score > 0) {
    if (score <= 3) score10 = score;               // 1, 2, 3 (רמה נמוכה)
    else if (score <= 5) score10 = 4;              // 4 (בינוני)
    else if (score <= 7) score10 = 5;              // 5 (בינוני)
    else if (score === 8) score10 = 6;             // 6 (בינוני)
    else if (score <= 11) score10 = 7;             // 7 (גבוה)
    else if (score <= 14) score10 = 8;             // 8 (גבוה)
    else if (score <= 18) score10 = 9;             // 9 (גבוה)
    else score10 = 10;                             // 10 (מקסימום סיכון)
  }

  state.result = { score, score10, level, detectedSignals, triggeredCombinations };
}

// ============================================================
// שמירה ל-Firebase
// ============================================================
async function saveAssessment() {
  if (!db) return;
  const deviceType = /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop";
  try {
    await addDoc(collection(db, "assessments"), {
      createdAt: serverTimestamp(),
      appVersion: APP_VERSION,
      questionnaireVersion: QUESTIONNAIRE_VERSION,
      demographics: {
        ageGroup: state.demographics.ageGroup || "not_specified",
        gender:   state.demographics.gender   || "not_specified",
        region:   state.demographics.region   || "not_specified"
      },
      scenario: { channel: state.channel || "not_specified" },
      answers: { ...state.answers },
      risk: state.result,
      metadata: { language: state.lang, deviceType }
    });
  } catch (err) {
    const el = document.getElementById("save-status");
    if (el) {
      el.textContent = I18N[state.lang].ui.offline;
      el.classList.add("warn");
    }
  }
}

// ============================================================
// ניהול ניווט 
// ============================================================
function resetAssessment() {
  state.step = "intro"; state.currentQuestionIndex = 0; state.channel = null; state.answers = {};
  state.demographics = { ageGroup: null, gender: null, region: null };
  state.result = { score: 0, score10: 0, level: null, detectedSignals: [], triggeredCombinations: [] };
  renderScreen();
}

function goBack() {
  switch (state.step) {
    case "channel": state.step = "intro"; break;
    case "question":
      if (state.currentQuestionIndex > 0) state.currentQuestionIndex--;
      else state.step = "channel";
      break;
    case "demographics":
      state.step = "question"; state.currentQuestionIndex = QUESTIONS_CONFIG.length - 1;
      break;
  }
  renderScreen();
}

function startApp() { state.step = "channel"; renderScreen(); }

async function shareApp() {
  if (!navigator.share) return;
  try {
    await navigator.share({
      title: I18N[state.lang].headerTitle,
      url: window.location.href
    });
  } catch { }
}

// ============================================================
// מנוע הצגה מרכזי 
// ============================================================
function renderScreen() {
  const app = document.getElementById("app");
  const t = I18N[state.lang];
  const offline = !navigator.onLine ? `<div class="offline-banner show">${t.ui.offline}</div>` : "";

  switch (state.step) {
    case "intro":         app.innerHTML = offline + buildIntro(t); break;
    case "channel":       app.innerHTML = offline + buildChannel(t); bindChannel(); break;
    case "question":      app.innerHTML = offline + buildQuestion(t); bindQuestion(); break;
    case "demographics":  app.innerHTML = offline + buildDemographics(t); bindDemographics(); break;
    case "results":       app.innerHTML = offline + buildResults(t); bindResults(); break;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ============================================================
// מסכי הממשק (Dynamic UI)
// ============================================================
function buildIntro(t) {
  return `
<div class="card">
  <h1 class="card-title">${t.intro.title}</h1>
  <p class="card-text">${t.intro.text}</p>
  <div class="notice">${t.intro.warn1}</div>
  <div class="notice notice-warn">${t.intro.warn2}</div>
  <div class="btn-row">
    <button class="btn btn-primary" onclick="startApp()">${t.ui.start}</button>
  </div>
</div>`;
}

function buildChannel(t) {
  const channelKeys = ["whatsapp", "sms", "email", "social", "website", "phone_call", "official_msg", "investment", "ad", "other"];
  const icons = ["💬", "📱", "📧", "👥", "🌐", "📞", "🏛️", "💰", "📢", "❓"];
  
  const btns = channelKeys.map((k, i) => `
    <button class="channel-btn${state.channel===k?" selected":""}" data-value="${k}" aria-pressed="${state.channel===k}">
      <span class="ch-icon">${icons[i]}</span>${t.channel.options[k]}
    </button>`).join("");

  return `
<div class="card">
  <h2 class="card-title">${t.channel.title}</h2>
  <p class="card-text">${t.channel.sub}</p>
  <div class="channel-grid">${btns}</div>
  <span class="err-msg" id="err-channel" style="margin-top:12px;">${t.ui.req}</span>
  <div class="btn-row">
    <button class="btn btn-primary" id="btn-ch-next">${t.ui.next}</button>
    <button class="btn btn-back" onclick="goBack()">${t.ui.back}</button>
  </div>
</div>`;
}

function bindChannel() {
  document.querySelectorAll(".channel-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.channel = btn.dataset.value;
      document.querySelectorAll(".channel-btn").forEach(b => { b.classList.remove("selected"); b.setAttribute("aria-pressed","false"); });
      btn.classList.add("selected"); btn.setAttribute("aria-pressed","true");
      document.getElementById("err-channel").classList.remove("show");
    });
  });
  document.getElementById("btn-ch-next").addEventListener("click", () => {
    if (!state.channel) { document.getElementById("err-channel").classList.add("show"); return; }
    state.step = "question"; state.currentQuestionIndex = 0; renderScreen();
  });
}

function buildQuestion(t) {
  const qConf = QUESTIONS_CONFIG[state.currentQuestionIndex];
  const qText = t.questions[qConf.key];
  const total = QUESTIONS_CONFIG.length;
  const current = state.currentQuestionIndex + 1;
  const pct = Math.round((current / total) * 100);
  const saved = state.answers[qConf.key] || null;

  const answerBtns = [ { v: "yes", l: t.ui.yes }, { v: "not_sure", l: t.ui.notSure }, { v: "no", l: t.ui.no } ].map(a => `
    <button class="btn btn-answer${saved===a.v?" selected":""}" data-value="${a.v}" aria-pressed="${saved===a.v}">
      ${a.l}
    </button>`).join("");

  return `
<div class="progress-wrap">
  <div class="progress-label">${t.ui.qProgress(current, total)}</div>
  <div class="progress-bar" role="progressbar" aria-valuenow="${current}" aria-valuemin="1" aria-valuemax="${total}">
    <div class="progress-fill" style="width:${pct}%"></div>
  </div>
</div>
<div class="card">
  <h2 class="q-text">${qText.t}</h2>
  ${qText.s ? `<p class="q-subtext">${qText.s}</p>` : ""}
  <div id="ans-btns">${answerBtns}</div>
  <span class="err-msg" id="err-ans">${t.ui.req}</span>
  <div class="btn-row">
    <button class="btn btn-primary" id="btn-q-next">${current === total ? t.ui.qFinish : t.ui.qNext}</button>
    <button class="btn btn-back" onclick="goBack()">${t.ui.back}</button>
  </div>
</div>`;
}

function bindQuestion() {
  const qKey = QUESTIONS_CONFIG[state.currentQuestionIndex].key;
  document.querySelectorAll("#ans-btns .btn-answer").forEach(btn => {
    btn.addEventListener("click", () => {
      state.answers[qKey] = btn.dataset.value;
      document.querySelectorAll("#ans-btns .btn-answer").forEach(b => { b.classList.remove("selected"); b.setAttribute("aria-pressed","false"); });
      btn.classList.add("selected"); btn.setAttribute("aria-pressed","true");
      document.getElementById("err-ans").classList.remove("show");
    });
  });
  document.getElementById("btn-q-next").addEventListener("click", () => {
    if (!state.answers[qKey]) { document.getElementById("err-ans").classList.add("show"); return; }
    const next = state.currentQuestionIndex + 1;
    if (next < QUESTIONS_CONFIG.length) { state.currentQuestionIndex = next; renderScreen(); } 
    else { state.step = "demographics"; renderScreen(); }
  });
}

function buildDemographics(t) {
  const d = t.demo;
  const radios = (name, opts, saved) => opts.map(o => `
    <label class="radio-opt${saved===o?" checked":""}">
      <input type="radio" name="${name}" value="${o}"${saved===o?" checked":""} />${o}
    </label>`).join("");

  return `
<div class="card">
  <h2 class="card-title">${d.title}</h2>
  <p class="card-text">${d.sub}</p>
  <div class="form-group">
    <label class="form-label"><span class="req-mark">*</span> ${d.ageLabel}</label>
    <div class="radio-group" id="rg-age">${radios("age", d.ageOpts, state.demographics.ageGroup)}</div>
    <span class="err-msg" id="err-age">${t.ui.req}</span>
  </div>
  <div class="form-group">
    <label class="form-label"><span class="req-mark">*</span> ${d.genLabel}</label>
    <div class="radio-group" id="rg-gender">${radios("gender", d.genOpts, state.demographics.gender)}</div>
    <span class="err-msg" id="err-gender">${t.ui.req}</span>
  </div>
  <div class="form-group">
    <label class="form-label">${d.regLabel}</label>
    <div class="radio-group" id="rg-region">${radios("region", d.regOpts, state.demographics.region)}</div>
  </div>
  <p class="disclaimer">${d.disclaimer}</p>
  <div class="btn-row">
    <button class="btn btn-primary" id="btn-demo-next">${t.ui.showResult}</button>
    <button class="btn btn-back" onclick="goBack()">${t.ui.back}</button>
  </div>
</div>`;
}

function bindDemographics() {
  document.querySelectorAll(".radio-opt").forEach(lbl => {
    lbl.addEventListener("click", () => {
      const inp = lbl.querySelector("input");
      document.querySelectorAll(`input[name="${inp.name}"]`).forEach(r => r.closest(".radio-opt").classList.remove("checked"));
      lbl.classList.add("checked");
    });
  });
  document.getElementById("btn-demo-next").addEventListener("click", () => {
    const ageEl = document.querySelector('input[name="age"]:checked');
    const genderEl = document.querySelector('input[name="gender"]:checked');
    const regionEl = document.querySelector('input[name="region"]:checked');
    let ok = true;
    if (!ageEl) { document.getElementById("err-age").classList.add("show"); ok = false; } else { document.getElementById("err-age").classList.remove("show"); state.demographics.ageGroup = ageEl.value; }
    if (!genderEl) { document.getElementById("err-gender").classList.add("show"); ok = false; } else { document.getElementById("err-gender").classList.remove("show"); state.demographics.gender = genderEl.value; }
    if (regionEl) state.demographics.region = regionEl.value;

    if (ok) { calculateRisk(); state.step = "results"; renderScreen(); saveAssessment(); }
  });
}

function buildResults(t) {
  const r = t.results;
  const { level, score10, detectedSignals } = state.result;
  const alreadyActed = state.answers.alreadyActed === "yes";

  const lvlMap = {
    low: { icon: "🟢", label: r.lowTitle, desc: r.lowDesc, color: "var(--clr-green)" },
    medium: { icon: "🟡", label: r.medTitle, desc: r.medDesc, color: "var(--clr-yellow)" },
    high: { icon: "🔴", label: r.highTitle, desc: r.highDesc, color: "var(--clr-red)" }
  };
  const lc = lvlMap[level];

  // אלמנט פרואקטיבי: בניית מד סיכון ויזואלי (Gauge) מ-0 ל-10
  const pct = (score10 / 10) * 100;
  const gaugeHtml = `
    <div style="margin-top: 20px; text-align: start; background: rgba(255,255,255,0.6); padding: 12px; border-radius: 8px;">
      <div style="font-size: 16px; margin-bottom: 8px;">${t.ui.scoreStr(score10, lc.label)}</div>
      <div style="width: 100%; height: 12px; background: #E5E7EB; border-radius: 6px; overflow: hidden; border: 1px solid rgba(0,0,0,0.05);">
        <div style="height: 100%; width: ${pct}%; background: ${lc.color}; transition: width 1s ease-in-out;"></div>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 13px; color: var(--clr-muted); margin-top: 6px; font-weight: 600;">
        <span>0</span><span>10</span>
      </div>
    </div>`;

  const emgHtml = alreadyActed ? `
<div class="emergency">
  <div class="emergency-title">${r.emgTitle}</div>
  <p style="font-size:16px;color:#991B1B;margin-bottom:12px;">${r.emgSub}</p>
  <ul class="emergency-list">${r.emgOpts.map((opt, i) => `<li><span class="en">${i+1}.</span><span>${opt}</span></li>`).join("")}</ul>
  <p class="disclaimer">${r.emgDisc}</p>
</div>` : "";

  const sigsHtml = detectedSignals.length > 0 ? `
<div class="signals-section">
  <div class="section-title">${r.signalsTitle(detectedSignals.length)}</div>
  ${detectedSignals.map(sig => {
    const qConf = QUESTIONS_CONFIG.find(q => q.key === sig);
    const qText = t.questions[sig];
    const dc = qConf.str === "high" ? "red" : qConf.str === "medium" ? "yellow" : "gray";
    return `<div class="signal-item"><div class="signal-dot ${dc}" aria-hidden="true"></div><div><div class="signal-name">${qText.n}</div><div class="signal-exp">${qText.e}</div></div></div>`;
  }).join("")}
</div>` : "";

  const recsHtml = `
<div class="rec-section">
  <div class="section-title">${r.recsTitle}</div>
  <ul class="rec-list">${r.recsOpts.map((opt, i) => `<li><span class="rec-num">${i+1}.</span><span>${opt}</span></li>`).join("")}</ul>
</div>`;

  const learnHtml = `
<div class="learning-box">
  <div class="learning-title">${r.learnTitle}</div>
  <div class="learning-text">${t.questions.urgentAction.e} ${t.questions.personalDetails.e}<br /><br /><strong>${r.learnRemember}</strong></div>
</div>`;

  const shareBtn = navigator.share ? `<button class="btn btn-share" id="btn-share-res">${t.ui.share}</button>` : "";

  return `
<div class="result-card ${level}">
  <span class="result-icon" aria-hidden="true">${lc.icon}</span>
  <div class="result-level">${lc.label}</div>
  <div class="result-desc">${lc.desc}</div>
  ${gaugeHtml}
</div>
${emgHtml}${sigsHtml}${recsHtml}${learnHtml}
<div class="card">
  <div class="btn-row">
    <button class="btn btn-primary" onclick="resetAssessment()">🔄 ${t.ui.restart}</button>
    <button class="btn btn-secondary" onclick="window.print()">📄 ${t.ui.printBtn}</button>
    ${shareBtn}
  </div>
  <div id="save-status" class="save-status"></div>
</div>`;
}

function bindResults() { document.getElementById("btn-share-res")?.addEventListener("click", shareApp); }

// ============================================================
// חשיפת פונקציות ואתחול
// ============================================================
window.startApp = startApp;
window.goBack = goBack;
window.resetAssessment = resetAssessment;

window.addEventListener("online", renderScreen);
window.addEventListener("offline", renderScreen);

setLanguage(state.lang);