import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, doc, setDoc, query, orderBy, onSnapshot, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// === משתנים גלובליים ונתיבים ===
let currentUser = null;
const adminUid = "QjT2Hkd8LUVme4whqUV4wFQkXJG3"; 

// הגדרת נתיב הבסיס כך שיתאים בדיוק לחוקים החדשים ב-Firebase
const familyId = "my_family"; // מזהה המשפחה שלך
const basePath = `FamilyCareApp/data/families/${familyId}`;

let unsubscribeTasks = null;
let unsubscribeExpenses = null;
let unsubscribeEmergency = null;

let editingTaskId = null;
let editingExpenseId = null;

// === אלמנטים מה-DOM ===
const views = {
    login: document.getElementById('login-view'),
    app: document.getElementById('app-view'),
    taskModal: document.getElementById('task-modal'),
    expenseModal: document.getElementById('expense-modal'),
    emergencyModal: document.getElementById('emergency-modal')
};

// === ניהול התחברות ===
document.getElementById('btn-login').addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(error => alert("שגיאה בהתחברות: " + error.message));
});

document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        // וידוא מורשים בצד הלקוח (הגנה נוספת מעבר ל-Rules)
        const allowedEmails = ["veredt9@gmail.com", "brother2@gmail.com", "ofirbn@gmail.com"];
        if (!allowedEmails.includes(user.email)) {
            alert("אינך מורשה לגשת לאפליקציה זו.");
            signOut(auth);
            return;
        }

        currentUser = user;
        views.login.classList.add('hidden-view');
        views.app.classList.remove('hidden-view');
        document.getElementById('user-greeting').textContent = `שלום, ${user.displayName.split(' ')[0]}`;
        
        if (user.uid === adminUid) {
            document.getElementById('nav-admin').classList.remove('hidden');
        }
        
        loadTasks();
        loadExpenses();
        loadEmergencyInfo();
    } else {
        currentUser = null;
        if (unsubscribeTasks) unsubscribeTasks();
        if (unsubscribeExpenses) unsubscribeExpenses();
        if (unsubscribeEmergency) unsubscribeEmergency();

        views.app.classList.add('hidden-view');
        views.login.classList.remove('hidden-view');
    }
});

// === ניווט ===
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

// ==========================================
// === לוגיקת תיק חירום ===
// ==========================================
document.getElementById('btn-edit-emergency').addEventListener('click', (e) => {
    e.stopPropagation();
    views.emergencyModal.classList.remove('hidden-view');
});
document.getElementById('btn-close-emergency-modal').addEventListener('click', () => views.emergencyModal.classList.add('hidden-view'));

document.getElementById('emergency-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const emData = {
        doctor: document.getElementById('em-doctor').value,
        hmo: document.getElementById('em-hmo').value,
        blood: document.getElementById('em-blood').value,
        allergies: document.getElementById('em-allergies').value,
        meds: document.getElementById('em-meds').value,
        updatedBy: currentUser.displayName,
        updatedAt: new Date().toISOString()
    };
    
    // שימוש בנתיב המבודד
    await setDoc(doc(db, `${basePath}/care_emergency`, "info"), emData);
    views.emergencyModal.classList.add('hidden-view');
});

function loadEmergencyInfo() {
    // שימוש בנתיב המבודד
    unsubscribeEmergency = onSnapshot(doc(db, `${basePath}/care_emergency`, "info"), (docSnap) => {
        const display = document.getElementById('emergency-data-display');
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            display.innerHTML = `
                <p><strong>רופא משפחה:</strong> ${data.doctor || 'לא הוזן'}</p>
                <p><strong>קופת חולים:</strong> ${data.hmo || 'לא הוזן'}</p>
                <p><strong>סוג דם:</strong> <span dir="ltr">${data.blood || 'לא הוזן'}</span></p>
                <p><strong>רגישויות:</strong> ${data.allergies || 'לא הוזן'}</p>
                <p><strong>תרופות קבועות:</strong> ${data.meds || 'לא הוזן'}</p>
                <p class="text-[10px] text-gray-400 mt-2">עודכן לאחרונה ע"י: ${data.updatedBy}</p>
            `;
            
            document.getElementById('em-doctor').value = data.doctor || '';
            document.getElementById('em-hmo').value = data.hmo || '';
            document.getElementById('em-blood').value = data.blood || '';
            document.getElementById('em-allergies').value = data.allergies || '';
            document.getElementById('em-meds').value = data.meds || '';

            document.getElementById('btn-share-emergency').onclick = (e) => {
                e.stopPropagation();
                const textToShare = `🚨 *תיק רפואי דחוף:*\n👨‍⚕️ רופא: ${data.doctor || 'לא ידוע'}\n🏥 קופה: ${data.hmo || 'לא ידוע'}\n🩸 סוג דם: ${data.blood || 'לא ידוע'}\n⚠️ רגישויות: ${data.allergies || 'אין'}\n💊 תרופות קבועות: ${data.meds || 'אין'}`;
                navigator.clipboard.writeText(textToShare);
                alert("המידע הרפואי הועתק! ניתן להדביק אותו כעת בווטסאפ.");
            };
        } else {
            display.innerHTML = `<p class="text-gray-500 py-2">התיק ריק. לחצו על "ערוך נתונים" כדי למלא את הפרטים הרפואיים.</p>`;
            document.getElementById('btn-share-emergency').onclick = (e) => { e.stopPropagation(); alert("אין עדיין נתונים להעתיק."); };
        }
    });
}

