import crypto from 'crypto';
import { config } from '../config.js';
import { query, getUserByEmail, updateUserGoogleBankingLink } from '../db/database.js';
import { CloudSyncService } from '../src/services/cloudSync.service.js';

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo';

export const GoogleOAuthService = {
  /**
   * Generate the Google OAuth 2.0 Authorization URL requesting permanent offline refresh token
   */
  getAuthUrl(userEmail, upiVpa = '', businessName = '', upiProvider = 'AUTO', origin = '') {
    const statePayload = JSON.stringify({
      userEmail: (userEmail || '').trim().toLowerCase(),
      upiVpa: (upiVpa || '').trim(),
      businessName: (businessName || '').trim(),
      upiProvider: (upiProvider || 'AUTO').trim(),
      origin: origin || 'https://upigateway.web.app',
      ts: Date.now()
    });

    const b64Payload = Buffer.from(statePayload).toString('base64url');
    const secret = config.jwtSecret || config.adminSecret || 'oauth_state_secret';
    const sig = crypto.createHmac('sha256', secret).update(b64Payload).digest('hex');
    const state = `${b64Payload}.${sig}`;

    const params = new URLSearchParams({
      client_id: config.googleOAuth.clientId,
      redirect_uri: config.googleOAuth.redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email',
      access_type: 'offline', // Requests Permanent Refresh Token
      prompt: 'consent',     // Forces consent screen to guarantee refresh_token is returned
      state: state
    });

    return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
  },

  /**
   * Exchange Google Authorization Code for Access & Permanent Refresh Tokens
   */
  async exchangeCodeForTokens(code) {
    const params = new URLSearchParams({
      code,
      client_id: config.googleOAuth.clientId,
      client_secret: config.googleOAuth.clientSecret,
      redirect_uri: config.googleOAuth.redirectUri,
      grant_type: 'authorization_code'
    });

    const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google token exchange failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || '',
      expiresIn: data.expires_in || 3600,
      tokenExpiry: Date.now() + ((data.expires_in || 3600) * 1000)
    };
  },

  /**
   * Fetch authenticated Google user's email address using access token
   */
  async getGoogleUserEmail(accessToken) {
    try {
      const res = await fetch(GOOGLE_USERINFO_ENDPOINT, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        return data.email || '';
      }
    } catch (_) {}
    return '';
  },

  /**
   * Auto-Refresh Access Token in background using saved Permanent Refresh Token
   */
  async refreshAccessToken(refreshToken, userEmail = '') {
    if (!refreshToken) return null;

    try {
      const params = new URLSearchParams({
        client_id: config.googleOAuth.clientId,
        client_secret: config.googleOAuth.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      });

      const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[GoogleOAuth] Failed to refresh token for ${userEmail}:`, errText);
        return null;
      }

      const data = await res.json();
      const newAccessToken = data.access_token;
      const newExpiry = Date.now() + ((data.expires_in || 3600) * 1000);

      if (userEmail && newAccessToken) {
        await query.run(
          `UPDATE users SET gmail_access_token = ?, google_token_expiry = ?, gmail_token_expired = 0, updated_at = ? WHERE lower(email) = ?`,
          [newAccessToken, newExpiry, Date.now(), userEmail.trim().toLowerCase()]
        );
        const updated = await getUserByEmail(userEmail);
        if (updated) {
          CloudSyncService.saveUser(updated).catch(() => {});
        }
      }

      return {
        accessToken: newAccessToken,
        tokenExpiry: newExpiry
      };
    } catch (err) {
      console.error('[GoogleOAuth] Error in refreshAccessToken:', err.message);
      return null;
    }
  }
};

export default GoogleOAuthService;
