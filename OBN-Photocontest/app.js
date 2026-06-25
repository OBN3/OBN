// ייבוא מודולים מ-Firebase (הקפד להכניס את פרטי הפרויקט שלך ב-firebaseConfig)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// הגדרת הרשאות צוות
const ADMIN_EMAIL = "ofirbn@gmail.com";
const APPROVED_JUDGES = ["judge1@gmail.com", "judge2@gmail.com"]; // הוסף את המיילים של השופטים כאן

// מנגנון הקטנת תמונות ישירות בדפדפן (Client-Side Compression)
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
                
                // המרה לפורמט WebP חסכוני במשקל
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/webp', 0.8); 
            };
        };
        reader.onerror = error => reject(error);
    });
}

// פונקציה חלופית לשליחת המקור אליך (למשל דרך Google Apps Script Webhook)
async function sendOriginalToAdmin(originalFile, photographerName) {
    // מכיוון שלא ניתן לשלוח קבצי ענק דרך המייל הסטנדרטי מ-Frontend, 
    // הדרך הנכונה כאן היא להקים Google Apps Script שמקבל את הקובץ ושומר ל-Drive.
    // אם תרצה שאכתוב לך את הסקריפט ל-Drive, רק תגיד. בינתיים זו הכנה לפונקציה:
    console.log(`Original file ready to be sent: ${originalFile.name} by ${photographerName}`);
}

// טיפול בהגשת הטופס הציבורי
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const status = document.getElementById('statusMessage');
    
    btn.disabled = true;
    status.style.color = '#2563eb';
    status.innerText = 'מעבד ומקטין את התמונה, אנא המתן...';

    try {
        const name = document.getElementById('photographerName').value;
        const title = document.getElementById('photoTitle').value;
        const desc = document.getElementById('photoDescription').value;
        const file = document.getElementById('photoFile').files[0];

        // 1. טיפול בקובץ המקור (שליחה אליך בנפרד)
        await sendOriginalToAdmin(file, name);

        // 2. דחיסת הקובץ עבור השופטים והמערכת
        const compressedBlob = await compressImage(file);
        const fileName = `submissions/${Date.now()}_${file.name.split('.')[0]}.webp`;
        const storageRef = ref(storage, fileName);

        status.innerText = 'מעלה למערכת השיפוט...';
        
        // 3. העלאה ל-Storage
        const snapshot = await uploadBytes(storageRef, compressedBlob);
        const downloadURL = await getDownloadURL(snapshot.ref);

        // 4. שמירת הנתונים ב-Firestore
        await addDoc(collection(db, "submissions"), {
            photographerName: name,
            title: title,
            description: desc,
            imageUrl: downloadURL,
            status: "pending", // התמונה ממתינה לשיפוט
            timestamp: serverTimestamp()
        });

        status.style.color = 'green';
        status.innerText = 'הצילום הוגש בהצלחה! תוכל להגיש תמונה נוספת כעת.';
        document.getElementById('uploadForm').reset(); // מאפשר העלאה נוספת
        
    } catch (error) {
        console.error("Error saving document: ", error);
        status.style.color = 'red';
        status.innerText = 'אירעה שגיאה בהעלאה. נסה שוב.';
    } finally {
        btn.disabled = false;
    }
});

// טיפול בהתחברות צוות (שופטים / מנהל)
document.getElementById('googleLoginBtn').addEventListener('click', async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        const userEmail = result.user.email;
        
        if (userEmail === ADMIN_EMAIL) {
            alert("זוהית כמנהל המערכת. מועבר לדשבורד האדמין...");
            // window.location.href = "admin.html";
        } else if (APPROVED_JUDGES.includes(userEmail)) {
            alert("זוהית כשופט מאושר. מועבר למסך השיפוט...");
            // window.location.href = "judge.html";
        } else {
            alert("האימייל אינו מורשה במערכת. מתנתק...");
            auth.signOut();
        }
    } catch (error) {
        console.error("Login failed:", error);
    }
});