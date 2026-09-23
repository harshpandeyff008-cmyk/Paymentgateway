import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure db directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'gateway.db');
const db = new sqlite3.Database(dbPath);

// Async wrapper helpers
export const query = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

export async function getSetting(key, defaultValue = '') {
  try {
    const row = await query.get('SELECT value FROM settings WHERE key = ?', [key]);
    return row ? row.value : defaultValue;
  } catch (_) {
    return defaultValue;
  }
}

export async function setSetting(key, value) {
  const strValue = String(value);
  await query.run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, strValue]
  );
}

export async function getAllSettings() {
  try {
    const rows = await query.all('SELECT key, value FROM settings');
    const result = {};
    for (const r of rows) {
      result[r.key] = r.value;
    }
    return result;
  } catch (_) {
    return {};
  }
}

// Domain API Keys CRUD Operations
export async function getAllDomainKeys() {
  try {
    return await query.all('SELECT * FROM domain_api_keys ORDER BY id DESC');
  } catch (err) {
    return [];
  }
}

export async function addDomainApiKey({ keyName = 'Default Key', domain, apiKey, status = 'ACTIVE' }) {
  const now = Date.now();
  const res = await query.run(
    `INSERT INTO domain_api_keys (key_name, domain, api_key, status, created_at, last_used_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [keyName, domain, apiKey, status, now, null]
  );
  return { id: res.lastID, key_name: keyName, domain, api_key: apiKey, status, created_at: now, last_used_at: null };
}

export async function deleteDomainApiKey(id) {
  return await query.run('DELETE FROM domain_api_keys WHERE id = ?', [id]);
}

export async function findDomainApiKey(clientKey) {
  try {
    return await query.get('SELECT * FROM domain_api_keys WHERE api_key = ? AND status = "ACTIVE"', [clientKey]);
  } catch (_) {
    return null;
  }
}

export async function updateDomainKeyLastUsed(apiKey) {
  try {
    await query.run('UPDATE domain_api_keys SET last_used_at = ? WHERE api_key = ?', [Date.now(), apiKey]);
  } catch (_) {}
}

export async function initDatabase() {
  // 1. Orders table
  await query.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_code TEXT UNIQUE NOT NULL,
      amount REAL NOT NULL,
      customer_name TEXT DEFAULT 'Guest',
      customer_phone TEXT DEFAULT '',
      status TEXT DEFAULT 'PENDING',
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      paid_at INTEGER,
      utr TEXT,
      sender_info TEXT,
      webhook_url TEXT,
      webhook_status TEXT,
      failure_reason TEXT
    )
  `);

  // Migrate existing orders table to include failure_reason, user_email, plan_id, credits_to_add if missing
  try {
    await query.run('ALTER TABLE orders ADD COLUMN failure_reason TEXT');
  } catch (_) {}
  try {
    await query.run('ALTER TABLE orders ADD COLUMN user_email TEXT');
  } catch (_) {}
  try {
    await query.run('ALTER TABLE orders ADD COLUMN plan_id TEXT');
  } catch (_) {}
  try {
    await query.run('ALTER TABLE orders ADD COLUMN credits_to_add INTEGER DEFAULT 0');
  } catch (_) {}
  try {
    await query.run('ALTER TABLE orders ADD COLUMN base_amount REAL');
  } catch (_) {}

  // 1.5 Users table for QR API platform
  await query.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT DEFAULT 'User',
      photo_url TEXT DEFAULT '',
      role TEXT DEFAULT 'user',
      plan TEXT DEFAULT 'NONE',
      qr_credits INTEGER DEFAULT 0,
      api_key TEXT UNIQUE,
      gmail_connected INTEGER DEFAULT 0,
      gmail_email TEXT DEFAULT '',
      gmail_app_pass TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Migrate users table columns if missing
  try {
    await query.run('ALTER TABLE users ADD COLUMN gmail_app_pass TEXT DEFAULT ""');
  } catch (_) {}
  try {
    await query.run('ALTER TABLE users ADD COLUMN website_url TEXT DEFAULT ""');
  } catch (_) {}
  try {
    await query.run('ALTER TABLE users ADD COLUMN is_website_locked INTEGER DEFAULT 0');
  } catch (_) {}
  try {
    await query.run('ALTER TABLE users ADD COLUMN website_locked_at INTEGER');
  } catch (_) {}
  try {
    await query.run('ALTER TABLE users ADD COLUMN max_websites INTEGER DEFAULT 1');
  } catch (_) {}
  try {
    await query.run('ALTER TABLE users ADD COLUMN website_urls TEXT DEFAULT ""');
  } catch (_) {}
  try {
    await query.run('ALTER TABLE users ADD COLUMN upi_vpa TEXT DEFAULT ""');
  } catch (_) {}
  try {
    await query.run('ALTER TABLE users ADD COLUMN business_name TEXT DEFAULT ""');
  } catch (_) {}
  try {
    await query.run('ALTER TABLE users ADD COLUMN settlement_type TEXT DEFAULT "GOOGLE_OAUTH"');
  } catch (_) {}
  try {
    await query.run('ALTER TABLE users ADD COLUMN gmail_access_token TEXT DEFAULT ""');
  } catch (_) {}
  try {
    await query.run('ALTER TABLE users ADD COLUMN imap_host TEXT DEFAULT "imap.gmail.com"');
  } catch (_) {}
  try {
    await query.run('ALTER TABLE users ADD COLUMN imap_port INTEGER DEFAULT 993');
  } catch (_) {}
  try {
    await query.run('ALTER TABLE users ADD COLUMN imap_secure INTEGER DEFAULT 1');
  } catch (_) {}

  // 2. Payments table
  await query.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      utr TEXT UNIQUE NOT NULL,
      amount REAL NOT NULL,
      sender TEXT,
      received_at INTEGER NOT NULL,
      source TEXT DEFAULT 'IMAP',
      raw_snippet TEXT,
      matched_order_id INTEGER,
      is_matched INTEGER DEFAULT 0,
      merchant_email TEXT DEFAULT '',
      FOREIGN KEY (matched_order_id) REFERENCES orders(id)
    )
  `);

  try {
    await query.run('ALTER TABLE payments ADD COLUMN merchant_email TEXT DEFAULT ""');
  } catch (_) {}

  // 3. Settings table
  await query.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Seed permanent default settings so they NEVER wipe out on reboot/hard-refresh
  const defaultSettings = [
    ['merchant_upi_vpa', 'ffdealsbyjena@fam'],
    ['merchant_name', 'ShivFFStore'],
    ['order_expiry_minutes', '5'],
    ['imap_enabled', 'true'],
    ['imap_user', 'shaahtasham9@gmail.com'],
    ['imap_pass', 'zfeoyxxoxrmnmbcr'],
    ['imap_filter', 'fampay,famapp,fam'],
    ['api_key', 'pg_live_549f404a2dddac4e59ff3ec1ed93d51de0b0'],
    ['admin_master_key', 'shivambhatt@admin'],
    ['require_api_key', 'true'],
    ['unique_amount_enabled', 'true'],
    ['unique_amount_window_minutes', '20'],
    ['allowed_origins', 'https://paypendicular.web.app,https://paypendicular.firebaseapp.com,https://dealsbyshiv.web.app,https://payment-gateway-ydl1.onrender.com,http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000']
  ];
  for (const [k, v] of defaultSettings) {
    try {
      await query.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [k, v]);
    } catch (_) {}
  }

  // 4. Multi-Domain API Keys table
  await query.run(`
    CREATE TABLE IF NOT EXISTS domain_api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_name TEXT,
      domain TEXT NOT NULL,
      api_key TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'ACTIVE',
      created_at INTEGER NOT NULL,
      last_used_at INTEGER
    )
  `);

  // Seed default domain API keys if empty
  try {
    const existing = await query.all('SELECT id FROM domain_api_keys LIMIT 1');
    if (existing.length === 0) {
      const now = Date.now();
      await query.run(
        `INSERT INTO domain_api_keys (key_name, domain, api_key, status, created_at)
         VALUES (?, ?, ?, 'ACTIVE', ?)`,
        ['Live Storefront (DealsByShiv)', 'dealsbyshiv.web.app', 'pg_live_549f404a2dddac4e59ff3ec1ed93d51de0b0', now]
      );
      await query.run(
        `INSERT INTO domain_api_keys (key_name, domain, api_key, status, created_at)
         VALUES (?, ?, ?, 'ACTIVE', ?)`,
        ['andriodTool', 'licence-management-4793d.web.app', 'pg_live_c0e7a1772532d02923f7a5213d25a6947ba6', now]
      );
      await query.run(
        `INSERT INTO domain_api_keys (key_name, domain, api_key, status, created_at)
         VALUES (?, ?, ?, 'ACTIVE', ?)`,
        ['Universal Fallback (*)', '*', 'pg_live_549f404a2dddac4e59ff3ec1ed93d51de0b0', now]
      );
    }
  } catch (_) {}

  // 5. API & Activity Notes table
  await query.run(`
    CREATE TABLE IF NOT EXISTS api_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      details TEXT,
      client_ip TEXT,
      origin TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  // 6. Coupons table (admin-created discount codes)
  await query.run(`
    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      discount_percent REAL NOT NULL,
      max_uses INTEGER DEFAULT -1,
      used_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      expires_at INTEGER,
      created_at INTEGER NOT NULL
    )
  `);

  // 7. Coupon Redemptions table (tracks who used what)
  await query.run(`
    CREATE TABLE IF NOT EXISTS coupon_redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coupon_code TEXT NOT NULL,
      user_email TEXT NOT NULL,
      order_code TEXT NOT NULL,
      discount_amount REAL NOT NULL,
      redeemed_at INTEGER NOT NULL
    )
  `);

  // 8. Plan Price Overrides table (admin can change plan prices)
  await query.run(`
    CREATE TABLE IF NOT EXISTS plan_price_overrides (
      plan_id TEXT PRIMARY KEY,
      custom_price REAL NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Auto-clean any legacy debit/outgoing payments from payments table
  try {
    await query.run(`
      DELETE FROM payments 
      WHERE (raw_snippet LIKE '%paid%to%' 
         OR raw_snippet LIKE '%successfully paid%' 
         OR raw_snippet LIKE '%debited%'
         OR raw_snippet LIKE '%sent%to%')
        AND is_matched = 0
    `);
  } catch (_) {}

  console.log('[DB] SQLite database initialized at:', dbPath);
}

export async function logActivity({ eventType, status = 'INFO', title, details = '', clientIp = '', origin = '' }) {
  try {
    const now = Date.now();
    const res = await query.run(
      `INSERT INTO api_logs (event_type, status, title, details, client_ip, origin, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [eventType, status, title, details, clientIp, origin, now]
    );
    return { id: res.lastID, event_type: eventType, status, title, details, client_ip: clientIp, origin, created_at: now };
  } catch (err) {
    console.error('[DB] Failed to log activity:', err.message);
    return null;
  }
}

