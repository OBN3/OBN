// --- הגדרות השרת של גוגל דרייב ---
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxN0Gin2H0LYHuUSGLN_v4CRomuaiGkJwv9QjAKu_KtCxPeikWYWB9OECszGiXWefPS/exec";

// ייבוא מודולים מ-Firebase
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

// מנגנוני טופס דינמיים
document.addEventListener('DOMContentLoaded', () => {
    const textarea = document.getElementById('photoDescription');
    const counter = document.getElementById('wordCounter');
    const pdfContainer = document.getElementById('pdfUploadContainer');
    const consentFileInput = document.getElementById('consentFile');
    const radioButtons = document.querySelectorAll('input[name="identifiablePerson"]');

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
        const status = document.getElementById('statusMessage');
        const file = document.getElementById('photoFile').files[0];

        const minSize = 2 * 1024 * 1024;
        const maxSize = 5 * 1024 * 1024;
        
        if (file) {
            if (file.size < minSize || file.size > maxSize) {
                status.style.color = 'red';
                status.innerText = 'שגיאה: קובץ הצילום חייב להיות בגודל של בין 2 מ"ב ל-5 מ"ב בלבד.';
                return; 
            }
        }

        btn.disabled = true;
        status.style.color = '#2563eb';
        status.innerText = 'מתחיל בעיבוד ההגשה והעלאת קבצים...';

        try {
            const uTitle = document.getElementById('userTitle').value;
            const fName = document.getElementById('firstName').value;
            const lName = document.getElementById('lastName').value;
            const phone = document.getElementById('userPhone').value;
            const email = document.getElementById('userEmail').value;
            const workplace = document.getElementById('userWorkplace').value;
            const dept = document.getElementById('userDepartment').value;
            const role = document.getElementById('userRole').value;
            const allowEmails = document.getElementById('allowEmails').checked;
            
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
                status.innerText = 'מעלה אישור מצולמים (קובץ PDF)...';
                const base64Pdf = await toBase64(consentFile);
                pdfDriveUrl = await uploadToDrive(base64Pdf, `${fullName}_${timestamp}_consent.pdf`, consentFile.type, true);
            }

            status.innerText = 'שולח את תמונת המקור למנהל התחרות...';
            const base64Original = await toBase64(file);
            await uploadToDrive(base64Original, `${baseFileName}_original_${file.name}`, file.type, true);

            status.innerText = 'מעלה את התמונה למערכת השיפוט...';
            const compressedBlob = await compressImage(file);
            const base64Compressed = await toBase64(compressedBlob);
            const compressedUrl = await uploadToDrive(base64Compressed, `${baseFileName}_compressed.webp`, 'image/webp', false);

            await addDoc(collection(db, "submissions"), {
                title: uTitle,
                firstName: fName,
                lastName: lName,
                photographerName: `${uTitle} ${fName} ${lName}`,
                phone: phone,
                email: email,
                workplace: workplace,
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

            status.style.color = 'green';
            status.innerText = 'הצילום והפרטים האישיים הוגשו בהצלחה לתחרות!';
            document.getElementById('uploadForm').reset();
            document.getElementById('pdfUploadContainer').style.display = 'none';
            document.getElementById('wordCounter').innerText = '0 / 70 מילים';
            
        } catch (error) {
            console.error("Upload Error: ", error);
            status.style.color = 'red';
            status.innerText = 'אירעה שגיאה בתהליך השליחה. נסה שוב.';
        } finally {
            btn.disabled = false;
        }
    });
}

// התחברות צוות (מוגן בפני קריסות באמצעות בדיקת קיום האלמנט)
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