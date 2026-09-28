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

  if (res.data.access_token) return res.data.access_token;
  throw new Error('Failed to get access token');
}

async function fetchCollection(colName, accessToken) {
  let docs = [];
  let pageToken = '';
  do {
    const p = pageToken ? `?pageToken=${pageToken}` : '';
    const res = await httpsRequest({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${colName}${p}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (res.status === 200 && res.data.documents) {
      docs.push(...res.data.documents);
      pageToken = res.data.nextPageToken || '';
    } else {
      break;
    }
  } while (pageToken);
  return docs;
}

function parseFields(fields) {
  const obj = {};
  if (!fields) return obj;
  for (const k in fields) {
    const val = fields[k];
    if (val.stringValue !== undefined) obj[k] = val.stringValue;
    else if (val.integerValue !== undefined) obj[k] = parseInt(val.integerValue, 10);
    else if (val.doubleValue !== undefined) obj[k] = parseFloat(val.doubleValue);
    else if (val.booleanValue !== undefined) obj[k] = val.booleanValue;
    else if (val.timestampValue !== undefined) obj[k] = val.timestampValue;
    else obj[k] = JSON.stringify(val);
  }
  return obj;
}

async function main() {
  const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const accessToken = await getAccessToken(config.tokens.refresh_token);

  console.log("=== ADMIN USERS ===");
  const users = await fetchCollection('users', accessToken);
  for (const u of users) {
    const d = parseFields(u.fields);
    if (d.role === 'admin' || d.role === 'superadmin' || d.role === 'staff' || d.role === 'employee' || (d.email && d.email.includes('admin'))) {
      console.log(`User: ${d.email} | Name: ${d.name} | Role: ${d.role} | UID: ${d.uid || u.name.split('/').pop()}`);
    }
  }

  console.log("\n=== GMAIL CREDENTIALS ===");
  const gmails = await fetchCollection('gmail_credentials', accessToken);
  console.log(`Total Gmails: ${gmails.length}`);
  for (const g of gmails) {
    const d = parseFields(g.fields);
    console.log(`- Gmail: ${d.gmail_email || d.email} | GameID: ${d.game_id_name} | UID: ${d.game_uid} | Assigned: ${d.assignedAdminId}`);
  }

  console.log("\n=== ZOHO CREDENTIALS ===");
  const zohos = await fetchCollection('zoho_credentials', accessToken);
  console.log(`Total Zohos: ${zohos.length}`);
  for (const z of zohos) {
    const d = parseFields(z.fields);
    console.log(`- Zoho: ${d.zoho_email || d.email} | GameID: ${d.game_id_name} | UID: ${d.game_uid}`);
  }

  console.log("\n=== IMAP CREDENTIALS ===");
  const imaps = await fetchCollection('imap_credentials', accessToken);
  console.log(`Total IMAPs: ${imaps.length}`);
  for (const i of imaps) {
    const d = parseFields(i.fields);
    console.log(`- IMAP: ${d.imap_email || d.email} | Host: ${d.imap_host} | Port: ${d.imap_port} | GameID: ${d.game_id_name} | UID: ${d.game_uid}`);
  }

  console.log("\n=== LICENSE KEYS ===");
  const keys = await fetchCollection('license_keys', accessToken);
  console.log(`Total License Keys: ${keys.length}`);
  for (const k of keys.slice(0, 10)) {
    const d = parseFields(k.fields);
    console.log(`- Key: ${k.name.split('/').pop()} | Status: ${d.status} | Mailbox: ${d.targetMailbox || d.linkedGmail || d.email} | Duration: ${d.durationDays || d.validityDays}`);
  }
}

main().catch(console.error);
