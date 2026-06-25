import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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

let submissionsData = []; 
let isLoggingOut = false;

// ניהול החלון הצף (Modal)
window.openModal = function(imageUrl) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImg');
    modalImg.src = imageUrl;
    modal.style.display = 'flex';
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

// פונקציית קישורי תמונות (עוקף חסימות CORB)
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

// הגנת אבטחה דינמית 
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        if (!isLoggingOut) alert("עליך להתחבר כדי לגשת לעמוד זה.");
        window.location.href = "/OBN-Photocontest/index.html";
        return;
    }

    try {
        const userDocRef = doc(db, "users_roles", user.email);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists() && userDocSnap.data().role === "admin") {
            fetchSubmissions(); 
        } else {
            alert("אין לך הרשאת מנהל גישה לעמוד זה.");
            window.location.href = "/OBN-Photocontest/index.html";
        }
    } catch (error) {
        console.error("Security check failed:", error);
        window.location.href = "/OBN-Photocontest/index.html";
    }
});

function calculateTotalScore(data) {
    const scores = data.scores || {};
    return (scores.relevance || 0) + (scores.artistry || 0) + (scores.quality || 0) + (scores.authenticity || 0);
}

// משיכת הנתונים מפיירבייס 
async function fetchSubmissions() {
    const table = document.getElementById('submissionsTable');
    const tbody = document.getElementById('tableBody');
    const loadingMsg = document.getElementById('loadingMsg');

    try {
        const querySnapshot = await getDocs(collection(db, "submissions"));
        submissionsData = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            submissionsData.push(data);
        });

        // מיון אוטומטי של הטבלה
        submissionsData.sort((a, b) => {
            return calculateTotalScore(b) - calculateTotalScore(a); 
        });

        tbody.innerHTML = '';

        submissionsData.forEach((data) => {
            const scores = data.scores || {};
            const totalScore = calculateTotalScore(data);
            
            // פירוט שופטים בסטטוס
            const evaluationEmails = data.evaluations ? Object.keys(data.evaluations) : [];
            const judgeCount = evaluationEmails.length;
            let statusHtml = '';

            if (judgeCount > 0) {
                statusHtml = `
                    <span class="status judged">דורג (${judgeCount})</span><br>
                    <small style="color: #6b7280; font-size: 11px;">ע"י: ${evaluationEmails.join(', ')}</small>
                `;
            } else {
                statusHtml = `<span class="status pending">ממתין</span>`;
            }

            const thumbUrl = getDirectImageUrl(data.imageUrl, 200);
            const largeUrl = getDirectImageUrl(data.imageUrl, 1920);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><img src="${thumbUrl}" class="thumbnail" alt="תמונה" title="לחץ להגדלה" onclick="window.openModal('${largeUrl}')"></td>
                <td><strong>${data.photographerName}</strong></td>
                <td>${data.title}</td>
                <td>${scores.relevance || 0}</td>
                <td>${scores.artistry || 0}</td>
                <td>${scores.quality || 0}</td>
                <td>${scores.authenticity || 0}</td>
                <td><strong>${totalScore}</strong></td>
                <td>${statusHtml}</td>
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

// ייצוא ויציאה
document.getElementById('exportCsvBtn').addEventListener('click', () => {
    if (submissionsData.length === 0) {
        alert("אין נתונים לייצוא.");
        return;
    }

    let csvContent = "שם הצלם,כותרת,תיאור,זיקה לנושא,אמנותיות,איכות טכנית,אותנטיות,ציון סופי,סטטוס (כמות),שופטים שדירגו\n";

    submissionsData.forEach(row => {
        const scores = row.scores || {};
        const totalScore = calculateTotalScore(row);
        const evaluationEmails = row.evaluations ? Object.keys(row.evaluations) : [];
        const judgeCount = evaluationEmails.length;
        const statusText = judgeCount > 0 ? 'דורג' : 'ממתין';
        
        csvContent += `"${row.photographerName}","${row.title}","${row.description || ''}",${scores.relevance || 0},${scores.artistry || 0},${scores.quality || 0},${scores.authenticity || 0},${totalScore},"${statusText} (${judgeCount})","${evaluationEmails.join(', ')}"\n`;
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "נתוני_התחרות_ממוינים.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    isLoggingOut = true;
    signOut(auth).then(() => {
        window.location.href = "/OBN-Photocontest/index.html";
    });
});