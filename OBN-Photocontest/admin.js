import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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

const ADMIN_EMAIL = "ofirbn@gmail.com";
let submissionsData = []; // שמירת הנתונים בזיכרון לייצוא

// 1. שכבת הגנה - Auth Guard
// בודק אם המשתמש מחובר ואם הוא המנהל המורשה
onAuthStateChanged(auth, (user) => {
    if (!user || user.email !== ADMIN_EMAIL) {
        alert("אין לך הרשאת גישה לעמוד זה.");
        window.location.href = "index.html"; // זורק חזרה לדף הבית
    } else {
        fetchSubmissions(); // אם תקין, טוען את הנתונים
    }
});

// 2. משיכת הנתונים מפיירבייס והצגתם בטבלה
async function fetchSubmissions() {
    const table = document.getElementById('submissionsTable');
    const tbody = document.getElementById('tableBody');
    const loadingMsg = document.getElementById('loadingMsg');

    try {
        const querySnapshot = await getDocs(collection(db, "submissions"));
        submissionsData = [];
        tbody.innerHTML = '';

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            submissionsData.push(data);

            // מכיוון שעוד לא בנינו את מסך השופטים, נשים 0 כברירת מחדל אם אין עדיין ציונים
            const relevance = data.scores?.relevance || 0;
            const artistry = data.scores?.artistry || 0;
            const quality = data.scores?.quality || 0;
            const authenticity = data.scores?.authenticity || 0;
            const totalScore = relevance + artistry + quality + authenticity;
            
            // תצוגת סטטוס ויזואלית
            const statusClass = totalScore > 0 ? 'judged' : 'pending';
            const statusText = totalScore > 0 ? 'דורג' : 'ממתין';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><a href="${data.imageUrl}" target="_blank"><img src="${data.imageUrl}" class="thumbnail" alt="תמונה"></a></td>
                <td><strong>${data.photographerName}</strong></td>
                <td>${data.title}</td>
                <td>${relevance}</td>
                <td>${artistry}</td>
                <td>${quality}</td>
                <td>${authenticity}</td>
                <td><strong>${totalScore}</strong></td>
                <td><span class="status ${statusClass}">${statusText}</span></td>
            `;
            tbody.appendChild(tr);
        });

        loadingMsg.style.display = 'none';
        table.style.display = 'table';

    } catch (error) {
        console.error("Error fetching submissions:", error);
        loadingMsg.innerText = "שגיאה בטעינת הנתונים.";
    }
}

// 3. ייצוא ל-CSV (אקסל)
document.getElementById('exportCsvBtn').addEventListener('click', () => {
    if (submissionsData.length === 0) {
        alert("אין נתונים לייצוא.");
        return;
    }

    // יצירת כותרות
    let csvContent = "שם הצלם,כותרת,תיאור,זיקה לנושא,אמנותיות,איכות טכנית,אותנטיות,ציון סופי,סטטוס\n";

    // הוספת השורות
    submissionsData.forEach(row => {
        const relevance = row.scores?.relevance || 0;
        const artistry = row.scores?.artistry || 0;
        const quality = row.scores?.quality || 0;
        const authenticity = row.scores?.authenticity || 0;
        const totalScore = relevance + artistry + quality + authenticity;
        const statusText = totalScore > 0 ? 'דורג' : 'ממתין';
        
        // עטיפת הטקסטים במירכאות כדי למנוע שבירה של פסיקים בתוך התיאור
        csvContent += `"${row.photographerName}","${row.title}","${row.description || ''}",${relevance},${artistry},${quality},${authenticity},${totalScore},"${statusText}"\n`;
    });

    // הוספת BOM כדי שהעברית תעבוד חלק באקסל
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "נתוני_התחרות.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// 4. התנתקות
document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = "index.html";
    });
});