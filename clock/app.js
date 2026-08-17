import { auth, db, appId } from "./firebase-config.js";
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, doc, setDoc, addDoc, updateDoc, onSnapshot, deleteDoc, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- State Variables ---
let userId = null;
let clientsData = [];
let projectsData = [];
let entriesData = [];
let filteredReportData = [];
let globalVatRate = 18;
let unsubscribes = [];
let timerInterval = null;

// --- DOM Initialization & Lifecycle ---
window.addEventListener('DOMContentLoaded', () => {
    if (window.location.protocol === 'file:') {
        const loginContainer = document.querySelector('#login-screen .bg-white');
        if (loginContainer) {
            loginContainer.innerHTML += `<div class="mt-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">יש להריץ דרך שרת מקומי (localhost)</div>`;
        }
    }

    bindStaticEventListeners();

    onAuthStateChanged(auth, user => {
        if (user) {
            userId = user.uid;
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('app-content').classList.remove('hidden');
            document.getElementById('nav-menus').classList.replace('hidden', 'flex');
            document.getElementById('user-profile').classList.replace('hidden', 'flex');
            document.getElementById('user-name').innerText = user.displayName || 'משתמש';
            document.getElementById('user-avatar').src = user.photoURL || 'https://via.placeholder.com/150';

            initDateFields();
            initDashboardFilters();
            setReportDates('all', document.getElementById('btn-filter-all'));
            setupListeners();
            restoreActiveTimer();
        } else {
            userId = null;
            document.getElementById('login-screen').classList.remove('hidden');
            document.getElementById('app-content').classList.add('hidden');
            document.getElementById('nav-menus').classList.replace('flex', 'hidden');
            document.getElementById('user-profile').classList.replace('flex', 'hidden');
            cleanupData();
        }
    });

    window.addEventListener('online', () => {
        showToast("החיבור לאינטרנט חזר. מסנכרן נתונים...");
        if (userId) setupListeners();
    });

    window.addEventListener('offline', () => {
        showToast("אין חיבור לאינטרנט. המערכת תחזור להסתנכרן כשהחיבור יחזור.");
    });

    window.addEventListener('beforeunload', () => {
        cleanupData();
    });
});

// --- Subscription Lifecycle Management ---
function cleanupData() {
    unsubscribes.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
    });
    unsubscribes = [];
    clientsData = [];
    projectsData = [];
    entriesData = [];
    filteredReportData = [];

    const clientsList = document.getElementById('clients-list');
    const projectsList = document.getElementById('projects-list');
    const reportTableBody = document.getElementById('report-table-body');
    const dashBreakdown = document.getElementById('dash-hierarchical-breakdown');

    if (clientsList) clientsList.innerHTML = '';
    if (projectsList) projectsList.innerHTML = '';
    if (reportTableBody) reportTableBody.innerHTML = '';
    if (dashBreakdown) dashBreakdown.innerHTML = '';

    const hoursEl = document.getElementById('report-total-hours');
    const earningsEl = document.getElementById('report-total-earnings');
    const billedEl = document.getElementById('report-billed-earnings');
    const unbilledEl = document.getElementById('report-unbilled-earnings');
    if (hoursEl) hoursEl.innerText = "00:00";
    if (earningsEl) earningsEl.innerText = "₪0";
    if (billedEl) billedEl.innerText = "₪0";
    if (unbilledEl) unbilledEl.innerText = "₪0";
}

const getDbRef = (colName) => collection(db, 'artifacts', appId, 'users', userId, colName);

function setupListeners() {
    if (!userId) return;
    cleanupData();

    const handleSnapshotError = (e) => {
        console.error("Firebase network reconnecting...", e.message);
        setTimeout(() => { if (userId) setupListeners(); }, 4000);
    };

    unsubscribes.push(onSnapshot(doc(db, 'artifacts', appId, 'users', userId, 'settings', 'general'), (docSnap) => {
        if (docSnap.exists() && docSnap.data().vatRate !== undefined) {
            globalVatRate = docSnap.data().vatRate;
            document.getElementById('vatRateSetting').value = globalVatRate;
        }
        if (entriesData.length > 0) generateReport();
    }, handleSnapshotError));

    unsubscribes.push(onSnapshot(getDbRef('clients'), (snapshot) => {
        clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateClientsUI();
    }, handleSnapshotError));

    unsubscribes.push(onSnapshot(getDbRef('projects'), (snapshot) => {
        projectsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateProjectsUI();
    }, handleSnapshotError));

    unsubscribes.push(onSnapshot(getDbRef('entries'), (snapshot) => {
        entriesData = snapshot.docs.map(doc => {
            const data = doc.data();
            if (data.durationDec === undefined) {
                data.durationDec = (data.durationSeconds || 0) / 3600;
            }
            if (!data.startDate) {
                const d = data.date ? new Date(data.date) : new Date();
                data.startDate = d.toISOString().split('T')[0];
                data.startTime = d.toTimeString().substring(0, 5);
                data.endDate = data.startDate;
                data.endTime = data.startTime;
            }
            return { id: doc.id, ...data };
        });

        entriesData.sort((a, b) => new Date(`${b.startDate}T${b.startTime}`) - new Date(`${a.startDate}T${a.startTime}`));
        updateDashboardStats();
        generateReport();
    }, handleSnapshotError));
}

// --- Helper Functions ---
function getDurationDecimal(startD, startT, endD, endT) {
    if (!startD || !startT || !endD || !endT) return { sec: 0, dec: 0 };
    const start = new Date(`${startD}T${startT}`);
    const end = new Date(`${endD}T${endT}`);
    const diffSec = Math.max(0, (end - start) / 1000);
    return { sec: diffSec, dec: diffSec / 3600 };
}

function formatSeconds(sec, hideSeconds = false) {
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return hideSeconds ? `${h}:${m}` : `${h}:${m}:${s}`;
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-msg').innerText = msg;
    toast.classList.replace('translate-y-20', 'translate-y-0');
    toast.classList.replace('opacity-0', 'opacity-100');
    setTimeout(() => {
        toast.classList.replace('translate-y-0', 'translate-y-20');
        toast.classList.replace('opacity-100', 'opacity-0');
    }, 3000);
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(tabId);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-btn').forEach(el => {
        el.classList.remove('bg-indigo-700', 'text-white');
        el.classList.add('hover:bg-indigo-500');
    });
    const activeBtn = document.getElementById('nav-' + tabId);
    if (activeBtn) {
        activeBtn.classList.add('bg-indigo-700', 'text-white');
        activeBtn.classList.remove('hover:bg-indigo-500');
    }
}

