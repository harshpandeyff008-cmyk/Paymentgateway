import { SettingModel } from '../models/setting.model.js';
import { getAllDomainKeys, addDomainApiKey, deleteDomainApiKey } from '../../db/database.js';
import { CloudSyncService } from '../services/cloudSync.service.js';
import { config } from '../../config.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

function maskKey(key) {
  if (!key) return '••••••••';
  if (key.length <= 12) return '••••••••';
  return `${key.slice(0, 8)}••••••••••••••••${key.slice(-4)}`;
}

export const ApiKeyController = {
  /**
   * List all domain-specific API Keys
   */
  async listDomainKeys(req, res) {
    try {
      const keys = await getAllDomainKeys();
      const requireApiKey = await SettingModel.isApiKeyRequired();

      const formatted = keys.map(k => ({
        id: k.id,
        keyName: k.key_name || 'Storefront Key',
        domain: k.domain,
        apiKey: k.api_key,
        maskedKey: maskKey(k.api_key),
        status: k.status,
        createdAt: k.created_at,
        lastUsedAt: k.last_used_at
      }));

      return res.json({
        success: true,
        keys: formatted,
        requireApiKey,
        total: formatted.length
      });
    } catch (err) {
      logger.error(`[ApiKeyController Error]: ${err.message}`);
      return res.status(500).json({ success: false, error: 'Failed to retrieve domain API keys' });
    }
  },

  /**
   * Create or Register a New API Key for a specific domain
   */
  async createDomainKey(req, res) {
    try {
      let { domain, apiKey, keyName } = req.body;

      if (!domain || !domain.trim()) {
        return res.status(400).json({ success: false, error: 'Domain is required (e.g. dealsbyshiv.web.app or * for universal)' });
      }

      domain = domain.trim();
      // Auto-generate key if user left it blank
      if (!apiKey || !apiKey.trim()) {
        apiKey = 'pg_live_' + crypto.randomBytes(18).toString('hex');
      } else {
        apiKey = apiKey.trim();
      }

      keyName = (keyName && keyName.trim()) ? keyName.trim() : `Key for ${domain}`;

      const newRecord = await addDomainApiKey({
        keyName,
        domain,
        apiKey,
        status: 'ACTIVE'
      });

      // Sync all domain keys to Cloud Firestore for persistence
      const allKeys = await getAllDomainKeys();
      CloudSyncService.saveDomainKeys(allKeys).catch(err => {
        logger.warn(`[ApiKeyController] Failed to sync domain keys to cloud: ${err.message}`);
      });

      logger.info(`[ApiKey] Created API key for domain "${domain}": ${apiKey.slice(0, 10)}...`);

      return res.json({
        success: true,
        message: `API Key created successfully for domain ${domain}!`,
        key: {
          id: newRecord.id,
          keyName: newRecord.key_name,
          domain: newRecord.domain,
          apiKey: newRecord.api_key,
          maskedKey: maskKey(newRecord.api_key),
          status: newRecord.status,
          createdAt: newRecord.created_at
        }
      });
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ success: false, error: 'This API Key already exists in the system.' });
      }
      logger.error(`[ApiKeyController Error]: ${err.message}`);
      return res.status(500).json({ success: false, error: 'Failed to create domain API key: ' + err.message });
    }
  },

  /**
   * Delete / Revoke a domain API key
   */
  async deleteDomainKey(req, res) {
    try {
      const { id } = req.params;
      await deleteDomainApiKey(id);

      // Sync updated list to Cloud Firestore
      const allKeys = await getAllDomainKeys();
      CloudSyncService.saveDomainKeys(allKeys).catch(() => {});

      return res.json({ success: true, message: 'Domain API key revoked and removed successfully.' });
    } catch (err) {
      logger.error(`[ApiKeyController Error]: ${err.message}`);
      return res.status(500).json({ success: false, error: 'Failed to delete domain API key' });
    }
  },

  /**
   * Toggle enforcement of API key verification on order creation
   */
  async toggleRequireApiKey(req, res) {
    try {
      const { required } = req.body;
      const isRequired = required === true || required === 'true';

      await SettingModel.setApiKeyRequired(isRequired);
      config.auth = config.auth || {};
      config.auth.requireApiKey = isRequired;

      logger.info(`[ApiKey] Require API Key enforcement set to: ${isRequired}`);

      return res.json({
        success: true,
        requireApiKey: isRequired,
        message: isRequired 
          ? 'API Key is now strictly REQUIRED for creating orders.' 
          : 'API Key requirement is now OPTIONAL (Open Testing Mode).'
      });
    } catch (err) {
      logger.error(`[ApiKeyController Error]: ${err.message}`);
      return res.status(500).json({ success: false, error: 'Failed to update API key enforcement setting' });
    }
  },

  /**
   * Legacy Get API Key for backward compatibility
   */
  async getApiKey(req, res) {
    try {
      const apiKey = await SettingModel.getApiKey();
      const requireApiKey = await SettingModel.isApiKeyRequired();
      const createdAt = await SettingModel.get('api_key_created_at', Date.now().toString());

      return res.json({
        success: true,
        apiKey,
        maskedKey: maskKey(apiKey),
        requireApiKey,
        createdAt: parseInt(createdAt, 10)
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Failed to retrieve API key' });
    }
  },

  /**
   * Legacy regenerate
   */
  async regenerateApiKey(req, res) {
    try {
      const newKey = await SettingModel.regenerateApiKey();
      config.auth = config.auth || {};
      config.auth.apiKey = newKey;

      return res.json({
        success: true,
        apiKey: newKey,
        message: 'New API Key generated successfully!'
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Failed to regenerate API key' });
    }
  }
};

export default ApiKeyController;
