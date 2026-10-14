import jwt from 'jsonwebtoken';
import { config } from '../../config.js';
import logger from '../utils/logger.js';

/**
 * Middleware to authenticate user/merchant requests via JWT.
 * Enforces verified user identity to eliminate IDOR and account takeover risks.
 */
export function userAuth(req, res, next) {
  // Allow Admin Master Key override if valid x-admin-key is supplied
  const adminKey = req.headers['x-admin-key'] || req.query.admin_key;
  if (adminKey && config.adminSecret && adminKey.trim() === config.adminSecret.trim()) {
    req.adminAuthenticated = true;
    req.user = { email: req.query.email || req.headers['x-user-email'] || 'admin', role: 'admin' };
    return next();
  }

  // Extract JWT from Authorization: Bearer <token> or x-auth-token header
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-auth-token']) {
    token = req.headers['x-auth-token'].trim();
  } else if (req.query.token) {
    token = req.query.token.trim();
  }

  if (!token) {
    logger.warn(`[UserAuth] Blocked unauthenticated request to ${req.method} ${req.originalUrl}`);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Authentication token is required. Please sign in.'
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (!decoded || !decoded.email) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token payload.' });
    }

    req.user = {
      id: decoded.id,
      email: decoded.email.toLowerCase().trim(),
      role: decoded.role || 'user'
    };

    return next();
  } catch (err) {
    logger.warn(`[UserAuth] JWT verification failed: ${err.message}`);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Session expired or invalid token. Please log in again.'
    });
  }
}

export default userAuth;
