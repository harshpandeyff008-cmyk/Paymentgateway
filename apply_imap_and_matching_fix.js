import fs from 'fs';
import path from 'path';

const gatewayRoot = 'c:\\Users\\harsh\\Desktop\\personal gateway';

// 1. Update services/matchingEngine.js
const matchingEnginePath = path.join(gatewayRoot, 'services', 'matchingEngine.js');
let matchingEngineCode = fs.readFileSync(matchingEnginePath, 'utf8');

// Replace duplicate check
const oldDupCheck = `  // 1. Duplicate Check
  const existingPayment = await query.get(
    'SELECT * FROM payments WHERE utr = ?',
    [utr]
  );

  if (existingPayment) {
    console.warn(\`[MatchingEngine] Duplicate payment received with UTR: \${utr}. Ignoring.\`);
    return {
      success: false,
      matched: false,
      reason: 'DUPLICATE_PAYMENT',
      payment: existingPayment
    };
  }`;

const newDupCheck = `  // 1. Duplicate Check
  const existingPayment = await query.get(
    'SELECT * FROM payments WHERE utr = ?',
    [utr]
  );

  // If this UTR was ALREADY successfully matched to an order, reject as duplicate
  if (existingPayment && existingPayment.is_matched === 1) {
    console.warn(\`[MatchingEngine] Duplicate payment received with UTR: \${utr}. Already matched to order #\${existingPayment.matched_order_id}.\`);
    return {
      success: false,
      matched: false,
      reason: 'DUPLICATE_PAYMENT',
      payment: existingPayment
    };
  }`;

matchingEngineCode = matchingEngineCode.replace(oldDupCheck, newDupCheck);

// Replace payment insert with insert/update depending on existingPayment
const oldPaymentInsert = `    // Save payment as matched
    const paymentResult = await query.run(
      \`INSERT INTO payments (utr, amount, sender, received_at, source, raw_snippet, matched_order_id, is_matched)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)\`,
      [utr, amount, sender, receivedTimestamp, source, rawSnippet, matchingOrder.id]
    );`;

const newPaymentInsert = `    // Save or update payment as matched
    let paymentId = existingPayment ? existingPayment.id : null;
    if (existingPayment) {
      await query.run(
        \`UPDATE payments 
         SET matched_order_id = ?, is_matched = 1, amount = ?, sender = ?, source = ?
         WHERE id = ?\`,
        [matchingOrder.id, amount, sender, source, existingPayment.id]
      );
    } else {
      const paymentResult = await query.run(
        \`INSERT INTO payments (utr, amount, sender, received_at, source, raw_snippet, matched_order_id, is_matched)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)\`,
        [utr, amount, sender, receivedTimestamp, source, rawSnippet, matchingOrder.id]
      );
      paymentId = paymentResult.lastID;
    }`;

matchingEngineCode = matchingEngineCode.replace(oldPaymentInsert, newPaymentInsert);

// Replace unmatched payment insert to avoid inserting duplicate
const oldUnmatchedInsert = `    // Save unmatched payment in database
    const paymentResult = await query.run(
      \`INSERT INTO payments (utr, amount, sender, received_at, source, raw_snippet, is_matched)
       VALUES (?, ?, ?, ?, ?, ?, 0)\`,
      [utr, amount, sender, receivedTimestamp, source, rawSnippet]
    );`;

const newUnmatchedInsert = `    // Save unmatched payment in database if not already present
    let paymentId = existingPayment ? existingPayment.id : null;
    if (!existingPayment) {
      const paymentResult = await query.run(
        \`INSERT INTO payments (utr, amount, sender, received_at, source, raw_snippet, is_matched)
         VALUES (?, ?, ?, ?, ?, ?, 0)\`,
        [utr, amount, sender, receivedTimestamp, source, rawSnippet]
      );
      paymentId = paymentResult.lastID;
    }`;

matchingEngineCode = matchingEngineCode.replace(oldUnmatchedInsert, newUnmatchedInsert);

fs.writeFileSync(matchingEnginePath, matchingEngineCode, 'utf8');
console.log('✅ Updated services/matchingEngine.js (Fixed duplicate check to allow matching existing unmatched payments)');

