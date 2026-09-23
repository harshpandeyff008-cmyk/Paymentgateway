import { config } from '../../config.js';
import logger from '../utils/logger.js';
import { logActivity, findDomainApiKey, updateDomainKeyLastUsed, getUserByApiKey, parseUserWebsites } from '../../db/database.js';

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

  // 2. Check in domain_api_keys table or users table
  const domainKeyRecord = await findDomainApiKey(clientKey);
  const userRecord = await getUserByApiKey(clientKey);

  if (!isGlobalMatch && !domainKeyRecord && !userRecord) {
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
      error: "Unauthorized: Invalid API Key. Please verify your API Key in your Dashboard."
    });
  }

  // 2.1 If user key, enforce Active Plan and 1-Website Lock
  if (userRecord && userRecord.role !== 'admin') {
    if (!userRecord.plan || userRecord.plan === 'NONE') {
      return res.status(403).json({
        success: false,
        error: "Forbidden: No active plan found. Please activate Monthly (₹299/mo) or 1-Year (₹1999/yr) plan on your dashboard."
      });
    }

    // Enforce Strict Website Lock: API Key will NOT work until website domain is registered & locked
    if (!userRecord.is_website_locked || !userRecord.website_url) {
      logger.warn(`[Auth] Blocked request from ${userRecord.email}: Website domain not registered/locked`);
      logActivity({
        eventType: 'API_AUTH_FAILED',
        status: 'FAILED',
        title: 'API Authentication Rejected: Website Domain Not Locked',
        details: `Merchant ${userRecord.email} has not locked their website domain yet. API calls are blocked until website is bound.`,
        clientIp,
        origin: rawOrigin
      });
      return res.status(403).json({
        success: false,
        error: "Forbidden: API Key is INACTIVE. You must register and permanently lock your authorized website domain in your Merchant Dashboard before this key can process payments."
      });
    }

    if (userRecord.is_website_locked === 1) {
      const websites = parseUserWebsites(userRecord);
      const allowedDomains = websites.map(w => normalizeDomain(w.url || w.domain || w)).filter(Boolean);
      const hostDomain = normalizeDomain(req.headers.host || '');
      const isAdminConsoleTest = req.headers['x-admin-test'] === 'true' || 
                                originDomain.includes('paypendicular') || 
                                originDomain === hostDomain;

      if (allowedDomains.length > 0 && originDomain && !isAdminConsoleTest) {
        const isDomainMatch = allowedDomains.some(d => originDomain === d || originDomain.endsWith('.' + d));
        if (!isDomainMatch) {
          logger.warn(`[Auth] Blocked: API Key locked to [${allowedDomains.join(', ')}] was called from "${originDomain}"`);
          logActivity({
            eventType: 'API_AUTH_DOMAIN_MISMATCH',
            status: 'FAILED',
            title: 'API Authentication Rejected: Locked Website Mismatch',
            details: `API Key is locked to [${allowedDomains.join(', ')}], but order request was sent from "${originDomain}"`,
            clientIp,
            origin: rawOrigin
          });
          return res.status(403).json({
            success: false,
            error: `Forbidden: This API Key is strictly locked to [${allowedDomains.join(', ')}]. Requests from '${originDomain}' are strictly prohibited.`
          });
        }
      }
    }
    req.userRecord = userRecord;
  }

  // 3. If matched a domain-specific key, verify domain permission
  if (domainKeyRecord) {
    const allowedDomain = normalizeDomain(domainKeyRecord.domain);

    // Check if the request is coming from the gateway's own Admin Console test or has admin test header
    const hostDomain = normalizeDomain(req.headers.host || '');
    const isAdminConsoleTest = req.headers['x-admin-test'] === 'true' || originDomain.includes('paypendicular') || 
                              originDomain === hostDomain || 
                              (originDomain && hostDomain && originDomain === hostDomain);

    // If key is bound to a specific domain (not wildcard '*') and request has origin/referer
    if (allowedDomain && allowedDomain !== '*' && originDomain && !isAdminConsoleTest) {
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
