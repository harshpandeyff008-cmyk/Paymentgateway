import logger from '../utils/logger.js';
import { config } from '../../config.js';

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${config.cloudSync?.projectId || 'ff-store-4a61e'}/databases/(default)/documents/ff_store`;

// Helper to convert plain JS object to Firestore document fields
function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === null || val === undefined) {
      fields[key] = { nullValue: null };
    } else if (typeof val === 'boolean') {
      fields[key] = { booleanValue: val };
    } else if (typeof val === 'number') {
      fields[key] = Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
    } else if (Array.isArray(val)) {
      fields[key] = {
        arrayValue: {
          values: val.map(v => typeof v === 'object' ? { stringValue: JSON.stringify(v) } : { stringValue: String(v) })
        }
      };
    } else if (typeof val === 'object') {
      fields[key] = { stringValue: JSON.stringify(val) };
    } else {
      fields[key] = { stringValue: String(val) };
    }
  }
  return fields;
}

// Helper to convert Firestore fields back to plain JS object
function fromFirestoreFields(fields) {
  if (!fields) return {};
  const obj = {};
  for (const [key, field] of Object.entries(fields)) {
    if ('stringValue' in field) obj[key] = field.stringValue;
    else if ('integerValue' in field) obj[key] = parseInt(field.integerValue, 10);
    else if ('doubleValue' in field) obj[key] = parseFloat(field.doubleValue);
    else if ('booleanValue' in field) obj[key] = field.booleanValue;
    else if ('nullValue' in field) obj[key] = null;
    else if ('arrayValue' in field) {
      obj[key] = (field.arrayValue.values || []).map(v => {
        if ('stringValue' in v) return v.stringValue;
        return v;
      });
    }
  }
  return obj;
}

export const CloudSyncService = {
  /**
   * Fetch persistent settings from Firestore ff_store/gateway_settings
   */
  async loadSettings() {
    try {
      const url = `${FIRESTORE_BASE}/gateway_settings`;
      const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
      if (!res.ok) {
        if (res.status === 404) {
          logger.info('[CloudSync] No cloud settings doc found yet. Will initialize on first write.');
          return null;
        }
        logger.warn(`[CloudSync] Failed to fetch settings from cloud (${res.status})`);
        return null;
      }
      const data = await res.json();
      const settings = fromFirestoreFields(data.fields);
      logger.info(`[CloudSync] Successfully loaded persistent settings from Firestore: merchant_upi_vpa="${settings.merchant_upi_vpa || 'not set'}"`);
      return settings;
    } catch (err) {
      logger.warn(`[CloudSync] Network error fetching cloud settings: ${err.message}`);
      return null;
    }
  },

  /**
   * Persist current settings into Firestore ff_store/gateway_settings
   */
  async saveSettings(settings) {
    try {
      const url = `${FIRESTORE_BASE}/gateway_settings`;
      const body = JSON.stringify({
        fields: toFirestoreFields({
          ...settings,
          updated_at: Date.now()
        })
      });
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body
      });
      if (res.ok) {
        logger.info('[CloudSync] Settings successfully backed up to Cloud Firestore.');
        return true;
      } else {
        const text = await res.text();
        logger.warn(`[CloudSync] Failed to save settings to Cloud Firestore (${res.status}): ${text}`);
        return false;
      }
    } catch (err) {
      logger.warn(`[CloudSync] Network error saving cloud settings: ${err.message}`);
      return false;
    }
  },

  /**
   * Fetch all domain API keys from Firestore ff_store/gateway_domain_keys
   */
  async loadDomainKeys() {
    try {
      const url = `${FIRESTORE_BASE}/gateway_domain_keys`;
      const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
      if (!res.ok) return [];
      const data = await res.json();
      const parsed = fromFirestoreFields(data.fields);
      if (parsed.keys_json) {
        try {
          return JSON.parse(parsed.keys_json);
        } catch (_) {}
      }
      return [];
    } catch (err) {
      logger.warn(`[CloudSync] Network error fetching domain keys: ${err.message}`);
      return [];
    }
  },

  /**
   * Save domain API keys array into Firestore ff_store/gateway_domain_keys
   */
  async saveDomainKeys(keysArray) {
    try {
      const url = `${FIRESTORE_BASE}/gateway_domain_keys`;
      const body = JSON.stringify({
        fields: toFirestoreFields({
          keys_json: JSON.stringify(keysArray),
          updated_at: Date.now()
        })
      });
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body
      });
      if (res.ok) {
        logger.info('[CloudSync] Domain API keys successfully backed up to Cloud Firestore.');
        return true;
      }
      return false;
    } catch (err) {
      logger.warn(`[CloudSync] Network error saving domain keys: ${err.message}`);
      return false;
    }
  }
};

export default CloudSyncService;
