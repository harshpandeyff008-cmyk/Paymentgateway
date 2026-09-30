import { initDatabase, closeDatabase, updateUserImapBankingLink, updateUserGoogleBankingLink, getUserByEmail, query } from '../db/database.js';
import { CloudSyncService } from '../src/services/cloudSync.service.js';

async function runTest() {
  console.log('--- TEST: Merchant Banking Persistence & Memory ---');
  await initDatabase();

  const testEmail = 'merchant_banking_test_' + Date.now() + '@example.com';

  // 1. Create a base user
  const apiKey = 'pg_live_test_' + Date.now();
  await query.run(
    `INSERT INTO users (email, name, role, plan, qr_credits, api_key, created_at, updated_at)
     VALUES (?, 'Test Merchant', 'user', 'MONTHLY', 100, ?, ?, ?)`,
    [testEmail, apiKey, Date.now(), Date.now()]
  );

  let user = await getUserByEmail(testEmail);
  console.log('User created:', user.email, 'Plan:', user.plan);

  // 2. Link IMAP Bank Email
  console.log('2. Linking IMAP banking email...');
  const updatedImap = await updateUserImapBankingLink(testEmail, {
    upiVpa: 'testmerchant@okhdfcbank',
    businessName: 'Test Merchant Store',
    upiProvider: 'HDFC',
    imapEmail: 'bankalerts_merchant@gmail.com',
    imapAppPass: 'abcd efgh ijkl mnop',
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapSecure: 1
  });

  if (updatedImap.gmail_connected === 1 && updatedImap.gmail_email === 'bankalerts_merchant@gmail.com' && updatedImap.settlement_type === 'IMAP') {
    console.log('✅ IMAP Banking linked in SQLite successfully!');
  } else {
    throw new Error('IMAP linking failed in SQLite');
  }

  // 3. Verify Cloud RTDB Persistence
  console.log('3. Verifying Firebase RTDB persistence...');
  const cloudUser = await CloudSyncService.getUser(testEmail);
  if (cloudUser && cloudUser.gmail_email === 'bankalerts_merchant@gmail.com' && cloudUser.gmail_app_pass === 'abcd efgh ijkl mnop' && cloudUser.upi_vpa === 'testmerchant@okhdfcbank') {
    console.log('✅ Merchant banking credentials permanently saved in Firebase RTDB!');
  } else {
    throw new Error('Firebase RTDB verification failed: ' + JSON.stringify(cloudUser));
  }

  // 4. Test Safe Merge (simulate plan upgrade/website update without banking params)
  console.log('4. Testing safe merge on user update...');
  const partialUserUpdate = {
    email: testEmail,
    plan: 'YEARLY',
    website_url: 'https://testmerchant.com'
  };
  await CloudSyncService.saveUser(partialUserUpdate);
  const cloudUserAfterMerge = await CloudSyncService.getUser(testEmail);
  if (cloudUserAfterMerge.plan === 'YEARLY' && cloudUserAfterMerge.gmail_email === 'bankalerts_merchant@gmail.com' && cloudUserAfterMerge.gmail_app_pass === 'abcd efgh ijkl mnop') {
    console.log('✅ Safe merge verified! Plan upgraded to YEARLY without erasing banking credentials!');
  } else {
    throw new Error('Safe merge failed! Banking credentials were lost: ' + JSON.stringify(cloudUserAfterMerge));
  }

  // 5. Test Full Cloud Restore into clean SQLite state
  console.log('5. Testing cloud restore after server restart...');
  // Wipe SQLite row for test merchant to simulate Render server reboot
  await query.run('DELETE FROM users WHERE email = ?', [testEmail]);
  let checkDeleted = await getUserByEmail(testEmail);
  if (checkDeleted) throw new Error('Failed to delete user for simulated reboot');

  // Run restoreAllFromCloud
  await CloudSyncService.restoreAllFromCloud(query);
  const restoredUser = await getUserByEmail(testEmail);
  if (restoredUser && restoredUser.gmail_connected === 1 && restoredUser.gmail_email === 'bankalerts_merchant@gmail.com' && restoredUser.gmail_app_pass === 'abcd efgh ijkl mnop' && restoredUser.upi_vpa === 'testmerchant@okhdfcbank') {
    console.log('✅ Cloud restore verified! Merchant banking credentials restored 100% after server restart!');
  } else {
    throw new Error('Cloud restore failed to restore banking credentials: ' + JSON.stringify(restoredUser));
  }

  // Clean up test record from cloud and DB
  const encKey = encodeURIComponent(testEmail).replace(/\./g, '_').replace(/[@$#\[\]\/]/g, '_');
  await fetch(`https://upigateway-ccaa4-default-rtdb.firebaseio.com/users/${encKey}.json`, { method: 'DELETE' });
  await query.run('DELETE FROM users WHERE email = ?', [testEmail]);

  console.log('🎉 ALL PERSISTENCE TESTS PASSED SUCCESSFULLY!');
  await closeDatabase();
}

runTest().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
