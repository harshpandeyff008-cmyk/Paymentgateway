import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';

const PROJECT_ID = 'ff-store-4a61e';
const TARGET_EMAIL = 'harshpandeyff008@gmail.com';

function httpsRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
  }).toString();

  const res = await httpsRequest({
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    }
  }, body);

  if (res.data.access_token) {
    return res.data.access_token;
  }
  throw new Error('Failed to get access token: ' + JSON.stringify(res.data));
}

async function findUserAuthId(accessToken) {
  console.log(`Searching for Auth User with email: ${TARGET_EMAIL}...`);
  const body = JSON.stringify({
    email: [TARGET_EMAIL]
  });
  
  const res = await httpsRequest({
    hostname: 'identitytoolkit.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/accounts:lookup`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    }
  }, body);

  if (res.status === 200 && res.data.users && res.data.users[0]) {
    console.log(`Found UID: ${res.data.users[0].localId}`);
    return res.data.users[0].localId;
  }
  console.log(`User not found in Firebase Auth for project ${PROJECT_ID}.`);
  return null;
}

async function createAdminDocument(accessToken, uid) {
  console.log(`Creating Admin Document in users/${uid}...`);
  const body = JSON.stringify({
    fields: {
      uid: { stringValue: uid },
      email: { stringValue: TARGET_EMAIL },
      role: { stringValue: 'admin' },
      name: { stringValue: 'Harsh Pandey' },
      createdAt: { timestampValue: new Date().toISOString() }
    }
  });

  const res = await httpsRequest({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`,
    method: 'PATCH', // MERGE or WRITE
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    }
  }, body);

  if (res.status === 200) {
    console.log(`Successfully created users/${uid} document with admin role!`);
    return true;
  } else {
    console.log(`Failed to create user document: ${res.status}`, JSON.stringify(res.data));
    return false;
  }
}

async function main() {
  const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  if (!fs.existsSync(configPath)) {
    console.error('Firebase CLI config not found.');
    return;
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const refreshToken = config.tokens?.refresh_token;
  if (!refreshToken) {
    console.error('No refresh token found.');
    return;
  }

  const accessToken = await getAccessToken(refreshToken);
  const uid = await findUserAuthId(accessToken);
  if (uid) {
    await createAdminDocument(accessToken, uid);
  } else {
    console.log('Please register or log in first on the website to create the Auth account, or we can create it via Auth API.');
  }
}

main().catch(console.error);