export async function getRecentApiLogs(limit = 50) {
  try {
    return await query.all('SELECT * FROM api_logs ORDER BY id DESC LIMIT ?', [limit]);
  } catch (err) {
    console.error('[DB] Failed to fetch api_logs:', err.message);
    return [];
  }
}

// User Platform Operations
export function generateApiKey() {
  const chars = 'abcdef0123456789';
  let rand = '';
  for (let i = 0; i < 32; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `pg_live_${rand}`;
}

export async function syncUser({ email, name = 'User', photoUrl = '' }) {
  if (!email) return null;
  const normalizedEmail = email.trim().toLowerCase();
  const now = Date.now();
  const isAdmin = normalizedEmail === 'hapa1929@gmail.com';
  const role = isAdmin ? 'admin' : 'user';

  let user = await query.get('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
  if (!user) {
    const initialApiKey = generateApiKey();
    await query.run(
      `INSERT INTO users (email, name, photo_url, role, plan, qr_credits, api_key, gmail_connected, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'NONE', 0, ?, 0, ?, ?)`,
      [normalizedEmail, name, photoUrl, role, initialApiKey, now, now]
    );
    user = await query.get('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
  } else {
    await query.run(
      `UPDATE users SET name = COALESCE(?, name), photo_url = COALESCE(?, photo_url), updated_at = ? WHERE email = ?`,
      [name, photoUrl, now, normalizedEmail]
    );
    user = await query.get('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
  }
  return user;
}

export async function getUserByEmail(email) {
  if (!email) return null;
  return await query.get('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
}

export async function getUserByApiKey(apiKey) {
  if (!apiKey) return null;
  return await query.get('SELECT * FROM users WHERE api_key = ?', [apiKey.trim()]);
}

export function parseUserWebsites(user) {
  if (!user) return [];
  let list = [];
  if (user.website_urls) {
    try {
      list = JSON.parse(user.website_urls);
    } catch (_) {
      list = user.website_urls.split(',').map(s => s.trim()).filter(Boolean);
    }
  } else if (user.website_url) {
    list = [user.website_url];
  }
  return list.map(item => {
    if (typeof item === 'string') {
      const clean = item.trim().toLowerCase().replace(/^[a-zA-Z]+:\/\//, '').split('/')[0].split('?')[0].split(':')[0].replace(/^www\./, '');
      return { url: item, domain: clean };
    }
    return item;
  });
}

export async function updateUserPlanAndCredits(email, plan, creditsToAdd = 0, maxWebsites = null) {
  if (!email) return null;
  const user = await getUserByEmail(email);
  if (!user) return null;

  const newCredits = (user.qr_credits || 0) + Number(creditsToAdd);
  const now = Date.now();
  
  let websitesLimit = maxWebsites;
  if (!websitesLimit) {
    const pUpper = plan.toUpperCase();
    if (pUpper.includes('FLEET') || pUpper.includes('5_WEBSITE') || pUpper.includes('5SITE')) websitesLimit = 5;
    else if (pUpper.includes('QUAD') || pUpper.includes('4_WEBSITE') || pUpper.includes('4SITE')) websitesLimit = 4;
    else if (pUpper.includes('TRIPLE') || pUpper.includes('3_WEBSITE') || pUpper.includes('3SITE')) websitesLimit = 3;
    else if (pUpper.includes('DUAL') || pUpper.includes('2_WEBSITE') || pUpper.includes('2SITE') || pUpper.includes('GROWTH')) websitesLimit = 2;
    else websitesLimit = 1;
  }

  await query.run(
    `UPDATE users SET plan = ?, qr_credits = ?, max_websites = ?, updated_at = ? WHERE email = ?`,
    [plan.toUpperCase(), newCredits, websitesLimit, now, email.trim().toLowerCase()]
  );
  return await getUserByEmail(email);
}

export async function updateUserGmailConfig(email, { gmailEmail = '', gmailConnected = 1, gmailAppPass = '' }) {
  if (!email) return null;
  const now = Date.now();
  await query.run(
    `UPDATE users SET gmail_email = ?, gmail_connected = ?, gmail_app_pass = ?, updated_at = ? WHERE email = ?`,
    [gmailEmail, gmailConnected ? 1 : 0, gmailAppPass, now, email.trim().toLowerCase()]
  );
  return await getUserByEmail(email);
}

export async function updateUserGoogleBankingLink(email, { upiVpa = '', businessName = '', googleEmail = '', accessToken = '' }) {
  if (!email) return null;
  const now = Date.now();
  await query.run(
    `UPDATE users SET 
       upi_vpa = CASE WHEN ? != '' THEN ? ELSE upi_vpa END,
       business_name = CASE WHEN ? != '' THEN ? ELSE business_name END,
       gmail_email = ?,
       gmail_access_token = ?,
       settlement_type = 'GOOGLE_OAUTH',
       gmail_connected = 1,
       updated_at = ?
     WHERE email = ?`,
    [upiVpa, upiVpa, businessName, businessName, googleEmail, accessToken, now, email.trim().toLowerCase()]
  );
  return await getUserByEmail(email);
}

export async function updateUserImapBankingLink(email, { upiVpa = '', businessName = '', imapEmail = '', imapAppPass = '', imapHost = 'imap.gmail.com', imapPort = 993, imapSecure = 1 }) {
  if (!email) return null;
  const now = Date.now();
  await query.run(
    `UPDATE users SET 
       upi_vpa = CASE WHEN ? != '' THEN ? ELSE upi_vpa END,
       business_name = CASE WHEN ? != '' THEN ? ELSE business_name END,
       gmail_email = ?,
       gmail_app_pass = ?,
       imap_host = ?,
       imap_port = ?,
       imap_secure = ?,
       settlement_type = 'IMAP',
       gmail_connected = 1,
       updated_at = ?
     WHERE email = ?`,
    [upiVpa, upiVpa, businessName, businessName, imapEmail, imapAppPass, imapHost, Number(imapPort) || 993, imapSecure ? 1 : 0, now, email.trim().toLowerCase()]
  );
  return await getUserByEmail(email);
}

export async function disconnectUserBanking(email) {
  if (!email) return null;
  const now = Date.now();
  await query.run(
    `UPDATE users SET 
       gmail_connected = 0,
       gmail_access_token = '',
       gmail_app_pass = '',
       updated_at = ?
     WHERE email = ?`,
    [now, email.trim().toLowerCase()]
  );
  return await getUserByEmail(email);
}

export async function getUserPayments(email, limit = 50) {
  if (!email) return [];
  const normalized = email.trim().toLowerCase();
  try {
    return await query.all(
      `SELECT p.*, o.order_code, o.amount as order_amount, o.user_email
       FROM payments p
       LEFT JOIN orders o ON p.matched_order_id = o.id
       WHERE p.merchant_email = ? OR o.user_email = ?
       ORDER BY p.received_at DESC
       LIMIT ?`,
      [normalized, normalized, Number(limit) || 50]
    );
  } catch (err) {
    return [];
  }
}

export async function regenerateUserApiKey(email) {
  if (!email) return null;
  const newKey = generateApiKey();
  const now = Date.now();
  await query.run(
    `UPDATE users SET api_key = ?, updated_at = ? WHERE email = ?`,
    [newKey, now, email.trim().toLowerCase()]
  );
  return newKey;
}

export async function lockUserWebsite(email, websiteUrl) {
  if (!email || !websiteUrl) return { success: false, error: 'Email and website URL are required.' };
  const user = await getUserByEmail(email);
  if (!user) return { success: false, error: 'User account not found.' };

  const maxAllowed = user.max_websites || 1;
  const currentWebsites = parseUserWebsites(user);

  if (currentWebsites.length >= maxAllowed) {
    return {
      success: false,
      error: `All ${maxAllowed} website slot(s) for your plan are already locked! Each API key is strictly limited and domains cannot be changed.`
    };
  }

  // Clean and extract valid domain
  const cleanDomain = websiteUrl
    .trim()
    .toLowerCase()
    .replace(/^[a-zA-Z]+:\/\//, '')
    .split('/')[0]
    .split('?')[0]
    .split(':')[0]
    .replace(/^www\./, '');

  if (!cleanDomain || cleanDomain.length < 3) {
    return { success: false, error: 'Please enter a valid website URL or domain name (e.g. yourstore.com).' };
  }

  if (currentWebsites.some(w => w.domain === cleanDomain)) {
    return { success: false, error: 'This website domain is already locked.' };
  }

  const now = Date.now();
  currentWebsites.push({ url: websiteUrl.trim(), domain: cleanDomain, lockedAt: now });
  const firstUrl = currentWebsites[0].url;

  await query.run(
    `UPDATE users 
     SET website_url = ?, website_urls = ?, is_website_locked = 1, website_locked_at = COALESCE(website_locked_at, ?), updated_at = ? 
     WHERE email = ?`,
    [firstUrl, JSON.stringify(currentWebsites), now, now, email.trim().toLowerCase()]
  );

  // Bind into domain_api_keys table to enforce domain filtering at the gateway level
  if (user.api_key) {
    try {
      await query.run(
        `INSERT INTO domain_api_keys (key_name, domain, api_key, status, created_at)
         VALUES (?, ?, ?, 'ACTIVE', ?)`,
        [`${user.name || 'Merchant'} Website (${cleanDomain})`, cleanDomain, user.api_key, now]
      );
    } catch (_) {}
  }

  const updatedUser = await getUserByEmail(email);
  return { 
    success: true, 
    user: updatedUser, 
    domain: cleanDomain,
    lockedWebsites: currentWebsites,
    remainingSlots: Math.max(0, maxAllowed - currentWebsites.length)
  };
}

export async function getAllUsers() {
  try {
    return await query.all('SELECT id, email, name, photo_url, role, plan, qr_credits, api_key, gmail_connected, gmail_email, website_url, is_website_locked, created_at, updated_at FROM users ORDER BY id DESC');
  } catch (err) {
    console.error('[DB] Failed to fetch users:', err.message);
    return [];
  }
}

export async function deductUserCredit(apiKey) {
  const user = await getUserByApiKey(apiKey);
  if (!user) return { success: false, reason: 'INVALID_API_KEY' };
  
  // UNLIMITED SUBSCRIPTION: All active subscribers get unlimited dynamic QR generations
  if (user.role === 'admin' || (user.plan && user.plan !== 'NONE')) {
    return { success: true, remaining: 'UNLIMITED' };
  }
  
  return { success: false, reason: 'PLAN_REQUIRED' };
}

/**
 * Micro-Fractional Dynamic Paise Offset (Unique Amount Assignment)
 * Resolves payment collisions when multiple users generate QR for the same base amount
 * within an active time window (e.g. 20 minutes).
 * Example: Base 500 -> 500.00, 500.01, 500.02, 500.03...
 */
export async function getUniquePayableAmount(baseAmount, windowMinutes = 20) {
  const numBase = parseFloat(baseAmount);
  if (isNaN(numBase) || numBase <= 0) return baseAmount;

  try {
    const isEnabled = await getSetting('unique_amount_enabled', 'true');
    if (isEnabled === 'false') {
      return parseFloat(numBase.toFixed(2));
    }

    const settingWindow = parseInt(await getSetting('unique_amount_window_minutes', String(windowMinutes)), 10) || windowMinutes;
    const now = Date.now();
    const windowStart = now - (settingWindow * 60 * 1000);

    // Query active pending orders in current active window for this base amount range
    const activeOrders = await query.all(
      `SELECT amount FROM orders 
       WHERE status = 'PENDING' 
         AND expires_at > ? 
         AND created_at >= ?
         AND amount >= ? 
         AND amount < ?`,
      [now, windowStart, numBase, numBase + 1.0]
    );

    const inUseAmounts = new Set(activeOrders.map(o => parseFloat(Number(o.amount).toFixed(2))));

    // Assign lowest available unique paise offset (+0.00, +0.01, +0.02 ... +0.99)
    for (let offset = 0; offset <= 99; offset++) {
      const candidate = parseFloat((numBase + (offset * 0.01)).toFixed(2));
      if (!inUseAmounts.has(candidate)) {
        return candidate;
      }
    }

    // Fallback if all 100 offsets are occupied
    return parseFloat((numBase + (Math.random() * 0.99)).toFixed(2));
  } catch (err) {
    console.error('[DB] Error calculating unique amount:', err.message);
    return parseFloat(numBase.toFixed(2));
  }
}

// ─── Coupons CRUD ────────────────────────────────────────────────────────────

export async function listCoupons() {
  try {
    return await query.all('SELECT * FROM coupons ORDER BY id DESC');
  } catch (_) { return []; }
}

export async function createCoupon({ code, discountPercent, maxUses = -1, expiresAt = null }) {
  if (!code || !discountPercent) throw new Error('Code and discountPercent are required');
  const now = Date.now();
  const result = await query.run(
    `INSERT INTO coupons (code, discount_percent, max_uses, used_count, is_active, expires_at, created_at)
     VALUES (?, ?, ?, 0, 1, ?, ?)`,
    [code.toUpperCase().trim(), parseFloat(discountPercent), parseInt(maxUses, 10), expiresAt || null, now]
  );
  return { id: result.lastID, code: code.toUpperCase().trim(), discount_percent: parseFloat(discountPercent), max_uses: parseInt(maxUses, 10), used_count: 0, is_active: 1, expires_at: expiresAt, created_at: now };
}

export async function getCouponByCode(code) {
  if (!code) return null;
  return await query.get('SELECT * FROM coupons WHERE code = ? AND is_active = 1', [code.toUpperCase().trim()]);
}

export async function validateCoupon(code) {
  const coupon = await getCouponByCode(code);
  if (!coupon) return { valid: false, error: 'Invalid or expired coupon code.' };
  if (coupon.expires_at && Date.now() > coupon.expires_at) {
    return { valid: false, error: 'Coupon has expired.' };
  }
  if (coupon.max_uses !== -1 && coupon.used_count >= coupon.max_uses) {
    return { valid: false, error: 'Coupon usage limit reached.' };
  }
  return { valid: true, coupon };
}

export async function markCouponUsed(code, userEmail, orderCode, discountAmount) {
  await query.run('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?', [code.toUpperCase().trim()]);
  await query.run(
    `INSERT INTO coupon_redemptions (coupon_code, user_email, order_code, discount_amount, redeemed_at)
     VALUES (?, ?, ?, ?, ?)`,
    [code.toUpperCase().trim(), userEmail, orderCode, discountAmount, Date.now()]
  );
}

export async function deleteCoupon(id) {
  return await query.run('UPDATE coupons SET is_active = 0 WHERE id = ?', [id]);
}

// ─── Plan Price Overrides ────────────────────────────────────────────────────

export async function getPlanPriceOverrides() {
  try {
    const rows = await query.all('SELECT * FROM plan_price_overrides');
    const map = {};
    for (const r of rows) map[r.plan_id] = r.custom_price;
    return map;
  } catch (_) { return {}; }
}

export async function setPlanPriceOverride(planId, customPrice) {
  const now = Date.now();
  await query.run(
    `INSERT INTO plan_price_overrides (plan_id, custom_price, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(plan_id) DO UPDATE SET custom_price = excluded.custom_price, updated_at = excluded.updated_at`,
    [planId.toUpperCase(), parseFloat(customPrice), now]
  );
}

export async function deletePlanPriceOverride(planId) {
  return await query.run('DELETE FROM plan_price_overrides WHERE plan_id = ?', [planId.toUpperCase()]);
}

export function closeDatabase() {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export default { 
  query, 
  initDatabase, 
  closeDatabase, 
  getSetting, 
  setSetting, 
  getAllSettings, 
  getAllDomainKeys, 
  addDomainApiKey, 
  deleteDomainApiKey, 
  findDomainApiKey, 
  updateDomainKeyLastUsed, 
  logActivity, 
  getRecentApiLogs,
  syncUser,
  getUserByEmail,
  getUserByApiKey,
  updateUserPlanAndCredits,
  updateUserGmailConfig,
  updateUserGoogleBankingLink,
  updateUserImapBankingLink,
  disconnectUserBanking,
  getUserPayments,
  regenerateUserApiKey,
  getAllUsers,
  deductUserCredit,
  getUniquePayableAmount,
  listCoupons,
  createCoupon,
  getCouponByCode,
  validateCoupon,
  markCouponUsed,
  deleteCoupon,
  getPlanPriceOverrides,
  setPlanPriceOverride,
  deletePlanPriceOverride
};
