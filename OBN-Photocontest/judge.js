import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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

const APPROVED_JUDGES = ["judge1@gmail.com", "judge2@gmail.com"]; // הכנס את אימייל השופטים האמיתיים
let currentUserEmail = "";
let pendingPhotos = [];
let currentIndex = 0;

// 1. שכבת הגנה לשופטים
onAuthStateChanged(auth, (user) => {
    if (!user || !APPROVED_JUDGES.includes(user.email)) {
        alert("אין לך הרשאת שופט במערכת זו.");
        window.location.href = "index.html";
    } else {
        currentUserEmail = user.email;
        loadPendingSubmissions();
    }
});

// 2. משיכת תמונות שטרם דורגו על ידי השופט הנוכחי
async function loadPendingSubmissions() {
    try {
        const querySnapshot = await getDocs(collection(db, "submissions"));
        pendingPhotos = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // בודק אם השופט הזה כבר דירג את התמונה. אם לא - מוסיף אותה לתור שלו.
            const hasJudged = data.evaluations && data.evaluations[currentUserEmail];
            if (!hasJudged) {
                pendingPhotos.push({ id: doc.id, ...data });
            }
        });

        document.getElementById('loadingMsg').style.display = 'none';
        
        if (pendingPhotos.length === 0) {
            document.getElementById('emptyState').style.display = 'block';
        } else {
            document.getElementById('judgingWorkspace').style.display = 'flex';
            showPhoto(currentIndex);
        }
    } catch (error) {
        console.error("Error loading submissions:", error);
        document.getElementById('loadingMsg').innerText = "שגיאה בטעינת הנתונים.";
    }
}

// 3. הצגת התמונה הנוכחית על המסך
function showPhoto(index) {
    const photo = pendingPhotos[index];
    document.getElementById('currentImage').src = photo.imageUrl;
    document.getElementById('currentTitle').innerText = photo.title;
    document.getElementById('currentDesc').innerText = photo.description || "ללא תיאור.";
    document.getElementById('progressText').innerText = `תמונה ${index + 1} מתוך ${pendingPhotos.length}`;
    
    // איפוס סרגלים ל-5 כברירת מחדל
    ['relevance', 'artistry', 'quality', 'authenticity'].forEach(crit => {
        document.getElementById(`score-${crit}`).value = 5;
        document.getElementById(`val-${crit}`).innerText = "5";
    });
}

// 4. שמירת הציונים וחישוב ממוצע למנהל
document.getElementById('scoringForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitScoreBtn');
    btn.disabled = true;
    btn.innerText = "שומר...";

    const currentPhotoId = pendingPhotos[currentIndex].id;
    
    // איסוף הציונים מהסרגלים
    const judgeScore = {
        relevance: parseInt(document.getElementById('score-relevance').value),
        artistry: parseInt(document.getElementById('score-artistry').value),
        quality: parseInt(document.getElementById('score-quality').value),
        authenticity: parseInt(document.getElementById('score-authenticity').value)
    };

    try {
        const docRef = doc(db, "submissions", currentPhotoId);
        const docSnap = await getDoc(docRef);
        const data = docSnap.data();
        
        // שמירת הציון של השופט הנוכחי
        let evaluations = data.evaluations || {};
        evaluations[currentUserEmail] = judgeScore;
        
        // חישוב הממוצע החדש של כל השופטים כדי שיופיע יפה לאדמין
        let totalJudges = Object.keys(evaluations).length;
        let avgScores = { relevance: 0, artistry: 0, quality: 0, authenticity: 0 };
        
        for (let email in evaluations) {
            avgScores.relevance += evaluations[email].relevance;
            avgScores.artistry += evaluations[email].artistry;
            avgScores.quality += evaluations[email].quality;
            avgScores.authenticity += evaluations[email].authenticity;
        }
        
        avgScores.relevance = parseFloat((avgScores.relevance / totalJudges).toFixed(1));
        avgScores.artistry = parseFloat((avgScores.artistry / totalJudges).toFixed(1));
        avgScores.quality = parseFloat((avgScores.quality / totalJudges).toFixed(1));
        avgScores.authenticity = parseFloat((avgScores.authenticity / totalJudges).toFixed(1));

        // עדכון המסד נתונים
        await updateDoc(docRef, {
            evaluations: evaluations,
            scores: avgScores, // זה מה שהאדמין רואה בטבלה
            status: "judged"
        });

        // מעבר לתמונה הבאה
        currentIndex++;
        if (currentIndex < pendingPhotos.length) {
            showPhoto(currentIndex);
        } else {
            // נגמרו התמונות
            document.getElementById('judgingWorkspace').style.display = 'none';
            document.getElementById('emptyState').style.display = 'block';
        }
    } catch (error) {
        console.error("Error saving score:", error);
        alert("שגיאה בשמירת הציון. נסה שוב.");
    } finally {
        btn.disabled = false;
        btn.innerText = "שמור דירוג והמשך ➡️";
    }
});

// 5. התנתקות
document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = "index.html";
    });
});