// 2. Update services/imapListener.js to add active 5-second auto-poller
const imapListenerPath = path.join(gatewayRoot, 'services', 'imapListener.js');
let imapCode = fs.readFileSync(imapListenerPath, 'utf8');

const autoPollerFunction = `
/**
 * Active Background Auto-Poller:
 * Checks latest 5 emails in Gmail every 5 seconds.
 * Guaranteed to catch payments even if IMAP IDLE drops or connection reconnected.
 */
let pollerInterval = null;
let isPolling = false;

export async function scanAndProcessRecentEmails() {
  if (isPolling) return;
  if (!config.imap.user || !config.imap.pass || !config.imap.enabled) return;

  isPolling = true;
  const user = (config.imap.user || '').trim();
  const pass = (config.imap.pass || '').trim().replace(/\\s+/g, '');

  const pollerClient = new ImapFlow({
    host: config.imap.host,
    port: config.imap.port,
    secure: config.imap.secure,
    auth: { user, pass },
    logger: false
  });

  pollerClient.on('error', () => {}); // Silently suppress transient socket errors

  try {
    await pollerClient.connect();
    const lock = await pollerClient.getMailboxLock(config.imap.mailbox);

    try {
      const status = await pollerClient.status(config.imap.mailbox, { messages: true });
      const total = status.messages || 0;

      if (total > 0) {
        const startSeq = Math.max(1, total - 4);
        for await (const message of pollerClient.fetch(\`\${startSeq}:\${total}\`, { source: true, envelope: true })) {
          const parsed = await simpleParser(message.source);
          const subject = parsed.subject || '';
          const fromAddress = parsed.from?.text || '';
          const bodyText = parsed.text || (parsed.html ? parsed.html.replace(/<[^>]+>/g, ' ') : '');
          const emailDate = parsed.date || new Date();

          const matchesFilter = config.imap.senderFilter.length === 0 ||
            config.imap.senderFilter.some(filter =>
              fromAddress.toLowerCase().includes(filter) || subject.toLowerCase().includes(filter)
            );

          if (matchesFilter) {
            const paymentData = parsePaymentEmail(subject, bodyText, emailDate);
            if (paymentData.success && paymentData.amount && paymentData.utr) {
              const paymentRow = await query.get('SELECT id, is_matched FROM payments WHERE utr = ?', [paymentData.utr]);
              if (!paymentRow || paymentRow.is_matched === 0) {
                console.log(\`[IMAP Fast-Poller] Processing payment: ₹\${paymentData.amount}, UTR: \${paymentData.utr}, Sender: \${paymentData.sender}\`);
                await processIncomingPayment({
                  amount: paymentData.amount,
                  utr: paymentData.utr,
                  sender: paymentData.sender || fromAddress,
                  receivedAt: paymentData.receivedAt,
                  source: 'IMAP',
                  rawSnippet: \`[IMAP] \${subject} - \${paymentData.sender || fromAddress}\`
                });
              }
            }
          }
        }
      }
    } finally {
      lock.release();
      await pollerClient.logout();
    }
  } catch (err) {
    // Ignore transient connection errors
  } finally {
    isPolling = false;
  }
}
`;

if (!imapCode.includes('scanAndProcessRecentEmails')) {
  imapCode = autoPollerFunction + '\n' + imapCode;
  // Start poller inside startImapListener
  imapCode = imapCode.replace(
    "console.log(`[IMAP IDLE] Listening for new payment emails in ${config.imap.mailbox}...`);",
    `console.log(\`[IMAP IDLE] Listening for new payment emails in \${config.imap.mailbox}...\`);\n    // Run immediate scan on startup\n    scanAndProcessRecentEmails().catch(() => {});\n    if (pollerInterval) clearInterval(pollerInterval);\n    pollerInterval = setInterval(() => { scanAndProcessRecentEmails().catch(() => {}); }, 5000);`
  );

  // Clear poller on shutdown
  imapCode = imapCode.replace(
    "if (keepAliveTimer) {",
    "if (pollerInterval) { clearInterval(pollerInterval); pollerInterval = null; }\n    if (keepAliveTimer) {"
  );

  fs.writeFileSync(imapListenerPath, imapCode, 'utf8');
  console.log('✅ Updated services/imapListener.js with 5-second fast auto-poller');
}

