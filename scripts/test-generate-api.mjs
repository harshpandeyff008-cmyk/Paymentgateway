import https from 'https';

const API_URL = 'https://imap-proxy-server.onrender.com/api/license/generate';
const API_KEY = 'sb_api_FMK0E83l4PAlDfMWrNKbDofV2Iab21aK';

function httpsRequest(url, options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
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

async function test() {
  console.log(`Sending POST to ${API_URL}...`);
  const body = JSON.stringify({
    assignedMailbox: 'test@gmail.com',
    mailboxType: 'gmail',
    orderId: 'ORD-TEST1234',
    game: 'Free Fire',
    price: 100,
    title: 'Test Account'
  });

  try {
    const res = await httpsRequest(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    }, body);

    console.log('Status Code:', res.status);
    console.log('Response Body:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('Request failed:', err);
  }
}

test().catch(console.error);