// ==========================================
// === לוגיקת משימות ===
// ==========================================

document.getElementById('btn-add-task').addEventListener('click', () => {
    editingTaskId = null;
    document.getElementById('task-form').reset();
    document.getElementById('task-modal-title').textContent = "משימה חדשה";
    views.taskModal.classList.remove('hidden-view');
});
document.getElementById('btn-close-task-modal').addEventListener('click', () => views.taskModal.classList.add('hidden-view'));

document.getElementById('task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const updates = {
        title: document.getElementById('task-title').value,
        desc: document.getElementById('task-desc').value,
        date: document.getElementById('task-date').value,
        location: document.getElementById('task-location').value,
    };
    
    if (editingTaskId) {
        // שימוש בנתיב המבודד
        await updateDoc(doc(db, `${basePath}/care_tasks`, editingTaskId), updates);
    } else {
        updates.assigneeId = null;
        updates.assigneeName = null;
        updates.status = 'open';
        updates.createdAt = new Date().toISOString();
        // שימוש בנתיב המבודד
        await addDoc(collection(db, `${basePath}/care_tasks`), updates);
    }
    
    e.target.reset();
    views.taskModal.classList.add('hidden-view');
});

function loadTasks() {
    // שימוש בנתיב המבודד
    const q = query(collection(db, `${basePath}/care_tasks`), orderBy("date", "asc"));
    unsubscribeTasks = onSnapshot(q, (snapshot) => {
        const container = document.getElementById('tasks-container');
        container.innerHTML = '';
        
        const now = new Date();
        const twoDaysFromNow = new Date(now.getTime() + (48 * 60 * 60 * 1000));
        const isAdmin = currentUser && currentUser.uid === adminUid;

        snapshot.forEach((docSnap) => {
            const task = docSnap.data();
            const taskId = docSnap.id;
            const taskDate = new Date(task.date);
            
            const isOrphan = (taskDate <= twoDaysFromNow && taskDate >= now && !task.assigneeId);
            const orphanClass = isOrphan ? 'border-red-500 border-2 orphan-alert' : 'border-gray-100 border';
            
            const isAssignee = task.assigneeId === currentUser.uid;
            const canEdit = isAssignee || isAdmin;
            
            let actionHtml = '';
            if (task.assigneeId) {
                if (isAssignee) {
                    actionHtml = `
                        <span class="text-green-600 font-semibold">✓ באחריותך</span>
                        <button class="btn-release text-red-500 text-xs mr-2 hover:underline" data-id="${taskId}">(ביטול בחירה)</button>
                    `;
                } else {
                    actionHtml = `<span class="text-green-600 font-semibold">✓ באחריות: ${task.assigneeName}</span>`;
                }
            } else {
                actionHtml = `<button class="btn-grab bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 text-sm font-semibold" data-id="${taskId}">🖐️ תפוס משימה</button>`;
            }
            
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
                    <div class="flex items-center space-x-2 space-x-reverse">
                        ${canEdit ? `<button class="btn-edit-task text-blue-500 hover:text-blue-700 text-sm" data-id="${taskId}">✎ ערוך</button>` : ''}
                        ${isAdmin ? `<button class="btn-delete-task text-red-500 hover:text-red-700 text-sm" data-id="${taskId}">🗑 מחק</button>` : ''}
                        <button class="btn-duplicate text-gray-400 hover:text-gray-700 text-sm mr-2" data-id="${taskId}" title="שכפל משימה">⧉ שכפל</button>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });

        document.querySelectorAll('.btn-grab').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                await updateDoc(doc(db, `${basePath}/care_tasks`, e.target.getAttribute('data-id')), {
                    assigneeId: currentUser.uid, assigneeName: currentUser.displayName
                });
            });
        });

        document.querySelectorAll('.btn-release').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                await updateDoc(doc(db, `${basePath}/care_tasks`, e.target.getAttribute('data-id')), {
                    assigneeId: null, assigneeName: null
                });
            });
        });

        document.querySelectorAll('.btn-edit-task').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                const taskRef = snapshot.docs.find(d => d.id === id).data();
                editingTaskId = id;
                
                document.getElementById('task-title').value = taskRef.title;
                document.getElementById('task-desc').value = taskRef.desc;
                document.getElementById('task-location').value = taskRef.location;
                document.getElementById('task-date').value = taskRef.date;
                
                document.getElementById('task-modal-title').textContent = "עריכת משימה";
                views.taskModal.classList.remove('hidden-view');
            });
        });

        document.querySelectorAll('.btn-delete-task').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if(confirm("למחוק משימה זו לצמיתות?")) {
                    await deleteDoc(doc(db, `${basePath}/care_tasks`, e.target.getAttribute('data-id')));
                }
            });
        });

        document.querySelectorAll('.btn-duplicate').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                const taskRef = snapshot.docs.find(d => d.id === id).data();
                editingTaskId = null; 
                
                document.getElementById('task-title').value = taskRef.title + " (העתק)";
                document.getElementById('task-desc').value = taskRef.desc;
                document.getElementById('task-location').value = taskRef.location;
                document.getElementById('task-date').value = "";
                
                document.getElementById('task-modal-title').textContent = "משימה חדשה (שכפול)";
                views.taskModal.classList.remove('hidden-view');
            });
        });
    });
}

