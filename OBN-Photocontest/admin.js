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
let submissionsData = []; 
let isLoggingOut = false; // הדגל שמונע את הלופ

// פונקציית עזר להמרת קישור מדרייב לתצוגה ישירה (עוקף חסימות CORB)
function getDirectImageUrl(url) {
    if (!url) return "";
    let fileId = "";
    
    // חילוץ מזהה הקובץ מהקישור של דרייב
    if (url.includes("id=")) {
        fileId = url.split("id=")[1].split("&")[0];
    } else if (url.includes("/d/")) {
        fileId = url.split("/d/")[1].split("/")[0];
    }
    
    // שימוש ב-API התמונות הממוזערות של גוגל. 
    // הפרמטר sz=w1000 מגדיר רוחב מקסימלי לתצוגה חדה ומהירה, ומאושר ל-Cross-Origin.
    return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000` : url;
}

// 1. שכבת הגנה משופרת
onAuthStateChanged(auth, (user) => {
    if (!user) {
        if (!isLoggingOut) alert("עליך להתחבר כדי לגשת לעמוד זה.");
        window.location.href = "/OBN-Photocontest/index.html";
    } else if (user.email !== ADMIN_EMAIL) {
        if (!isLoggingOut) alert("אין לך הרשאת גישה לעמוד זה.");
        window.location.href = "/OBN-Photocontest/index.html";
    } else {
        fetchSubmissions(); 
    }
});

// 2. משיכת הנתונים מפיירבייס והצגתם
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

            const relevance = data.scores?.relevance || 0;
            const artistry = data.scores?.artistry || 0;
            const quality = data.scores?.quality || 0;
            const authenticity = data.scores?.authenticity || 0;
            const totalScore = relevance + artistry + quality + authenticity;
            
            const statusClass = totalScore > 0 ? 'judged' : 'pending';
            const statusText = totalScore > 0 ? 'דורג' : 'ממתין';

            // יצירת הקישור המוצג
            const displayUrl = getDirectImageUrl(data.imageUrl);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><a href="${data.imageUrl}" target="_blank" title="לחץ להורדה מקורית"><img src="${displayUrl}" class="thumbnail" alt="תמונה"></a></td>
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

// 3. ייצוא ל-CSV (נשאר ללא שינוי)
document.getElementById('exportCsvBtn').addEventListener('click', () => {
    if (submissionsData.length === 0) {
        alert("אין נתונים לייצוא.");
        return;
    }

    let csvContent = "שם הצלם,כותרת,תיאור,זיקה לנושא,אמנותיות,איכות טכנית,אותנטיות,ציון סופי,סטטוס\n";

    submissionsData.forEach(row => {
        const relevance = row.scores?.relevance || 0;
        const artistry = row.scores?.artistry || 0;
        const quality = row.scores?.quality || 0;
        const authenticity = row.scores?.authenticity || 0;
        const totalScore = relevance + artistry + quality + authenticity;
        const statusText = totalScore > 0 ? 'דורג' : 'ממתין';
        
        csvContent += `"${row.photographerName}","${row.title}","${row.description || ''}",${relevance},${artistry},${quality},${authenticity},${totalScore},"${statusText}"\n`;
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "נתוני_התחרות.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// 4. התנתקות חלקה ללא שגיאות
document.getElementById('logoutBtn').addEventListener('click', () => {
    isLoggingOut = true;
    signOut(auth).then(() => {
        window.location.href = "/OBN-Photocontest/index.html";
    });
});