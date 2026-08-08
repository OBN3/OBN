import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";

import {
    getFirestore,
    collection,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    deleteField
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import {
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";


// ===================================================
// Firebase
// ===================================================

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


// ===================================================
// משתנים
// ===================================================

let submissionsData = [];
let currentTableData = [];

let isLoggingOut = false;
let showingDeleted = false;

let currentDateFilter = {
    type: "all",
    start: null,
    end: null
};

// מיון
let currentSort = "score_desc";


// ===================================================
// Modal
// ===================================================

window.openModal = function(imageUrl) {

    const modal = document.getElementById("imageModal");
    const modalImg = document.getElementById("modalImg");

    modalImg.src = imageUrl;

    modal.style.display = "flex";
};


window.onclick = function(event) {

    const modal = document.getElementById("imageModal");

    if (event.target === modal) {

        modal.style.display = "none";

        document.getElementById("modalImg").src = "";
    }
};


// ===================================================
// DOMContentLoaded
// ===================================================

document.addEventListener("DOMContentLoaded", () => {


    // -----------------------------------------------
    // סגירת Modal
    // -----------------------------------------------

    const closeModal =
        document.getElementById("closeModal");

    if (closeModal) {

        closeModal.addEventListener("click", () => {

            document.getElementById("imageModal")
                .style.display = "none";

            document.getElementById("modalImg").src = "";
        });
    }


    // -----------------------------------------------
    // מעבר בין רשומות פעילות / מחוקות
    // -----------------------------------------------

    const toggleDeletedBtn =
        document.getElementById("toggleDeletedBtn");

    if (toggleDeletedBtn) {

        toggleDeletedBtn.addEventListener("click", () => {

            showingDeleted = !showingDeleted;

            const title =
                document.getElementById("pageTitle");


            if (showingDeleted) {

                toggleDeletedBtn.innerHTML =
                    "🔙 חזור לרשומות פעילות";

                toggleDeletedBtn.style.backgroundColor =
                    "#3b82f6";

                if (title) {
                    title.innerHTML =
                        "🗑️ רשומות מחוקות";
                }

            } else {

                toggleDeletedBtn.innerHTML =
                    "🗑️ רשומות מחוקות";

                toggleDeletedBtn.style.backgroundColor =
                    "#6b7280";

                if (title) {
                    title.innerHTML =
                        "🏆 מערכת ניהול התחרות";
                }
            }


            applyFiltersAndRender();
        });
    }


    // -----------------------------------------------
    // סינון תאריכים
    // -----------------------------------------------

    const dateFilter =
        document.getElementById("dateFilter");

    if (dateFilter) {

        dateFilter.addEventListener("change", (e) => {

            currentDateFilter.type =
                e.target.value;


            if (
                currentDateFilter.type ===
                "custom"
            ) {

                const customRange =
                    document.getElementById(
                        "customDateRange"
                    );

                if (customRange) {
                    customRange.style.display = "flex";
                }

            } else {

                const customRange =
                    document.getElementById(
                        "customDateRange"
                    );

                if (customRange) {
                    customRange.style.display = "none";
                }

                applyFiltersAndRender();
            }
        });
    }


    // -----------------------------------------------
    // תאריכים מותאמים אישית
    // -----------------------------------------------

    const applyDateFilterBtn =
        document.getElementById(
            "applyDateFilterBtn"
        );

    if (applyDateFilterBtn) {

        applyDateFilterBtn.addEventListener(
            "click",
            () => {

                const startVal =
                    document.getElementById(
                        "startDate"
                    ).value;

                const endVal =
                    document.getElementById(
                        "endDate"
                    ).value;


                currentDateFilter.start =
                    startVal
                        ? new Date(startVal)
                        : null;


                currentDateFilter.end =
                    endVal
                        ? new Date(endVal)
                        : null;


                applyFiltersAndRender();
            }
        );
    }


    // -----------------------------------------------
    // תפריט מיון
    // -----------------------------------------------

    const sortSelect =
        document.getElementById("sortSelect");

    if (sortSelect) {

        sortSelect.addEventListener(
            "change",
            (e) => {

                currentSort =
                    e.target.value;

                updateSortIndicators();

                applyFiltersAndRender();
            }
        );
    }


    // -----------------------------------------------
    // מיון לפי כותרות
    // -----------------------------------------------

    document
        .querySelectorAll("th.sortable")
        .forEach(th => {

            th.addEventListener("click", () => {

                const sortKey =
                    th.dataset.sort;

                toggleSortByKey(sortKey);
            });
        });


    // -----------------------------------------------
    // חיפוש
    // -----------------------------------------------

    const searchInput =
        document.getElementById("searchInput");

    if (searchInput) {

        searchInput.addEventListener(
            "input",
            function(e) {

                const searchTerm =
                    e.target.value.toLowerCase();

                const rows =
                    document.querySelectorAll(
                        "#tableBody tr"
                    );


                rows.forEach(row => {

                    const rowText =
                        row.textContent.toLowerCase();


                    row.style.display =
                        rowText.includes(searchTerm)
                            ? ""
                            : "none";
                });
            }
        );
    }


    updateSortIndicators();
});


// ===================================================
// מיון
// ===================================================

function toggleSortByKey(key) {

    const keyMap = {

        score: {
            desc: "score_desc",
            asc: "score_asc"
        },

        date: {
            desc: "date_desc",
            asc: "date_asc"
        },

        judges: {
            desc: "judges_desc",
            asc: "judges_asc"
        }
    };


    if (!keyMap[key]) {
        return;
    }


    const currentDesc =
        keyMap[key].desc;

    const currentAsc =
        keyMap[key].asc;


    if (currentSort === currentDesc) {

        currentSort = currentAsc;

    } else {

        currentSort = currentDesc;
    }


    const sortSelect =
        document.getElementById("sortSelect");

    if (sortSelect) {
        sortSelect.value = currentSort;
    }


    updateSortIndicators();

    applyFiltersAndRender();
}


// ===================================================
// אינדיקטורים למיון
// ===================================================

function updateSortIndicators() {

    const map = {

        score_desc: {
            col: "score",
            arrow: "↓"
        },

        score_asc: {
            col: "score",
            arrow: "↑"
        },

        date_desc: {
            col: "date",
            arrow: "↓"
        },

        date_asc: {
            col: "date",
            arrow: "↑"
        },

        judges_desc: {
            col: "judges",
            arrow: "↓"
        },

        judges_asc: {
            col: "judges",
            arrow: "↑"
        }
    };


    [
        "date",
        "score",
        "judges"
    ].forEach(col => {

        const th =
            document.getElementById(
                `th-${col}`
            );

        const si =
            document.getElementById(
                `si-${col}`
            );


        if (th) {
            th.classList.remove(
                "active-sort"
            );
        }


        if (si) {
            si.textContent = "↕";
        }
    });


    const active =
        map[currentSort];


    if (active) {

        const th =
            document.getElementById(
                `th-${active.col}`
            );

        const si =
            document.getElementById(
                `si-${active.col}`
            );


        if (th) {
            th.classList.add(
                "active-sort"
            );
        }


        if (si) {
            si.textContent =
                active.arrow;
        }
    }
}


// ===================================================
// מיון הנתונים
// ===================================================

function sortData(data) {

    return [...data].sort((a, b) => {

        const scoreA =
            calculateTotalScore(a);

        const scoreB =
            calculateTotalScore(b);


        const dateA =
            a.timestamp
                ? (
                    a.timestamp.toDate
                        ? a.timestamp.toDate().getTime()
                        : new Date(
                            a.timestamp
                        ).getTime()
                )
                : 0;


        const dateB =
            b.timestamp
                ? (
                    b.timestamp.toDate
                        ? b.timestamp.toDate().getTime()
                        : new Date(
                            b.timestamp
                        ).getTime()
                )
                : 0;


        const judgesA =
            a.evaluations
                ? Object.keys(
                    a.evaluations
                ).length
                : 0;


        const judgesB =
            b.evaluations
                ? Object.keys(
                    b.evaluations
                ).length
                : 0;


        switch (currentSort) {

            case "score_desc":
                return scoreB - scoreA;

            case "score_asc":
                return scoreA - scoreB;

            case "date_desc":
                return dateB - dateA;

            case "date_asc":
                return dateA - dateB;

            case "judges_desc":
                return judgesB - judgesA;

            case "judges_asc":
                return judgesA - judgesB;

            default:
                return scoreB - scoreA;
        }
    });
}


// ===================================================
// URL ישיר לתמונה
// ===================================================

function getDirectImageUrl(
    url,
    size = 1000
) {

    if (!url) {
        return "";
    }


    let fileId = "";


    if (url.includes("id=")) {

        fileId =
            url
                .split("id=")[1]
                .split("&")[0];

    } else if (url.includes("/d/")) {

        fileId =
            url
                .split("/d/")[1]
                .split("/")[0];
    }


    return fileId
        ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`
        : url;
}


// ===================================================
// Authentication
// ===================================================

onAuthStateChanged(
    auth,
    async (user) => {

        if (!user) {

            if (!isLoggingOut) {

                alert(
                    "עליך להתחבר כדי לגשת לעמוד זה."
                );
            }


            window.location.href =
                "/OBN-Photocontest/index.html";

            return;
        }


        try {

            const userDocRef =
                doc(
                    db,
                    "users_roles",
                    user.email
                );


            const userDocSnap =
                await getDoc(
                    userDocRef
                );


            if (
                userDocSnap.exists() &&
                userDocSnap.data().role === "admin"
            ) {

                fetchSubmissions();

            } else {

                alert(
                    "אין לך הרשאת מנהל גישה לעמוד זה."
                );


                window.location.href =
                    "/OBN-Photocontest/index.html";
            }

        } catch (error) {

            console.error(
                "Security check failed:",
                error
            );


            window.location.href =
                "/OBN-Photocontest/index.html";
        }
    }
);


// ===================================================
// חישוב ציון כולל
// ===================================================

function calculateTotalScore(data) {

    const scores =
        data.scores || {};


    const total =
        (scores.relevance || 0) +
        (scores.artistry || 0) +
        (scores.quality || 0) +
        (scores.authenticity || 0);


    return Number(
        total.toFixed(2)
    );
}


// ===================================================
// פורמט תאריך
// ===================================================

function formatDate(timestamp) {

    if (!timestamp) {
        return "לא ידוע";
    }


    const date =
        timestamp.toDate
            ? timestamp.toDate()
            : new Date(timestamp);


    return date.toLocaleDateString(
        "he-IL"
    );
}


// ===================================================
// טעינת submissions
// ===================================================

async function fetchSubmissions() {

    const loadingMsg =
        document.getElementById(
            "loadingMsg"
        );


    const table =
        document.getElementById(
            "submissionsTable"
        );


    if (loadingMsg) {
        loadingMsg.style.display = "block";
    }


    if (table) {
        table.style.display = "none";
    }


    try {

        const querySnapshot =
            await getDocs(
                collection(
                    db,
                    "submissions"
                )
            );


        submissionsData = [];


        querySnapshot.forEach(
            (docSnap) => {

                submissionsData.push({

                    id: docSnap.id,

                    ...docSnap.data()
                });
            }
        );


        applyFiltersAndRender();


        if (loadingMsg) {
            loadingMsg.style.display = "none";
        }


        if (table) {
            table.style.display = "table";
        }


    } catch (error) {

        console.error(
            "Error fetching submissions:",
            error
        );


        if (loadingMsg) {

            loadingMsg.innerText =
                "שגיאה בטעינת הנתונים.";
        }
    }
}


// ===================================================
// סינון + מיון + רינדור
// ===================================================

function applyFiltersAndRender() {

    let dateFilteredData =
        submissionsData.filter(
            data => {

                if (!data.timestamp) {
                    return true;
                }


                const date =
                    data.timestamp.toDate
                        ? data.timestamp.toDate()
                        : new Date(
                            data.timestamp
                        );


                const now =
                    new Date();


                if (
                    currentDateFilter.type ===
                    "last_month"
                ) {

                    const monthAgo =
                        new Date();

                    monthAgo.setMonth(
                        now.getMonth() - 1
                    );


                    return date >= monthAgo;
                }


                if (
                    currentDateFilter.type ===
                    "last_year"
                ) {

                    const yearAgo =
                        new Date();

                    yearAgo.setFullYear(
                        now.getFullYear() - 1
                    );


                    return date >= yearAgo;
                }


                if (
                    currentDateFilter.type ===
                    "custom"
                ) {

                    if (
                        currentDateFilter.start &&
                        date <
                        currentDateFilter.start
                    ) {
                        return false;
                    }


                    if (
                        currentDateFilter.end
                    ) {

                        const endOfDay =
                            new Date(
                                currentDateFilter.end
                            );


                        endOfDay.setHours(
                            23,
                            59,
                            59,
                            999
                        );


                        if (
                            date >
                            endOfDay
                        ) {
                            return false;
                        }
                    }


                    return true;
                }


                return true;
            }
        );


    updateStatistics(
        dateFilteredData
    );


    let filtered =
        dateFilteredData.filter(
            data =>
                showingDeleted
                    ? data.isDeleted === true
                    : !data.isDeleted
        );


    currentTableData =
        sortData(filtered);


    renderTableRows(
        currentTableData
    );
}


// ===================================================
// סטטיסטיקות
// ===================================================

function updateStatistics(
    dataArray
) {

    const total =
        dataArray.length;


    const deleted =
        dataArray.filter(
            d =>
                d.isDeleted === true
        ).length;


    const judged =
        dataArray.filter(
            d =>
                d.evaluations &&
                Object.keys(
                    d.evaluations
                ).length > 0
        ).length;


    const uniqueJudges =
        new Set();


    dataArray.forEach(
        d => {

            if (d.evaluations) {

                Object.keys(
                    d.evaluations
                ).forEach(
                    email =>
                        uniqueJudges.add(
                            email
                        )
                );
            }
        }
    );


    const statTotal =
        document.getElementById(
            "stat-total"
        );

    const statDeleted =
        document.getElementById(
            "stat-deleted"
        );

    const statJudged =
        document.getElementById(
            "stat-judged"
        );

    const statJudges =
        document.getElementById(
            "stat-judges-count"
        );

    const statsContainer =
        document.getElementById(
            "statsContainer"
        );


    if (statTotal) {
        statTotal.innerText =
            total;
    }


    if (statDeleted) {
        statDeleted.innerText =
            deleted;
    }


    if (statJudged) {
        statJudged.innerText =
            judged;
    }


    if (statJudges) {
        statJudges.innerText =
            uniqueJudges.size;
    }


    if (statsContainer) {
        statsContainer.style.display =
            "flex";
    }
}


// ===================================================
// רינדור טבלת Admin
// ===================================================

function renderTableRows(
    tableData
) {

    const tbody =
        document.getElementById(
            "tableBody"
        );


    if (!tbody) {
        return;
    }


    tbody.innerHTML = "";


    if (tableData.length === 0) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="15"
                    style="
                        text-align:center;
                        padding:20px;
                    "
                >
                    אין נתונים להצגה
                    בחתך התאריכים הנבחר
                </td>

            </tr>

        `;

        return;
    }


    tableData.forEach(
        data => {

            const scores =
                data.scores || {};


            const totalScore =
                calculateTotalScore(
                    data
                );


            const submitDate =
                formatDate(
                    data.timestamp
                );


            const evaluationEmails =
                data.evaluations
                    ? Object.keys(
                        data.evaluations
                    )
                    : [];


            const judgeCount =
                evaluationEmails.length;


            let statusHtml =
                judgeCount > 0

                    ? `

                        <span
                            class="status judged"
                        >
                            דורג (${judgeCount})
                        </span>

                        <br>

                        <small
                            style="
                                color:#6b7280;
                                font-size:11px;
                            "
                        >
                            ע"י:
                            ${evaluationEmails.join(", ")}
                        </small>

                    `

                    : `

                        <span
                            class="status pending"
                        >
                            ממתין
                        </span>

                    `;


            let pdfHtml =
                data.consentPdfUrl

                    ? `

                        <a
                            href="${data.consentPdfUrl}"
                            target="_blank"
                            style="
                                color:#2563eb;
                                font-weight:bold;
                                font-size:12px;
                            "
                        >
                            📄 אישור PDF
                        </a>

                    `

                    : `

                        <span
                            style="
                                color:#94a3b8;
                                font-size:12px;
                            "
                        >
                            אין
                        </span>

                    `;


            const thumbUrl =
                getDirectImageUrl(
                    data.imageUrl,
                    200
                );


            const largeUrl =
                getDirectImageUrl(
                    data.imageUrl,
                    1920
                );


            const pTitle =
                data.title || "";


            const fName =
                data.firstName || "";


            const lName =
                data.lastName ||
                data.photographerName ||
                "";


            const fullDisplayName =
                `${pTitle} ${fName} ${lName}`
                    .trim();


            const wpParts =
                (data.workplace || "")
                    .split(" - ");


            const baseWorkplace =
                wpParts[0] || "";


            const subWorkplace =
                wpParts.length > 1
                    ? wpParts[1]
                    : "-";


            let personReadable =
                "ללא זיהוי";


            if (
                data.identifiablePerson ===
                "staff"
            ) {

                personReadable =
                    "עובדי מוסד";
            }


            if (
                data.identifiablePerson ===
                "patients"
            ) {

                personReadable =
                    "מטופלים";
            }


            let actionBtnHtml =
                showingDeleted

                    ? `

                        <button
                            class="action-btn btn-restore-row"
                            onclick="
                                toggleDeleteStatus(
                                    '${data.id}',
                                    false
                                )
                            "
                        >
                            שחזר ⟲
                        </button>

                    `

                    : `

                        <button
                            class="action-btn btn-delete-row"
                            onclick="
                                toggleDeleteStatus(
                                    '${data.id}',
                                    true
                                )
                            "
                        >
                            מחק 🗑️
                        </button>

                    `;


            if (
                judgeCount > 0 &&
                !showingDeleted
            ) {

                actionBtnHtml += `

                    <button
                        class="action-btn"
                        onclick="
                            resetSubmissionScores(
                                '${data.id}'
                            )
                        "
                        style="
                            background-color:#f59e0b;
                            color:white;
                            margin-right:5px;
                        "
                    >
                        🔄 איפוס
                    </button>

                `;
            }


            const tr =
                document.createElement(
                    "tr"
                );


            tr.innerHTML = `

                <td>
                    <span
                        style="
                            color:#6b7280;
                            font-size:13px;
                        "
                    >
                        ${submitDate}
                    </span>
                </td>


                <td>

                    <img
                        src="${thumbUrl}"
                        class="thumbnail"
                        alt="תמונה"
                        title="לחץ להגדלה"
                        onclick="
                            window.openModal(
                                '${largeUrl}'
                            )
                        "
                    >

                </td>


                <td>

                    <strong>
                        ${fullDisplayName}
                    </strong>

                </td>


                <td>
                    ${baseWorkplace}
                </td>


                <td>

                    <span
                        style="
                            color:#6b7280;
                            font-size:13px;
                        "
                    >
                        ${subWorkplace}
                    </span>

                </td>


                <td>
                    ${
                        data.photoTitle ||
                        data.title ||
                        ""
                    }
                </td>


                <td>

                    <span
                        style="
                            background-color:#f1f5f9;
                            padding:2px 6px;
                            border-radius:4px;
                            font-size:12px;
                        "
                    >
                        ${personReadable}
                    </span>

                </td>


                <td>
                    ${scores.relevance || 0}
                </td>


                <td>
                    ${scores.artistry || 0}
                </td>


                <td>
                    ${scores.quality || 0}
                </td>


                <td>
                    ${scores.authenticity || 0}
                </td>


                <td>

                    <strong>
                        ${totalScore}
                    </strong>

                </td>


                <td>
                    ${pdfHtml}
                </td>


                <td>
                    ${statusHtml}
                </td>


                <td>
                    ${actionBtnHtml}
                </td>

            `;


            tbody.appendChild(tr);
        }
    );
}


// ===================================================
// מחיקה / שחזור
// ===================================================

window.toggleDeleteStatus =
    async function(
        id,
        isDeleted
    ) {

        if (isDeleted) {

            if (
                !confirm(
                    "האם אתה בטוח שברצונך למחוק רשומה זו? " +
                    "היא לא תוצג יותר לשופטים " +
                    "ותעבור לארכיון המחוקים."
                )
            ) {
                return;
            }

        } else {

            if (
                !confirm(
                    "האם לשחזר רשומה זו למאגר הפעיל?"
                )
            ) {
                return;
            }
        }


        try {

            const docRef =
                doc(
                    db,
                    "submissions",
                    id
                );


            await updateDoc(
                docRef,
                {
                    isDeleted
                }
            );


            const record =
                submissionsData.find(
                    d => d.id === id
                );


            if (record) {
                record.isDeleted =
                    isDeleted;
            }


            applyFiltersAndRender();


        } catch (error) {

            console.error(
                "Error updating delete status:",
                error
            );


            alert(
                "אירעה שגיאה בעדכון מצב הרשומה."
            );
        }
    };


// ===================================================
// איפוס דירוגים
// ===================================================

window.resetSubmissionScores =
    async function(
        docId
    ) {

        if (
            !confirm(
                "האם אתה בטוח שברצונך למחוק את כל הדירוגים " +
                "של תמונה זו? התמונה תחזור למצב 'ממתין' " +
                "עבור כל השופטים."
            )
        ) {
            return;
        }


        try {

            const docRef =
                doc(
                    db,
                    "submissions",
                    docId
                );


            await updateDoc(
                docRef,
                {
                    evaluations:
                        deleteField(),

                    scores:
                        deleteField(),

                    status:
                        "pending"
                }
            );


            const record =
                submissionsData.find(
                    d => d.id === docId
                );


            if (record) {

                delete record.evaluations;

                delete record.scores;

                record.status =
                    "pending";
            }


            applyFiltersAndRender();


            alert(
                "הדירוגים אופסו בהצלחה!"
            );


        } catch (error) {

            console.error(
                "Error resetting scores:",
                error
            );


            alert(
                "שגיאה באיפוס הדירוג."
            );
        }
    };


// ===================================================
// ייצוא לאקסל
// ===================================================

const exportExcelBtn =
    document.getElementById(
        "exportExcelBtn"
    );


if (exportExcelBtn) {

    exportExcelBtn.addEventListener(
        "click",
        exportToExcel
    );
}


function exportToExcel() {

    // -----------------------------------------------
    // בדיקות
    // -----------------------------------------------

    if (
        currentTableData.length === 0
    ) {

        alert(
            "אין נתונים לייצוא בחתך הנבחר."
        );

        return;
    }


    if (
        typeof XLSX === "undefined"
    ) {

        alert(
            "ספריית ייצוא האקסל לא נטענה. " +
            "בדוק את חיבור האינטרנט ונסה שוב."
        );

        return;
    }


    // ===================================================
    // גיליון 1 - תוצאות
    // ===================================================

    const resultsData =
        currentTableData.map(
            row => {

                const scores =
                    row.scores || {};


                const evaluationEmails =
                    row.evaluations
                        ? Object.keys(
                            row.evaluations
                        )
                        : [];


                const wpParts =
                    (row.workplace || "")
                        .split(" - ");


                const baseWorkplace =
                    wpParts[0] || "";


                const subWorkplace =
                    wpParts.length > 1
                        ? wpParts[1]
                        : "";


                let personType =
                    "לא";


                if (
                    row.identifiablePerson ===
                    "staff"
                ) {

                    personType =
                        "עובדי מוסד";
                }


                if (
                    row.identifiablePerson ===
                    "patients"
                ) {

                    personType =
                        "מטופלים (מצורף PDF)";
                }


                return {

                    "מזהה רשומה":
                        row.id || "",

                    "תאריך הגשה":
                        formatDate(
                            row.timestamp
                        ),

                    "תואר":
                        row.title || "",

                    "שם פרטי":
                        row.firstName || "",

                    "שם משפחה":
                        row.lastName || "",

                    "טלפון נייד":
                        row.phone || "",

                    "דוא\"ל":
                        row.email || "",

                    "מקום עבודה ראשי":
                        baseWorkplace,

                    "פירוט מקום עבודה":
                        subWorkplace,

                    "מחלקה":
                        row.department || "",

                    "תפקיד":
                        row.role || "",

                    "מאשר דיוור":
                        row.allowEmails
                            ? "כן"
                            : "לא",

                    "שם הצילום":
                        row.photoTitle || "",

                    "הסיפור מאחורי התמונה":
                        row.description || "",

                    "זיהוי אדם":
                        personType,

                    "לינק ל-PDF אישורים":
                        row.consentPdfUrl || "",

                    "זיקה לנושא - ממוצע":
                        scores.relevance || 0,

                    "אמנותיות - ממוצע":
                        scores.artistry || 0,

                    "איכות טכנית - ממוצע":
                        scores.quality || 0,

                    "אותנטיות - ממוצע":
                        scores.authenticity || 0,

                    "ציון סופי":
                        calculateTotalScore(
                            row
                        ),

                    "מספר שופטים":
                        evaluationEmails.length,

                    "שופטים שדירגו":
                        evaluationEmails.join(
                            ", "
                        )
                };
            }
        );


    // ===================================================
    // גיליון 2 + 3 - דירוגי שופטים
    // ===================================================

    const judgesData = [];


    currentTableData.forEach(
        row => {

            const evaluations =
                row.evaluations || {};


            const evaluationEmails =
                Object.keys(
                    evaluations
                );


            const wpParts =
                (row.workplace || "")
                    .split(" - ");


            const baseWorkplace =
                wpParts[0] || "";


            const subWorkplace =
                wpParts.length > 1
                    ? wpParts[1]
                    : "";


            const photographerName =
                `${row.title || ""} ${
                    row.firstName || ""
                } ${
                    row.lastName || ""
                }`.trim();


            // -------------------------------------------
            // תמונה ללא דירוגים
            // -------------------------------------------

            if (
                evaluationEmails.length === 0
            ) {

                judgesData.push({

                    "מזהה רשומה":
                        row.id || "",

                    "תאריך הגשה":
                        formatDate(
                            row.timestamp
                        ),

                    "שם הצילום":
                        row.photoTitle ||
                        row.title ||
                        "",

                    "שם הצלם":
                        photographerName,

                    "מקום עבודה ראשי":
                        baseWorkplace,

                    "פירוט מקום עבודה":
                        subWorkplace,

                    "שופט":
                        "",

                    "זיקה לנושא":
                        "",

                    "אמנותיות":
                        "",

                    "איכות טכנית":
                        "",

                    "אותנטיות":
                        "",

                    "סה\"כ שופט":
                        "",

                    "סטטוס":
                        "טרם דורג"
                });


                return;
            }


            // -------------------------------------------
            // כל שופט בנפרד
            // -------------------------------------------

            evaluationEmails.forEach(
                email => {

                    const evaluation =
                        evaluations[email] ||
                        {};


                    const relevance =
                        Number(
                            evaluation.relevance || 0
                        );


                    const artistry =
                        Number(
                            evaluation.artistry || 0
                        );


                    const quality =
                        Number(
                            evaluation.quality || 0
                        );


                    const authenticity =
                        Number(
                            evaluation.authenticity || 0
                        );


                    const judgeTotal =
                        relevance +
                        artistry +
                        quality +
                        authenticity;


                    judgesData.push({

                        "מזהה רשומה":
                            row.id || "",

                        "תאריך הגשה":
                            formatDate(
                                row.timestamp
                            ),

                        "שם הצילום":
                            row.photoTitle ||
                            row.title ||
                            "",

                        "שם הצלם":
                            photographerName,

                        "מקום עבודה ראשי":
                            baseWorkplace,

                        "פירוט מקום עבודה":
                            subWorkplace,

                        "שופט":
                            email,

                        "זיקה לנושא":
                            relevance,

                        "אמנותיות":
                            artistry,

                        "איכות טכנית":
                            quality,

                        "אותנטיות":
                            authenticity,

                        "סה\"כ שופט":
                            judgeTotal,

                        "סטטוס":
                            "דורג"
                    });
                }
            );
        }
    );


    // ===================================================
    // יצירת Workbook
    // ===================================================

    const workbook =
        XLSX.utils.book_new();


    // ===================================================
    // גיליון תוצאות
    // ===================================================

    const resultsSheet =
        XLSX.utils.json_to_sheet(
            resultsData
        );


    resultsSheet["!cols"] = [

        { wch: 22 },
        { wch: 14 },
        { wch: 12 },
        { wch: 16 },
        { wch: 18 },
        { wch: 16 },
        { wch: 28 },
        { wch: 22 },
        { wch: 22 },
        { wch: 18 },
        { wch: 14 },
        { wch: 25 },
        { wch: 45 },
        { wch: 22 },
        { wch: 35 },
        { wch: 18 },
        { wch: 18 },
        { wch: 20 },
        { wch: 16 },
        { wch: 14 },
        { wch: 14 },
        { wch: 45 }
    ];


    resultsSheet["!sheetViews"] = [
        {
            rightToLeft: true
        }
    ];


    // ===================================================
    // גיליון דירוגי שופטים
    // ===================================================

    const judgesSheet =
        XLSX.utils.json_to_sheet(
            judgesData
        );


    judgesSheet["!cols"] = [

        { wch: 22 }, // מזהה
        { wch: 14 }, // תאריך
        { wch: 30 }, // צילום
        { wch: 25 }, // צלם
        { wch: 25 }, // מקום עבודה
        { wch: 28 }, // פירוט מקום עבודה
        { wch: 35 }, // שופט
        { wch: 14 }, // זיקה
        { wch: 14 }, // אמנותיות
        { wch: 16 }, // איכות
        { wch: 14 }, // אותנטיות
        { wch: 16 }, // סה"כ
        { wch: 14 }  // סטטוס
    ];


    // AutoFilter
    if (judgesData.length > 0) {

        const lastRow =
            judgesData.length + 1;


        const lastColumn =
            XLSX.utils.encode_col(
                Object.keys(
                    judgesData[0]
                ).length - 1
            );


        judgesSheet["!autofilter"] = {
            ref:
                `A1:${lastColumn}${lastRow}`
        };
    }


    judgesSheet["!sheetViews"] = [
        {
            rightToLeft: true
        }
    ];


    // ===================================================
    // גיליון 3 - סינון שופטים
    // ===================================================

    const filterData =
        judgesData.map(row => ({
            "שופט":
                row["שופט"],

            "מקום עבודה ראשי":
                row["מקום עבודה ראשי"],

            "פירוט מקום עבודה":
                row["פירוט מקום עבודה"],

            "שם הצילום":
                row["שם הצילום"],

            "שם הצלם":
                row["שם הצלם"],

            "זיקה לנושא":
                row["זיקה לנושא"],

            "אמנותיות":
                row["אמנותיות"],

            "איכות טכנית":
                row["איכות טכנית"],

            "אותנטיות":
                row["אותנטיות"],

            "סה\"כ שופט":
                row["סה\"כ שופט"],

            "סטטוס":
                row["סטטוס"],

            "מזהה רשומה":
                row["מזהה רשומה"],

            "תאריך הגשה":
                row["תאריך הגשה"]
        }));


    const filterSheet =
        XLSX.utils.json_to_sheet(
            filterData
        );


    filterSheet["!cols"] = [

        { wch: 35 }, // שופט
        { wch: 25 }, // מקום עבודה
        { wch: 30 }, // פירוט
        { wch: 30 }, // צילום
        { wch: 25 }, // צלם
        { wch: 14 }, // זיקה
        { wch: 14 }, // אמנותיות
        { wch: 16 }, // איכות
        { wch: 14 }, // אותנטיות
        { wch: 16 }, // סה"כ
        { wch: 14 }, // סטטוס
        { wch: 22 }, // מזהה
        { wch: 14 }  // תאריך
    ];


    // -----------------------------------------------
    // AutoFilter בגיליון הסינון
    // -----------------------------------------------

    if (filterData.length > 0) {

        const lastRow =
            filterData.length + 1;


        const lastColumn =
            XLSX.utils.encode_col(
                Object.keys(
                    filterData[0]
                ).length - 1
            );


        filterSheet["!autofilter"] = {
            ref:
                `A1:${lastColumn}${lastRow}`
        };
    }


    filterSheet["!sheetViews"] = [
        {
            rightToLeft: true
        }
    ];


    // ===================================================
    // הוספת הגיליונות
    // ===================================================

    XLSX.utils.book_append_sheet(
        workbook,
        resultsSheet,
        "תוצאות"
    );


    XLSX.utils.book_append_sheet(
        workbook,
        judgesSheet,
        "דירוגי שופטים"
    );


    XLSX.utils.book_append_sheet(
        workbook,
        filterSheet,
        "סינון שופטים"
    );


    // ===================================================
    // שם הקובץ
    // ===================================================

    const fileName =
        showingDeleted
            ? "נתוני_תחרות_מחוקים.xlsx"
            : "נתוני_התחרות.xlsx";


    // ===================================================
    // יצירת הקובץ
    // ===================================================

    XLSX.writeFile(
        workbook,
        fileName
    );
}


// ===================================================
// התנתקות
// ===================================================

const logoutBtn =
    document.getElementById(
        "logoutBtn"
    );


if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        () => {

            isLoggingOut = true;


            signOut(auth)
                .then(() => {

                    window.location.href =
                        "/OBN-Photocontest/index.html";
                });
        }
    );
}