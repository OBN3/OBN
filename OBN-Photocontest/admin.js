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

// ==========================================
// 1. ניהול החלון הצף (Modal) - חשוף ל-HTML
// ==========================================
window.openModal = function(imageUrl) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImg');
    modalImg.src = imageUrl;
    modal.style.display = 'flex';
};

// סגירת החלון בלחיצה על הרקע הכהה
window.onclick = function(event) {
    const modal = document.getElementById('imageModal');
    if (event.target === modal) {
        modal.style.display = 'none';
        document.getElementById('modalImg').src = '';
    }
};

// סגירת החלון דרך כפתור ה-X (ברגע שהדף נטען)
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('closeModal').addEventListener('click', () => {
        document.getElementById('imageModal').style.display = 'none';
        document.getElementById('modalImg').src = '';
    });
});


// ==========================================
// 2. פונקציית קישורי תמונות (עוקף CORB)
// ==========================================
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


// ==========================================
// 3. הגנת אבטחה דינמית ומשיכת נתונים
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        if (!isLoggingOut) alert("עליך להתחבר כדי לגשת לעמוד זה.");
        window.location.href = "/OBN-Photocontest/index.html";
        return;
    }

    try {
        // בדיקה מאובטחת מול Firestore שהמשתמש הוא אכן אדמין
        const userDocRef = doc(db, "users_roles", user.email);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists() && userDocSnap.data().role === "admin") {
            fetchSubmissions(); // הכל תקין - טוען את הטבלה
        } else {
            alert("אין לך הרשאת מנהל גישה לעמוד זה.");
            window.location.href = "/OBN-Photocontest/index.html";
        }
    } catch (error) {
        console.error("Security check failed:", error);
        window.location.href = "/OBN-Photocontest/index.html";
    }
});

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

            const thumbUrl = getDirectImageUrl(data.imageUrl, 200);
            const largeUrl = getDirectImageUrl(data.imageUrl, 1920);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><img src="${thumbUrl}" class="thumbnail" alt="תמונה" title="לחץ להגדלה" onclick="window.openModal('${largeUrl}')"></td>
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


// ==========================================
// 4. פעולות כפתורים (ייצוא ויציאה)
// ==========================================
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

document.getElementById('logoutBtn').addEventListener('click', () => {
    isLoggingOut = true;
    signOut(auth).then(() => {
        window.location.href = "/OBN-Photocontest/index.html";
    });
});