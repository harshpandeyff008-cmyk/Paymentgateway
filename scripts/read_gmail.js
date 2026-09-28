const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Helper to ask user questions in the terminal
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));
const askPassword = (query) => new Promise((resolve) => {
  // Simple masking for password entry in console
  const stdin = process.openStdin();
  process.stdin.on('data', (char) => {
    char = char + '';
    switch (char) {
      case '\n':
      case '\r':
      case '\u0004':
        stdin.pause();
        break;
      default:
        process.stdout.write('\033[2D  \033[2D'); // mask with spaces (simple console trick)
        break;
    }
  });
  rl.question(query, (value) => {
    resolve(value);
  });
});

// 1. Parse .env file
const parseEnv = () => {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('Error: .env file not found. Please create one based on .env.example.');
    process.exit(1);
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  envContent.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim();
    }
  });
  return env;
};

const env = parseEnv();
const API_KEY = env.VITE_FIREBASE_API_KEY;
const PROJECT_ID = env.VITE_FIREBASE_PROJECT_ID;
const CLIENT_ID = env.VITE_GOOGLE_CLIENT_ID;
const CLIENT_SECRET = env.VITE_GOOGLE_CLIENT_SECRET;

if (!API_KEY || !PROJECT_ID || !CLIENT_ID || !CLIENT_SECRET) {
  console.error('Error: Environment variables are not fully configured in your .env file.');
  console.error('Required: VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, VITE_GOOGLE_CLIENT_ID, VITE_GOOGLE_CLIENT_SECRET');
  process.exit(1);
}

// 2. Firebase Sign In
const firebaseSignIn = async (email, password) => {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error?.message || 'Firebase Auth failed');
  }
  return await response.json();
};

// 3. Query Firestore for verified accounts
const fetchVerifiedGmailUsers = async (idToken) => {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'gmail_credentials' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'gmail_verified_by_admin' },
            op: 'EQUAL',
            value: { booleanValue: true }
          }
        }
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firestore query failed: ${errorText}`);
  }

  const queryResults = await response.json();
  const users = [];

  for (const result of queryResults) {
    if (result.document) {
      const doc = result.document;
      const fields = doc.fields;
      users.push({
        uid: fields.userId?.stringValue || doc.name.split('/').pop(),
        name: fields.userName?.stringValue || 'Unknown Name',
        email: fields.userEmail?.stringValue || 'No Email',
        gmail_email: fields.gmail_email?.stringValue || '',
        gmail_refresh_token: fields.gmail_refresh_token?.stringValue || ''
      });
    }
  }

  return users;
};

// 4. Exchange Refresh Token for Access Token
const refreshAccessToken = async (refreshToken) => {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error_description || 'Google Token Refresh failed');
  }

  const data = await response.json();
  return data.access_token;
};

// 5. Fetch Gmail Messages
const fetchGmailEmails = async (accessToken) => {
  const listUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5';
  const listResponse = await fetch(listUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!listResponse.ok) {
    throw new Error('Failed to retrieve list of messages');
  }

  const listData = await listResponse.json();
  const messages = listData.messages || [];
  const fetchedEmails = [];

  for (const msg of messages) {
    const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`;
    const detailResponse = await fetch(detailUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (detailResponse.ok) {
      const detail = await detailResponse.json();
      const headers = detail.payload.headers || [];
      const getHeader = (name) => {
        const found = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
        return found ? found.value : '';
      };

      fetchedEmails.push({
        id: detail.id,
        snippet: detail.snippet,
        subject: getHeader('Subject') || '(No Subject)',
        from: getHeader('From') || 'Unknown',
        date: getHeader('Date') || 'Unknown'
      });
    }
  }

  return fetchedEmails;
};

// Main CLI Execution Loop
const main = async () => {
  console.log('==================================================');
  console.log('         GMAIL READ-ONLY CONSOLE AUDITOR          ');
  console.log('==================================================');

  try {
    const email = await askQuestion('Enter Admin Email: ');
    const password = await askPassword('Enter Admin Password: ');
    
    console.log('\nAuthenticating Admin credentials with Firebase...');
    const authData = await firebaseSignIn(email, password);
    console.log(`Welcome back, Admin! (Local ID: ${authData.localId})`);

    console.log('Fetching verified Gmail accounts from database...');
    const users = await fetchVerifiedGmailUsers(authData.idToken);

    if (users.length === 0) {
      console.log('\nNo verified Gmail accounts found in database. Exiting.');
      rl.close();
      return;
    }

    console.log('\nVerified Gmail Accounts found:');
    users.forEach((u, index) => {
      console.log(`[${index + 1}] ${u.name} (${u.email}) -> Connected Gmail: ${u.gmail_email}`);
    });

    const choiceStr = await askQuestion('\nSelect account number to inspect emails (or type "exit"): ');
    if (choiceStr.toLowerCase() === 'exit') {
      console.log('Exiting...');
      rl.close();
      return;
    }

    const choiceIndex = parseInt(choiceStr, 10) - 1;
    if (isNaN(choiceIndex) || choiceIndex < 0 || choiceIndex >= users.length) {
      console.log('Invalid choice. Exiting...');
      rl.close();
      return;
    }

    const targetUser = users[choiceIndex];
    console.log(`\nInspecting Gmail inbox logs for: ${targetUser.gmail_email}`);
    console.log('Refreshing access tokens with Google APIs...');
    const accessToken = await refreshAccessToken(targetUser.gmail_refresh_token);

    console.log('Retrieving last 5 messages...');
    const emails = await fetchGmailEmails(accessToken);

    console.log('\n--------------------------------------------------');
    console.log(`Mail records for ${targetUser.gmail_email}:`);
    console.log('--------------------------------------------------');
    
    if (emails.length === 0) {
      console.log('Mailbox is empty.');
    } else {
      emails.forEach((mail, idx) => {
        console.log(`\nEmail #${idx + 1}`);
        console.log(`From:    ${mail.from}`);
        console.log(`Date:    ${mail.date}`);
        console.log(`Subject: ${mail.subject}`);
        console.log(`Snippet: ${mail.snippet}`);
        console.log('--------------------------------------------------');
      });
    }

  } catch (err) {
    console.error('\n[Error occurred]:', err.message);
  } finally {
    rl.close();
  }
};

main();
