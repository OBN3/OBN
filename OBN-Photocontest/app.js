const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxN0Gin2H0LYHuUSGLN_v4CRomuaiGkJwv9QjAKu_KtCxPeikWYWB9OECszGiXWefPS/exec";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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
const provider = new GoogleAuthProvider();

// פונקציה חכמה להצגת הודעות מערכת קופצות למשתמש
window.showMessageModal = function(type, title, message) {
    const modal = document.getElementById('messageModal');
    const icon = document.getElementById('msgIcon');
    const titleEl = document.getElementById('msgTitle');
    const textEl = document.getElementById('msgText');
    const btn = document.getElementById('msgBtn');

    titleEl.innerText = title;
    textEl.innerText = message;

    if (type === 'success') {
        icon.innerText = '🎉';
        btn.className = 'msg-btn success';
        btn.innerText = 'מעולה, תודה!';
    } else if (type === 'error') {
        icon.innerText = '⚠️';
        btn.className = 'msg-btn error';
        btn.innerText = 'הבנתי, אחזור לתקן';
    }

    modal.style.display = 'flex';
};

// סגירת חלון ההודעות
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('msgBtn').addEventListener('click', () => {
        document.getElementById('messageModal').style.display = 'none';
    });
});

// מנגנוני טופס דינמיים
document.addEventListener('DOMContentLoaded', () => {
    const textarea = document.getElementById('photoDescription');
    const counter = document.getElementById('wordCounter');
    if (textarea) {
        textarea.addEventListener('input', () => {
            let words = textarea.value.trim().split(/\s+/).filter(w => w.length > 0);
            if (words.length > 70) {
                textarea.value = words.slice(0, 70).join(" ");
                words = words.slice(0, 70);
            }
            counter.innerText = `${words.length} / 70 מילים`;
        });
    }

    const pdfContainer = document.getElementById('pdfUploadContainer');
    const consentFileInput = document.getElementById('consentFile');
    const radioButtons = document.querySelectorAll('input[name="identifiablePerson"]');
    radioButtons.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'patients') {
                pdfContainer.style.display = 'block';
                consentFileInput.required = true;
            } else {
                pdfContainer.style.display = 'none';
                consentFileInput.required = false;
                consentFileInput.value = '';
            }
        });
    });

    const wpSelect = document.getElementById('userWorkplace');
    const subElements = {
        'בית חולים': document.getElementById('subHospital'),
        'קהילה (קופות חולים)': document.getElementById('subCommunity'),
        'אוניברסיטאות ומכללות': document.getElementById('subUniversity'),
        'משרד הבריאות': document.getElementById('subMinistry'),
        'אחר': document.getElementById('subOther')
    };

    if (wpSelect) {
        wpSelect.addEventListener('change', (e) => {
            Object.values(subElements).forEach(el => {
                if (el) {
                    el.style.display = 'none';
                    el.required = false;
                    el.value = ''; 
                }
            });

            const selected = e.target.value;
            if (subElements[selected]) {
                subElements[selected].style.display = 'block';
                subElements[selected].required = true;
            }
        });
    }
});

function toBase64(fileOrBlob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(fileOrBlob);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

async function compressImage(file, maxWidth = 1920) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scaleSize = maxWidth / img.width;
                canvas.width = maxWidth;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.8); 
            };
        };
        reader.onerror = reject;
    });
}

async function uploadToDrive(base64Data, fileName, mimeType, isOriginal) {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ fileData: base64Data, fileName, mimeType, isOriginal })
    });
    const result = await response.json();
    if (result.status !== "success") throw new Error(result.message);
    return result.url;
}