function filterProjectsByClient(clientSelectId, projectSelectId, defaultText = '-- בחר פרויקט --') {
    const clientEl = document.getElementById(clientSelectId);
    const projSelect = document.getElementById(projectSelectId);
    if (!clientEl || !projSelect) return;

    projSelect.innerHTML = `<option value="">${defaultText}</option>`;
    if (clientEl.value) {
        projectsData.filter(p => p.clientId === clientEl.value).forEach(p => {
            projSelect.innerHTML += `<option value="${p.id}">${p.name}</option>`;
        });
        projSelect.disabled = false;
    } else {
        projSelect.disabled = true;
    }
}

function initDateFields() {
    const now = new Date();
    const offsetDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
    const dateStr = offsetDate.toISOString().split('T')[0];
    const timeStr = now.toTimeString().substring(0, 5);

    document.getElementById('manualStartDate').value = dateStr;
    document.getElementById('manualStartTime').value = timeStr;
    document.getElementById('manualEndDate').value = dateStr;
    document.getElementById('manualEndTime').value = timeStr;
    calcManualDuration();
}

function calcManualDuration() {
    const sd = document.getElementById('manualStartDate').value;
    const st = document.getElementById('manualStartTime').value;
    const ed = document.getElementById('manualEndDate').value;
    const et = document.getElementById('manualEndTime').value;
    const res = getDurationDecimal(sd, st, ed, et);
    document.getElementById('manualDurationDisplay').innerText = `סה"כ זמן: ${formatSeconds(res.sec, true)} (${res.dec.toFixed(2)} שעות עשרוניות)`;
}

// --- Dashboard Logic ---
function initDashboardFilters() {
    const select = document.getElementById('dashFilterSelect');
    const now = new Date();
    const currYear = now.getFullYear();
    const currMonth = now.getMonth();
    const hebrewMonths = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
    const prevMonthDate = new Date(currYear, currMonth - 1, 1);

    select.innerHTML = `
        <option value="currentMonth" selected>חודש נוכחי (${hebrewMonths[currMonth]} ${currYear})</option>
        <option value="prevMonth">חודש קודם (${hebrewMonths[prevMonthDate.getMonth()]} ${prevMonthDate.getFullYear()})</option>
        <option value="currentYear">שנה נוכחית (${currYear})</option>
        <option value="yearMinus1">שנת ${currYear - 1}</option>
        <option value="yearMinus2">שנת ${currYear - 2}</option>
        <option value="yearMinus3">שנת ${currYear - 3}</option>
        <option value="all">הכל (כל הזמנים)</option>
        <option value="custom">מותאם אישית...</option>
    `;
    handleDashFilterChange(false);
}

function handleDashFilterChange(triggerUpdate = true) {
    const val = document.getElementById('dashFilterSelect').value;
    const customDates = document.getElementById('dashCustomDates');
    const now = new Date();
    let start, end;

    customDates.classList.add('hidden');
    customDates.classList.remove('flex');

    if (val === 'currentMonth') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (val === 'prevMonth') {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (val === 'currentYear') {
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
    } else if (val === 'yearMinus1') {
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31);
    } else if (val === 'yearMinus2') {
        start = new Date(now.getFullYear() - 2, 0, 1);
        end = new Date(now.getFullYear() - 2, 11, 31);
    } else if (val === 'yearMinus3') {
        start = new Date(now.getFullYear() - 3, 0, 1);
        end = new Date(now.getFullYear() - 3, 11, 31);
    } else if (val === 'all') {
        document.getElementById('dashStartDate').value = '';
        document.getElementById('dashEndDate').value = '';
    } else if (val === 'custom') {
        customDates.classList.remove('hidden');
        customDates.classList.add('flex');
        if (triggerUpdate) updateDashboardStats();
        return;
    }

    if (start && end) {
        const offsetStart = new Date(start.getTime() - (start.getTimezoneOffset() * 60000));
        const offsetEnd = new Date(end.getTime() - (end.getTimezoneOffset() * 60000));
        document.getElementById('dashStartDate').value = offsetStart.toISOString().split('T')[0];
        document.getElementById('dashEndDate').value = offsetEnd.toISOString().split('T')[0];
    }

    if (triggerUpdate) updateDashboardStats();
}

