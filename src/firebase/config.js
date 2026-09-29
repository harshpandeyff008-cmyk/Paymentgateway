import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBcuSIz3NvPh2kU-BziQfjYsGKCMSjeWR4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ff-store-4a61e.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "ff-store-4a61e",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "ff-store-4a61e.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "117091451724",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:117091451724:web:e3cdb657f7ff8b289985e9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, firebaseConfig };
