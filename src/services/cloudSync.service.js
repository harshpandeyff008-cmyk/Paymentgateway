import logger from '../utils/logger.js';

const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/ff-store-4a61e/databases/(default)/documents/ff_store';

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
  async loadSettings() {
    try {
      const url = `${FIRESTORE_BASE}/gateway_settings`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const settings = fromFirestoreFields(data.fields);
        logger.info(`[CloudSync] Loaded settings from Firestore: upi="${settings.merchant_upi_vpa}"`);
        return settings;
      }
    } catch (e) {
      logger.warn(`[CloudSync] Failed to load settings: ${e.message}`);
    }
    return null;
  },

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
        logger.info('[CloudSync] Saved settings to Firestore');
        return true;
      }
    } catch (e) {
      logger.warn(`[CloudSync] Failed to save settings: ${e.message}`);
    }
    return false;
  },

  async loadDomainKeys() {
    try {
      const url = `${FIRESTORE_BASE}/gateway_domain_keys`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const parsed = fromFirestoreFields(data.fields);
        if (parsed.keys_json) {
          const keys = JSON.parse(parsed.keys_json);
          logger.info(`[CloudSync] Loaded ${keys.length} domain keys from Firestore`);
          return keys;
        }
      }
    } catch (e) {
      logger.warn(`[CloudSync] Failed to load domain keys: ${e.message}`);
    }
    return [];
  },

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
        logger.info(`[CloudSync] Saved ${keysArray.length} domain keys to Firestore`);
        return true;
      }
    } catch (e) {
      logger.warn(`[CloudSync] Failed to save domain keys: ${e.message}`);
    }
    return false;
  },

  async loadOrders() {
    try {
      const url = `${FIRESTORE_BASE}/gateway_orders_data`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const parsed = fromFirestoreFields(data.fields);
        if (parsed.orders_json) {
          const orders = JSON.parse(parsed.orders_json);
          logger.info(`[CloudSync] Loaded ${orders.length} orders from Firestore`);
          return orders;
        }
      }
    } catch (e) {
      logger.warn(`[CloudSync] Failed to load orders: ${e.message}`);
    }
    return [];
  },

  async saveOrders(ordersArray) {
    try {
      const url = `${FIRESTORE_BASE}/gateway_orders_data`;
      const slice = ordersArray.slice(0, 200);
      const body = JSON.stringify({
        fields: toFirestoreFields({
          orders_json: JSON.stringify(slice),
          updated_at: Date.now()
        })
      });
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body
      });
      if (res.ok) {
        logger.info(`[CloudSync] Synced ${slice.length} orders to Firestore`);
        return true;
      }
    } catch (e) {
      logger.warn(`[CloudSync] Failed to save orders: ${e.message}`);
    }
    return false;
  },

  async loadPayments() {
    try {
      const url = `${FIRESTORE_BASE}/gateway_payments_data`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const parsed = fromFirestoreFields(data.fields);
        if (parsed.payments_json) {
          const payments = JSON.parse(parsed.payments_json);
          logger.info(`[CloudSync] Loaded ${payments.length} payments from Firestore`);
          return payments;
        }
      }
    } catch (e) {
      logger.warn(`[CloudSync] Failed to load payments: ${e.message}`);
    }
    return [];
  },

  async savePayments(paymentsArray) {
    try {
      const url = `${FIRESTORE_BASE}/gateway_payments_data`;
      const slice = paymentsArray.slice(0, 200);
      const body = JSON.stringify({
        fields: toFirestoreFields({
          payments_json: JSON.stringify(slice),
          updated_at: Date.now()
        })
      });
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body
      });
      if (res.ok) {
        logger.info(`[CloudSync] Synced ${slice.length} payments to Firestore`);
        return true;
      }
    } catch (e) {
      logger.warn(`[CloudSync] Failed to save payments: ${e.message}`);
    }
    return false;
  }
};

export default CloudSyncService;
