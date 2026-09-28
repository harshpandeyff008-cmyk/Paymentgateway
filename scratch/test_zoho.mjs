import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

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
  const snap = await getDocs(collection(db, 'zoho_credentials'));
  console.log("Total Zoho credentials docs:", snap.size);
  let foundCred = null;
  snap.forEach(d => {
    const data = d.data();
    console.log("Doc ID:", d.id, "zoho_email:", data.zoho_email, "account_id:", data.zoho_account_id);
    if (data.zoho_email && data.zoho_email.toLowerCase().includes('pandeyharshhack')) {
      foundCred = data;
    }
  });

  if (!foundCred) {
    console.log("pandeyharshhack NOT FOUND in zoho_credentials!");
    return;
  }

  console.log("\nTesting token refresh for", foundCred.zoho_email);
  const tokenUrl = "https://accounts.zoho.in/oauth/v2/token";
  const body = new URLSearchParams({
    client_id: "1000.FZJ97A4AV5S97D1KBMEAZ69CUDZCPH",
    client_secret: "befb4c2a53a5ede358f3f3eda7fe8e728f4115dae6",
    refresh_token: foundCred.zoho_refresh_token,
    grant_type: "refresh_token"
  });

  const tRes = await fetch(tokenUrl, { method: "POST", body });
  const tData = await tRes.json();
  console.log("Token response:", tData);

  if (!tData.access_token) {
    console.error("No access token!");
    return;
  }

  const accessToken = tData.access_token;
  console.log("\nFetching folders for account:", foundCred.zoho_account_id);
  const fRes = await fetch(`https://mail.zoho.in/api/accounts/${foundCred.zoho_account_id}/folders`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
  });
  const fData = await fRes.json();
  console.log("Folders count:", fData.data?.length);
  if (fData.data) {
    fData.data.forEach(f => console.log("Folder:", f.folderName, "ID:", f.folderId));
  }

  // Fetch from ALL folders or search
  console.log("\nSearching messages with query: garena");
  const sRes = await fetch(`https://mail.zoho.in/api/accounts/${foundCred.zoho_account_id}/messages/search?searchKey=garena&limit=20`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
  });
  const sData = await sRes.json();
  console.log("Search garena count:", sData.data?.length);
  if (sData.data && sData.data.length > 0) {
    console.log("First search result:", JSON.stringify(sData.data[0], null, 2));
  }

  // Also check inbox messages
  const inboxFolder = fData.data?.find(f => f.folderName.toLowerCase() === 'inbox');
  if (inboxFolder) {
    console.log("\nFetching latest 10 messages from Inbox:", inboxFolder.folderId);
    const mRes = await fetch(`https://mail.zoho.in/api/accounts/${foundCred.zoho_account_id}/messages/view?folderId=${inboxFolder.folderId}&limit=10`, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
    });
    const mData = await mRes.json();
    console.log("Inbox messages count:", mData.data?.length);
    if (mData.data) {
      mData.data.forEach((m, idx) => {
        console.log(`[${idx}] Sender: "${m.sender}", Subject: "${m.subject}", Summary: "${m.summary}", Time: ${new Date(Number(m.sentTime)).toISOString()}`);
      });
    }
  }
}

test().catch(console.error).finally(() => process.exit(0));
