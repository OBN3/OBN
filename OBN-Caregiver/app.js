import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// === הגדרות Firebase ===
// יש להחליף בנתונים מ-Firebase Console
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// === משתנים גלובליים ===
let currentUser = null;
const adminUid = "YOUR_ADMIN_UID_HERE"; // החלף ב-UID של חשבון הגוגל שלך

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
        
        // חשיפת כפתור אדמין אם זה אתה
        if (user.uid === adminUid) {
            document.getElementById('nav-admin').classList.remove('hidden');
        }
        
        loadTasks();
        loadExpenses();
    } else {
        currentUser = null;
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
    
    await addDoc(collection(db, "tasks"), taskData);
    e.target.reset();
    views.taskModal.classList.add('hidden-view');
});

function loadTasks() {
    const q = query(collection(db, "tasks"), orderBy("date", "asc"));
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('tasks-container');
        container.innerHTML = '';
        
        const now = new Date();
        const twoDaysFromNow = new Date(now.getTime() + (48 * 60 * 60 * 1000));

        snapshot.forEach((docSnap) => {
            const task = docSnap.data();
            const taskId = docSnap.id;
            const taskDate = new Date(task.date);
            
            // זיהוי "משימה יתומה" (פחות מ-48 שעות ואין assignee)
            const isOrphan = (taskDate <= twoDaysFromNow && taskDate >= now && !task.assigneeId);
            const orphanClass = isOrphan ? 'border-red-500 border-2 orphan-alert' : 'border-gray-100 border';
            
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
                    <div class="text-sm">
                        ${task.assigneeId ? 
                            `<span class="text-green-600 font-semibold">✓ באחריות: ${task.assigneeName}</span>` : 
                            `<button class="btn-grab bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 text-sm font-semibold" data-id="${taskId}">🖐️ תפוס משימה</button>`
                        }
                    </div>
                    <button class="btn-duplicate text-gray-400 hover:text-gray-700" data-id="${taskId}" title="שכפל משימה">⧉</button>
                </div>
            `;
            container.appendChild(div);
        });

        // חיבור אירועים דינמיים
        document.querySelectorAll('.btn-grab').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                await updateDoc(doc(db, "tasks", id), {
                    assigneeId: currentUser.uid,
                    assigneeName: currentUser.displayName
                });
            });
        });

        document.querySelectorAll('.btn-duplicate').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const taskRef = snapshot.docs.find(d => d.id === id).data();
                
                // מילוי הטופס בנתוני המשימה המקורית
                document.getElementById('task-title').value = taskRef.title + " (העתק)";
                document.getElementById('task-desc').value = taskRef.desc;
                document.getElementById('task-location').value = taskRef.location;
                document.getElementById('task-date').value = ""; // משאירים ריק לבחירה מחדש
                views.taskModal.classList.remove('hidden-view');
            });
        });
    });
}

// === לוגיקת הוצאות (Settle Up) ===
document.getElementById('btn-add-expense').addEventListener('click', async () => {
    const amount = prompt("הזן סכום (בשקלים):");
    if (!amount || isNaN(amount)) return;
    
    const desc = prompt("על מה ההוצאה? (למשל: סופרמרקט)");
    if (!desc) return;

    await addDoc(collection(db, "expenses"), {
        amount: parseFloat(amount),
        desc: desc,
        paidById: currentUser.uid,
        paidByName: currentUser.displayName,
        date: new Date().toISOString()
    });
});

function loadExpenses() {
    const q = query(collection(db, "expenses"), orderBy("date", "desc"));
    onSnapshot(q, (snapshot) => {
        const listContainer = document.getElementById('expenses-list');
        listContainer.innerHTML = '';
        
        let totalExpenses = 0;
        const balances = {}; // { uid: { name, paid: amount } }

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

        // חישוב התחשבנות בין אחים (בהנחה של 3 אחים, אפשר לשנות דינמית לפי כמות היוזרים)
        const activeBrothers = Object.keys(balances).length > 0 ? 3 : 1; // קבוע ל-3 לצורך הדוגמה
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