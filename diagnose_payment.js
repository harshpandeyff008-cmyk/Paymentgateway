async function checkOrderAndPayment() {
  const base = 'https://payment-gateway-ydl1.onrender.com';
  const headers = { 'x-admin-key': 'shivambhatt@admin' };

  console.log('=== 1. FETCHING STATS ===');
  try {
    const sRes = await fetch(`${base}/api/admin/stats`, { headers });
    const sData = await sRes.json();
    console.log('Stats:', JSON.stringify(sData.stats, null, 2));
  } catch (e) { console.error('Stats error:', e.message); }

  console.log('\n=== 2. FETCHING RECENT ORDERS ===');
  try {
    const oRes = await fetch(`${base}/api/admin/orders?limit=10`, { headers });
    const oData = await oRes.json();
    console.log('Orders:', JSON.stringify(oData.orders, null, 2));
  } catch (e) { console.error('Orders error:', e.message); }

  console.log('\n=== 3. FETCHING RECORDED PAYMENTS ===');
  try {
    const pRes = await fetch(`${base}/api/admin/payments?limit=10`, { headers });
    const pData = await pRes.json();
    console.log('Payments:', JSON.stringify(pData.payments, null, 2));
  } catch (e) { console.error('Payments error:', e.message); }

  console.log('\n=== 4. SCANNING GMAIL INBOX FOR LATEST EMAILS ===');
  try {
    const iRes = await fetch(`${base}/api/admin/imap/recent`, { headers });
    const iData = await iRes.json();
    console.log('Recent Emails:', JSON.stringify(iData.emails, null, 2));
  } catch (e) { console.error('IMAP error:', e.message); }

  console.log('\n=== 5. RECENT LOGS ===');
  try {
    const lRes = await fetch(`${base}/api/admin/logs?limit=10`, { headers });
    const lData = await lRes.json();
    console.log('Logs:', JSON.stringify(lData.logs, null, 2));
  } catch (e) { console.error('Logs error:', e.message); }
}

checkOrderAndPayment();
