import { initDatabase, closeDatabase, query, getUserByEmail } from '../db/database.js';
import { OrderController } from '../src/controllers/order.controller.js';
import { UserController } from '../src/controllers/user.controller.js';

async function testPaymentLinkGating() {
  console.log('--- TEST: Payment Link Membership Gating ---');
  await initDatabase();

  const freeUserEmail = 'free_user_' + Date.now() + '@example.com';
  const memberUserEmail = 'member_user_' + Date.now() + '@example.com';

  await query.run(
    `INSERT INTO users (email, name, role, plan, qr_credits, api_key, created_at, updated_at)
     VALUES (?, 'Free Merchant', 'user', 'NONE', 0, ?, ?, ?)`,
    [freeUserEmail, 'pg_live_free_' + Date.now(), Date.now(), Date.now()]
  );

  await query.run(
    `INSERT INTO users (email, name, role, plan, qr_credits, api_key, created_at, updated_at)
     VALUES (?, 'Member Merchant', 'user', 'MONTHLY', 100, ?, ?, ?)`,
    [memberUserEmail, 'pg_live_member_' + Date.now(), Date.now(), Date.now()]
  );

  // Test 1: Free User attempts to create payment link -> Must be blocked with 403
  let freeStatus = null;
  let freeError = null;
  const mockReqFree = {
    body: { userEmail: freeUserEmail, amount: 250, customerName: 'Buyer A' },
    ip: '127.0.0.1',
    headers: {}
  };
  const mockResFree = {
    status(code) { freeStatus = code; return this; },
    json(data) { freeError = data.error; return this; }
  };

  await UserController.createPaymentLink(mockReqFree, mockResFree);
  if (freeStatus === 403 && freeError && freeError.includes('Membership Required')) {
    console.log('✅ Test 1 Passed: Free user was strictly blocked from creating payment links (HTTP 403)!');
  } else {
    throw new Error(`Test 1 Failed: Expected 403, got ${freeStatus}: ${freeError}`);
  }

  // Test 2: Member User attempts to create payment link -> Must succeed
  let memberStatus = 200;
  let memberData = null;
  const mockReqMember = {
    body: { userEmail: memberUserEmail, amount: 500, customerName: 'Buyer B', expiryMinutes: 120 },
    ip: '127.0.0.1',
    headers: {}
  };
  const mockResMember = {
    status(code) { memberStatus = code; return this; },
    json(data) { memberData = data; return this; }
  };

  await UserController.createPaymentLink(mockReqMember, mockResMember);
  if (memberData && memberData.success && memberData.order && memberData.order.orderCode && memberData.order.orderCode.startsWith('LNK-')) {
    console.log('✅ Test 2 Passed: Member user created payment link successfully! OrderCode:', memberData.order.orderCode, 'Payable:', memberData.order.amount);
  } else {
    throw new Error(`Test 2 Failed: ${JSON.stringify(memberData)}`);
  }

  // Clean up
  await query.run('DELETE FROM users WHERE email IN (?, ?)', [freeUserEmail, memberUserEmail]);
  await query.run('DELETE FROM orders WHERE user_email IN (?, ?)', [freeUserEmail, memberUserEmail]);

  console.log('🎉 ALL PAYMENT LINK GATING TESTS PASSED!');
  await closeDatabase();
}

testPaymentLinkGating().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
