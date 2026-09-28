import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

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

async function run() {
  try {
    console.log("Fetching credentials for gadgetflow0001@zohomail.in...");
    const q = query(collection(db, 'zoho_credentials'), where('zoho_email', '==', 'gadgetflow0001@zohomail.in'));
    const snap = await getDocs(q);
    if (snap.empty) {
      console.log("No credentials found for this email!");
      return;
    }
    let creds;
    snap.forEach(d => { creds = d.data(); });
    console.log("Found credentials. Refreshing access token...");

    // Refresh token
    const tokenRes = await fetch("https://zoho-proxy-server-xaf9.onrender.com/zoho/refresh", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: creds.zoho_refresh_token })
    });
    if (!tokenRes.ok) {
      throw new Error("Failed to refresh token: " + await tokenRes.text());
    }
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    console.log("Access token resolved. Fetching folder list...");

    // Fetch folders
    const foldersRes = await fetch("https://zoho-proxy-server-xaf9.onrender.com/zoho/proxy", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: `/api/accounts/${creds.zoho_account_id}/folders`,
        method: 'GET',
        token: accessToken
      })
    });
    const foldersData = await foldersRes.json();
    const foldersList = foldersData.data || [];
    console.log("Folders List:");
    foldersList.forEach(f => {
      console.log(`- FolderName: "${f.folderName}", FolderId: "${f.folderId}"`);
    });

    // Query messages in each folder
    for (const folder of foldersList) {
      if (['inbox', 'newsletter', 'newsletters', 'notification', 'notifications'].includes(folder.folderName.toLowerCase())) {
        console.log(`\nFetching messages from folder: "${folder.folderName}" (Id: ${folder.folderId})`);
        const msgsRes = await fetch("https://zoho-proxy-server-xaf9.onrender.com/zoho/proxy", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: `/api/accounts/${creds.zoho_account_id}/messages/view?folderId=${folder.folderId}&limit=10`,
            method: 'GET',
            token: accessToken
          })
        });
        const msgsData = await msgsRes.json();
        const msgs = msgsData.data || [];
        console.log(`Found ${msgs.length} messages:`);
        msgs.forEach(m => {
          console.log(`  * Sender: "${m.sender}", Subject: "${m.subject}", SentTime: ${m.sentTime}`);
        });
      }
    }

  } catch (err) {
    console.error("Error:", err);
  }
}
run();
