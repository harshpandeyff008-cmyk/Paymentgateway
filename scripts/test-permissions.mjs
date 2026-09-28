import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

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

async function test() {
  console.log('Testing unauthenticated read to system_settings/maintenance...');
  try {
    const docRef = doc(db, 'system_settings', 'maintenance');
    const snap = await getDoc(docRef);
    console.log('Success! Document exists:', snap.exists(), snap.data());
  } catch (err) {
    console.error('Error reading system_settings/maintenance:', err.message || err);
  }

  console.log('\nTesting unauthenticated read to system/maintenance...');
  try {
    const docRef = doc(db, 'system', 'maintenance');
    const snap = await getDoc(docRef);
    console.log('Success! Document exists:', snap.exists(), snap.data());
  } catch (err) {
    console.error('Error reading system/maintenance:', err.message || err);
  }
}

test().catch(console.error);
