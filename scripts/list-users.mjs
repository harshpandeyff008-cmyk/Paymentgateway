import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';

const PROJECT_ID = 'ff-store-4a61e';

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

async function listUsers(accessToken) {
  console.log('Listing users from firestore...');
  const res = await httpsRequest({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/users`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    }
  });

  if (res.status === 200) {
    console.log('Users found:');
    if (!res.data.documents) {
      console.log('No documents found in users collection.');
      return;
    }
    for (const doc of res.data.documents) {
      const fields = doc.fields;
      const name = fields.name?.stringValue || 'N/A';
      const email = fields.email?.stringValue || 'N/A';
      const role = fields.role?.stringValue || 'N/A';
      console.log(`- Email: ${email}, Name: ${name}, Role: ${role}, Path: ${doc.name.split('/').pop()}`);
    }
  } else {
    console.log('Failed to list users:', res.status, JSON.stringify(res.data));
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
  await listUsers(accessToken);
}

main().catch(console.error);
