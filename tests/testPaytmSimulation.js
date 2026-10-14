import { initDatabase, query } from '../db/database.js';
import { processIncomingPayment } from '../services/matchingEngine.js';
import { parsePaymentEmail } from '../services/emailParser.js';

async function main() {
  console.log('--- 🧪 Simulating Paytm Note & Instant Verification on Localhost ---');
  await initDatabase();

  // 1. Create a simulated customer order
  const orderCode = `ORD-TEST-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = Date.now();
  await query.run(
    `INSERT INTO orders (order_code, amount, customer_name, status, created_at, expires_at)
     VALUES (?, 299.00, 'Harsh Test', 'PENDING', ?, ?)`,
    [orderCode, now, now + 300000]
  );
  console.log(`✅ [1/3] Created Order: ${orderCode} for ₹299.00 (Status: PENDING)`);

  // 2. Incoming Paytm Email with Note containing orderCode
  const testUtr = `UTR-${Date.now()}`;
  const paytmSubject = 'Payment Received of Rs 299.00 from Customer';
  const paytmBody = `Payment Received
₹ 299.00
From BHIM UPI customer@paytm
Order ID: T2609141307521577368395
Note: ${orderCode}
UTR: ${testUtr}`;

  const parsed = parsePaymentEmail(paytmSubject, paytmBody);
  console.log(`✅ [2/3] Parser Extracted from Paytm Email:`);
  console.log(`       Amount: ₹${parsed.amount}`);
  console.log(`       Gateway Order Code from Note: ${parsed.gatewayOrderCode}`);
  console.log(`       Paytm Order ID: ${parsed.txnId}`);
  console.log(`       UTR: ${parsed.utr}`);

  // 3. Process incoming payment in Matching Engine
  const matchResult = await processIncomingPayment({
    amount: parsed.amount,
    utr: parsed.utr,
    orderCode: parsed.gatewayOrderCode,
    sender: parsed.sender,
    source: 'MERCHANT_IMAP_PUSH',
    rawSnippet: paytmBody
  });

  if (matchResult.matched && matchResult.order.status === 'PAID') {
    console.log(`✅ [3/3] ⚡ Instant Deterministic Match SUCCESS!`);
    console.log(`       Order Code: ${matchResult.order.order_code}`);
    console.log(`       Status: ${matchResult.order.status}`);
    console.log(`       Paid At: ${new Date(matchResult.order.paid_at).toLocaleTimeString()}`);
    console.log('\n🎉 ALL LOCALHOST VERIFICATION TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  } else {
    console.error(`❌ Verification failed:`, matchResult);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
