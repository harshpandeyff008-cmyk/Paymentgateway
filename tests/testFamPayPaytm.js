import { initDatabase, query } from '../db/database.js';
import { processIncomingPayment } from '../services/matchingEngine.js';
import { parsePaymentEmail, parseFamPayEmail, parsePaytmEmail, parsePhonePeEmail, parseBankEmail } from '../services/emailParser.js';
import { buildUpiUri } from '../src/utils/qr.util.js';

// ---------------------------------------------------------------------------
// Real email texts, transcribed exactly from the owner's screenshots.
// ---------------------------------------------------------------------------
const FAMPAY_SUBJECT = 'You received ₹3000.01 in your FamX account';
const FAMPAY_BODY = `Hey Rajdeep Das,
You have successfully received
₹3000.01
from Aditya
Transaction ID :
FMPIB6842248581
Date :
04:36 PM IST, 22 October 2026
Updated Balance :
₹3070.81
If this was not done by you, call us and report this at +91 8095858881 or email us at support@famapp.in
Best, Fam.`;

// Same email after HTML stripping WITHOUT whitespace between elements.
const FAMPAY_BODY_GLUED = `Hey Rajdeep Das,You have successfully received₹3000.01from AdityaTransaction ID :FMPIB6842248581Date :04:36 PM IST, 22 October 2026Updated Balance :₹3070.81If this was not done by you, call us and report this at +91 8095858881 or email us at support@famapp.inBest, Fam.`;

const PAYTM_SUBJECT = 'Rs. 600.00 paid at Sep 12, 2026, 8:31 PM';
const PAYTM_BODY = `Payment Received
₹ 600
Rupees Six Hundred only
It will settle to your bank by 7 am tomorrow. Visit b.paytm.me for details.
Transaction Count #3
From
BHIM UPI 9430XX@slc
In Account of
HARSH PANDEY
Sep 12, 2026, 8:31 PM
Order ID: NEF1970b768a3bc4c039b93a57491bf020`;

