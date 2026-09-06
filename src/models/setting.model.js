import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { getSetting, setSetting, getAllSettings, getAllDomainKeys, addDomainApiKey } from '../../db/database.js';
import { config } from '../../config.js';
import { CloudSyncService } from '../services/cloudSync.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envFilePath = path.join(__dirname, '..', '..', '.env');

export const SettingModel = {
  get: getSetting,
  
  async set(key, value) {
    await setSetting(key, value);
    await this.syncToEnvFile();

    // Async sync to Cloud Firestore
    const all = await getAllSettings();
    CloudSyncService.saveSettings(all).catch(err => {
      console.warn('[SettingModel] Cloud sync failed:', err.message);
    });
  },

  getAll: getAllSettings,

  async syncToEnvFile() {
    try {
      const all = await getAllSettings();
      const envLines = [
        `PORT=${config.port || 3000}`,
        `NODE_ENV=${config.nodeEnv || 'development'}`,
        `MERCHANT_UPI_VPA=${all.merchant_upi_vpa || config.merchant.upiVpa || 'ffdealsbyjena@fam'}`,
        `MERCHANT_NAME=${all.merchant_name || config.merchant.name || 'ShivFFStore'}`,
        `ORDER_EXPIRY_MINUTES=${all.order_expiry_minutes || config.orderExpiryMinutes || 5}`,
        `IMAP_ENABLED=${all.imap_enabled !== undefined ? all.imap_enabled : (config.imap.enabled ? 'true' : 'false')}`,
        `IMAP_HOST=${config.imap.host || 'imap.gmail.com'}`,
        `IMAP_PORT=${config.imap.port || 993}`,
        `IMAP_SECURE=${config.imap.secure !== false ? 'true' : 'false'}`,
        `IMAP_USER=${all.imap_user || config.imap.user || 'shaahtasham9@gmail.com'}`,
        `IMAP_PASS=${all.imap_pass || config.imap.pass || 'zfeoyxxoxrmnmbcr'}`,
        `IMAP_MAILBOX=${config.imap.mailbox || 'INBOX'}`,
        `IMAP_SENDER_FILTER=${all.imap_filter || (config.imap.senderFilter ? config.imap.senderFilter.join(',') : 'fampay,famapp,fam')}`,
        `ADMIN_SECRET_KEY=${all.admin_master_key || config.adminSecret || 'shivambhatt@admin'}`,
        `API_KEY=${all.api_key || config.auth?.apiKey || 'pg_live_549f404a2dddac4e59ff3ec1ed93d51de0b0'}`,
        `REQUIRE_API_KEY=${all.require_api_key || (config.auth?.requireApiKey ? 'true' : 'false')}`,
        `ALLOWED_ORIGINS=${all.allowed_origins || (config.allowedOrigins ? config.allowedOrigins.join(',') : 'https://dealsbyshiv.web.app,http://localhost:5173,http://localhost:3000')}`
      ];
      fs.writeFileSync(envFilePath, envLines.join('\n') + '\n', 'utf8');
    } catch (e) {
      console.error('[SettingModel] Failed to sync to .env file:', e.message);
    }
  },

  generateApiKey() {
    return 'pg_live_' + crypto.randomBytes(18).toString('hex');
  },

  async getApiKey() {
    let key = await getSetting('api_key');
    if (!key) {
      key = config.auth?.apiKey || 'pg_live_549f404a2dddac4e59ff3ec1ed93d51de0b0';
      await setSetting('api_key', key);
      await setSetting('api_key_created_at', Date.now().toString());
      await setSetting('require_api_key', 'true');
      await this.syncToEnvFile();
    }
    return key;
  },

  async regenerateApiKey() {
    const newKey = this.generateApiKey();
    await setSetting('api_key', newKey);
    await setSetting('api_key_created_at', Date.now().toString());
    await this.syncToEnvFile();
    return newKey;
  },

  async isApiKeyRequired() {
    const val = await getSetting('require_api_key', 'true');
    return val !== 'false';
  },

  async setApiKeyRequired(required) {
    await setSetting('require_api_key', required ? 'true' : 'false');
    await this.syncToEnvFile();
    const all = await getAllSettings();
    CloudSyncService.saveSettings(all).catch(() => {});
  },

  async getMasterKey() {
    let key = await getSetting('admin_master_key');
    if (!key) {
      key = config.adminSecret || 'shivambhatt@admin';
      await setSetting('admin_master_key', key);
      await this.syncToEnvFile();
    }
    return key;
  },

  async setMasterKey(newKey) {
    await setSetting('admin_master_key', newKey);
    config.adminSecret = newKey;
    await this.syncToEnvFile();
    const all = await getAllSettings();
    CloudSyncService.saveSettings(all).catch(() => {});
    return newKey;
  },

  async hydrateConfig(config) {
    // 1. Attempt hydration from Cloud Firestore first (ensures persistence across Render restarts)
    try {
      const cloudSettings = await CloudSyncService.loadSettings();
      if (cloudSettings) {
        for (const [k, v] of Object.entries(cloudSettings)) {
          if (v !== undefined && v !== null && v !== '') {
            await setSetting(k, v);
          }
        }
      }

      // Also hydrate domain API keys from cloud
      const cloudDomainKeys = await CloudSyncService.loadDomainKeys();
      if (cloudDomainKeys && cloudDomainKeys.length > 0) {
        const localKeys = await getAllDomainKeys();
        const localKeySet = new Set(localKeys.map(k => k.api_key));
        for (const dk of cloudDomainKeys) {
          if (!localKeySet.has(dk.api_key)) {
            await addDomainApiKey({
              keyName: dk.key_name || dk.keyName || 'Synced Key',
              domain: dk.domain,
              apiKey: dk.api_key || dk.apiKey,
              status: dk.status || 'ACTIVE'
            });
          }
        }
      }
    } catch (syncErr) {
      console.warn('[SettingModel] Initial cloud hydration warning:', syncErr.message);
    }

    // 2. Hydrate from SQLite / defaults into active memory config
    const vpa = await getSetting('merchant_upi_vpa');
    config.merchant.upiVpa = vpa || config.merchant.upiVpa || 'ffdealsbyjena@fam';

    const name = await getSetting('merchant_name');
    config.merchant.name = name || config.merchant.name || 'ShivFFStore';

    const expiry = await getSetting('order_expiry_minutes');
    if (expiry) config.orderExpiryMinutes = parseInt(expiry, 10);

    const imapEnabled = await getSetting('imap_enabled');
    if (imapEnabled !== '') config.imap.enabled = imapEnabled === 'true';

    const imapUser = await getSetting('imap_user');
    config.imap.user = imapUser || config.imap.user || 'shaahtasham9@gmail.com';

    const imapPass = await getSetting('imap_pass');
    config.imap.pass = imapPass || config.imap.pass || 'zfeoyxxoxrmnmbcr';

    const imapFilter = await getSetting('imap_filter');
    if (imapFilter) config.imap.senderFilter = imapFilter.split(',').map(s => s.trim().toLowerCase());

    const allowedOrigins = await getSetting('allowed_origins');
    if (allowedOrigins) {
      config.allowedOrigins = allowedOrigins.split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
    }

    // Hydrate API Key into runtime configuration
    config.auth = config.auth || {};
    config.auth.apiKey = await this.getApiKey();
    config.auth.requireApiKey = await this.isApiKeyRequired();

    // Hydrate Admin Master Key
    config.adminSecret = await this.getMasterKey();

    // Ensure .env is refreshed with latest settings
    await this.syncToEnvFile();

    console.log(`[SettingModel] Config successfully hydrated. UPI VPA: ${config.merchant.upiVpa}`);
  }
};

export default SettingModel;
