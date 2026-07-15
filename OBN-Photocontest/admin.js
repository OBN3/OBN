import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc, deleteField } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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
let currentTableData = []; // הנתונים המסוננים שמוצגים כעת
let isLoggingOut = false;
let showingDeleted = false; 
let currentDateFilter = { type: 'all', start: null, end: null };

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

    // כפתור מעבר בין מחוקים לפעילים
    document.getElementById('toggleDeletedBtn').addEventListener('click', () => {
        showingDeleted = !showingDeleted;
        const btn = document.getElementById('toggleDeletedBtn');
        const title = document.getElementById('pageTitle');
        
        if (showingDeleted) {
            btn.innerHTML = "🔙 חזור לרשומות פעילות";
            btn.style.backgroundColor = "#3b82f6";
            title.innerHTML = "🗑️ רשומות מחוקות";
        } else {
            btn.innerHTML = "🗑️ רשומות מחוקות";
            btn.style.backgroundColor = "#6b7280";
            title.innerHTML = "🏆 מערכת ניהול התחרות";
        }
        applyFiltersAndRender();
    });

    // מאזינים לשינויים בסינון תאריכים
    document.getElementById('dateFilter').addEventListener('change', (e) => {
        currentDateFilter.type = e.target.value;
        if (currentDateFilter.type === 'custom') {
            document.getElementById('customDateRange').style.display = 'flex';
        } else {
            document.getElementById('customDateRange').style.display = 'none';
            applyFiltersAndRender();
        }
    });

    document.getElementById('applyDateFilterBtn').addEventListener('click', () => {
        const startVal = document.getElementById('startDate').value;
        const endVal = document.getElementById('endDate').value;
        currentDateFilter.start = startVal ? new Date(startVal) : null;
        currentDateFilter.end = endVal ? new Date(endVal) : null;
        applyFiltersAndRender();
    });

    // מנגנון חיפוש חי בטבלה (Client-side filtering)
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#tableBody tr');
            
            rows.forEach(row => {
                const rowText = row.textContent.toLowerCase();
                if (rowText.includes(searchTerm)) {
                    row.style.display = ''; 
                } else {
                    row.style.display = 'none'; 
                }
            });
        });
    }
});

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
    const total = (scores.relevance || 0) + (scores.artistry || 0) + (scores.quality || 0) + (scores.authenticity || 0);
    return Number(total.toFixed(2));
}

// פונקציית המרת Timestamp לתאריך קריא
function formatDate(timestamp) {
    if (!timestamp) return "לא ידוע";
    let date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('he-IL');
}

async function fetchSubmissions() {
    const loadingMsg = document.getElementById('loadingMsg');
    const table = document.getElementById('submissionsTable');
    loadingMsg.style.display = 'block';
    table.style.display = 'none';

    try {
        const querySnapshot = await getDocs(collection(db, "submissions"));
        submissionsData = [];
        
        querySnapshot.forEach((docSnap) => {
            submissionsData.push({ id: docSnap.id, ...docSnap.data() });
        });

        submissionsData.sort((a, b) => calculateTotalScore(b) - calculateTotalScore(a));
        
        // מפעיל את הרינדור הראשוני עם הסינונים (ברירת מחדל: "הכל")
        applyFiltersAndRender();

        loadingMsg.style.display = 'none';
        table.style.display = 'table';

    } catch (error) {
        console.error("Error fetching submissions:", error);
        loadingMsg.innerText = "שגיאה בטעינת הנתונים.";
    }
}

// מפעיל את כל מערך הסינונים לפי הסדר
function applyFiltersAndRender() {
    // 1. סינון תאריכים
    let dateFilteredData = submissionsData.filter(data => {
        if (!data.timestamp) return true; // הגנה במקרה של רשומות ישנות ללא תאריך
        
        let date = data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
        let now = new Date();

        if (currentDateFilter.type === 'last_month') {
            let monthAgo = new Date();
            monthAgo.setMonth(now.getMonth() - 1);
            return date >= monthAgo;
        } else if (currentDateFilter.type === 'last_year') {
            let yearAgo = new Date();
            yearAgo.setFullYear(now.getFullYear() - 1);
            return date >= yearAgo;
        } else if (currentDateFilter.type === 'custom') {
            if (currentDateFilter.start && date < currentDateFilter.start) return false;
            if (currentDateFilter.end) {
                let endOfDay = new Date(currentDateFilter.end);
                endOfDay.setHours(23, 59, 59, 999);
                if (date > endOfDay) return false;
            }
            return true;
        }
        return true; // 'all'
    });

    // 2. עדכון הסטטיסטיקות לפי טווח התאריכים (חשוב! סטטיסטיקה מושפעת רק מהתאריך ולא ממצב המחיקה)
    updateStatistics(dateFilteredData);

    // 3. סינון למחיקה רכה (עבור הטבלה בלבד)
    currentTableData = dateFilteredData.filter(data => showingDeleted ? data.isDeleted === true : !data.isDeleted);

    // 4. רינדור טבלה
    renderTableRows(currentTableData);
}

