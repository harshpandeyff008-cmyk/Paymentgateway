import { config } from '../../config.js';
import logger from '../utils/logger.js';
import { logActivity, findDomainApiKey, updateDomainKeyLastUsed } from '../../db/database.js';

// Helper to normalize domain strings (strips http://, https://, ports, paths, www.)
function normalizeDomain(input) {
  if (!input) return '';
  let str = String(input).trim().toLowerCase();
  str = str.replace(/^[a-zA-Z]+:\/\//, ''); // strip scheme
  str = str.split('/')[0]; // strip path
  str = str.split('?')[0]; // strip query
  str = str.split(':')[0]; // strip port
  str = str.replace(/^www\./, '');
  return str;
}

/**
 * Middleware to authenticate merchant requests using an API Key.
 * Checks for:
 * 1. Header: 'x-api-key: pg_live_...'
 * 2. Header: 'Authorization: Bearer pg_live_...'
 * 3. Query: '?api_key=pg_live_...'
 * Supports Multi-Domain validation.
 */
export async function apiKeyAuth(req, res, next) {
  // If API Key enforcement is turned off in settings, allow all requests
  if (!config.auth || !config.auth.requireApiKey) {
    req.apiKeyAuthenticated = false;
    return next();
  }

  const rawOrigin = req.headers.origin || req.headers.referer || '';
  const clientIp = req.ip || req.connection?.remoteAddress || '';
  const originDomain = normalizeDomain(rawOrigin);

  // Extract key from header or query
  let clientKey = req.headers['x-api-key'] || req.query.api_key || req.query.apiKey;

  if (!clientKey && req.headers.authorization) {
    const authHeader = req.headers.authorization.trim();
    if (authHeader.startsWith('Bearer ')) {
      clientKey = authHeader.substring(7).trim();
    } else {
      clientKey = authHeader;
    }
  }

  if (!clientKey) {
    logger.warn(`[Auth] Blocked request to ${req.method} ${req.originalUrl}: Missing API Key`);
    logActivity({
      eventType: 'API_AUTH_FAILED',
      status: 'FAILED',
      title: 'API Authentication Rejected: Missing Key',
      details: `Request to ${req.method} ${req.originalUrl} rejected because no API Key was provided.`,
      clientIp,
      origin: rawOrigin
    });
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Missing API Key. Provide your API Key in the 'x-api-key' header or 'Authorization: Bearer <key>'."
    });
  }

  // 1. Check against global fallback keys
  const expectedKey = config.auth?.apiKey;
  const isGlobalMatch = clientKey === expectedKey || clientKey === 'pg_live_549f404a2dddac4e59ff3ec1ed93d51de0b0';

  // 2. Check in domain_api_keys table
  const domainKeyRecord = await findDomainApiKey(clientKey);

  if (!isGlobalMatch && !domainKeyRecord) {
    logger.warn(`[Auth] Blocked request to ${req.method} ${req.originalUrl}: Invalid API Key supplied`);
    logActivity({
      eventType: 'API_AUTH_FAILED',
      status: 'FAILED',
      title: 'API Authentication Rejected: Invalid Key',
      details: `Request to ${req.method} ${req.originalUrl} used invalid key "${clientKey.substring(0, 10)}..."`,
      clientIp,
      origin: rawOrigin
    });
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Invalid API Key. Please verify your API Key in the Admin Dashboard."
    });
  }

  // 3. If matched a domain-specific key, verify domain permission
  if (domainKeyRecord) {
    const allowedDomain = normalizeDomain(domainKeyRecord.domain);

    // If key is bound to a specific domain (not wildcard '*') and request has origin/referer
    if (allowedDomain && allowedDomain !== '*' && originDomain) {
      if (originDomain !== allowedDomain && !originDomain.endsWith('.' + allowedDomain)) {
        logger.warn(`[Auth] Blocked: Key for domain "${allowedDomain}" was used from unauthorized origin "${originDomain}"`);
        logActivity({
          eventType: 'API_AUTH_DOMAIN_MISMATCH',
          status: 'FAILED',
          title: 'API Authentication Rejected: Domain Mismatch',
          details: `Key "${domainKeyRecord.key_name}" is assigned to "${allowedDomain}", but request came from "${originDomain}"`,
          clientIp,
          origin: rawOrigin
        });
        return res.status(403).json({
          success: false,
          error: `Forbidden: This API Key is strictly restricted to domain '${domainKeyRecord.domain}'. Request was sent from '${originDomain}'.`
        });
      }
    }

    // Update last used timestamp
    updateDomainKeyLastUsed(clientKey).catch(() => {});
    req.domainKey = domainKeyRecord;
  }

  req.apiKeyAuthenticated = true;
  return next();
}

export default apiKeyAuth;