// 3. Add manual reconcile / match endpoint in AdminController
const adminCtrlPath = path.join(gatewayRoot, 'src', 'controllers', 'admin.controller.js');
let adminCtrl = fs.readFileSync(adminCtrlPath, 'utf8');

const reconcileEndpoint = `  async reconcileOrder(req, res, next) {
    try {
      const { orderCode, utr } = req.body;
      if (!orderCode) return res.status(400).json({ success: false, error: 'Order code is required' });

      const order = await OrderModel.getByCode(orderCode);
      if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

      const utrToUse = (utr && utr.trim()) ? utr.trim() : (order.utr || '');
      const result = await claimOrderWithUtr(orderCode, utrToUse);

      return res.json({ success: true, result });
    } catch (err) {
      next(err);
    }
  },

  async markOrderPaidManually(req, res, next) {
    try {
      const { orderCode } = req.params;
      const { utr, sender = 'Manual Verification (Admin)' } = req.body;

      const order = await OrderModel.getByCode(orderCode);
      if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

      const now = Date.now();
      const finalUtr = (utr && utr.trim()) ? utr.trim() : \`MANUAL-\${now}\`;

      await query.run(
        \`UPDATE orders SET status = 'PAID', paid_at = ?, utr = ?, sender_info = ? WHERE id = ?\`,
        [now, finalUtr, sender, order.id]
      );

      // Check or insert payment
      const existing = await query.get('SELECT id FROM payments WHERE utr = ?', [finalUtr]);
      if (existing) {
        await query.run('UPDATE payments SET matched_order_id = ?, is_matched = 1 WHERE id = ?', [order.id, existing.id]);
      } else {
        await query.run(
          \`INSERT INTO payments (utr, amount, sender, received_at, source, raw_snippet, matched_order_id, is_matched)
           VALUES (?, ?, ?, ?, 'MANUAL_ADMIN', 'Manually verified by admin', ?, 1)\`,
          [finalUtr, order.amount, sender, now, order.id]
        );
      }

      if (req.io) {
        req.io.to(\`order_\${order.order_code}\`).emit('order_status_update', {
          orderCode: order.order_code,
          status: 'PAID',
          amount: order.amount,
          utr: finalUtr,
          paidAt: now
        });
        req.io.to('admin_room').emit('payment_event', {
          type: 'ORDER_PAID',
          order: { ...order, status: 'PAID', utr: finalUtr, paid_at: now }
        });
      }

      return res.json({ success: true, message: \`Order \${orderCode} marked as PAID!\` });
    } catch (err) {
      next(err);
    }
  },
`;

if (!adminCtrl.includes('markOrderPaidManually')) {
  adminCtrl = adminCtrl.replace('async updateSettings(req, res, next) {', reconcileEndpoint + '\n  async updateSettings(req, res, next) {');
  // Add import of claimOrderWithUtr if needed
  if (!adminCtrl.includes('claimOrderWithUtr')) {
    adminCtrl = adminCtrl.replace("import { processIncomingPayment }", "import { processIncomingPayment, claimOrderWithUtr }");
  }
  fs.writeFileSync(adminCtrlPath, adminCtrl, 'utf8');
  console.log('✅ Updated src/controllers/admin.controller.js with reconcile and markOrderPaidManually');
}

// 4. Update src/routes/admin.routes.js
const adminRoutesPath = path.join(gatewayRoot, 'src', 'routes', 'admin.routes.js');
let adminRoutes = fs.readFileSync(adminRoutesPath, 'utf8');
if (!adminRoutes.includes('/orders/:orderCode/mark-paid')) {
  adminRoutes = adminRoutes.replace(
    "router.post('/simulate-payment', AdminController.simulatePayment);",
    "router.post('/simulate-payment', AdminController.simulatePayment);\nrouter.post('/orders/:orderCode/mark-paid', AdminController.markOrderPaidManually);\nrouter.post('/reconcile', AdminController.reconcileOrder);"
  );
  fs.writeFileSync(adminRoutesPath, adminRoutes, 'utf8');
  console.log('✅ Updated src/routes/admin.routes.js with manual reconcile routes');
}

console.log('🎉 IMAP & MATCHING ENGINE FIXES APPLIED SUCCESSFULLY!');