let passed = 0;
let failed = 0;
function check(name, cond, detail = '') {
  if (cond) {
    passed++;
    console.log(`✅ [PASS] ${name}`);
  } else {
    failed++;
    console.error(`❌ [FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function parserTests() {
  console.log('--- Parser: real FamApp (FamPay/FamX) email ---');
  const fam = parsePaymentEmail(FAMPAY_SUBJECT, FAMPAY_BODY, new Date());
  check('FamPay auto-detect sourceApp', fam.sourceApp === 'FamPay', `got ${fam.sourceApp}`);
  check('FamPay amount is the received ₹3000.01 (not Updated Balance ₹3070.81)', fam.amount === 3000.01, `got ${fam.amount}`);
  check('FamPay reference is the FMPIB id (email has no UTR)', fam.utr === 'FMPIB6842248581', `got ${fam.utr}`);
  check('FamPay txnId is the FMPIB id', fam.txnId === 'FMPIB6842248581', `got ${fam.txnId}`);
  check('FamPay sender', fam.sender === 'Aditya', `got ${fam.sender}`);
  check('FamPay receiver', fam.receiver === 'Rajdeep Das', `got ${fam.receiver}`);

  console.log('--- Parser: FamApp email, glued HTML variant ---');
  const glued = parsePaymentEmail(FAMPAY_SUBJECT, FAMPAY_BODY_GLUED, new Date());
  check('Glued FamPay amount', glued.amount === 3000.01, `got ${glued.amount}`);
  check('Glued FamPay FMPIB id has NO glued "Date" suffix', glued.utr === 'FMPIB6842248581' && glued.txnId === 'FMPIB6842248581', `got utr=${glued.utr} txnId=${glued.txnId}`);
  check('Glued FamPay sender', glued.sender === 'Aditya', `got ${glued.sender}`);

  console.log('--- Parser: dedicated parseFamPayEmail + forced FAMPAY hint ---');
  const famDirect = parseFamPayEmail(FAMPAY_SUBJECT, FAMPAY_BODY, new Date());
  check('parseFamPayEmail amount/ref', famDirect.amount === 3000.01 && famDirect.utr === 'FMPIB6842248581', `got ${famDirect.amount}/${famDirect.utr}`);
  const famSparse = parsePaymentEmail(
    'You received ₹3000.01 in your FamX account',
    'You have successfully received ₹3000.01 from Aditya Transaction ID: FMPIB6842248581',
    new Date(),
    'FAMPAY'
  );
  check('FAMPAY hint forces FamPay parser on a FamX subject with sparse keywords', famSparse.sourceApp === 'FamPay' && famSparse.amount === 3000.01 && famSparse.utr === 'FMPIB6842248581', `got app=${famSparse.sourceApp} amount=${famSparse.amount} utr=${famSparse.utr}`);

  console.log('--- Parser: real Paytm Business email ---');
  const pay = parsePaymentEmail(PAYTM_SUBJECT, PAYTM_BODY, new Date());
  check('Paytm auto-detect sourceApp', pay.sourceApp === 'Paytm Business', `got ${pay.sourceApp}`);
  check('Paytm amount', pay.amount === 600, `got ${pay.amount}`);
  check('Paytm reference is the NEF Order ID (email has no UTR)', pay.utr === 'NEF1970b768a3bc4c039b93a57491bf020', `got ${pay.utr}`);
  check('Paytm txnId is the NEF Order ID', pay.txnId === 'NEF1970b768a3bc4c039b93a57491bf020', `got ${pay.txnId}`);
  check('Paytm sender contains BHIM UPI', (pay.sender || '').includes('BHIM UPI'), `got ${pay.sender}`);
  check('Paytm receiver', pay.receiver === 'HARSH PANDEY', `got ${pay.receiver}`);

  console.log('--- Parser: dedicated parsePaytmEmail + forced PAYTM hint ---');
  const payDirect = parsePaytmEmail(PAYTM_SUBJECT, PAYTM_BODY, new Date());
  check('parsePaytmEmail amount/ref', payDirect.amount === 600 && payDirect.utr === 'NEF1970b768a3bc4c039b93a57491bf020', `got ${payDirect.amount}/${payDirect.utr}`);
  const payHint = parsePaymentEmail(PAYTM_SUBJECT, PAYTM_BODY, new Date(), 'PAYTM');
  check('PAYTM hint forces Paytm parser', payHint.sourceApp === 'Paytm Business' && payHint.amount === 600, `got ${payHint.sourceApp}/${payHint.amount}`);

  console.log('--- Parser: LABEL-FREE order code (owner-confirmed: note prints with NO label) ---');
  // This PhonePe-format body contains the gateway order code as BARE
  // text. The label words Note/Remarks/Comment/Description/Purpose do
  // not appear anywhere in it.
  const barePhonePeBody = `Payment Received
₹ 450.00
Payment received of ₹ 450.00 from ROHIT VERMA via PhonePe.
Transaction ID: T2609141307521577368395
UTR: 423589012346
Credited to Bank Account ending in 4321.
ORD-BARE123456`;
  const barePhonePe = parsePaymentEmail('Payment Received', barePhonePeBody, new Date());
  check('Label-free PhonePe: branch detected', barePhonePe.sourceApp === 'PhonePe', `got ${barePhonePe.sourceApp}`);
  check('Label-free PhonePe: gatewayOrderCode populated without any label', barePhonePe.gatewayOrderCode === 'ORD-BARE123456', `got ${barePhonePe.gatewayOrderCode}`);
  check('Label-free PhonePe: amount/utr intact', barePhonePe.amount === 450 && barePhonePe.utr === '423589012346', `got ${barePhonePe.amount}/${barePhonePe.utr}`);

  const bareBank = parsePaymentEmail(
    'Credit Alert: UPI Transaction',
    'Dear Customer, A/C credited by Rs 1,250.50 on 04-Sep-26 by UPI/423456789013/Payment from GPay. Ref ORD-BARE123456',
    new Date()
  );
  check('Label-free generic/bank: gatewayOrderCode populated without any label', bareBank.gatewayOrderCode === 'ORD-BARE123456', `got ${bareBank.gatewayOrderCode} (app=${bareBank.sourceApp})`);

  console.log('--- Parser: REAL PhonePe Business email (owner screenshot) ---');
  const PHONEPE_SUBJECT = 'Payment Received on PhonePe Business';
  const PHONEPE_BODY = `Sep 30, 2026
Received ₹ 50.09
Txn. ID : T2609301256309083331806
Store Name : PANME SHOP
Paid By : kirupri143@oksbi
Txn. Status : Successful
Hi
For more details login into PhonePe Business Dashboard.
Cheers! Team PhonePe
For any queries write to merchant-desk@phonepe.com`;
  const ppReal = parsePaymentEmail(PHONEPE_SUBJECT, PHONEPE_BODY, new Date());
  check('Real PhonePe: parsed via PhonePe parser', ppReal.success && ppReal.sourceApp === 'PhonePe', `got ${ppReal.success}/${ppReal.sourceApp} ${ppReal.error || ''}`);
  check('Real PhonePe: amount keeps exact paise 50.09', ppReal.amount === 50.09, `got ${ppReal.amount}`);
  check('Real PhonePe: reference is the Txn. ID (no UTR in email)', ppReal.utr === 'T2609301256309083331806' && ppReal.txnId === 'T2609301256309083331806', `got utr=${ppReal.utr} txn=${ppReal.txnId}`);
  check('Real PhonePe: sender = Paid By VPA', ppReal.sender === 'kirupri143@oksbi', `got ${ppReal.sender}`);
  check('Real PhonePe: receiver = Store Name', ppReal.receiver === 'PANME SHOP', `got ${ppReal.receiver}`);
  const ppRealDirect = parsePhonePeEmail(PHONEPE_SUBJECT, PHONEPE_BODY, new Date());
  check('Real PhonePe: dedicated function agrees', ppRealDirect.success && ppRealDirect.amount === 50.09 && ppRealDirect.utr === 'T2609301256309083331806', `got ${ppRealDirect.amount}/${ppRealDirect.utr}`);
  const ppFailed = parsePhonePeEmail(PHONEPE_SUBJECT, PHONEPE_BODY.replace('Txn. Status : Successful', 'Txn. Status : Failed'), new Date());
  check('PhonePe Txn. Status Failed is REJECTED', ppFailed.success === false, `got success=${ppFailed.success}`);
  const ppFailedDispatch = parsePaymentEmail(PHONEPE_SUBJECT, PHONEPE_BODY.replace('Txn. Status : Successful', 'Txn. Status : Failed'), new Date());
  check('PhonePe Failed also rejected via dispatcher', ppFailedDispatch.success === false, `got success=${ppFailedDispatch.success}`);

  console.log('--- Parser: dedicated parsePhonePeEmail / parseBankEmail (separate complete functions) ---');
  const ppDirect = parsePhonePeEmail('Payment Received', `Payment Received
₹ 450.00
Payment received of ₹ 450.00 from ROHIT VERMA via PhonePe.
Transaction ID: T2609141307521577368395
UTR: 423589012345
Credited to Bank Account ending in 4321.
ORD-BARE123456`);
  check('parsePhonePeEmail direct: amount/utr/app', ppDirect.success && ppDirect.amount === 450 && ppDirect.utr === '423589012345' && ppDirect.sourceApp === 'PhonePe', `got ${ppDirect.amount}/${ppDirect.utr}/${ppDirect.sourceApp}`);
  check('parsePhonePeEmail direct: label-free gatewayOrderCode populated standalone', ppDirect.gatewayOrderCode === 'ORD-BARE123456', `got ${ppDirect.gatewayOrderCode}`);
  const bankDirect = parseBankEmail('Credit Alert: UPI Transaction', 'Dear Customer, A/C credited by Rs 1,250.50 on 04-Sep-26 by UPI/423456789012/Payment.');
  check('parseBankEmail direct: amount/utr', bankDirect.success && bankDirect.amount === 1250.5 && bankDirect.utr === '423456789012', `got ${bankDirect.amount}/${bankDirect.utr}`);
  const ppHint = parsePaymentEmail('Payment Received', 'Payment Received\n₹ 450.00\nPayment received of ₹ 450.00 from ROHIT VERMA via PhonePe.\nTransaction ID: T2609141307521577368395\nUTR: 423589012345', new Date(), 'PHONEPE');
  check('PHONEPE hint forces PhonePe parser via dispatcher', ppHint.sourceApp === 'PhonePe' && ppHint.amount === 450, `got ${ppHint.sourceApp}/${ppHint.amount}`);

  console.log('--- QR: Paytm note guarantee ---');
  const paytmUri = buildUpiUri({ vpa: 'merchant@paytm', merchantName: 'Test Store', amount: 600, orderCode: 'ORD-ABC123', note: 'Custom marketing note', provider: 'PAYTM' });
  check('Paytm QR tn= is the order code, custom note cannot override', paytmUri.includes('tn=ORD-ABC123'), paytmUri);
  check('Paytm QR tr= is the order code', paytmUri.includes('tr=ORD-ABC123'), paytmUri);
  const famUri = buildUpiUri({ vpa: 'merchant@fam', merchantName: 'Test Store', amount: 600, orderCode: 'ORD-ABC123', provider: 'FAMPAY' });
  check('Non-Paytm QR still carries order code in tn=/tr=', famUri.includes('tn=ORD-ABC123') && famUri.includes('tr=ORD-ABC123'), famUri);
}

async function integrationTests() {
  console.log('--- Integration: matching engine ---');
  await initDatabase();
  const suffix = Date.now().toString().slice(-6);
  const cleanupOrders = [];
  const cleanupUtrs = [];

  // 1) Late FamPay email revives an EXPIRED order.
  // Order lived 13 -> 8 minutes ago (5-min window, already EXPIRED);
  // the FamApp email "arrives" now (8 min after expiry, inside the
  // 15-min grace). Before the fix this could never succeed.
  const receivedAt = Date.now();
  const lateCode = `ORD-LATE${suffix}`;
  cleanupOrders.push(lateCode);
  cleanupUtrs.push('FMPIB6842248581');
  await query.run(
    `INSERT INTO orders (order_code, amount, base_amount, customer_name, status, created_at, expires_at)
     VALUES (?, ?, ?, 'Late FamPay Test', 'EXPIRED', ?, ?)`,
    [lateCode, 3000.01, 3000, receivedAt - 13 * 60 * 1000, receivedAt - 8 * 60 * 1000]
  );
  const famParsed = parsePaymentEmail(FAMPAY_SUBJECT, FAMPAY_BODY, new Date(receivedAt));
  const lateResult = await processIncomingPayment({
    amount: famParsed.amount,
    utr: famParsed.utr,
    orderCode: famParsed.gatewayOrderCode || null,
    sender: famParsed.sender,
    receivedAt: new Date(receivedAt),
    source: 'TEST_FAMPAY_LATE',
    rawSnippet: FAMPAY_BODY
  });
  check('Late FamPay payment (8 min after expiry) revives EXPIRED order to PAID', lateResult.matched === true && lateResult.order.status === 'PAID', JSON.stringify(lateResult).substring(0, 200));
  const lateRow = await query.get('SELECT status FROM orders WHERE order_code = ?', [lateCode]);
  check('Revived order persisted as PAID in DB', lateRow && lateRow.status === 'PAID', `got ${lateRow && lateRow.status}`);

  // Duplicate protection on the revived payment must still hold.
  const dupResult = await processIncomingPayment({
    amount: famParsed.amount,
    utr: famParsed.utr,
    sender: famParsed.sender,
    receivedAt: new Date(receivedAt + 1000),
    source: 'TEST_FAMPAY_LATE',
    rawSnippet: FAMPAY_BODY
  });
  check('Duplicate FMPIB payment still rejected', dupResult.matched === false && dupResult.reason === 'DUPLICATE_PAYMENT', JSON.stringify(dupResult).substring(0, 160));

  // 2) Paytm note-based deterministic match.
  const noteCode = `ORD-TN${suffix}`;
  cleanupOrders.push(noteCode);
  const noteBody = `${PAYTM_BODY}
Note: ${noteCode}`;
  const noteParsed = parsePaymentEmail(PAYTM_SUBJECT, noteBody, new Date());
  check('Paytm variant email: gateway order code extracted from Note', noteParsed.gatewayOrderCode === noteCode, `got ${noteParsed.gatewayOrderCode}`);
  cleanupUtrs.push(noteParsed.utr);
  const now2 = Date.now();
  await query.run(
    `INSERT INTO orders (order_code, amount, base_amount, customer_name, status, created_at, expires_at)
     VALUES (?, ?, ?, 'Paytm Note Test', 'PENDING', ?, ?)`,
    [noteCode, 600, 600, now2, now2 + 5 * 60 * 1000]
  );
  const noteResult = await processIncomingPayment({
    amount: noteParsed.amount,
    utr: noteParsed.utr,
    orderCode: noteParsed.gatewayOrderCode,
    sender: noteParsed.sender,
    receivedAt: new Date(now2 + 5000),
    source: 'TEST_PAYTM_NOTE',
    rawSnippet: noteBody
  });
  check('Paytm note payment deterministically matches its order to PAID', noteResult.matched === true && noteResult.order.status === 'PAID', JSON.stringify(noteResult).substring(0, 200));

  // 3) Step-0 amount guard: right order code, WRONG amount -> no PAID.
  const guardCode = `ORD-GRD${suffix}`;
  cleanupOrders.push(guardCode);
  const guardUtr = `GUARD-${Date.now()}`;
  cleanupUtrs.push(guardUtr);
  const now3 = Date.now();
  await query.run(
    `INSERT INTO orders (order_code, amount, base_amount, customer_name, status, created_at, expires_at)
     VALUES (?, ?, ?, 'Guard Test', 'PENDING', ?, ?)`,
    [guardCode, 700, 700, now3, now3 + 5 * 60 * 1000]
  );
  const guardResult = await processIncomingPayment({
    amount: 650,
    utr: guardUtr,
    orderCode: guardCode,
    sender: 'Guard Tester',
    receivedAt: new Date(now3 + 5000),
    source: 'TEST_GUARD',
    rawSnippet: ''
  });
  check('Order-code match with wrong amount does NOT mark order paid', guardResult.matched === false, JSON.stringify(guardResult).substring(0, 160));
  const guardRow = await query.get('SELECT status FROM orders WHERE order_code = ?', [guardCode]);
  check('Guard order remains PENDING in DB', guardRow && guardRow.status === 'PENDING', `got ${guardRow && guardRow.status}`);

  // 4) Label-free bare order code (PhonePe format, no label word
  // anywhere) deterministically matches its order.
  const bareCode = `ORD-BARE${suffix}`;
  cleanupOrders.push(bareCode);
  const bareUtr = `423589${suffix}`;
  cleanupUtrs.push(bareUtr);
  const bareBody = `Payment Received
₹ 450.00
Payment received of ₹ 450.00 from ROHIT VERMA via PhonePe.
Transaction ID: T2609141307521577368395
UTR: ${bareUtr}
Credited to Bank Account ending in 4321.
${bareCode}`;
  const bareParsed = parsePaymentEmail('Payment Received', bareBody, new Date());
  check('Label-free integration: parsed gatewayOrderCode', bareParsed.gatewayOrderCode === bareCode, `got ${bareParsed.gatewayOrderCode}`);
  const now4 = Date.now();
  await query.run(
    `INSERT INTO orders (order_code, amount, base_amount, customer_name, status, created_at, expires_at)
     VALUES (?, ?, ?, 'Bare Code Test', 'PENDING', ?, ?)`,
    [bareCode, 450, 450, now4, now4 + 5 * 60 * 1000]
  );
  const bareResult = await processIncomingPayment({
    amount: bareParsed.amount,
    utr: bareParsed.utr,
    orderCode: bareParsed.gatewayOrderCode,
    sender: bareParsed.sender,
    receivedAt: new Date(now4 + 5000),
    source: 'TEST_BARE_CODE',
    rawSnippet: bareBody
  });
  check('Label-free integration: bare-code payment deterministically matches order to PAID', bareResult.matched === true && bareResult.order.status === 'PAID', JSON.stringify(bareResult).substring(0, 200));

  // Cleanup test rows
  for (const code of cleanupOrders) {
    await query.run('DELETE FROM orders WHERE order_code = ?', [code]).catch(() => {});
  }
  for (const utr of cleanupUtrs) {
    await query.run('DELETE FROM payments WHERE utr = ?', [utr]).catch(() => {});
  }
}

async function main() {
  parserTests();
  await integrationTests();
  console.log(`\nFamPay/Paytm Results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    console.error('❌ testFamPayPaytm FAILED');
    process.exit(1);
  }
  console.log('🎉 ALL FAMPAY/PAYTM TESTS PASSED!\n');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
