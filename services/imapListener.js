
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { config } from '../config.js';
import { query, logActivity } from '../db/database.js';
import { parsePaymentEmail } from './emailParser.js';
import { processIncomingPayment, reconcileUnmatchedPayments } from './matchingEngine.js';
import { startGmailWatcher, stopGmailWatcher } from './gmailWatcher.service.js';

/**
 * Active Background Auto-Poller:
 * Checks latest 5 emails in Admin Gmail every 5 seconds for subscription payments.
 * Checks connected merchants' Gmails every 10 seconds for customer store orders.
 */
let pollerInterval = null;
let isPolling = false;
let isMerchantPolling = false;

export async function scanAndProcessRecentEmails() {
  if (isPolling) return;
  if (!config.imap.user || !config.imap.pass || !config.imap.enabled) return;

  isPolling = true;
  const user = (config.imap.user || '').trim();
  const pass = (config.imap.pass || '').trim().replace(/\s+/g, '');

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
        const startSeq = Math.max(1, total - 9);
        for await (const message of pollerClient.fetch(`${startSeq}:${total}`, { source: true, envelope: true })) {
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
            const paymentData = parsePaymentEmail(subject, bodyText, emailDate, config.merchant?.upiProvider || 'AUTO');
            if (paymentData.success && paymentData.amount && paymentData.utr) {
              const paymentRow = await query.get('SELECT id, is_matched FROM payments WHERE utr = ?', [paymentData.utr]);
              if (!paymentRow || paymentRow.is_matched === 0) {
                console.log(`[Admin IMAP Poller] Processing payment: ₹${paymentData.amount}, UTR: ${paymentData.utr}${paymentData.gatewayOrderCode ? `, Order: ${paymentData.gatewayOrderCode}` : ''}, Sender: ${paymentData.sender}`);
                await processIncomingPayment({
                  amount: paymentData.amount,
                  utr: paymentData.utr,
                  orderCode: paymentData.gatewayOrderCode || null,
                  sender: paymentData.sender || fromAddress,
                  receivedAt: paymentData.receivedAt,
                  source: 'IMAP',
                  rawSnippet: bodyText || `[Admin IMAP] ${subject} - ${paymentData.sender || fromAddress}`
                });
                schedulePaymentMonitoringSync();
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

let merchantPollerInterval = null;

export function startMerchantImapPoller() {
  if (merchantPollerInterval) return;
  scanAndProcessMerchantEmails().catch(() => {});
  merchantPollerInterval = setInterval(() => {
    scanAndProcessMerchantEmails().catch(() => {});
  }, 5000);
  console.log('[Merchant IMAP Poller] Initialized background merchant IMAP monitor (5s fallback interval with instant IDLE push).');
}

export function stopMerchantImapPoller() {
  if (merchantPollerInterval) {
    clearInterval(merchantPollerInterval);
    merchantPollerInterval = null;
  }
  for (const [email, entry] of activeMerchantClients.entries()) {
    if (entry.keepAliveTimer) clearInterval(entry.keepAliveTimer);
    if (entry.client) {
      try { entry.client.logout(); } catch (_) {}
    }
  }
  activeMerchantClients.clear();
}

const activeMerchantClients = new Map();

async function getOrCreateMerchantClient(merchant) {
  const email = merchant.email;
  const user = (merchant.gmail_email || '').trim();
  const pass = (merchant.gmail_app_pass || '').trim().replace(/\s+/g, '');
  const credKey = `${user}:${pass}:${merchant.imap_host || 'imap.gmail.com'}:${merchant.imap_port || 993}`;

  let existing = activeMerchantClients.get(email);
  if (existing) {
    if (existing.credKey !== credKey) {
      if (existing.keepAliveTimer) clearInterval(existing.keepAliveTimer);
      try { await existing.client.logout(); } catch (_) {}
      activeMerchantClients.delete(email);
      existing = null;
    } else if (existing.client && existing.client.usable) {
      return existing.client;
    }
  }

  const merchantHost = (merchant.imap_host || config.imap.host || 'imap.gmail.com').trim();
  const merchantPort = Number(merchant.imap_port) || config.imap.port || 993;
  const merchantSecure = merchant.imap_secure !== 0;

  const client = new ImapFlow({
    host: merchantHost,
    port: merchantPort,
    secure: merchantSecure,
    auth: { user, pass },
    logger: false,
    clientInfo: { name: 'UPI Gateway', version: '1.0.0' },
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 15000
  });

  client.on('error', (err) => {
    console.warn(`[Merchant IMAP Error for ${email}]:`, err.message);
    const ent = activeMerchantClients.get(email);
    if (ent && ent.keepAliveTimer) clearInterval(ent.keepAliveTimer);
    activeMerchantClients.delete(email);
  });

  client.on('close', () => {
    const ent = activeMerchantClients.get(email);
    if (ent && ent.keepAliveTimer) clearInterval(ent.keepAliveTimer);
    activeMerchantClients.delete(email);
  });

  await client.connect();
  console.log(`[Merchant IMAP] ✅ Connected to Gmail for merchant: ${email} (${user})`);

  // Start keepalive ping every 2 minutes
  const keepAliveTimer = setInterval(async () => {
    if (client && client.usable) {
      try { await client.noop(); } catch (_) {}
    }
  }, 2 * 60 * 1000);

  const entry = { client, credKey, isScanning: false, keepAliveTimer };
  activeMerchantClients.set(email, entry);

  // Attach instantaneous IMAP IDLE push notification
  client.on('exists', async (data) => {
    console.log(`[Merchant IMAP Push] ⚡ Realtime email detected for ${email}! Total inbox count: ${data.count}`);
    scanSingleMerchant(merchant, client).catch(() => {});
  });

  // Background IDLE Loop for true real-time push
  (async () => {
    while (client && client.usable) {
      try {
        await client.idle();
      } catch (_) {
        break;
      }
    }
  })().catch(() => {});

  return client;
}

async function scanSingleMerchant(merchant, client) {
  if (!client || !client.usable) return;
  const entry = activeMerchantClients.get(merchant.email);
  if (entry && entry.isScanning) return; // Prevent lock conflict
  if (entry) entry.isScanning = true;

  try {
    const lock = await client.getMailboxLock(config.imap.mailbox || 'INBOX');
    try {
      const status = await client.status(config.imap.mailbox || 'INBOX', { messages: true });
      const total = status.messages || 0;
      if (total > 0) {
        const startSeq = Math.max(1, total - 7);
        for await (const message of client.fetch(`${startSeq}:${total}`, { source: true, envelope: true })) {
          const parsed = await simpleParser(message.source);
          const subject = parsed.subject || '';
          const fromAddress = parsed.from?.text || '';
          const bodyText = parsed.text || (parsed.html ? parsed.html.replace(/<[^>]+>/g, ' ') : '');
          const emailDate = parsed.date || new Date();

          const paymentData = parsePaymentEmail(subject, bodyText, emailDate, merchant?.upi_provider || 'AUTO');
          if (paymentData.success && paymentData.amount && paymentData.utr) {
            const paymentRow = await query.get('SELECT id, is_matched FROM payments WHERE utr = ?', [paymentData.utr]);
            if (!paymentRow || paymentRow.is_matched === 0) {
              console.log(`[Merchant IMAP] ⚡ Payment matched for ${merchant.email}: ₹${paymentData.amount}, UTR: ${paymentData.utr}${paymentData.gatewayOrderCode ? `, Order: ${paymentData.gatewayOrderCode}` : ''}`);
              await processIncomingPayment({
                amount: paymentData.amount,
                utr: paymentData.utr,
                orderCode: paymentData.gatewayOrderCode || null,
                sender: paymentData.sender || fromAddress,
                receivedAt: paymentData.receivedAt,
                source: 'MERCHANT_IMAP_PUSH',
                rawSnippet: bodyText || `[Merchant: ${merchant.email}] ${subject} - ${paymentData.sender || fromAddress}`,
                merchantEmail: merchant.email
              });
              schedulePaymentMonitoringSync();
            }
          }
        }
      }
    } finally {
      lock.release();
    }
  } catch (scanErr) {
    // Suppress transient lock errors
  } finally {
    if (entry) entry.isScanning = false;
  }
}

/**
 * Connected Merchants IMAP Poller:
 * Checks registered merchants who activated their Bank Gmail in Settlement Engine.
 * Automatically verifies customer payments for their store API orders.
 */
export async function scanAndProcessMerchantEmails() {
  if (isMerchantPolling) return;
  isMerchantPolling = true;

  try {
    const merchants = await query.all(
      `SELECT email, upi_vpa, upi_provider, business_name, gmail_email, gmail_app_pass, imap_host, imap_port, imap_secure 
       FROM users 
       WHERE gmail_connected = 1 
         AND gmail_email IS NOT NULL 
         AND gmail_email != '' 
         AND gmail_app_pass IS NOT NULL 
         AND gmail_app_pass != ''`
    );

    if (!merchants || merchants.length === 0) return;

    // Process all merchants in parallel using reusable persistent connections
    await Promise.allSettled(merchants.map(async (merchant) => {
      const user = (merchant.gmail_email || '').trim();
      const pass = (merchant.gmail_app_pass || '').trim().replace(/\s+/g, '');
      if (!user || !pass) return;

      try {
        const client = await getOrCreateMerchantClient(merchant);
        if (client && client.usable) {
          await scanSingleMerchant(merchant, client);
        }
      } catch (merr) {
        console.warn(`[Merchant IMAP Connection Error]: Could not connect for ${merchant.email}:`, merr.message);
        activeMerchantClients.delete(merchant.email);
      }
    }));
  } catch (err) {
    console.error('[Merchant Poller Error]:', err.message);
  } finally {
    isMerchantPolling = false;
  }
}

let client = null;
let isRunning = false;
let globalIo = null;
let activeMailboxLock = null;
let keepAliveTimer = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
let monitoringSyncTimer = null;
let monitoringSyncPromise = null;

let statusInfo = {
  enabled: config.imap.enabled,
  connected: false,
  listening: false,
  lastCheckedAt: null,
  lastError: null,
  processedCount: 0,
  user: config.imap.user || '',
  host: config.imap.host || 'imap.gmail.com'
};

export function getImapStatus() {
  return {
    ...statusInfo,
    enabled: config.imap.enabled,
    user: config.imap.user || ''
  };
}

/** Start monitors only while at least one payment order can still be matched. */
export async function syncPaymentMonitoring(io = null) {
  if (io) globalIo = io;
  if (monitoringSyncPromise) return monitoringSyncPromise;

  monitoringSyncPromise = (async () => {
    const pending = await query.get(
      `SELECT COUNT(*) AS count FROM orders WHERE status = 'PENDING' AND expires_at > ?`,
      [Date.now()]
    );
    const pendingCount = Number(pending?.count || 0);

    const merchantCredsRow = await query.get(
      `SELECT COUNT(*) AS count FROM users WHERE gmail_connected = 1 AND ((gmail_email != '' AND gmail_app_pass != '') OR (gmail_access_token != ''))`
    );
    const hasMerchantCreds = Number(merchantCredsRow?.count || 0) > 0;
    const hasImapCreds = Boolean(config.imap.enabled && config.imap.user && config.imap.pass);

    if (pendingCount === 0 && !hasImapCreds && !hasMerchantCreds) {
      const wasActive = isRunning || Boolean(pollerInterval) || Boolean(reconnectTimer) || Boolean(merchantPollerInterval);
      await stopImapListener(false);
      stopGmailWatcher();
      stopMerchantImapPoller();
      if (wasActive) console.log('[Payment Monitoring] No active orders and no IMAP/banking credentials configured; all email monitors are stopped.');
      return { active: false, pendingCount: 0 };
    }

    startGmailWatcher();
    startMerchantImapPoller();
    if (config.imap.enabled && !isRunning && hasImapCreds) {
      await startImapListener(globalIo);
    }
    return { active: true, pendingCount };
  })();

  try {
    return await monitoringSyncPromise;
  } finally {
    monitoringSyncPromise = null;
  }
}

export function schedulePaymentMonitoringSync() {
  if (monitoringSyncTimer) clearTimeout(monitoringSyncTimer);
  monitoringSyncTimer = setTimeout(() => {
    syncPaymentMonitoring(globalIo).catch(err => console.warn('[Payment Monitoring] State sync failed:', err.message));
  }, 0);
}

function scheduleReconnect() {
  if (reconnectTimer || !config.imap.enabled) return;
  const delay = Math.min(60000, 1000 * (2 ** reconnectAttempt));
  reconnectAttempt = Math.min(reconnectAttempt + 1, 6);
  console.log(`[IMAP] Reconnecting in ${Math.round(delay / 1000)} seconds...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    syncPaymentMonitoring(globalIo).catch(err => console.warn('[IMAP] Reconnect check failed:', err.message));
  }, delay);
}

/**
 * Test IMAP connection with given or configured credentials without keeping a persistent lock
 */
export async function testImapConnection(creds = {}) {
  const host = creds.host || config.imap.host;
  const port = parseInt(creds.port || config.imap.port, 10);
  const secure = creds.secure !== undefined ? creds.secure : config.imap.secure;
  const user = (creds.user || config.imap.user || '').trim();
  const pass = (creds.pass || config.imap.pass || '').trim().replace(/\s+/g, ''); // remove any accidental spaces in app password

  if (!user || !pass) {
    return {
      success: false,
      error: 'Gmail Address and 16-character App Password are required.'
    };
  }

  const testClient = new ImapFlow({
    host,
    port,
    secure,
    auth: { user, pass },
    logger: false
  });

  // Prevent unhandled error event crash on socket timeout or auth failure
  let connectionError = null;
  testClient.on('error', (err) => {
    connectionError = err;
  });

  try {
    await testClient.connect();
    const mailbox = await testClient.status(creds.mailbox || config.imap.mailbox || 'INBOX', { messages: true, unseen: true });
    await testClient.logout();

    return {
      success: true,
      user,
      host,
      totalMessages: mailbox.messages || 0,
      unseenMessages: mailbox.unseen || 0
    };
  } catch (err) {
    const errorToReport = connectionError || err;
    let friendlyError = errorToReport.message || 'Connection failed';
    const msg = friendlyError.toLowerCase();
    if (msg.includes('invalid credentials') || msg.includes('authenticationfailed') || msg.includes('command failed') || msg.includes('auth') || msg.includes('timeout')) {
      friendlyError = 'Invalid Gmail credentials or connection timeout. Make sure 2-Step Verification is ON in your Google Account and you are using a 16-character Google App Password (without spaces).';
    }
    return {
      success: false,
      error: friendlyError
    };
  }
}

/**
 * Fetch the latest 5 emails matching the filter for diagnostic inspection
 */
export async function fetchRecentPaymentEmails(limit = 5) {
  if (!config.imap.user || !config.imap.pass) {
    return { success: false, error: 'IMAP credentials not configured' };
  }

  const client = new ImapFlow({
    host: config.imap.host,
    port: config.imap.port,
    secure: config.imap.secure,
    auth: {
      user: config.imap.user,
      pass: config.imap.pass.replace(/\s+/g, '')
    },
    logger: false
  });

  client.on('error', (err) => {
    console.error('[IMAP Diagnostic Client Error]:', err.message);
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock(config.imap.mailbox);
    const emails = [];

    try {
      // Fetch the last `limit` messages from mailbox
      const status = await client.status(config.imap.mailbox, { messages: true });
      const total = status.messages;
      if (total > 0) {
        const startSeq = Math.max(1, total - limit + 1);
        for await (const message of client.fetch(`${startSeq}:${total}`, { source: true, envelope: true })) {
          const parsed = await simpleParser(message.source);
          const subject = parsed.subject || '';
          const from = parsed.from?.text || '';
          const body = parsed.text || (parsed.html ? parsed.html.replace(/<[^>]+>/g, ' ') : '');
          const paymentData = parsePaymentEmail(subject, body, parsed.date || new Date());

          emails.unshift({
            uid: message.uid,
            subject,
            from,
            date: parsed.date,
            parsedPayment: paymentData.success ? {
              amount: paymentData.amount,
              utr: paymentData.utr,
              sender: paymentData.sender
            } : null
          });
        }
      }
    } finally {
      lock.release();
      await client.logout();
    }

    return { success: true, emails };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Scan past emails from mailbox, extract payments, and build historical financial ledger
 */
export async function syncHistoricalPayments({ maxEmails = 100 } = {}) {
  const user = (config.imap.user || '').trim();
  const pass = (config.imap.pass || '').trim().replace(/\s+/g, '');

  if (!user || !pass) {
    return {
      success: false,
      error: 'Gmail credentials not configured in settings yet. Please add your email and 16-character Google App Password first.'
    };
  }

  const client = new ImapFlow({
    host: config.imap.host,
    port: config.imap.port,
    secure: config.imap.secure,
    auth: { user, pass },
    logger: false
  });

  let connectionError = null;
  client.on('error', (err) => {
    connectionError = err;
    console.error('[Historical Sync Client Error]:', err.message);
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock(config.imap.mailbox);

    let scannedCount = 0;
    let importedCount = 0;
    let totalImportedAmount = 0;
    let duplicateCount = 0;
    const importedList = [];

    try {
      const status = await client.status(config.imap.mailbox, { messages: true });
      const totalMessages = status.messages || 0;

      if (totalMessages === 0) {
        return {
          success: true,
          scannedCount: 0,
          importedCount: 0,
          duplicateCount: 0,
          totalAmount: 0,
          payments: []
        };
      }

      // Fetch the latest `maxEmails` messages (from end of mailbox)
      const startSeq = Math.max(1, totalMessages - maxEmails + 1);

      for await (const message of client.fetch(`${startSeq}:${totalMessages}`, { source: true, envelope: true })) {
        scannedCount++;
        const parsed = await simpleParser(message.source);
        const subject = parsed.subject || '';
        const fromAddress = parsed.from?.text || '';
        const bodyText = parsed.text || (parsed.html ? parsed.html.replace(/<[^>]+>/g, ' ') : '');
        const emailDate = parsed.date || new Date();

        // Run parser
        const payment = parsePaymentEmail(subject, bodyText, emailDate);

        if (payment.success && payment.amount) {
          // Check if UTR already exists in DB
          const existing = await query.get('SELECT id FROM payments WHERE utr = ?', [payment.utr]);
          if (existing) {
            duplicateCount++;
          } else {
            const receivedTimestamp = payment.receivedAt.getTime();
            const insertRes = await query.run(
              `INSERT INTO payments (utr, amount, sender, received_at, source, raw_snippet, is_matched)
               VALUES (?, ?, ?, ?, 'IMAP_HISTORICAL', ?, 0)`,
              [payment.utr, payment.amount, payment.sender || fromAddress, receivedTimestamp, payment.rawSnippet]
            );

            importedCount++;
            totalImportedAmount += payment.amount;
            importedList.push({
              id: insertRes.lastID,
              amount: payment.amount,
              utr: payment.utr,
              sender: payment.sender,
              sourceApp: payment.sourceApp,
              date: payment.receivedAt
            });
          }
        }
      }
    } finally {
      lock.release();
      await client.logout();
    }

    return {
      success: true,
      scannedCount,
      importedCount,
      duplicateCount,
      totalAmount: totalImportedAmount,
      payments: importedList
    };
  } catch (err) {
    const errorToReport = connectionError || err;
    return { success: false, error: errorToReport.message || 'Failed to sync historical emails' };
  }
}

/**
 * Start the persistent IMAP IDLE listener
 */
export async function startImapListener(io = null) {
  if (io) globalIo = io;

  if (isRunning) return;

  if (!config.imap.enabled) {
    console.log('[IMAP] IMAP listener is currently disabled.');
    statusInfo.enabled = false;
    statusInfo.connected = false;
    statusInfo.listening = false;
    if (globalIo) globalIo.to('admin_room').emit('imap_status', getImapStatus());
    return;
  }

  const user = (config.imap.user || '').trim();
  const pass = (config.imap.pass || '').trim().replace(/\s+/g, '');

  if (!user || !pass) {
    console.warn('[IMAP] Missing IMAP credentials in settings/env.');
    statusInfo.lastError = 'Missing Gmail credentials. Configure in Settings.';
    statusInfo.connected = false;
    statusInfo.listening = false;
    if (globalIo) globalIo.to('admin_room').emit('imap_status', getImapStatus());
    return;
  }

  statusInfo.enabled = true;
  statusInfo.user = user;
  isRunning = true;

  try {
    // Disconnect old client & timer if exists
    if (pollerInterval) { clearInterval(pollerInterval); pollerInterval = null; }
    if (keepAliveTimer) {
      clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    }
    if (activeMailboxLock) {
      try { activeMailboxLock.release(); } catch (_) {}
      activeMailboxLock = null;
    }
    if (client) {
      try { await client.logout(); } catch (_) {}
      client = null;
    }

    client = new ImapFlow({
      host: config.imap.host,
      port: config.imap.port,
      secure: config.imap.secure,
      auth: { user, pass },
      logger: false
    });

    client.on('error', (err) => {
      console.error('[IMAP Error]', err.message);
      statusInfo.connected = false;
      statusInfo.listening = false;
      statusInfo.lastError = err.message;
      if (globalIo) globalIo.to('admin_room').emit('imap_status', getImapStatus());
    });

    client.on('close', () => {
      console.log('[IMAP] Connection closed.');
      statusInfo.connected = false;
      statusInfo.listening = false;
      if (globalIo) globalIo.to('admin_room').emit('imap_status', getImapStatus());

      if (isRunning && config.imap.enabled) {
        isRunning = false;
        scheduleReconnect();
      }
    });

    console.log(`[IMAP] Connecting to ${config.imap.host} as ${user}...`);
    await client.connect();

    statusInfo.connected = true;
    statusInfo.lastError = null;
    reconnectAttempt = 0;
    console.log('[IMAP] Successfully authenticated with IMAP!');

    activeMailboxLock = await client.getMailboxLock(config.imap.mailbox);
    statusInfo.listening = true;
    statusInfo.lastCheckedAt = Date.now();
    if (globalIo) globalIo.to('admin_room').emit('imap_status', getImapStatus());

    await logActivity({
      eventType: 'IMAP_ACTIVE',
      status: 'SUCCESS',
      title: 'Gmail IMAP Listener Active',
      details: `Live push active for ${user} on mailbox ${config.imap.mailbox}.`
    });

    console.log(`[IMAP IDLE] Listening for new payment emails in ${config.imap.mailbox}...`);
    // Run immediate scan on startup
    scanAndProcessRecentEmails().catch(() => {});
    scanAndProcessMerchantEmails().catch(() => {});
    let reconcileTick = 0;
    if (pollerInterval) clearInterval(pollerInterval);
    pollerInterval = setInterval(() => {
      scanAndProcessRecentEmails().catch(() => {});
      reconcileTick++;
      if (reconcileTick % 5 === 0) {
        reconcileUnmatchedPayments().catch(() => {});
      }
    }, 3000);

    client.on('exists', async (data) => {
      console.log(`[IMAP] New email detected! Total inbox count: ${data.count}`);
      statusInfo.lastCheckedAt = Date.now();
      await fetchAndProcessLatestMessage(client, globalIo);
    });

    // Start 4-minute keepalive ping to maintain active socket connection
    keepAliveTimer = setInterval(async () => {
      if (client && client.usable && isRunning) {
        try {
          await client.noop();
        } catch (e) {
          console.warn('[IMAP Keepalive Ping Notice]:', e.message);
        }
      }
    }, 4 * 60 * 1000);

    // Run IDLE in background loop so this function returns immediately
    (async () => {
      while (isRunning && client && client.usable) {
        try {
          await client.idle();
        } catch (idleErr) {
          console.warn('[IMAP IDLE Loop Notice]:', idleErr.message);
          break;
        }
      }
    })().catch(err => {
      console.error('[IMAP Background Idle Error]:', err.message);
    });

  } catch (err) {
    console.error('[IMAP Start Failed]:', err.message);
    statusInfo.connected = false;
    statusInfo.listening = false;
    statusInfo.lastError = err.message;
    isRunning = false;
    if (globalIo) globalIo.to('admin_room').emit('imap_status', getImapStatus());
    await logActivity({
      eventType: 'IMAP_ERROR',
      status: 'FAILED',
      title: 'IMAP Connection Error',
      details: err.message
    });
    scheduleReconnect();
  }
}

async function fetchAndProcessLatestMessage(imapClient, io) {
  try {
    const message = await imapClient.fetchOne('*', { source: true, envelope: true });
    if (!message || !message.source) return;

    const parsed = await simpleParser(message.source);
    const subject = parsed.subject || '';
    const fromAddress = parsed.from?.text || '';
    // Strip HTML tags for clean text parsing
    const bodyText = parsed.text || (parsed.html ? parsed.html.replace(/<[^>]+>/g, ' ') : '');
    const emailDate = parsed.date || new Date();

    console.log(`[IMAP] Incoming email from: "${fromAddress}", Subject: "${subject}"`);

    // Check sender filter
    const matchesFilter = config.imap.senderFilter.length === 0 ||
      config.imap.senderFilter.some(filter =>
        fromAddress.toLowerCase().includes(filter) || subject.toLowerCase().includes(filter)
      );

    if (!matchesFilter) {
      console.log(`[IMAP] Skipped (does not match filter: ${config.imap.senderFilter.join(', ')})`);
      return;
    }

    const paymentData = parsePaymentEmail(subject, bodyText, emailDate, config.merchant?.upiProvider || 'AUTO');
    if (paymentData.success && paymentData.amount) {
      console.log(`[IMAP] ✅ Payment Extracted: ₹${paymentData.amount}, UTR: ${paymentData.utr}`);
      statusInfo.processedCount++;

      await logActivity({
        eventType: 'PAYMENT_RECEIVED',
        status: 'SUCCESS',
        title: `Payment Detected: ₹${paymentData.amount}`,
        details: `Extracted from email. Ref/UTR: ${paymentData.utr}, Sender: ${paymentData.sender || fromAddress}`
      });

      await processIncomingPayment({
        amount: paymentData.amount,
        utr: paymentData.utr,
        orderCode: paymentData.gatewayOrderCode || null,
        sender: paymentData.sender || fromAddress,
        receivedAt: paymentData.receivedAt,
        source: 'IMAP',
        rawSnippet: bodyText || paymentData.rawSnippet
      });
      schedulePaymentMonitoringSync();

      if (io) io.to('admin_room').emit('imap_status', getImapStatus());
    }
  } catch (err) {
    console.error('[IMAP Parse Error]:', err.message);
  }
}

export async function stopImapListener(disablePermanently = false) {
  isRunning = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (disablePermanently) {
    config.imap.enabled = false;
  }
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
  if (activeMailboxLock) {
    try { activeMailboxLock.release(); } catch (_) {}
    activeMailboxLock = null;
  }
  if (client) {
    try { await client.logout(); } catch (_) {}
    client = null;
  }
  statusInfo.connected = false;
  statusInfo.listening = false;
  if (globalIo) globalIo.to('admin_room').emit('imap_status', getImapStatus());
}

export async function restartImapListener(newConfig = null, io = null) {
  if (newConfig) {
    if (newConfig.user !== undefined) config.imap.user = newConfig.user.trim();
    if (newConfig.pass !== undefined) config.imap.pass = newConfig.pass.trim().replace(/\s+/g, '');
    if (newConfig.enabled !== undefined) config.imap.enabled = Boolean(newConfig.enabled);
    if (newConfig.host) config.imap.host = newConfig.host.trim();
    if (newConfig.port) config.imap.port = parseInt(newConfig.port, 10);
    if (newConfig.senderFilter) {
      config.imap.senderFilter = newConfig.senderFilter.split(',').map(s => s.trim().toLowerCase());
    }
  }

  await stopImapListener(false);
  await syncPaymentMonitoring(io || globalIo);
}

export default {
  startImapListener,
  stopImapListener,
  restartImapListener,
  testImapConnection,
  fetchRecentPaymentEmails,
  syncHistoricalPayments,
  getImapStatus,
  syncPaymentMonitoring,
  schedulePaymentMonitoringSync,
  startMerchantImapPoller,
  stopMerchantImapPoller
};
