import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

setLogLevel('error');

export const firebaseConfig = {
    apiKey: "AIzaSyBzXRUcnLuqH8rAaHdu6uGehgatD6hsIV0",
    authDomain: "myclock-6ba87.firebaseapp.com",
    projectId: "myclock-6ba87",
    storageBucket: "myclock-6ba87.firebasestorage.app",
    messagingSenderId: "969819524379",
    appId: "1:969819524379:web:89ceeddac15da03617d7be"
};

export const appId = 'myclock-app';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);