// הגשת הטופס הציבורי
const uploadForm = document.getElementById('uploadForm');
if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('submitBtn');
        const uploadProgressText = document.getElementById('uploadProgressText');
        const file = document.getElementById('photoFile').files[0];
        const uploadOverlay = document.getElementById('uploadOverlay');

        const minSize = 1.5 * 1024 * 1024;
        const maxSize = 8 * 1024 * 1024;
        
        if (file) {
            if (file.size < minSize || file.size > maxSize) {
                showMessageModal('error', 'גודל קובץ לא תקין', 'שגיאה: קובץ הצילום שהעלית אינו עומד בדרישות. אנא ודא שהקובץ הוא בגודל של בין 2 מ"ב ל-6 מ"ב בלבד, ונסה שוב.');
                return; 
            }
        }

        btn.disabled = true;
        
        if (uploadOverlay) {
            uploadProgressText.innerText = 'מתחיל בעיבוד ההגשה... ⏳';
            uploadOverlay.style.display = 'flex';
        }

        try {
            const uTitle = document.getElementById('userTitle').value;
            const fName = document.getElementById('firstName').value;
            const lName = document.getElementById('lastName').value;
            const phone = document.getElementById('userPhone').value;
            const email = document.getElementById('userEmail').value;
            const dept = document.getElementById('userDepartment').value;
            const role = document.getElementById('userRole').value;
            const allowEmails = document.getElementById('allowEmails').checked;
            
            const baseWorkplace = document.getElementById('userWorkplace').value;
            let specificWorkplace = "";
            const activeSub = document.querySelector('.sub-workplace[style*="display: block"]');
            if (activeSub) specificWorkplace = activeSub.value;
            const finalWorkplace = specificWorkplace ? `${baseWorkplace} - ${specificWorkplace}` : baseWorkplace;
            
            const photoTitle = document.getElementById('photoTitle').value;
            const desc = document.getElementById('photoDescription').value;
            const personOption = document.querySelector('input[name="identifiablePerson"]:checked').value;
            const consentFile = document.getElementById('consentFile').files[0];

            const fullName = `${fName}_${lName}`;
            const timestamp = Date.now();
            const cleanTitle = photoTitle.replace(/[^a-zA-Zא-ת0-9]/g, '-');
            const baseFileName = `${fullName}_${cleanTitle}_${timestamp}`;

            let pdfDriveUrl = "";
            if (personOption === 'patients' && consentFile) {
                uploadProgressText.innerText = 'מעלה את אישורי המצולמים... 📄';
                const base64Pdf = await toBase64(consentFile);
                pdfDriveUrl = await uploadToDrive(base64Pdf, `${fullName}_${timestamp}_consent.pdf`, consentFile.type, true);
            }

            uploadProgressText.innerText = 'מגבה את תמונת המקור באיכות מלאה... 📷';
            const base64Original = await toBase64(file);
            await uploadToDrive(base64Original, `${baseFileName}_original_${file.name}`, file.type, true);

            uploadProgressText.innerText = 'מעלה את התמונה למערכת השיפוט... ⚖️';
            const compressedBlob = await compressImage(file);
            const base64Compressed = await toBase64(compressedBlob);
            const compressedUrl = await uploadToDrive(base64Compressed, `${baseFileName}_compressed.webp`, 'image/webp', false);

            uploadProgressText.innerText = 'שומר את הפרטים במאגר... 💾';
            await addDoc(collection(db, "submissions"), {
                title: uTitle,
                firstName: fName,
                lastName: lName,
                photographerName: `${uTitle} ${fName} ${lName}`,
                phone: phone,
                email: email,
                workplace: finalWorkplace,
                department: dept,
                role: role,
                allowEmails: allowEmails,
                photoTitle: photoTitle,
                description: desc,
                imageUrl: compressedUrl,
                identifiablePerson: personOption,
                consentPdfUrl: pdfDriveUrl,
                status: "pending", 
                timestamp: serverTimestamp()
            });

            // השלמה מוצלחת
            if (uploadOverlay) uploadOverlay.style.display = 'none';
            showMessageModal('success', 'ההגשה הושלמה בהצלחה!', 'הצילום והפרטים האישיים שלך הוגשו בהצלחה למערכת.\nתודה רבה על השתתפותך, ובהצלחה בתחרות!');
            
            document.getElementById('uploadForm').reset();
            document.getElementById('pdfUploadContainer').style.display = 'none';
            document.querySelectorAll('.sub-workplace').forEach(el => el.style.display = 'none');
            document.getElementById('wordCounter').innerText = '0 / 70 מילים';
            
        } catch (error) {
            console.error("Upload Error: ", error);
            if (uploadOverlay) uploadOverlay.style.display = 'none';
            showMessageModal('error', 'אירעה שגיאה', 'לצערנו חלה שגיאה בתהליך השליחה והנתונים לא נשמרו. אנא נסה שוב בעוד מספר רגעים או בדוק את חיבור האינטרנט שלך.');
        } finally {
            btn.disabled = false;
        }
    });
}

// התחברות צוות אדמין / שופטים
const googleLoginBtn = document.getElementById('googleLoginBtn');
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
        try {
            const result = await signInWithPopup(auth, provider);
            const userEmail = result.user.email;
            const userDocRef = doc(db, "users_roles", userEmail);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                if (userData.role === "admin") {
                    alert("שלום, זוהית כמנהל המערכת. מועבר לדשבורד...");
                    window.location.href = "/OBN-Photocontest/admin.html";
                } else if (userData.role === "judge") {
                    alert("שלום, זוהית כשופט מאושר. מועבר למסך השיפוט...");
                    window.location.href = "/OBN-Photocontest/judge.html";
                }
            } else {
                alert("כתובת אימייל זו אינה מורשית.");
                auth.signOut(); 
            }
        } catch (error) {
            console.error("Login failed:", error);
        }
    });
}