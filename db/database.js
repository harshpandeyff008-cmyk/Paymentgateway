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

  // Migrate existing orders table to include failure_reason if missing
  try {
    await query.run('ALTER TABLE orders ADD COLUMN failure_reason TEXT');
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
      FOREIGN KEY (matched_order_id) REFERENCES orders(id)
    )
  `);

  // 3. Settings table
  await query.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

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
  getRecentApiLogs 
};
