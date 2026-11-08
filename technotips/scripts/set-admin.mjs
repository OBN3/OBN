// הגדרת מנהל ראשון / נוסף. יוצר את המשתמש אם אינו קיים, מגדיר custom claim admin=true ומסמך admins/{uid}.
// שימוש: node set-admin.mjs ofir@example.com [password]     |  הסרה: node set-admin.mjs ofir@example.com --revoke
import { auth, db, FieldValue } from './_admin.mjs';

const [email, arg] = process.argv.slice(2);
if (!email) { console.error('שימוש: node set-admin.mjs <email> [password | --revoke]'); process.exit(1); }

let user;
try { user = await auth.getUserByEmail(email); }
catch (e) {
  if (e.code !== 'auth/user-not-found' || !arg || arg === '--revoke') { console.error(`✗ המשתמש ${email} לא נמצא. העבירו סיסמה כדי ליצור אותו.`); process.exit(1); }
  if (arg.length < 12) { console.error('✗ סיסמה חייבת להכיל לפחות 12 תווים.'); process.exit(1); }
  user = await auth.createUser({ email, password: arg, emailVerified: true });
  console.log(`✓ נוצר משתמש ${email}`);
}

if (arg === '--revoke') {
  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin: false });
  await db.doc(`admins/${user.uid}`).delete();
  await auth.revokeRefreshTokens(user.uid);
  console.log(`✓ הרשאת הניהול של ${email} הוסרה`);
} else {
  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin: true });
  await db.doc(`admins/${user.uid}`).set({ email, createdAt: FieldValue.serverTimestamp() });
  console.log(`✓ ${email} הוגדר כמנהל (uid: ${user.uid}). יש להתחבר מחדש כדי שההרשאה תיכנס לתוקף.`);
}
process.exit(0);
