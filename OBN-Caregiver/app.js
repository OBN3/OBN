import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
// שים לב: הוספתי פה את deleteDoc
import { getFirestore, collection, addDoc, updateDoc, doc, query, orderBy, onSnapshot, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// === הגדרות Firebase ===
const firebaseConfig = {
  apiKey: "AIzaSyDn9MNktFcHxzwxL5hhIYPIIN635_0pST8",
  authDomain: "obn-photocontest.firebaseapp.com",
  projectId: "obn-photocontest",
  storageBucket: "obn-photocontest.firebasestorage.app",
  messagingSenderId: "833616633042",
  appId: "1:833616633042:web:82339189ba55f3d916210b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// === משתנים גלובליים ===
let currentUser = null;
const adminUid = "QjT2Hkd8LUVme4whqUV4wFQkXJG3"; // החלף ב-UID האמיתי שלך מתוך טאב Authentication בפיירבייס!
let unsubscribeTasks = null;
let unsubscribeExpenses = null;

// === אלמנטים מה-DOM ===
const views = {
    login: document.getElementById('login-view'),
    app: document.getElementById('app-view'),
    taskModal: document.getElementById('task-modal')
};

// === ניהול התחברות ===
document.getElementById('btn-login').addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(error => alert("שגיאה בהתחברות: " + error.message));
});

document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        views.login.classList.add('hidden-view');
        views.app.classList.remove('hidden-view');
        document.getElementById('user-greeting').textContent = `שלום, ${user.displayName.split(' ')[0]}`;
        
        // חשיפת כפתור אדמין
        if (user.uid === adminUid) {
            document.getElementById('nav-admin').classList.remove('hidden');
        }
        
        loadTasks();
        loadExpenses();
    } else {
        currentUser = null;
        if (unsubscribeTasks) unsubscribeTasks();
        if (unsubscribeExpenses) unsubscribeExpenses();

        views.app.classList.add('hidden-view');
        views.login.classList.remove('hidden-view');
    }
});

// === ניווט ותיק חירום ===
document.getElementById('toggle-emergency').addEventListener('click', () => {
    document.getElementById('emergency-content').classList.toggle('hidden');
});

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-btn').forEach(b => {
            b.classList.remove('text-blue-600');
            b.classList.add('text-gray-500');
        });
        e.target.classList.add('text-blue-600');
        e.target.classList.remove('text-gray-500');

        document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('hidden-view'));
        document.getElementById(e.target.dataset.target).classList.remove('hidden-view');
    });
});

// === לוגיקת משימות ===
document.getElementById('btn-add-task').addEventListener('click', () => views.taskModal.classList.remove('hidden-view'));
document.getElementById('btn-close-task-modal').addEventListener('click', () => views.taskModal.classList.add('hidden-view'));

document.getElementById('task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const taskData = {
        title: document.getElementById('task-title').value,
        desc: document.getElementById('task-desc').value,
        date: document.getElementById('task-date').value,
        location: document.getElementById('task-location').value,
        assigneeId: null,
        assigneeName: null,
        status: 'open',
        createdAt: new Date().toISOString()
    };
    
    await addDoc(collection(db, "care_tasks"), taskData);
    e.target.reset();
    views.taskModal.classList.add('hidden-view');
});

