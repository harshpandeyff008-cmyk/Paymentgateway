import { query, getSetting, setSetting } from '../db/database.js';
import { parsePaymentEmail } from './emailParser.js';
import { processIncomingPayment } from './matchingEngine.js';

let isScanning = false;
let watcherInterval = null;

/**
 * Extract clean plain text from Gmail message payload parts (handling multipart, base64url)
 */
function extractBodyFromPayload(payload) {
  if (!payload) return '';
  let text = '';

  if (payload.body && payload.body.data) {
    try {
      text += Buffer.from(payload.body.data, 'base64url').toString('utf-8') + ' ';
    } catch (_) {}
  }

  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        try {
          text += Buffer.from(part.body.data, 'base64url').toString('utf-8') + ' ';
        } catch (_) {}
      } else if (part.mimeType === 'text/html' && part.body && part.body.data) {
        try {
          const html = Buffer.from(part.body.data, 'base64url').toString('utf-8');
          text += html.replace(/<[^>]+>/g, ' ') + ' ';
        } catch (_) {}
      } else if (part.parts) {
        text += extractBodyFromPayload(part) + ' ';
      }
    }
  }

  if (!text && payload.snippet) {
    text = payload.snippet;
  }

  return text;
}

/**
 * Scan a single Google-linked banking account via Gmail REST API
 */
export async function checkGoogleBankingAlerts(accessToken, targetEmail, isMerchant = false) {
  if (!accessToken) return { success: false, error: 'Access token is required' };

  try {
    const listUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=newer_than:1d+(credited+OR+received+OR+UPI+OR+FamPay+OR+payment)&maxResults=5';
    const listRes = await fetch(listUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (listRes.status === 401) {
      console.warn(`[GmailWatcher] Access token expired or revoked for ${targetEmail}.`);
      return { success: false, expired: true, error: 'Google session token expired. Please re-link in dashboard.' };
    }

    if (!listRes.ok) {
      return { success: false, error: `Gmail API error status ${listRes.status}` };
    }

    const listData = await listRes.json();
    const messages = listData.messages || [];
    if (messages.length === 0) {
      return { success: true, processed: 0 };
    }

    let processedCount = 0;

    for (const msg of messages) {
      try {
        const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        });

        if (!msgRes.ok) continue;
        const msgData = await msgRes.json();
        const headers = msgData.payload?.headers || [];

        const getHeader = (name) => {
          const h = headers.find(item => item.name && item.name.toLowerCase() === name.toLowerCase());
          return h ? h.value : '';
        };

        const subject = getHeader('Subject');
        const fromAddress = getHeader('From');
        const dateHeader = getHeader('Date');
        const emailDate = dateHeader ? new Date(dateHeader) : new Date();

        const bodyText = extractBodyFromPayload(msgData.payload);
        const paymentData = parsePaymentEmail(subject, bodyText, emailDate);

        if (paymentData.success && paymentData.amount && paymentData.utr) {
          const paymentRow = await query.get('SELECT id, is_matched FROM payments WHERE utr = ?', [paymentData.utr]);
          if (!paymentRow) {
            console.log(`[GmailWatcher] Detected ₹${paymentData.amount} via Google Banking Link for ${targetEmail}. UTR: ${paymentData.utr}`);
            await processIncomingPayment({
              amount: paymentData.amount,
              utr: paymentData.utr,
              sender: paymentData.sender || fromAddress,
              receivedAt: paymentData.receivedAt,
              source: isMerchant ? 'MERCHANT_GOOGLE_LINK' : 'ADMIN_GOOGLE_LINK',
              rawSnippet: `[Google Link: ${targetEmail}] ${subject} - ${paymentData.sender || fromAddress}`,
              merchantEmail: isMerchant ? targetEmail : null
            });
            processedCount++;
          }
        }
      } catch (innerErr) {
        // Continue processing other messages
      }
    }

    return { success: true, processed: processedCount };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Scan all active Google OAuth linked accounts (both Admin & Merchants)
 */
export async function scanGoogleBankingAccounts() {
  if (isScanning) return;
  isScanning = true;

  try {
    // 1. Scan Admin if Google OAuth Link is active
    const adminSettlementType = await getSetting('admin_settlement_type', 'IMAP');
    const adminToken = await getSetting('admin_gmail_access_token', '');
    const adminEmail = await getSetting('admin_gmail_email', '');

    if (adminSettlementType === 'GOOGLE_OAUTH' && adminToken) {
      await checkGoogleBankingAlerts(adminToken, adminEmail || 'Admin', false);
    }

    // 2. Scan Connected Merchants who chose Google OAuth Link
    const merchants = await query.all(
      `SELECT email, upi_vpa, business_name, gmail_email, gmail_access_token
       FROM users
       WHERE gmail_connected = 1
         AND settlement_type = 'GOOGLE_OAUTH'
         AND gmail_access_token IS NOT NULL
         AND gmail_access_token != ''`
    );

    if (merchants && merchants.length > 0) {
      for (const m of merchants) {
        if (!m.gmail_access_token) continue;
        await checkGoogleBankingAlerts(m.gmail_access_token, m.email, true);
      }
    }
  } catch (err) {
    // Suppress transient loop errors
  } finally {
    isScanning = false;
  }
}

/**
 * Start the background poller for Google Banking Accounts
 */
export function startGmailWatcher() {
  if (watcherInterval) clearInterval(watcherInterval);
  // Ultra-fast 3-second bank credit scan
  watcherInterval = setInterval(() => {
    scanGoogleBankingAccounts().catch(() => {});
  }, 3000);
  console.log('[GmailWatcher] Background Google Banking Link poller initialized (3s ultra-fast interval).');
}

export function stopGmailWatcher() {
  if (watcherInterval) {
    clearInterval(watcherInterval);
    watcherInterval = null;
  }
}

export default {
  checkGoogleBankingAlerts,
  scanGoogleBankingAccounts,
  startGmailWatcher,
  stopGmailWatcher
};
