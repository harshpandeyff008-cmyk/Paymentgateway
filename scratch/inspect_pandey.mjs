import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./imap-proxy-server/serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function inspect() {
  console.log("=== CHECKING USERS ===");
  const usersSnap = await db.collection('users').get();
  usersSnap.forEach(d => {
    const data = d.data();
    if (JSON.stringify(data).toLowerCase().includes('pandeyharshhack')) {
      console.log("USER:", d.id, JSON.stringify(data, null, 2));
    }
  });

  console.log("\n=== CHECKING ZOHO_CREDENTIALS ===");
  const zSnap = await db.collection('zoho_credentials').get();
  zSnap.forEach(d => {
    const data = d.data();
    if (JSON.stringify(data).toLowerCase().includes('pandeyharshhack')) {
      console.log("ZOHO_CREDENTIAL:", d.id, JSON.stringify(data, null, 2));
    }
  });

  console.log("\n=== CHECKING IMAP_CREDENTIALS ===");
  const iSnap = await db.collection('imap_credentials').get();
  iSnap.forEach(d => {
    const data = d.data();
    if (JSON.stringify(data).toLowerCase().includes('pandeyharshhack')) {
      console.log("IMAP_CREDENTIAL:", d.id, JSON.stringify(data, null, 2));
    }
  });
}

inspect().catch(console.error).finally(() => process.exit(0));