function loadTasks() {
    const q = query(collection(db, "care_tasks"), orderBy("date", "asc"));
    unsubscribeTasks = onSnapshot(q, (snapshot) => {
        const container = document.getElementById('tasks-container');
        const adminList = document.getElementById('admin-tasks-list');
        
        container.innerHTML = '';
        if (adminList) adminList.innerHTML = ''; // איפוס אזור מנהל
        
        const now = new Date();
        const twoDaysFromNow = new Date(now.getTime() + (48 * 60 * 60 * 1000));

        snapshot.forEach((docSnap) => {
            const task = docSnap.data();
            const taskId = docSnap.id;
            const taskDate = new Date(task.date);
            
            const isOrphan = (taskDate <= twoDaysFromNow && taskDate >= now && !task.assigneeId);
            const orphanClass = isOrphan ? 'border-red-500 border-2 orphan-alert' : 'border-gray-100 border';
            
            // --- קביעת תצוגת הכפתורים לפי מי שלקח את המשימה ---
            let actionHtml = '';
            if (task.assigneeId) {
                // אם אתה הבעלים של המשימה, תראה כפתור ביטול
                if (task.assigneeId === currentUser.uid) {
                    actionHtml = `
                        <span class="text-green-600 font-semibold">✓ באחריותך</span>
                        <button class="btn-release text-red-500 text-xs mr-2 hover:underline" data-id="${taskId}">(ביטול)</button>
                    `;
                } else {
                    actionHtml = `<span class="text-green-600 font-semibold">✓ באחריות: ${task.assigneeName}</span>`;
                }
            } else {
                actionHtml = `<button class="btn-grab bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 text-sm font-semibold" data-id="${taskId}">🖐️ תפוס משימה</button>`;
            }
            
            // רינדור משימה למשתמש
            const div = document.createElement('div');
            div.className = `bg-white p-4 rounded-xl shadow-sm ${orphanClass}`;
            div.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="font-bold text-gray-800">${task.title}</h4>
                        <p class="text-xs text-gray-500">📅 ${task.date} | 📍 ${task.location || 'ללא מיקום'}</p>
                    </div>
                    ${isOrphan ? `<span class="bg-red-100 text-red-700 text-xs px-2 py-1 rounded font-bold">דחוף!</span>` : ''}
                </div>
                <p class="text-sm text-gray-600 mb-3">${task.desc}</p>
                <div class="flex justify-between items-center mt-2 pt-2 border-t border-gray-50">
                    <div class="text-sm flex items-center">
                        ${actionHtml}
                    </div>
                    <button class="btn-duplicate text-gray-400 hover:text-gray-700" data-id="${taskId}" title="שכפל משימה">⧉</button>
                </div>
            `;
            container.appendChild(div);

            // רינדור משימה למנהל (Admin)
            if (currentUser && currentUser.uid === adminUid && adminList) {
                adminList.innerHTML += `
                    <div class="flex justify-between items-center bg-gray-50 p-2 rounded text-sm border">
                        <div class="flex-1">
                            <span class="font-bold">${task.title}</span> <span class="text-gray-500">(${task.date})</span>
                        </div>
                        <button class="btn-admin-delete bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 text-xs font-bold" data-id="${taskId}">מחק</button>
                    </div>
                `;
            }
        });

        // אירועי לחיצה: תפיסת משימה
        document.querySelectorAll('.btn-grab').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                await updateDoc(doc(db, "care_tasks", id), {
                    assigneeId: currentUser.uid,
                    assigneeName: currentUser.displayName
                });
            });
        });

        // אירועי לחיצה: שחרור משימה
        document.querySelectorAll('.btn-release').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                await updateDoc(doc(db, "care_tasks", id), {
                    assigneeId: null,
                    assigneeName: null
                });
            });
        });

        // אירועי לחיצה: שכפול משימה
        document.querySelectorAll('.btn-duplicate').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const taskRef = snapshot.docs.find(d => d.id === id).data();
                
                document.getElementById('task-title').value = taskRef.title + " (העתק)";
                document.getElementById('task-desc').value = taskRef.desc;
                document.getElementById('task-location').value = taskRef.location;
                document.getElementById('task-date').value = "";
                views.taskModal.classList.remove('hidden-view');
            });
        });

        // אירועי לחיצה: מחיקה מוחלטת דרך Admin
        document.querySelectorAll('.btn-admin-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm("האם אתה בטוח שברצונך למחוק משימה זו לחלוטין מכל האחים?")) {
                    const id = e.target.getAttribute('data-id');
                    await deleteDoc(doc(db, "care_tasks", id));
                }
            });
        });
    });
}

// === לוגיקת הוצאות ===
document.getElementById('btn-add-expense').addEventListener('click', async () => {
    const amount = prompt("הזן סכום (בשקלים):");
    if (!amount || isNaN(amount)) return;
    
    const desc = prompt("על מה ההוצאה? (למשל: סופרמרקט)");
    if (!desc) return;

    await addDoc(collection(db, "care_expenses"), {
        amount: parseFloat(amount),
        desc: desc,
        paidById: currentUser.uid,
        paidByName: currentUser.displayName,
        date: new Date().toISOString()
    });
});

function loadExpenses() {
    const q = query(collection(db, "care_expenses"), orderBy("date", "desc"));
    unsubscribeExpenses = onSnapshot(q, (snapshot) => {
        const listContainer = document.getElementById('expenses-list');
        listContainer.innerHTML = '';
        
        let totalExpenses = 0;
        const balances = {};

        snapshot.forEach((docSnap) => {
            const exp = docSnap.data();
            totalExpenses += exp.amount;
            
            if(!balances[exp.paidById]) balances[exp.paidById] = { name: exp.paidByName, paid: 0 };
            balances[exp.paidById].paid += exp.amount;

            listContainer.innerHTML += `
                <div class="bg-white p-3 rounded shadow-sm flex justify-between text-sm border-r-4 border-green-500">
                    <div><span class="font-bold">${exp.desc}</span> <span class="text-gray-500">(${exp.paidByName})</span></div>
                    <div class="font-bold">₪${exp.amount}</div>
                </div>
            `;
        });

        const activeBrothers = Object.keys(balances).length > 0 ? 3 : 1; 
        const targetPerPerson = totalExpenses / 3;
        
        let splitHtml = `<p>סה"כ הוצאות: ₪${totalExpenses.toFixed(2)} (יעד לכל אח: ₪${targetPerPerson.toFixed(2)})</p><hr class="my-2">`;
        
        for (const [uid, data] of Object.entries(balances)) {
            const diff = data.paid - targetPerPerson;
            if (diff > 0) {
                splitHtml += `<p class="text-green-600">👈 ${data.name} צריך לקבל ₪${diff.toFixed(2)}</p>`;
            } else if (diff < 0) {
                splitHtml += `<p class="text-red-600">👉 ${data.name} חייב ₪${Math.abs(diff).toFixed(2)}</p>`;
            } else {
                splitHtml += `<p class="text-gray-600">${data.name} מאוזן.</p>`;
            }
        }
        
        document.getElementById('expenses-split').innerHTML = splitHtml;
    });
}