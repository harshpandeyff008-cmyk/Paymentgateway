import logger from '../utils/logger.js';

// Realtime Database endpoint for project upigateway-ccaa4
const RTDB_BASE = 'https://upigateway-ccaa4-default-rtdb.firebaseio.com';

// Helper to sanitize keys for Firebase RTDB (cannot contain ., #, $, [, ])
export function encodeKey(str) {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/\./g, '_dot_')
    .replace(/[#$\[\]]/g, '_');
}

export function decodeKey(str) {
  if (!str) return '';
  return String(str).replace(/_dot_/g, '.');
}

export const CloudSyncService = {
  // ─── SETTINGS ─────────────────────────────────────────────────────────────
  async loadSettings() {
    try {
      const res = await fetch(`${RTDB_BASE}/settings.json`);
      if (res.ok) {
        const settings = await res.json();
        if (settings) {
          logger.info('[CloudSync] Loaded settings from Firebase RTDB');
          return settings;
        }
      }
    } catch (e) {
      logger.warn(`[CloudSync] Failed to load settings: ${e.message}`);
    }
    return null;
  },

  async saveSettings(settings) {
    try {
      const res = await fetch(`${RTDB_BASE}/settings.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, updated_at: Date.now() })
      });
      if (res.ok) {
        logger.info('[CloudSync] Saved settings to Firebase RTDB');
        return true;
      }
    } catch (e) {
      logger.warn(`[CloudSync] Failed to save settings: ${e.message}`);
    }
    return false;
  },

  // ─── USERS ────────────────────────────────────────────────────────────────
  async saveUser(user) {
    if (!user || !user.email) return false;
    try {
      const key = encodeKey(user.email);
      let existingCloud = null;
      try {
        existingCloud = await this.getUser(user.email);
      } catch (_) {}

      const merged = {
        ...(existingCloud || {}),
        ...user,
        email: user.email.toLowerCase().trim(),
        // Plan & Credits protection
        plan: (user.plan && user.plan !== 'NONE') ? user.plan : (existingCloud?.plan || user.plan || 'NONE'),
        qr_credits: (user.qr_credits !== undefined && Number(user.qr_credits) > 0) ? Number(user.qr_credits) : (existingCloud?.qr_credits !== undefined ? Number(existingCloud.qr_credits) : (Number(user.qr_credits) || 0)),
        api_key: user.api_key || existingCloud?.api_key || '',

        // Strict Website Lock & Domain bindings protection
        website_url: (user.website_url !== undefined && user.website_url !== '') ? user.website_url : (existingCloud?.website_url || ''),
        website_urls: (user.website_urls !== undefined && user.website_urls !== '') ? user.website_urls : (existingCloud?.website_urls || ''),
        is_website_locked: (user.is_website_locked !== undefined && user.is_website_locked) ? 1 : (existingCloud?.is_website_locked ? 1 : 0),
        website_locked_at: user.website_locked_at || existingCloud?.website_locked_at || null,
        max_websites: Math.max(user.max_websites || 1, existingCloud?.max_websites || 1),

        // Checkout branding & customization protection
        default_brand_name: (user.default_brand_name !== undefined && user.default_brand_name !== '') ? user.default_brand_name : (existingCloud?.default_brand_name || ''),
        default_brand_logo_url: (user.default_brand_logo_url !== undefined && user.default_brand_logo_url !== '') ? user.default_brand_logo_url : (existingCloud?.default_brand_logo_url || ''),
        default_theme: user.default_theme || existingCloud?.default_theme || 'tiranga',
        default_redirect_url: (user.default_redirect_url !== undefined && user.default_redirect_url !== '') ? user.default_redirect_url : (existingCloud?.default_redirect_url || ''),
        default_custom_note: (user.default_custom_note !== undefined && user.default_custom_note !== '') ? user.default_custom_note : (existingCloud?.default_custom_note || ''),

        // Ensure banking email & auth tokens are never overwritten with empty values
        gmail_email: (user.gmail_email !== undefined && user.gmail_email !== '') ? user.gmail_email : (existingCloud?.gmail_email || ''),
        gmail_app_pass: (user.gmail_app_pass !== undefined && user.gmail_app_pass !== '') ? user.gmail_app_pass : (existingCloud?.gmail_app_pass || ''),
        gmail_access_token: (user.gmail_access_token !== undefined && user.gmail_access_token !== '') ? user.gmail_access_token : (existingCloud?.gmail_access_token || ''),
        settlement_type: user.settlement_type || existingCloud?.settlement_type || 'GOOGLE_OAUTH',
        gmail_connected: user.gmail_connected !== undefined ? (user.gmail_connected ? 1 : 0) : (existingCloud?.gmail_connected ? 1 : 0),
        imap_host: user.imap_host || existingCloud?.imap_host || 'imap.gmail.com',
        imap_port: user.imap_port || existingCloud?.imap_port || 993,
        imap_secure: user.imap_secure !== undefined ? (user.imap_secure ? 1 : 0) : (existingCloud?.imap_secure !== undefined ? existingCloud.imap_secure : 1),
        upi_provider: user.upi_provider || existingCloud?.upi_provider || 'AUTO',
        upi_vpa: user.upi_vpa || existingCloud?.upi_vpa || '',
        business_name: user.business_name || existingCloud?.business_name || '',
        updated_at: Date.now()
      };

      const res = await fetch(`${RTDB_BASE}/users/${key}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged)
      });
      if (res.ok) {
        logger.info(`[CloudSync] Saved user ${user.email} to Firebase RTDB (Plan: ${merged.plan || 'NONE'}, Site: ${merged.website_url || 'None'}, Banking: ${merged.gmail_connected ? 'Connected' : 'Disconnected'})`);
        return true;
      }
    } catch (e) {
      logger.warn(`[CloudSync] Failed to save user ${user.email}: ${e.message}`);
    }
    return false;
  },

  async getUser(email) {
    if (!email) return null;
    try {
      const key = encodeKey(email);
      const res = await fetch(`${RTDB_BASE}/users/${key}.json`);
      let user = res.ok ? await res.json() : null;

      // Legacy key fallback check (_ instead of _dot_)
      const legacyKey = String(email).trim().toLowerCase().replace(/\./g, '_').replace(/[@$#\[\]\/]/g, '_');
      if (legacyKey !== key) {
        try {
          const legRes = await fetch(`${RTDB_BASE}/users/${legacyKey}.json`);
          if (legRes.ok) {
            const legUser = await legRes.json();
            if (legUser) {
              user = { ...legUser, ...(user || {}), email: email.toLowerCase().trim() };
            }
          }
        } catch (_) {}
      }
      return user;
    } catch (e) {
      logger.warn(`[CloudSync] Failed to fetch user ${email}: ${e.message}`);
    }
    return null;
  },

  async getAllUsers() {
    try {
      const res = await fetch(`${RTDB_BASE}/users.json`);
      if (res.ok) {
        const usersObj = await res.json();
        if (usersObj) {
          const mergedByEmail = {};
          for (const [k, u] of Object.entries(usersObj)) {
            if (!u) continue;
            let em = u.email;
            if (!em) {
              // Try reconstructing email from key: test@gmail_dot_com or test@gmail_com
              em = k.replace(/_dot_/g, '.').replace(/_com$/, '.com').replace(/_in$/, '.in');
            }
            if (!em || !em.includes('@')) continue;
            em = em.toLowerCase().trim();
            mergedByEmail[em] = {
              ...(mergedByEmail[em] || {}),
              ...u,
              email: em
            };
          }
          return Object.values(mergedByEmail);
        }
      }
    } catch (e) {
      logger.warn(`[CloudSync] Failed to fetch all users: ${e.message}`);
    }
    return [];
  },

  // ─── COUPONS ──────────────────────────────────────────────────────────────
  async saveCoupon(coupon) {
    if (!coupon || !coupon.code) return false;
    try {
      const codeKey = encodeKey(coupon.code);
      const res = await fetch(`${RTDB_BASE}/coupons/${codeKey}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...coupon,
          code: coupon.code.toUpperCase().trim(),
          updated_at: Date.now()
        })
      });
      return res.ok;
    } catch (e) {
      logger.warn(`[CloudSync] Failed to save coupon ${coupon.code}: ${e.message}`);
    }
    return false;
  },

  async deleteCoupon(code) {
    if (!code) return false;
    try {
      const codeKey = encodeKey(code);
      const res = await fetch(`${RTDB_BASE}/coupons/${codeKey}.json`, {
        method: 'DELETE'
      });
      return res.ok;
    } catch (e) {
      logger.warn(`[CloudSync] Failed to delete coupon ${code}: ${e.message}`);
    }
    return false;
  },

  async getAllCoupons() {
    try {
      const res = await fetch(`${RTDB_BASE}/coupons.json`);
      if (res.ok) {
        const data = await res.json();
        if (data) return Object.values(data);
      }
    } catch (e) {
      logger.warn(`[CloudSync] Failed to fetch coupons: ${e.message}`);
    }
    return [];
  },

  // ─── PLAN PRICES ──────────────────────────────────────────────────────────
  async savePlanPrices(prices) {
    try {
      const res = await fetch(`${RTDB_BASE}/plan_prices.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prices || {})
      });
      return res.ok;
    } catch (e) {
      logger.warn(`[CloudSync] Failed to save plan prices: ${e.message}`);
    }
    return false;
  },

  async getPlanPrices() {
    try {
      const res = await fetch(`${RTDB_BASE}/plan_prices.json`);
      if (res.ok) {
        const data = await res.json();
        return data || {};
      }
    } catch (e) {
      logger.warn(`[CloudSync] Failed to load plan prices: ${e.message}`);
    }
    return {};
  },

  // ─── DOMAIN API KEYS ──────────────────────────────────────────────────────
  async saveDomainKeys(keysArray) {
    try {
      const res = await fetch(`${RTDB_BASE}/domain_api_keys.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keysArray || [])
      });
      if (res.ok) {
        logger.info(`[CloudSync] Saved ${(keysArray || []).length} domain keys to Firebase RTDB`);
        return true;
      }
    } catch (e) {
      logger.warn(`[CloudSync] Failed to save domain keys: ${e.message}`);
    }
    return false;
  },

  async loadDomainKeys() {
    try {
      const res = await fetch(`${RTDB_BASE}/domain_api_keys.json`);
      if (res.ok) {
        const keys = await res.json();
        if (Array.isArray(keys)) return keys;
        if (keys && typeof keys === 'object') return Object.values(keys);
      }
    } catch (e) {
      logger.warn(`[CloudSync] Failed to load domain keys: ${e.message}`);
    }
    return [];
  },

  // ─── ORDERS ───────────────────────────────────────────────────────────────
  async saveOrder(order) {
    if (!order) return false;
    const code = order.order_code || order.orderCode;
    if (!code) return false;
    try {
      const res = await fetch(`${RTDB_BASE}/orders/${encodeKey(code)}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...order,
          updated_at: Date.now()
        })
      });
      return res.ok;
    } catch (e) {
      logger.warn(`[CloudSync] Failed to save order ${code}: ${e.message}`);
    }
    return false;
  },

  async getAllOrders() {
    try {
      const res = await fetch(`${RTDB_BASE}/orders.json`);
      if (res.ok) {
        const ordersObj = await res.json();
        if (ordersObj) {
          return Object.values(ordersObj);
        }
      }
    } catch (e) {
      logger.warn(`[CloudSync] Failed to load orders: ${e.message}`);
    }
    return [];
  },

  // ─── PAYMENTS / BANK ALERTS ───────────────────────────────────────────────
  async savePayment(payment) {
    if (!payment || !payment.utr) return false;
    try {
      const key = encodeKey(payment.utr);
      const res = await fetch(`${RTDB_BASE}/payments/${key}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payment,
          updated_at: Date.now()
        })
      });
      return res.ok;
    } catch (e) {
      logger.warn(`[CloudSync] Failed to save payment ${payment.utr}: ${e.message}`);
    }
    return false;
  },

  async getAllPayments() {
    try {
      const res = await fetch(`${RTDB_BASE}/payments.json`);
      if (res.ok) {
        const paymentsObj = await res.json();
        if (paymentsObj) {
          return Object.values(paymentsObj);
        }
      }
    } catch (e) {
      logger.warn(`[CloudSync] Failed to load payments: ${e.message}`);
    }
    return [];
  },

  // ─── RESTORE ALL ON STARTUP ───────────────────────────────────────────────
  /**
   * Called during database initialization so Render startup automatically
   * repopulates the SQLite cache from Firebase Realtime Database.
   */
  async restoreAllFromCloud(query) {
    if (!query) return;
    logger.info('[CloudSync] Starting cloud restore from Firebase RTDB...');

    try {
      // 1. Restore Users
      const cloudUsers = await this.getAllUsers();
      if (cloudUsers.length > 0) {
        logger.info(`[CloudSync] Restoring ${cloudUsers.length} users from Firebase RTDB...`);
        for (const u of cloudUsers) {
          if (!u || !u.email) continue;
          const email = u.email.toLowerCase().trim();
          const existing = await query.get('SELECT * FROM users WHERE email = ?', [email]);
          if (!existing) {
            await query.run(
              `INSERT INTO users (
                email, name, photo_url, role, plan, qr_credits, api_key,
                gmail_connected, gmail_email, gmail_app_pass, gmail_access_token,
                settlement_type, imap_host, imap_port, imap_secure, upi_provider,
                website_url, website_urls, is_website_locked, website_locked_at, max_websites,
                upi_vpa, business_name, default_brand_name, default_brand_logo_url, default_theme,
                default_redirect_url, default_custom_note, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                email,
                u.name || 'User',
                u.photo_url || '',
                u.role || 'user',
                u.plan || 'NONE',
                u.qr_credits !== undefined ? u.qr_credits : 0,
                u.api_key || '',
                u.gmail_connected ? 1 : 0,
                u.gmail_email || '',
                u.gmail_app_pass || '',
                u.gmail_access_token || '',
                u.settlement_type || 'GOOGLE_OAUTH',
                u.imap_host || 'imap.gmail.com',
                Number(u.imap_port) || 993,
                u.imap_secure !== undefined ? (u.imap_secure ? 1 : 0) : 1,
                u.upi_provider || 'AUTO',
                u.website_url || '',
                u.website_urls || '',
                u.is_website_locked ? 1 : 0,
                u.website_locked_at || null,
                u.max_websites || 1,
                u.upi_vpa || '',
                u.business_name || '',
                u.default_brand_name || '',
                u.default_brand_logo_url || '',
                u.default_theme || 'tiranga',
                u.default_redirect_url || '',
                u.default_custom_note || '',
                u.created_at || Date.now(),
                u.updated_at || Date.now()
              ]
            );
          } else {
            // Restore active plan, credits, AND banking credentials from cloud
            await query.run(
              `UPDATE users SET 
                 plan = CASE WHEN ? != 'NONE' THEN ? ELSE plan END,
                 qr_credits = CASE WHEN ? > 0 THEN ? ELSE qr_credits END,
                 gmail_connected = CASE WHEN ? = 1 THEN 1 ELSE gmail_connected END,
                 gmail_email = CASE WHEN ? != '' THEN ? ELSE gmail_email END,
                 gmail_app_pass = CASE WHEN ? != '' THEN ? ELSE gmail_app_pass END,
                 gmail_access_token = CASE WHEN ? != '' THEN ? ELSE gmail_access_token END,
                 settlement_type = CASE WHEN ? != '' THEN ? ELSE settlement_type END,
                 imap_host = CASE WHEN ? != '' THEN ? ELSE imap_host END,
                 imap_port = CASE WHEN ? > 0 THEN ? ELSE imap_port END,
                 imap_secure = CASE WHEN ? >= 0 THEN ? ELSE imap_secure END,
                 upi_provider = CASE WHEN ? != '' THEN ? ELSE upi_provider END,
                 upi_vpa = CASE WHEN ? != '' THEN ? ELSE upi_vpa END,
                 business_name = CASE WHEN ? != '' THEN ? ELSE business_name END,
                 max_websites = CASE WHEN ? > 0 THEN ? ELSE max_websites END,
                 is_website_locked = CASE WHEN ? = 1 THEN 1 ELSE is_website_locked END,
                 website_url = CASE WHEN ? != '' THEN ? ELSE website_url END,
                 website_urls = CASE WHEN ? != '' THEN ? ELSE website_urls END,
                 updated_at = ?
               WHERE email = ?`,
              [
                u.plan || 'NONE', u.plan || 'NONE',
                u.qr_credits || 0, u.qr_credits || 0,
                u.gmail_connected ? 1 : 0,
                u.gmail_email || '', u.gmail_email || '',
                u.gmail_app_pass || '', u.gmail_app_pass || '',
                u.gmail_access_token || '', u.gmail_access_token || '',
                u.settlement_type || '', u.settlement_type || '',
                u.imap_host || '', u.imap_host || '',
                Number(u.imap_port) || 0, Number(u.imap_port) || 0,
                u.imap_secure !== undefined ? (u.imap_secure ? 1 : 0) : -1, u.imap_secure !== undefined ? (u.imap_secure ? 1 : 0) : -1,
                u.upi_provider || '', u.upi_provider || '',
                u.upi_vpa || '', u.upi_vpa || '',
                u.business_name || '', u.business_name || '',
                u.max_websites || 0, u.max_websites || 0,
                u.is_website_locked ? 1 : 0,
                u.website_url || '', u.website_url || '',
                u.website_urls || '', u.website_urls || '',
                Date.now(),
                email
              ]
            );
          }
        }
      }

      // 2. Restore Coupons
      const cloudCoupons = await this.getAllCoupons();
      if (cloudCoupons.length > 0) {
        logger.info(`[CloudSync] Restoring ${cloudCoupons.length} coupons from Firebase RTDB...`);
        for (const c of cloudCoupons) {
          if (!c || !c.code) continue;
          const existing = await query.get('SELECT * FROM coupons WHERE code = ?', [c.code.toUpperCase().trim()]);
          if (!existing) {
            await query.run(
              `INSERT INTO coupons (code, discount_percent, max_uses, used_count, expires_at, is_active, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                c.code.toUpperCase().trim(),
                c.discount_percent || 0,
                c.max_uses || null,
                c.used_count || 0,
                c.expires_at || null,
                c.is_active !== undefined ? (c.is_active ? 1 : 0) : 1,
                c.created_at || Date.now()
              ]
            );
          }
        }
      }

      // 3. Restore Plan Prices
      const cloudPrices = await this.getPlanPrices();
      if (cloudPrices && Object.keys(cloudPrices).length > 0) {
        await query.run(
          `INSERT INTO settings (key, value) VALUES ('plan_price_overrides', ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          [JSON.stringify(cloudPrices)]
        );
      }

      // 4. Restore Domain API Keys
      const cloudDomainKeys = await this.loadDomainKeys();
      if (cloudDomainKeys.length > 0) {
        for (const k of cloudDomainKeys) {
          if (!k || !k.api_key) continue;
          const existing = await query.get('SELECT * FROM domain_api_keys WHERE api_key = ?', [k.api_key]);
          if (!existing) {
            await query.run(
              `INSERT INTO domain_api_keys (key_name, domain, api_key, status, created_at, last_used_at)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [k.key_name || 'Key', k.domain, k.api_key, k.status || 'ACTIVE', k.created_at || Date.now(), k.last_used_at || null]
            );
          }
        }
      }

      // 5. Restore Payments / Bank Alerts
      const cloudPayments = await this.getAllPayments();
      if (cloudPayments.length > 0) {
        try {
          await query.run('BEGIN TRANSACTION');
          for (const p of cloudPayments) {
            if (!p || !p.utr) continue;
            await query.run(
              `INSERT OR IGNORE INTO payments (utr, amount, sender, received_at, source, raw_snippet, matched_order_id, is_matched, merchant_email)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                p.utr,
                p.amount,
                p.sender || '',
                p.received_at || Date.now(),
                p.source || 'IMAP',
                p.raw_snippet || '',
                p.matched_order_id || null,
                p.is_matched ? 1 : 0,
                p.merchant_email || ''
              ]
            );
          }
          await query.run('COMMIT');
        } catch (txErr) {
          await query.run('ROLLBACK').catch(() => {});
          logger.warn(`[CloudSync] Payments batch restore error: ${txErr.message}`);
        }
      }

      logger.info('[CloudSync] Cloud restore from Firebase RTDB completed successfully!');
    } catch (err) {
      logger.error(`[CloudSync] Cloud restore error: ${err.message}`);
    }
  }
};

export default CloudSyncService;
