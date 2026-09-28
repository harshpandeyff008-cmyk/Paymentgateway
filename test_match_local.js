import { initDatabase, closeDatabase, query } from '../personal gateway/db/database.js';
import { processIncomingPayment } from '../personal gateway/services/matchingEngine.js';

async function testMatch() {
  await initDatabase();

  console.log('--- Testing Matching on UTR 661504779893 ---');
  const res = await processIncomingPayment({
    amount: 500,
    utr: '661504779893',
    sender: 'SHARNJIT KAUR',
    receivedAt: 1788709257000,
    source: 'IMAP',
    rawSnippet: 'You received ₹500.0 from SHARNJIT KAUR'
  });

  console.log('Match Result:', JSON.stringify(res, null, 2));

  // Check order status
  const order = await query.get('SELECT * FROM orders WHERE amount = 500 ORDER BY id DESC LIMIT 1');
  console.log('Order in DB:', order ? `${order.order_code} Status: ${order.status} PaidAt: ${order.paid_at} UTR: ${order.utr}` : 'None');

  await closeDatabase();
}

testMatch().catch(console.error);