function updateDashboardStats() {
    const startVal = document.getElementById('dashStartDate')?.value;
    const endVal = document.getElementById('dashEndDate')?.value;
    const startDate = startVal ? new Date(startVal).setHours(0,0,0,0) : null;
    const endDate = endVal ? new Date(endVal).setHours(23,59,59,999) : null;

    const selectEl = document.getElementById('dashFilterSelect');
    const titleText = selectEl && selectEl.selectedIndex > -1 ? selectEl.options[selectEl.selectedIndex].text : 'סיכום נתונים';
    document.getElementById('dash-main-title').innerText = `סיכום נתונים - ${titleText}`;

    let totalSeconds = 0;
    let totalEarnings = 0;
    const hierarchy = {};

    entriesData.forEach(entry => {
        const dTime = new Date(entry.startDate).getTime();
        if (startDate && dTime < startDate) return;
        if (endDate && dTime > endDate) return;

        totalSeconds += entry.durationSeconds;
        const client = clientsData.find(c => c.id === entry.clientId);
        const earnings = (client && client.hourlyRate) ? (entry.durationDec * client.hourlyRate) : 0;
        totalEarnings += earnings;

        const cId = entry.clientId || 'general';
        const cName = client ? client.name : 'ללא לקוח';
        const pId = entry.projectId || 'general_proj';
        const proj = projectsData.find(p => p.id === entry.projectId);
        const pName = proj ? proj.name : 'ללא פרויקט';

        if (!hierarchy[cId]) hierarchy[cId] = { name: cName, seconds: 0, earnings: 0, projects: {} };
        hierarchy[cId].seconds += entry.durationSeconds;
        hierarchy[cId].earnings += earnings;

        if (!hierarchy[cId].projects[pId]) hierarchy[cId].projects[pId] = { name: pName, seconds: 0, earnings: 0, budgetedHours: proj?.budgetedHours || 0 };
        hierarchy[cId].projects[pId].seconds += entry.durationSeconds;
        hierarchy[cId].projects[pId].earnings += earnings;
    });

    document.getElementById('dash-total-hours').innerText = formatSeconds(totalSeconds, true);
    document.getElementById('dash-total-earnings').innerText = '₪' + Math.round(totalEarnings).toLocaleString();

    const container = document.getElementById('dash-hierarchical-breakdown');
    container.innerHTML = '';

    const sortedClients = Object.values(hierarchy).sort((a, b) => b.earnings - a.earnings);
    if (sortedClients.length === 0) {
        container.innerHTML = '<p class="text-slate-400 text-center py-4">אין נתונים לתקופה זו</p>';
        return;
    }

    sortedClients.forEach(client => {
        let html = `
            <div class="mb-4 bg-white border border-slate-200 rounded p-4">
                <div class="flex justify-between items-end mb-3 border-b pb-2">
                    <span class="font-bold text-slate-800 text-lg"><i class="fas fa-building text-indigo-400 ml-2"></i>${client.name}</span>
                    <span class="text-indigo-600 font-bold">₪${Math.round(client.earnings).toLocaleString()} <span class="font-normal text-sm">(${formatSeconds(client.seconds, true)} שעות)</span></span>
                </div>
                <div class="space-y-4">
        `;

        Object.values(client.projects).forEach(proj => {
            const pHours = proj.seconds / 3600;
            let budgetHtml = '';
            if (proj.budgetedHours > 0) {
                const pct = Math.min(100, (pHours / proj.budgetedHours) * 100);
                const colorClass = pct > 90 ? 'bg-red-500' : (pct > 75 ? 'bg-amber-400' : 'bg-green-500');
                budgetHtml = `
                    <div class="mt-1">
                        <div class="flex justify-between text-xs text-slate-500 mb-1">
                            <span>נוצלו ${pHours.toFixed(1)} מתוך ${proj.budgetedHours} שעות</span>
                            <span class="font-bold">${pct.toFixed(1)}%</span>
                        </div>
                        <div class="w-full bg-slate-200 rounded-full h-1.5"><div class="${colorClass} h-1.5 rounded-full" style="width: ${pct}%"></div></div>
                    </div>
                `;
            }

            html += `
                <div class="bg-slate-50 p-3 rounded border border-slate-100">
                    <div class="flex justify-between text-sm items-center mb-1">
                        <span class="font-medium text-slate-700">${proj.name}</span>
                        <span class="text-slate-600">₪${Math.round(proj.earnings).toLocaleString()} (${pHours.toFixed(2)} שעות)</span>
                    </div>
                    ${budgetHtml}
                </div>
            `;
        });
        html += `</div></div>`;
        container.innerHTML += html;
    });
}

// --- UI Updaters ---
function updateClientsUI() {
    const selects = ['timerClientSelect', 'manualClientSelect', 'newProjectClient', 'filterClientSelect', 'editEntryClient'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const currentVal = el.value;
        el.innerHTML = `<option value="">-- בחר לקוח --</option>`;
        clientsData.forEach(c => { el.innerHTML += `<option value="${c.id}">${c.name}</option>`; });
        if (clientsData.find(c => c.id === currentVal)) el.value = currentVal;
    });

    const list = document.getElementById('clients-list');
    list.innerHTML = '';
    clientsData.forEach(c => {
        const rateText = c.hourlyRate ? `(₪${c.hourlyRate}/שעה)` : '';
        const kmRateText = c.kmRate ? `| (₪${c.kmRate}/ק"מ)` : '';
        list.innerHTML += `
            <li class="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span class="font-medium"><i class="fas fa-user text-indigo-400 ml-2"></i>${c.name} <span class="text-slate-500 text-xs font-normal">${rateText} ${kmRateText}</span></span>
                <div class="flex gap-3">
                    <button data-action="edit-client" data-id="${c.id}" class="text-slate-400 hover:text-indigo-600"><i class="fas fa-pen"></i></button>
                    <button data-action="delete-client" data-id="${c.id}" class="text-slate-400 hover:text-red-600"><i class="fas fa-trash"></i></button>
                </div>
            </li>`;
    });
    generateReport();
}

function updateProjectsUI() {
    const list = document.getElementById('projects-list');
    list.innerHTML = '';
    projectsData.forEach(p => {
        const client = clientsData.find(c => c.id === p.clientId);
        const budgetTxt = p.budgetedHours ? `| ${p.budgetedHours} שעות תקציב` : '';
        list.innerHTML += `
            <li class="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span class="font-medium"><i class="fas fa-folder text-indigo-400 ml-2"></i>${p.name} <span class="text-xs text-slate-500 font-normal">(${client ? client.name : '-'}) ${budgetTxt}</span></span>
                <div class="flex gap-3">
                    <button data-action="edit-project" data-id="${p.id}" class="text-slate-400 hover:text-indigo-600"><i class="fas fa-pen"></i></button>
                    <button data-action="delete-project" data-id="${p.id}" class="text-slate-400 hover:text-red-600"><i class="fas fa-trash"></i></button>
                </div>
            </li>`;
    });

    filterProjectsByClient('timerClientSelect', 'timerProjectSelect');
    filterProjectsByClient('manualClientSelect', 'manualProjectSelect');
    updateReportProjectFilter();
    updateDashboardStats();
    generateReport();
}

// --- Reports Logic ---
function setReportDates(preset, btnElement = null) {
    document.querySelectorAll('#reports .bg-slate-800, #reports .bg-indigo-50').forEach(btn => {
        btn.className = "preset-btn text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full hover:bg-indigo-100 transition";
    });
    if (btnElement) {
        btnElement.classList.replace('bg-indigo-50', 'bg-slate-800');
        btnElement.classList.replace('text-indigo-700', 'text-white');
    }

    const today = new Date();
    let start, end;

    if (preset === 'thisMonth') {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (preset === 'lastMonth') {
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
    } else if (preset === 'thisYear') {
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31);
    } else if (preset === 'all') {
        document.getElementById('filterStartDate').value = '';
        document.getElementById('filterEndDate').value = '';
        generateReport();
        return;
    }

    const offsetStart = new Date(start.getTime() - (start.getTimezoneOffset() * 60000));
    const offsetEnd = new Date(end.getTime() - (end.getTimezoneOffset() * 60000));
    document.getElementById('filterStartDate').value = offsetStart.toISOString().split('T')[0];
    document.getElementById('filterEndDate').value = offsetEnd.toISOString().split('T')[0];
    generateReport();
}

