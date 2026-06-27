import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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

// הגדרת שמירת החיבור באופן מפורש בדפדפן ליציבות מירבית
setPersistence(auth, browserLocalPersistence).catch(console.error);

let currentUserEmail = "";
let pendingPhotos = [];
let currentIndex = 0;
let isLoggingOut = false;
let authTimeout = null; 
let hasLoadedSubmissions = false; // דגל המונע קריאות כפולות ואיפוס של ה-currentIndex

// פונקציית קישורי תמונות (תיקון שגיאות CORB)
function getDirectImageUrl(url, size = 1000) {
    if (!url) return "";
    let fileId = "";
    if (url.includes("id=")) {
        fileId = url.split("id=")[1].split("&")[0];
    } else if (url.includes("/d/")) {
        fileId = url.split("/d/")[1].split("/")[0];
    }
    return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}` : url;
}

// ניהול החלון הצף (Modal) עבור השופט
window.openJudgeModal = function() {
    const photo = pendingPhotos[currentIndex];
    if(photo) {
        const largeUrl = getDirectImageUrl(photo.imageUrl, 1920);
        document.getElementById('modalImg').src = largeUrl;
        document.getElementById('imageModal').style.display = 'flex';
    }
};

window.onclick = function(event) {
    const modal = document.getElementById('imageModal');
    if (event.target === modal) {
        modal.style.display = 'none';
        document.getElementById('modalImg').src = '';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('closeModal').addEventListener('click', () => {
        document.getElementById('imageModal').style.display = 'none';
        document.getElementById('modalImg').src = '';
    });
});

// שכבת הגנה דינמית לשופטים (כולל מנגנון הגנה מפני ניתוקים רגעיים)
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // מחכים 1.5 שניות לפני שזורקים את המשתמש, למקרה שמדובר ברענון טוקן זמני ברקע
        authTimeout = setTimeout(() => {
            if (!isLoggingOut) {
                alert("עליך להתחבר כדי לגשת לעמוד זה.");
                window.location.href = "/OBN-Photocontest/index.html";
            }
        }, 1500);
        return;
    }

    // אם המשתמש חזר/נשאר מחובר בתוך חלון הזמן, נבטל את הניתוק מיד
    if (authTimeout) clearTimeout(authTimeout);

    try {
        // מונע הרצה חוזרת של טעינת התמונות ואיפוס האינדקס אם הסטטוס התרענן בהצלחה ברקע
        if (!hasLoadedSubmissions) {
            const userDocRef = doc(db, "users_roles", user.email);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists() && userDocSnap.data().role === "judge") {
                currentUserEmail = user.email;
                hasLoadedSubmissions = true;
                loadPendingSubmissions(); 
            } else {
                alert("אין לך הרשאת שופט במערכת זו.");
                window.location.href = "/OBN-Photocontest/index.html";
            }
        }
    } catch (error) {
        console.error("Security check failed:", error);
        window.location.href = "/OBN-Photocontest/index.html";
    }
});

// משיכת התמונות לשיפוט
async function loadPendingSubmissions() {
    try {
        const querySnapshot = await getDocs(collection(db, "submissions"));
        pendingPhotos = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const hasJudged = data.evaluations && data.evaluations[currentUserEmail];
            if (!hasJudged) {
                pendingPhotos.push({ id: doc.id, ...data });
            }
        });

        document.getElementById('loadingMsg').style.display = 'none';
        
        if (pendingPhotos.length === 0) {
            document.getElementById('emptyState').style.display = 'block';
            document.getElementById('judgingWorkspace').style.display = 'none';
        } else {
            document.getElementById('judgingWorkspace').style.display = 'flex';
            showPhoto(currentIndex);
        }
    } catch (error) {
        console.error("Error loading submissions:", error);
        document.getElementById('loadingMsg').innerText = "שגיאה בטעינת הנתונים.";
    }
}

// הצגת התמונה הנוכחית
function showPhoto(index) {
    const photo = pendingPhotos[index];
    document.getElementById('currentImage').src = getDirectImageUrl(photo.imageUrl, 1000);
    
    // שליפת שם התמונה האמיתי (ולא התואר של המשתמש)
    let finalTitle = photo.photoTitle;
    
    // הגנה פרואקטיבית לתמונות ישנות: במידה ואין photoTitle, נשתמש ב-title הישן, 
    // אך רק בתנאי שהוא לא מכיל תואר שמסגיר את המשתמש לשופטים
    if (!finalTitle && photo.title) {
        const userTitles = ["פרופ'", 'ד"ר', 'עו"ד', "אינג'", "מגר'", "גב'", "מר"];
        if (!userTitles.includes(photo.title)) {
            finalTitle = photo.title;
        }
    }
    
    document.getElementById('currentTitle').innerText = finalTitle || "ללא כותרת";
    document.getElementById('currentDesc').innerText = photo.description || "ללא תיאור.";
    document.getElementById('progressText').innerText = `תמונה ${index + 1} מתוך ${pendingPhotos.length}`;
    
    // איפוס תיבות הבחירה ל-1
    ['relevance', 'artistry', 'quality', 'authenticity'].forEach(crit => {
        document.getElementById(`score-${crit}`).value = "1";
    });
}

// שמירת ציון השופט
document.getElementById('scoringForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitScoreBtn');
    btn.disabled = true;
    btn.innerText = "שומר...";

    const currentPhotoId = pendingPhotos[currentIndex].id;
    
    // איסוף הציונים מתיבות ה-Dropdown
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
        
        let evaluations = data.evaluations || {};
        evaluations[currentUserEmail] = judgeScore;
        
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

        await updateDoc(docRef, {
            evaluations: evaluations,
            scores: avgScores,
            status: "judged"
        });

        // מעבר לתמונה הבאה
        currentIndex++;
        if (currentIndex < pendingPhotos.length) {
            showPhoto(currentIndex);
        } else {
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

// התנתקות חלקה
document.getElementById('logoutBtn').addEventListener('click', () => {
    isLoggingOut = true;
    signOut(auth).then(() => {
        window.location.href = "/OBN-Photocontest/index.html";
    });
});