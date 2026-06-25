// --- הגדרות השרת של גוגל דרייב ---
// הדבק כאן את הקישור שהעתקת מה-Apps Script בשלב 1
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxN0Gin2H0LYHuUSGLN_v4CRomuaiGkJwv9QjAKu_KtCxPeikWYWB9OECszGiXWefPS/exec";

// ייבוא מודולים מ-Firebase (רק למסד הנתונים וההתחברות)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
	  apiKey: "AIzaSyDn9MNktFcHxzwxL5hhIYPIIN635_0pST8",
  authDomain: "obn-photocontest.firebaseapp.com",
  projectId: "obn-photocontest",
  storageBucket: "obn-photocontest.firebasestorage.app",
  messagingSenderId: "833616633042",
  appId: "1:833616633042:web:2422680ceaa37b9d16210b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const ADMIN_EMAIL = "ofirbn@gmail.com";
const APPROVED_JUDGES = ["oriuri02@gmail.com", "judge2@gmail.com"]; 

// פונקציית עזר להמרת קובץ לפורמט Base64 שניתן לשלוח ברשת
function toBase64(fileOrBlob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(fileOrBlob);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// הקטנת תמונות בדפדפן
async function compressImage(file, maxWidth = 1920) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scaleSize = maxWidth / img.width;
                canvas.width = maxWidth;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.8); 
            };
        };
        reader.onerror = reject;
    });
}

// פונקציה חכמה לשליחה ל-Google Drive עם עקיפת CORS
async function uploadToDrive(base64Data, fileName, mimeType, isOriginal) {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        // השימוש ב- text/plain מונע שגיאות CORS של הדפדפן 
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ fileData: base64Data, fileName, mimeType, isOriginal })
    });
    const result = await response.json();
    if (result.status !== "success") throw new Error(result.message);
    return result.url;
}

// טיפול בהגשת הטופס הציבורי
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const status = document.getElementById('statusMessage');
    
    // שליפת הקובץ שהמשתמש בחר
    const file = document.getElementById('photoFile').files[0];

    // === הבדיקה החדשה: מגבלת 5MB (5 * 1024 * 1024 בתים) ===
    if (file && file.size > 5 * 1024 * 1024) {
        status.style.color = 'red';
        status.innerText = 'שגיאה: הקובץ חורג מ-5 מגה-בייט. אנא העלה תמונה קלה יותר.';
        return; // הפקודה הזו עוצרת מיד את ההעלאה
    }
    // ========================================================

    btn.disabled = true;
    status.style.color = '#2563eb';
    status.innerText = 'מעבד את התמונה ויוצר עותק לשופטים...';

    try {
        const name = document.getElementById('photographerName').value;
        const title = document.getElementById('photoTitle').value;
        const desc = document.getElementById('photoDescription').value;

        // 1. שליחת התמונה המקורית (ישירות לתיקייה החסויה שלך)
        status.innerText = 'שולח את תמונת המקור למנהל התחרות...';
        const base64Original = await toBase64(file);
        await uploadToDrive(base64Original, `${name}_${file.name}`, file.type, true);

        // 2. דחיסה ושליחת עותק מוקטן למערכת השיפוט
        status.innerText = 'מעלה את התמונה למערכת השיפוט...';
        const compressedBlob = await compressImage(file);
        const base64Compressed = await toBase64(compressedBlob);
        const compressedUrl = await uploadToDrive(base64Compressed, `${name}_compressed.webp`, 'image/webp', false);

        // 3. שמירת הנתונים ב-Firestore של פיירבייס
        await addDoc(collection(db, "submissions"), {
            photographerName: name,
            title: title,
            description: desc,
            imageUrl: compressedUrl, // הקישור לדרייב החשוף לשופטים
            status: "pending", 
            timestamp: serverTimestamp()
        });

        status.style.color = 'green';
        status.innerText = 'הצילום הוגש בהצלחה! העותק המקורי הועבר בבטחה.';
        document.getElementById('uploadForm').reset();
        
    } catch (error) {
        console.error("Upload Error: ", error);
        status.style.color = 'red';
        status.innerText = 'אירעה שגיאה בהעלאה. נסה שוב.';
    } finally {
        btn.disabled = false;
    }
});

// התחברות צוות
document.getElementById('googleLoginBtn').addEventListener('click', async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        const userEmail = result.user.email;
        
        if (userEmail === ADMIN_EMAIL) {
            alert("זוהית כמנהל המערכת. מועבר לדשבורד האדמין...");
            window.location.href = "/OBN-Photocontest/admin.html"; // המעבר מופעל
        } else if (APPROVED_JUDGES.includes(userEmail)) {
            alert("זוהית כשופט מאושר. מועבר למסך השיפוט...");
            window.location.href = "/OBN-Photocontest/judge.html"; // המעבר מופעל (יוקם בהמשך)
        } else {
            alert("האימייל אינו מורשה במערכת.");
            auth.signOut();
        }
    } catch (error) {
        console.error("Login failed:", error);
    }
});