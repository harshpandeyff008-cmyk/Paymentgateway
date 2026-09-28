import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBcuSIz3NvPh2kU-BziQfjYsGKCMSjeWR4",
  authDomain: "ff-store-4a61e.firebaseapp.com",
  projectId: "ff-store-4a61e",
  storageBucket: "ff-store-4a61e.firebasestorage.app",
  messagingSenderId: "117091451724",
  appId: "1:117091451724:web:e3cdb657f7ff8b289985e9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  console.log("Checking Firestore collections...");
  for (const col of ['gmail_credentials', 'zoho_credentials', 'imap_credentials', 'users', 'license_keys']) {
    try {
      const snap = await getDocs(collection(db, col));
      console.log(`Collection [${col}]: ${snap.size} documents`);
      snap.forEach(doc => {
        const d = doc.data();
        console.log(`  Doc: ${doc.id} ->`, JSON.stringify(d).substring(0, 150));
      });
    } catch (e) {
      console.log(`Error in ${col}:`, e.message);
    }
  }
  process.exit(0);
}

check();