function updateReportProjectFilter() {
    const clientEl = document.getElementById('filterClientSelect');
    const projSelect = document.getElementById('filterProjectSelect');
    if (!clientEl || !projSelect) return;

    const clientId = clientEl.value;
    projSelect.innerHTML = ``;
    let relevantProjects = clientId ? projectsData.filter(p => p.clientId === clientId) : projectsData;

    relevantProjects.forEach(p => {
        projSelect.innerHTML += `<option value="${p.id}" class="p-1 cursor-pointer rounded mb-1">${p.name}</option>`;
    });
}

function generateReport() {
    const startVal = document.getElementById('filterStartDate').value;
    const endVal = document.getElementById('filterEndDate').value;
    const clientId = document.getElementById('filterClientSelect').value;
    const selectedProjects = Array.from(document.getElementById('filterProjectSelect').selectedOptions).map(opt => opt.value);
    const billedStatus = document.getElementById('filterBilledStatus')?.value || 'all';

    const startDate = startVal ? new Date(startVal).setHours(0,0,0,0) : null;
    const endDate = endVal ? new Date(endVal).setHours(23,59,59,999) : null;

    filteredReportData = entriesData.filter(entry => {
        const entryDate = new Date(entry.startDate).getTime();
        if (startDate && entryDate < startDate) return false;
        if (endDate && entryDate > endDate) return false;
        if (clientId && entry.clientId !== clientId) return false;
        if (selectedProjects.length > 0 && !selectedProjects.includes(entry.projectId || '')) return false;

        const hasInvoice = !!entry.invoiceReqNum;
        if (billedStatus === 'billed' && !hasInvoice) return false;
        if (billedStatus === 'unbilled' && hasInvoice) return false;

        return true;
    });

    const tbody = document.getElementById('report-table-body');
    tbody.innerHTML = '';

    let totalSeconds = 0;
    let totalEarnings = 0;
    let totalBilledEarnings = 0;
    let totalUnbilledEarnings = 0;

    const masterCheckbox = document.getElementById('selectAllEntries');
    if (masterCheckbox) masterCheckbox.checked = false;
    toggleBulkEditBtn();

    if (filteredReportData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="13" class="p-8 text-center text-slate-400">לא נמצאו רשומות</td></tr>';
    } else {
        filteredReportData.forEach(entry => {
            const client = clientsData.find(c => c.id === entry.clientId);
            const project = projectsData.find(p => p.id === entry.projectId);

            totalSeconds += entry.durationSeconds;
            let billableNet = 0;
            if (client && client.hourlyRate) billableNet = entry.durationDec * client.hourlyRate;

            const vatAmount = billableNet * (globalVatRate / 100);
            const totalGross = billableNet + vatAmount;
            totalEarnings += billableNet;

            const isBilled = !!entry.invoiceReqNum;
            if (isBilled) {
                totalBilledEarnings += billableNet;
            } else {
                totalUnbilledEarnings += billableNet;
            }

            const travelIcon = entry.travelKm > 0 ? `<i class="fas fa-car text-amber-500" title="${entry.travelDesc} (${entry.travelKm}km)"></i>` : '';
            const billedIcon = isBilled ? `<i class="fas fa-check text-green-500 text-lg" title="חשבונית עסקה: ${entry.invoiceReqNum}"></i>` : `<i class="fas fa-times text-red-500 text-lg" title="לא יצא חיוב"></i>`;

            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 transition";
            tr.innerHTML = `
                <td class="text-center"><input type="checkbox" class="entry-checkbox w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer" value="${entry.id}"></td>
                <td>
                    <div>${new Date(entry.startDate).toLocaleDateString('he-IL')}</div>
                    <div class="text-xs text-slate-400">${entry.startTime}</div>
                </td>
                <td class="font-medium">${client ? client.name : '-'}</td>
                <td>${project ? project.name : '-'}</td>
                <td class="text-slate-600 truncate max-w-[150px]" title="${entry.description || ''}">${entry.description || '-'}</td>
                <td dir="ltr" class="font-bold text-slate-700">${formatSeconds(entry.durationSeconds, true)}</td>
                <td class="text-indigo-600">${entry.durationDec.toFixed(2)}</td>
                <td>₪${billableNet.toFixed(2)}</td>
                <td class="text-slate-400 text-xs">₪${vatAmount.toFixed(2)}</td>
                <td class="font-bold text-green-700">₪${totalGross.toFixed(2)}</td>
                <td class="text-center">${travelIcon}</td>
                <td class="text-center">${billedIcon}</td>
                <td class="text-center flex justify-center gap-4 sm:gap-6">
                    <button data-action="edit-entry" data-id="${entry.id}" class="text-indigo-500 hover:text-indigo-700 hover:bg-indigo-100 p-2 rounded-full transition-colors" title="ערוך דיווח"><i class="fas fa-edit text-lg"></i></button>
                    <button data-action="delete-entry" data-id="${entry.id}" class="text-red-500 hover:text-red-700 hover:bg-red-100 p-2 rounded-full transition-colors" title="מחק דיווח"><i class="fas fa-trash text-lg"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    const hoursEl = document.getElementById('report-total-hours');
    const earningsEl = document.getElementById('report-total-earnings');
    const billedEl = document.getElementById('report-billed-earnings');
    const unbilledEl = document.getElementById('report-unbilled-earnings');

    if (hoursEl) hoursEl.innerText = formatSeconds(totalSeconds, true);
    if (earningsEl) earningsEl.innerText = '₪' + Math.round(totalEarnings).toLocaleString();
    if (billedEl) billedEl.innerText = '₪' + Math.round(totalBilledEarnings).toLocaleString();
    if (unbilledEl) unbilledEl.innerText = '₪' + Math.round(totalUnbilledEarnings).toLocaleString();
}

function toggleBulkEditBtn() {
    const selected = document.querySelectorAll('.entry-checkbox:checked');
    const btn = document.getElementById('bulkEditBtn');
    const badge = document.getElementById('selectedCountBadge');

    if (badge) badge.innerText = selected.length;

    if (selected.length > 0) {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
        const master = document.getElementById('selectAllEntries');
        if (master) master.checked = false;
    }
}

// --- Modal Handlers & Actions ---
async function addClient() {
    const name = document.getElementById('newClientName').value.trim();
    const rate = document.getElementById('newClientRate').value;
    const kmRate = document.getElementById('newClientKmRate').value;
    if (!name) return showToast("חובה להזין שם לקוח");

    await addDoc(getDbRef('clients'), {
        name,
        hourlyRate: rate ? Number(rate) : 0,
        kmRate: kmRate ? Number(kmRate) : 0,
        createdAt: serverTimestamp()
    });
    document.getElementById('newClientName').value = '';
    document.getElementById('newClientRate').value = '';
    document.getElementById('newClientKmRate').value = '';
    showToast("לקוח נוסף בהצלחה");
}

function editClientPrompt(id) {
    const client = clientsData.find(c => c.id === id);
    if (!client) return;
    document.getElementById('editClientId').value = client.id;
    document.getElementById('editClientName').value = client.name || '';
    document.getElementById('editClientRate').value = client.hourlyRate || 0;
    document.getElementById('editClientKmRate').value = client.kmRate || 0;
    document.getElementById('edit-client-modal').classList.remove('hidden');
}

function closeClientModal() {
    document.getElementById('edit-client-modal').classList.add('hidden');
}

async function saveClientEdit() {
    const id = document.getElementById('editClientId').value;
    const newName = document.getElementById('editClientName').value.trim();
    const newRate = Number(document.getElementById('editClientRate').value) || 0;
    const newKmRate = Number(document.getElementById('editClientKmRate').value) || 0;

    if (!newName) return showToast("שם לקוח לא יכול להיות ריק");

    await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'clients', id), {
        name: newName,
        hourlyRate: newRate,
        kmRate: newKmRate
    });
    closeClientModal();
    showToast("לקוח עודכן בהצלחה");
}

async function addProject() {
    const clientId = document.getElementById('newProjectClient').value;
    const name = document.getElementById('newProjectName').value.trim();
    const budget = document.getElementById('newProjectBudget').value;
    if (!clientId || !name) return showToast("חובה לבחור לקוח ולהזין שם");

    await addDoc(getDbRef('projects'), {
        clientId, name,
        budgetedHours: budget ? Number(budget) : 0,
        createdAt: serverTimestamp()
    });
    document.getElementById('newProjectName').value = '';
    document.getElementById('newProjectBudget').value = '';
    showToast("פרויקט נוסף בהצלחה");
}

function editProjectPrompt(id) {
    const p = projectsData.find(x => x.id === id);
    if (!p) return;
    document.getElementById('editProjectId').value = p.id;
    document.getElementById('editProjectName').value = p.name || '';
    document.getElementById('editProjectBudget').value = p.budgetedHours || 0;
    document.getElementById('edit-project-modal').classList.remove('hidden');
}

function closeProjectModal() {
    document.getElementById('edit-project-modal').classList.add('hidden');
}

async function saveProjectEdit() {
    const id = document.getElementById('editProjectId').value;
    const newName = document.getElementById('editProjectName').value.trim();
    const newBud = Number(document.getElementById('editProjectBudget').value) || 0;

    if (!newName) return showToast("שם פרויקט לא יכול להיות ריק");

    await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'projects', id), {
        name: newName,
        budgetedHours: newBud
    });
    closeProjectModal();
    showToast("פרויקט עודכן בהצלחה");
}

async function deleteDocById(collectionName, id) {
    if (confirm("למחוק רשומה זו? (לא ניתן לשחזר)")) {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, collectionName, id));
        showToast("נמחק בהצלחה");
    }
}

async function saveManualEntry() {
    const startDate = document.getElementById('manualStartDate').value;
    const startTime = document.getElementById('manualStartTime').value;
    const endDate = document.getElementById('manualEndDate').value;
    const endTime = document.getElementById('manualEndTime').value;
    const clientId = document.getElementById('manualClientSelect').value;
    const projectId = document.getElementById('manualProjectSelect').value;
    const desc = document.getElementById('manualDesc').value.trim();
    const travelDesc = document.getElementById('manualTravelDesc').value.trim();
    const travelKm = Number(document.getElementById('manualTravelKm').value) || 0;

    if (!startDate || !startTime || !endDate || !endTime || !clientId || !projectId) {
        return showToast("חובה למלא לקוח, פרויקט וזמנים תקינים.");
    }

    const res = getDurationDecimal(startDate, startTime, endDate, endTime);
    if (res.sec <= 0) return showToast("תאריך/שעת הסיום חייבים להיות אחרי ההתחלה.");

    await addDoc(getDbRef('entries'), {
        startDate, startTime, endDate, endTime,
        durationSeconds: res.sec,
        durationDec: res.dec,
        clientId, projectId, description: desc,
        travelDesc, travelKm,
        entryType: 'manual',
        createdAt: serverTimestamp()
    });

    document.getElementById('manualDesc').value = '';
    document.getElementById('manualTravelDesc').value = '';
    document.getElementById('manualTravelKm').value = '';
    initDateFields();
    showToast("רשומה נשמרה בהצלחה");
}

function openEditModal(entryId) {
    const entry = entriesData.find(e => e.id === entryId);
    if (!entry) return;

    document.getElementById('editEntryId').value = entry.id;
    document.getElementById('editStartDate').value = entry.startDate;
    document.getElementById('editStartTime').value = entry.startTime;
    document.getElementById('editEndDate').value = entry.endDate || entry.startDate;
    document.getElementById('editEndTime').value = entry.endTime || entry.startTime;

    document.getElementById('editEntryClient').value = entry.clientId;
    filterProjectsByClient('editEntryClient', 'editEntryProject');
    document.getElementById('editEntryProject').value = entry.projectId;

    document.getElementById('editEntryDesc').value = entry.description || '';
    document.getElementById('editTravelDesc').value = entry.travelDesc || '';
    document.getElementById('editTravelKm').value = entry.travelKm || 0;

    document.getElementById('editInvoiceReqNum').value = entry.invoiceReqNum || '';
    document.getElementById('editInvoiceReceiptNum').value = entry.invoiceReceiptNum || '';

    document.getElementById('edit-entry-modal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('edit-entry-modal').classList.add('hidden');
}

async function saveEditEntry() {
    const id = document.getElementById('editEntryId').value;
    const startDate = document.getElementById('editStartDate').value;
    const startTime = document.getElementById('editStartTime').value;
    const endDate = document.getElementById('editEndDate').value;
    const endTime = document.getElementById('editEndTime').value;
    const clientId = document.getElementById('editEntryClient').value;
    const projectId = document.getElementById('editEntryProject').value;
    const desc = document.getElementById('editEntryDesc').value.trim();
    const travelDesc = document.getElementById('editTravelDesc').value.trim();
    const travelKm = Number(document.getElementById('editTravelKm').value) || 0;
    const invoiceReqNum = document.getElementById('editInvoiceReqNum').value.trim();
    const invoiceReceiptNum = document.getElementById('editInvoiceReceiptNum').value.trim();

    if (!startDate || !endDate || !clientId || !projectId) return showToast("חובה למלא לקוח, פרויקט וזמנים תקינים");

    const res = getDurationDecimal(startDate, startTime, endDate, endTime);
    if (res.sec <= 0) return showToast("זמנים שגויים: סיום חייב להיות אחרי התחלה");

    await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'entries', id), {
        startDate, startTime, endDate, endTime,
        durationSeconds: res.sec, durationDec: res.dec,
        clientId, projectId, description: desc,
        travelDesc, travelKm,
        invoiceReqNum, invoiceReceiptNum
    });

    closeEditModal();
    showToast("רשומה עודכנה");
}

// --- Live Timer Logic ---
function restoreActiveTimer() {
    const stored = localStorage.getItem('timerData');
    if (stored) {
        const data = JSON.parse(stored);
        document.getElementById('timerClientSelect').value = data.clientId;
        filterProjectsByClient('timerClientSelect', 'timerProjectSelect');
        document.getElementById('timerProjectSelect').value = data.projectId;
        document.getElementById('timerDesc').value = data.desc;
        startTimerUIInterval(data.startTs);
    }
}

function startAutoTimer() {
    const clientId = document.getElementById('timerClientSelect').value;
    const projectId = document.getElementById('timerProjectSelect').value;
    const desc = document.getElementById('timerDesc').value;

    if (!clientId || !projectId) return showToast("חובה לבחור לקוח ופרויקט!");

    const startTs = Date.now();
    localStorage.setItem('timerData', JSON.stringify({ startTs, clientId, projectId, desc }));
    startTimerUIInterval(startTs);
}

function startTimerUIInterval(startTs) {
    document.getElementById('timerClientSelect').disabled = true;
    document.getElementById('timerProjectSelect').disabled = true;
    document.getElementById('timerDesc').disabled = true;

    document.getElementById('startTimerBtn').classList.add('hidden');
    document.getElementById('stopTimerBtn').classList.remove('hidden');
    document.getElementById('live-indicator').classList.remove('hidden');
    document.getElementById('live-indicator').classList.replace('opacity-0', 'opacity-100');
    document.getElementById('global-timer').classList.remove('hidden');

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const sec = Math.floor((Date.now() - startTs) / 1000);
        const timeStr = formatSeconds(sec);
        document.getElementById('timerDisplay').innerText = timeStr;
        document.getElementById('global-timer-time').innerText = timeStr;
    }, 1000);
}

function stopAutoTimer() {
    clearInterval(timerInterval);

    const stored = localStorage.getItem('timerData');
    if (!stored) return;
    const data = JSON.parse(stored);

    const startD = new Date(data.startTs);
    const endD = new Date();

    document.getElementById('timerStartDate').value = startD.toISOString().split('T')[0];
    document.getElementById('timerStartTime').value = startD.toTimeString().substring(0, 5);
    document.getElementById('timerEndDate').value = endD.toISOString().split('T')[0];
    document.getElementById('timerEndTime').value = endD.toTimeString().substring(0, 5);

    document.getElementById('timerTravelDesc').value = '';
    document.getElementById('timerTravelKm').value = '';

    document.getElementById('stopTimerBtn').classList.add('hidden');
    document.getElementById('timer-finalize-section').classList.remove('hidden');
    document.getElementById('live-indicator').classList.replace('opacity-100', 'opacity-0');
    document.getElementById('global-timer').classList.add('hidden');
}

function cancelAutoTimer() {
    localStorage.removeItem('timerData');
    resetTimerUI();
    showToast("טיימר בוטל");
}

async function saveAutoTimer() {
    const stored = localStorage.getItem('timerData');
    if (!stored) return resetTimerUI();
    const data = JSON.parse(stored);

    const startDate = document.getElementById('timerStartDate').value;
    const startTime = document.getElementById('timerStartTime').value;
    const endDate = document.getElementById('timerEndDate').value;
    const endTime = document.getElementById('timerEndTime').value;
    const travelDesc = document.getElementById('timerTravelDesc').value.trim();
    const travelKm = Number(document.getElementById('timerTravelKm').value) || 0;

    const res = getDurationDecimal(startDate, startTime, endDate, endTime);
    if (res.sec < 60) {
        if (!confirm("משך העבודה פחות מדקה. לשמור בכל זאת?")) return cancelAutoTimer();
    }

    await addDoc(getDbRef('entries'), {
        startDate, startTime, endDate, endTime,
        durationSeconds: res.sec, durationDec: res.dec,
        clientId: data.clientId, projectId: data.projectId, description: data.desc,
        travelDesc, travelKm,
        entryType: 'auto',
        createdAt: serverTimestamp()
    });

    localStorage.removeItem('timerData');
    resetTimerUI();
    showToast("עבודה נשמרה בהצלחה בענן");
}

function resetTimerUI() {
    document.getElementById('timerClientSelect').disabled = false;
    document.getElementById('timerClientSelect').value = "";
    filterProjectsByClient('timerClientSelect', 'timerProjectSelect');
    document.getElementById('timerProjectSelect').disabled = false;
    document.getElementById('timerDesc').disabled = false;
    document.getElementById('timerDesc').value = "";
    document.getElementById('timerDisplay').innerText = "00:00:00";
    document.getElementById('global-timer-time').innerText = "00:00:00";

    document.getElementById('startTimerBtn').classList.remove('hidden');
    document.getElementById('stopTimerBtn').classList.add('hidden');
    document.getElementById('timer-finalize-section').classList.add('hidden');
    document.getElementById('live-indicator').classList.add('hidden');
    document.getElementById('global-timer').classList.add('hidden');
}

// --- Excel Export & Bulk Edit Logic ---
function exportToExcel() {
    if (filteredReportData.length === 0) return showToast("אין נתונים בסינון הנוכחי לייצוא");

    const wb = XLSX.utils.book_new();
    const wsData = [];

    wsData.push(["Customer", "Project", "Description", "Start Date", "Start Time", "End Date", "End Time", "Duration (h)", "Duration (decimal)", "Billable Rate (NIS)", "Billable Amount (NIS)", "מעמ", "חיוב כולל מעמ", "חשבונית עסקה", "חשבונית מס קבלה"]);

    let grandDec = 0, grandBill = 0, grandVat = 0, grandTotal = 0;

    const projectsGroup = {};
    filteredReportData.forEach(entry => {
        const pId = entry.projectId || 'none';
        if (!projectsGroup[pId]) projectsGroup[pId] = [];
        projectsGroup[pId].push(entry);
    });

    for (const pId in projectsGroup) {
        let pDec = 0, pBill = 0, pVat = 0, pTotal = 0;

        projectsGroup[pId].forEach(entry => {
            const client = clientsData.find(c => c.id === entry.clientId);
            const project = projectsData.find(p => p.id === entry.projectId);

            const rate = client ? (client.hourlyRate || 0) : 0;
            const billNet = entry.durationDec * rate;
            const vat = billNet * (globalVatRate / 100);
            const totalGross = billNet + vat;

            pDec += entry.durationDec;
            pBill += billNet;
            pVat += vat;
            pTotal += totalGross;

            wsData.push([
                client ? client.name : '-',
                project ? project.name : '-',
                entry.description || '',
                new Date(entry.startDate).toLocaleDateString('he-IL'),
                entry.startTime,
                new Date(entry.endDate).toLocaleDateString('he-IL'),
                entry.endTime,
                formatSeconds(entry.durationSeconds, true),
                Number(entry.durationDec.toFixed(2)),
                rate,
                Number(billNet.toFixed(2)),
                Number(vat.toFixed(2)),
                Number(totalGross.toFixed(2)),
                entry.invoiceReqNum || '',
                entry.invoiceReceiptNum || ''
            ]);
        });

        grandDec += pDec; grandBill += pBill; grandVat += pVat; grandTotal += pTotal;
        wsData.push(["", "סה\"כ לפרויקט:", "", "", "", "", "", "", Number(pDec.toFixed(2)), "", Number(pBill.toFixed(2)), Number(pVat.toFixed(2)), Number(pTotal.toFixed(2)), "", ""]);
    }

    wsData.push([]);
    wsData.push(["סה\"כ עבודה כולל:", "", "", "", "", "", "", "", Number(grandDec.toFixed(2)), "", Number(grandBill.toFixed(2)), Number(grandVat.toFixed(2)), Number(grandTotal.toFixed(2)), "", ""]);
    wsData.push([]);
    wsData.push([]);

    const travelEntries = filteredReportData.filter(e => e.travelKm > 0);
    if (travelEntries.length > 0) {
        wsData.push(["לקוח", "פרויקט", "תיאור הנסיעה", "תאריך", "שעה", "ק\"מ", "תעריף לק\"מ", "סה\"כ לפני מעמ", "סה\"כ כולל מעמ"]);
        let tGrandNet = 0, tGrandGross = 0;

        travelEntries.forEach(entry => {
            const client = clientsData.find(c => c.id === entry.clientId);
            const project = projectsData.find(p => p.id === entry.projectId);
            const kmRate = client ? (client.kmRate || 0) : 0;
            const net = entry.travelKm * kmRate;
            const gross = net * (1 + (globalVatRate/100));

            tGrandNet += net;
            tGrandGross += gross;

            wsData.push([
                client ? client.name : '-',
                project ? project.name : '-',
                entry.travelDesc || '-',
                new Date(entry.startDate).toLocaleDateString('he-IL'),
                entry.startTime,
                entry.travelKm,
                kmRate,
                Number(net.toFixed(2)),
                Number(gross.toFixed(2))
            ]);
        });
        wsData.push(["סה\"כ נסיעות:", "", "", "", "", "", "", Number(tGrandNet.toFixed(2)), Number(tGrandGross.toFixed(2))]);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    if (!ws['!dir']) ws['!dir'] = 'rtl';
    XLSX.utils.book_append_sheet(wb, ws, "דוח מרכז");

    XLSX.writeFile(wb, `TimeTracker_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast("דוח מקצועי הופק בהצלחה!");
}

async function saveBulkInvoiceEdit(selectedEntryIds, invoiceReqNum, invoiceReceiptNum) {
    if (!selectedEntryIds || selectedEntryIds.length === 0) {
        showToast("לא נבחרו רשומות לעריכה");
        return;
    }

    const updateData = {};
    if (invoiceReqNum.trim() !== "") updateData.invoiceReqNum = invoiceReqNum.trim();
    if (invoiceReceiptNum.trim() !== "") updateData.invoiceReceiptNum = invoiceReceiptNum.trim();

    if (Object.keys(updateData).length === 0) {
        showToast("לא הוכנסו נתונים לעדכון מרוכז");
        return;
    }

    try {
        const chunkSize = 500;
        for (let i = 0; i < selectedEntryIds.length; i += chunkSize) {
            const chunk = selectedEntryIds.slice(i, i + chunkSize);
            const batch = writeBatch(db);

            chunk.forEach(id => {
                const docRef = doc(db, 'artifacts', appId, 'users', userId, 'entries', id);
                batch.update(docRef, updateData);
            });

            await batch.commit();
        }
        showToast(`עודכנו בהצלחה ${selectedEntryIds.length} רשומות עבודה`);
    } catch (error) {
        console.error("Error in bulk update:", error);
        showToast("שגיאה בעדכון מרוכז של הרשומות.");
    }
}

// --- Global DOM Event Bindings ---
function bindStaticEventListeners() {
    // Auth & Global Nav
    document.getElementById('google-login-btn')?.addEventListener('click', async () => {
        try {
            await signInWithPopup(auth, new GoogleAuthProvider());
        } catch (error) {
            showToast("שגיאה בהתחברות.");
        }
    });

    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await signOut(auth);
        cleanupData();
        localStorage.clear();
        window.location.reload();
    });

    document.getElementById('global-timer')?.addEventListener('click', () => switchTab('tracker'));

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            if (tab) switchTab(tab);
        });
    });

    // Dashboard Filters
    document.getElementById('dashFilterSelect')?.addEventListener('change', () => handleDashFilterChange(true));
    document.getElementById('dashStartDate')?.addEventListener('change', updateDashboardStats);
    document.getElementById('dashEndDate')?.addEventListener('change', updateDashboardStats);

    // Live Timer
    document.getElementById('timerClientSelect')?.addEventListener('change', () => filterProjectsByClient('timerClientSelect', 'timerProjectSelect'));
    document.getElementById('startTimerBtn')?.addEventListener('click', startAutoTimer);
    document.getElementById('stopTimerBtn')?.addEventListener('click', stopAutoTimer);
    document.getElementById('cancelAutoTimerBtn')?.addEventListener('click', cancelAutoTimer);
    document.getElementById('saveAutoTimerBtn')?.addEventListener('click', saveAutoTimer);

    // Manual Entry
    document.getElementById('manualClientSelect')?.addEventListener('change', () => filterProjectsByClient('manualClientSelect', 'manualProjectSelect'));
    document.querySelectorAll('.manual-time-input').forEach(input => {
        input.addEventListener('change', calcManualDuration);
    });
    document.getElementById('saveManualEntryBtn')?.addEventListener('click', saveManualEntry);

    // Reports Filters & Presets
    document.getElementById('report-preset-buttons')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.preset-btn');
        if (btn && btn.dataset.preset) {
            setReportDates(btn.dataset.preset, btn);
        }
    });
    document.getElementById('filterStartDate')?.addEventListener('change', generateReport);
    document.getElementById('filterEndDate')?.addEventListener('change', generateReport);
    document.getElementById('filterClientSelect')?.addEventListener('change', () => {
        updateReportProjectFilter();
        generateReport();
    });
    document.getElementById('filterProjectSelect')?.addEventListener('change', generateReport);
    document.getElementById('clearProjectSelectionBtn')?.addEventListener('click', () => {
        document.getElementById('filterProjectSelect').selectedIndex = -1;
        generateReport();
    });
    document.getElementById('filterBilledStatus')?.addEventListener('change', generateReport);

    // Reports Actions
    document.getElementById('exportExcelBtn')?.addEventListener('click', exportToExcel);
    document.getElementById('selectAllEntries')?.addEventListener('click', (e) => {
        const master = e.target;
        document.querySelectorAll('.entry-checkbox').forEach(cb => cb.checked = master.checked);
        toggleBulkEditBtn();
    });

    document.getElementById('report-table-body')?.addEventListener('change', (e) => {
        if (e.target.classList.contains('entry-checkbox')) {
            toggleBulkEditBtn();
        }
    });

    document.getElementById('report-table-body')?.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const id = btn.dataset.id;

        if (action === 'edit-entry') openEditModal(id);
        if (action === 'delete-entry') deleteDocById('entries', id);
    });

    // Bulk Edit Modal
    document.getElementById('bulkEditBtn')?.addEventListener('click', () => {
        const selected = document.querySelectorAll('.entry-checkbox:checked');
        document.getElementById('bulkEditCount').innerText = selected.length;
        document.getElementById('bulkInvoiceReqNum').value = '';
        document.getElementById('bulkInvoiceReceiptNum').value = '';
        document.getElementById('bulk-edit-modal').classList.remove('hidden');
    });

    const closeBulkModal = () => document.getElementById('bulk-edit-modal').classList.add('hidden');
    document.getElementById('closeBulkEditXBtn')?.addEventListener('click', closeBulkModal);
    document.getElementById('closeBulkEditBtn')?.addEventListener('click', closeBulkModal);

    document.getElementById('executeBulkEditBtn')?.addEventListener('click', async () => {
        const selectedIds = Array.from(document.querySelectorAll('.entry-checkbox:checked')).map(cb => cb.value);
        const reqNum = document.getElementById('bulkInvoiceReqNum').value;
        const receiptNum = document.getElementById('bulkInvoiceReceiptNum').value;
        await saveBulkInvoiceEdit(selectedIds, reqNum, receiptNum);
        closeBulkModal();
    });

    // Manage Settings (Clients & Projects)
    document.getElementById('vatRateSetting')?.addEventListener('change', async (e) => {
        const val = Number(e.target.value);
        if (val >= 0) {
            await setDoc(doc(db, 'artifacts', appId, 'users', userId, 'settings', 'general'), { vatRate: val }, { merge: true });
            showToast("אחוז מע\"מ עודכן בהצלחה");
        }
    });

    document.getElementById('addClientBtn')?.addEventListener('click', addClient);
    document.getElementById('addProjectBtn')?.addEventListener('click', addProject);

    document.getElementById('clients-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === 'edit-client') editClientPrompt(id);
        if (action === 'delete-client') deleteDocById('clients', id);
    });

    document.getElementById('projects-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === 'edit-project') editProjectPrompt(id);
        if (action === 'delete-project') deleteDocById('projects', id);
    });

    // Edit Client Modal
    document.getElementById('closeEditClientXBtn')?.addEventListener('click', closeClientModal);
    document.getElementById('closeEditClientBtn')?.addEventListener('click', closeClientModal);
    document.getElementById('saveClientEditBtn')?.addEventListener('click', saveClientEdit);

    // Edit Project Modal
    document.getElementById('closeEditProjectXBtn')?.addEventListener('click', closeProjectModal);
    document.getElementById('closeEditProjectBtn')?.addEventListener('click', closeProjectModal);
    document.getElementById('saveProjectEditBtn')?.addEventListener('click', saveProjectEdit);

    // Edit Entry Modal
    document.getElementById('editEntryClient')?.addEventListener('change', () => {
        filterProjectsByClient('editEntryClient', 'editEntryProject', '-- בחר פרויקט --');
    });
    document.getElementById('closeEditEntryXBtn')?.addEventListener('click', closeEditModal);
    document.getElementById('closeEditEntryBtn')?.addEventListener('click', closeEditModal);
    document.getElementById('saveEditEntryBtn')?.addEventListener('click', saveEditEntry);
}