// ==========================================
// === לוגיקת הוצאות ===
// ==========================================

document.getElementById('btn-add-expense-modal').addEventListener('click', () => {
    editingExpenseId = null;
    document.getElementById('expense-form').reset();
    document.getElementById('expense-modal-title').textContent = "הוצאה חדשה";
    views.expenseModal.classList.remove('hidden-view');
});
document.getElementById('btn-close-expense-modal').addEventListener('click', () => views.expenseModal.classList.add('hidden-view'));

document.getElementById('expense-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('expense-amount').value);
    const desc = document.getElementById('expense-desc').value;
    
    if (editingExpenseId) {
        // שימוש בנתיב המבודד
        await updateDoc(doc(db, `${basePath}/care_expenses`, editingExpenseId), { amount, desc });
    } else {
        // שימוש בנתיב המבודד
        await addDoc(collection(db, `${basePath}/care_expenses`), {
            amount, desc,
            paidById: currentUser.uid,
            paidByName: currentUser.displayName,
            date: new Date().toISOString()
        });
    }
    
    e.target.reset();
    views.expenseModal.classList.add('hidden-view');
});

function loadExpenses() {
    // שימוש בנתיב המבודד
    const q = query(collection(db, `${basePath}/care_expenses`), orderBy("date", "desc"));
    unsubscribeExpenses = onSnapshot(q, (snapshot) => {
        const listContainer = document.getElementById('expenses-list');
        listContainer.innerHTML = '';
        
        let totalExpenses = 0;
        const balances = {}; 
        const isAdmin = currentUser && currentUser.uid === adminUid;

        snapshot.forEach((docSnap) => {
            const exp = docSnap.data();
            const expId = docSnap.id;
            totalExpenses += exp.amount;
            
            if(!balances[exp.paidById]) balances[exp.paidById] = { name: exp.paidByName, paid: 0 };
            balances[exp.paidById].paid += exp.amount;

            const isOwner = exp.paidById === currentUser.uid;
            const canEdit = isOwner || isAdmin;

            listContainer.innerHTML += `
                <div class="bg-white p-3 rounded shadow-sm flex flex-col text-sm border-r-4 border-green-500">
                    <div class="flex justify-between items-center mb-1">
                        <div><span class="font-bold">${exp.desc}</span> <span class="text-gray-500">(${exp.paidByName})</span></div>
                        <div class="font-bold text-base">₪${exp.amount}</div>
                    </div>
                    <div class="flex items-center space-x-3 space-x-reverse text-xs mt-1 border-t pt-2 border-gray-50">
                        ${canEdit ? `<button class="btn-edit-expense text-blue-500 hover:underline" data-id="${expId}">✎ ערוך</button>` : ''}
                        ${isAdmin ? `<button class="btn-delete-expense text-red-500 hover:underline" data-id="${expId}">🗑 מחק</button>` : ''}
                    </div>
                </div>
            `;
        });

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

        document.querySelectorAll('.btn-edit-expense').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                const expRef = snapshot.docs.find(d => d.id === id).data();
                editingExpenseId = id;
                
                document.getElementById('expense-desc').value = expRef.desc;
                document.getElementById('expense-amount').value = expRef.amount;
                
                document.getElementById('expense-modal-title').textContent = "עריכת הוצאה";
                views.expenseModal.classList.remove('hidden-view');
            });
        });

        document.querySelectorAll('.btn-delete-expense').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if(confirm("למחוק הוצאה זו?")) {
                    await deleteDoc(doc(db, `${basePath}/care_expenses`, e.target.getAttribute('data-id')));
                }
            });
        });
    });
}