function updateStatistics(dataArray) {
    const total = dataArray.length;
    const deleted = dataArray.filter(d => d.isDeleted === true).length;
    const judged = dataArray.filter(d => d.evaluations && Object.keys(d.evaluations).length > 0).length;
    
    const uniqueJudges = new Set();
    dataArray.forEach(d => {
        if (d.evaluations) {
            Object.keys(d.evaluations).forEach(email => uniqueJudges.add(email));
        }
    });
    
    document.getElementById('stat-total').innerText = total;
    document.getElementById('stat-deleted').innerText = deleted;
    document.getElementById('stat-judged').innerText = judged;
    document.getElementById('stat-judges-count').innerText = uniqueJudges.size;
    
    document.getElementById('statsContainer').style.display = 'flex';
}

function renderTableRows(tableData) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    if (tableData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="15" style="text-align: center; padding: 20px;">אין נתונים להצגה בחתך התאריכים הנבחר</td></tr>`;
        return;
    }

    tableData.forEach((data) => {
        const scores = data.scores || {};
        const totalScore = calculateTotalScore(data);
        const submitDate = formatDate(data.timestamp);
        
        const evaluationEmails = data.evaluations ? Object.keys(data.evaluations) : [];
        const judgeCount = evaluationEmails.length;
        let statusHtml = judgeCount > 0 ? `<span class="status judged">דורג (${judgeCount})</span><br><small style="color:#6b7280; font-size:11px;">ע"י: ${evaluationEmails.join(', ')}</small>` : `<span class="status pending">ממתין</span>`;

        let pdfHtml = data.consentPdfUrl ? `<a href="${data.consentPdfUrl}" target="_blank" style="color:#2563eb; font-weight:bold; font-size:12px;">📄 אישור PDF</a>` : `<span style="color:#94a3b8; font-size:12px;">אין</span>`;

        const thumbUrl = getDirectImageUrl(data.imageUrl, 200);
        const largeUrl = getDirectImageUrl(data.imageUrl, 1920);

        const pTitle = data.title || "";
        const fName = data.firstName || "";
        const lName = data.lastName || data.photographerName || "";
        const fullDisplayName = `${pTitle} ${fName} ${lName}`.trim();

        let wpParts = (data.workplace || "").split(" - ");
        let baseWorkplace = wpParts[0] || "";
        let subWorkplace = wpParts.length > 1 ? wpParts[1] : "-";

        let personReadable = "ללא זיהוי";
        if(data.identifiablePerson === 'staff') personReadable = "עובדי מוסד";
        if(data.identifiablePerson === 'patients') personReadable = "מטופלים";

        // הוספת כפתור האיפוס לצד כפתור המחיקה בעמודת הפעולות
        let actionBtnHtml = showingDeleted 
            ? `<button class="action-btn btn-restore-row" onclick="toggleDeleteStatus('${data.id}', false)">שחזר ⟲</button>`
            : `<button class="action-btn btn-delete-row" onclick="toggleDeleteStatus('${data.id}', true)">מחק 🗑️</button>`;
            
        // כפתור איפוס דירוגים פעיל רק אם התמונה דורגה
        if (judgeCount > 0 && !showingDeleted) {
            actionBtnHtml += ` <button class="action-btn" onclick="resetSubmissionScores('${data.id}')" style="background-color: #f59e0b; color: white; margin-right: 5px;">🔄 איפוס</button>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span style="color:#6b7280; font-size:13px;">${submitDate}</span></td>
            <td><img src="${thumbUrl}" class="thumbnail" alt="תמונה" title="לחץ להגדלה" onclick="window.openModal('${largeUrl}')"></td>
            <td><strong>${fullDisplayName}</strong></td>
            <td>${baseWorkplace}</td>
            <td><span style="color:#6b7280; font-size:13px;">${subWorkplace}</span></td>
            <td>${data.photoTitle || data.title || ''}</td>
            <td><span style="background-color:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:12px;">${personReadable}</span></td>
            <td>${scores.relevance || 0}</td>
            <td>${scores.artistry || 0}</td>
            <td>${scores.quality || 0}</td>
            <td>${scores.authenticity || 0}</td>
            <td><strong>${totalScore}</strong></td>
            <td>${pdfHtml}</td>
            <td>${statusHtml}</td>
            <td>${actionBtnHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

window.toggleDeleteStatus = async function(id, isDeleted) {
    if (isDeleted) {
        if (!confirm("האם אתה בטוח שברצונך למחוק רשומה זו? היא לא תוצג יותר לשופטים ותעבור לארכיון המחוקים.")) return;
    } else {
        if (!confirm("האם לשחזר רשומה זו למאגר הפעיל?")) return;
    }

    try {
        const docRef = doc(db, "submissions", id);
        await updateDoc(docRef, {
            isDeleted: isDeleted
        });
        
        const record = submissionsData.find(d => d.id === id);
        if (record) {
            record.isDeleted = isDeleted;
        }
        
        // קריאה מחדש לרינדור כדי להחיל את העדכון מיד במסך
        applyFiltersAndRender();

    } catch (error) {
        console.error("Error updating delete status:", error);
        alert("אירעה שגיאה בעדכון מצב הרשומה.");
    }
};

window.resetSubmissionScores = async function(docId) {
    if (!confirm("האם אתה בטוח שברצונך למחוק את כל הדירוגים של תמונה זו? התמונה תחזור למצב 'ממתין' עבור כל השופטים.")) return;
    
    try {
        const docRef = doc(db, "submissions", docId);
        
        await updateDoc(docRef, {
            evaluations: deleteField(),
            scores: deleteField(),
            status: "pending"
        });
        
        // עדכון מקומי של הנתונים כדי למנוע קריאה מיותרת למסד הנתונים
        const record = submissionsData.find(d => d.id === docId);
        if (record) {
            delete record.evaluations;
            delete record.scores;
            record.status = "pending";
        }
        
        applyFiltersAndRender();
        alert("הדירוגים אופסו בהצלחה!");
        
    } catch (error) {
        console.error("Error resetting scores:", error);
        alert("שגיאה באיפוס הדירוג.");
    }
};

document.getElementById('exportCsvBtn').addEventListener('click', () => {
    // הייצוא כעת מבוסס על currentTableData, מה שאומר שהוא מייצא בדיוק את מה שרואים!
    if (currentTableData.length === 0) {
        alert("אין נתונים לייצוא בחתך הנבחר.");
        return;
    }

    let csvContent = "תאריך הגשה,תואר,שם פרטי,שם משפחה,טלפון נייד,דוא\"ל,מקום עבודה ראשי,פירוט מקום עבודה,מחלקה,תפקיד,מאשר דיוור,שם הצילום,הסיפור מאחורי התמונה,זיהוי אדם,לינק ל-PDF אישורים,זיקה לנושא,אמנותיות,איכות טכנית,אותנטיות,ציון סופי,סטטוס (כמות),שופטים שדירגו\n";

    currentTableData.forEach(row => {
        const scores = row.scores || {};
        const totalScore = calculateTotalScore(row);
        const evaluationEmails = row.evaluations ? Object.keys(row.evaluations) : [];
        const judgeCount = evaluationEmails.length;
        const statusText = judgeCount > 0 ? 'דורג' : 'ממתין';
        const submitDate = formatDate(row.timestamp);
        
        let personType = "לא";
        if(row.identifiablePerson === 'staff') personType = "עובדי מוסד";
        if(row.identifiablePerson === 'patients') personType = "מטופלים (מצורף PDF)";

        let wpParts = (row.workplace || "").split(" - ");
        let baseWorkplace = wpParts[0] || "";
        let subWorkplace = wpParts.length > 1 ? wpParts[1] : "";

        csvContent += `"${submitDate}","${row.title || ''}","${row.firstName || ''}","${row.lastName || ''}","${row.phone || ''}","${row.email || ''}","${baseWorkplace}","${subWorkplace}","${row.department || ''}","${row.role || ''}","${row.allowEmails ? 'כן' : 'לא'}","${row.photoTitle || ''}","${(row.description || '').replace(/"/g, '""')}","${personType}","${row.consentPdfUrl || ''}",${scores.relevance || 0},${scores.artistry || 0},${scores.quality || 0},${scores.authenticity || 0},${totalScore},"${statusText} (${judgeCount})","${evaluationEmails.join(', ')}"\n`;
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    // התאמת שם הקובץ בהתאם למצב
    let fileName = showingDeleted ? "נתוני_תחרות_מחוקים.csv" : "נתוני_התחרות_פעילים.csv";
    link.setAttribute("download", fileName);
    
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