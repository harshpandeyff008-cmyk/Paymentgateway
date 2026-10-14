import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OtpManager } from './otpManager.js';
import { EmailSender } from './emailSender.js';
import { getUserByEmail, query, generateApiKey } from '../../db/database.js';
import { CloudSyncService } from '../../src/services/cloudSync.service.js';
import { config } from '../../config.js';

export const OtpController = {
  /**
   * POST /api/v1/auth/otp/send
   * Body: { email, purpose: 'SIGNUP' | 'FORGOT_PASSWORD' }
   */
  async sendOtp(req, res) {
    try {
      const { email, purpose = 'SIGNUP' } = req.body;
      const normalizedEmail = (email || '').trim().toLowerCase();

      if (!normalizedEmail || !normalizedEmail.includes('@')) {
        return res.status(400).json({ success: false, error: 'Valid email address is required' });
      }

      // Enforce 60s cooldown rate limiting between OTP requests
      const cooldownCheck = OtpManager.checkCooldown(normalizedEmail, purpose, 60);
      if (cooldownCheck.inCooldown) {
        return res.status(429).json({
          success: false,
          error: `Please wait ${cooldownCheck.remainingSeconds} seconds before requesting a new OTP.`
        });
      }

      // If forgot password, check if user exists in database or CloudSync
      if (purpose === 'FORGOT_PASSWORD') {
        let user = await getUserByEmail(normalizedEmail);
        if (!user) {
          try {
            user = await CloudSyncService.getUser(normalizedEmail);
          } catch (_) {}
        }
        if (!user) {
          return res.status(404).json({ 
            success: false, 
            error: 'No registered merchant account found with this email. Please check your email or click "Create New Account".' 
          });
        }
      }

      // If signup, check if email is already registered with a password
      if (purpose === 'SIGNUP') {
        let existingUser = await getUserByEmail(normalizedEmail);
        if (!existingUser) {
          try {
            existingUser = await CloudSyncService.getUser(normalizedEmail);
          } catch (_) {}
        }
        if (existingUser && existingUser.password_hash) {
          return res.status(409).json({ 
            success: false, 
            error: 'This email is already registered. Please Sign In or use "Forgot Password".' 
          });
        }
      }

      // Generate 6-Digit OTP
      const { otp, expirySeconds } = OtpManager.generateOtp(normalizedEmail, purpose);

      const title = purpose === 'FORGOT_PASSWORD' ? 'Password Reset Verification' : 'Email Verification Code';
      const actionText = purpose === 'FORGOT_PASSWORD' ? 'reset your ZeroFee UPI account password' : 'complete your secure merchant workspace registration on ZeroFee UPI';

      const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
          .card { background: #ffffff; max-width: 480px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
          .header { border-bottom: 1px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
          .logo-text { font-size: 18px; font-weight: 800; color: #ea580c; }
          .otp-box { background: #fff7ed; border: 1.5px dashed #ea580c; border-radius: 12px; padding: 16px; text-align: center; margin: 24px 0; }
          .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #ea580c; font-family: monospace; }
          .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 11.5px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <span class="logo-text">ZeroFee UPI</span>
          </div>
          <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0;">${title}</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            Use the 6-digit verification code below to ${actionText}:
          </p>
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
            <div style="font-size: 12px; color: #9a3412; font-weight: 600; margin-top: 6px;">Valid for 5 minutes</div>
          </div>
          <p style="font-size: 12.5px; color: #64748b; line-height: 1.5;">
            Warning: If you did not request this verification code, please ignore this email. Never share this code with anyone.
          </p>
          <div class="footer">
            <span>256-Bit SSL Encrypted Transaction Engine - ZeroFee UPI Gateway</span>
          </div>
        </div>
      </body>
      </html>
      `;

      // Dispatch email asynchronously
      EmailSender.sendHtmlEmail({
        to: normalizedEmail,
        subject: `${otp} is your ZeroFee UPI verification code`,
        htmlContent: html
      }).catch(err => {
        console.error(`[AuthOtp] Background email dispatch error for ${normalizedEmail}:`, err.message);
      });

      return res.json({
        success: true,
        message: '6-digit OTP code sent successfully to your email inbox.',
        email: normalizedEmail,
        expirySeconds
      });
    } catch (err) {
      console.error('[OtpController] Send OTP error:', err);
      return res.status(500).json({ success: false, error: 'Failed to send OTP: ' + err.message });
    }
  },

  /**
   * POST /api/v1/auth/otp/verify
   * Body: { email, otp, purpose }
   */
  async verifyOtp(req, res) {
    try {
      const { email, otp, purpose = 'SIGNUP' } = req.body;
      const normalizedEmail = (email || '').trim().toLowerCase();

      if (!normalizedEmail || !otp) {
        return res.status(400).json({ success: false, error: 'Email and OTP code are required' });
      }

      const result = OtpManager.verifyOtp(normalizedEmail, otp, purpose);
      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.json(result);
    } catch (err) {
      console.error('[OtpController] Verify OTP error:', err);
      return res.status(500).json({ success: false, error: 'Failed to verify OTP' });
    }
  },

  /**
   * POST /api/v1/auth/otp/register
   * Body: { email, password, name, phone, verificationToken }
   */
  async register(req, res) {
    try {
      const { email, password, name = 'User', phone = '', verificationToken } = req.body;
      const normalizedEmail = (email || '').trim().toLowerCase();

      if (!normalizedEmail || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long' });
      }

      // Strictly require verification token
      if (!verificationToken) {
        return res.status(400).json({ success: false, error: 'Email verification token is required to register.' });
      }

      const isTokenValid = OtpManager.validateVerificationToken(normalizedEmail, verificationToken, 'SIGNUP');
      if (!isTokenValid) {
        return res.status(400).json({ success: false, error: 'Invalid or expired verification token. Please verify OTP first.' });
      }

      // Check if already registered with a password
      let user = await getUserByEmail(normalizedEmail);
      if (!user) {
        try {
          user = await CloudSyncService.getUser(normalizedEmail);
        } catch (_) {}
      }

      if (user && user.password_hash) {
        return res.status(409).json({
          success: false,
          error: 'This email is already registered. Please Sign In with your password.'
        });
      }

      const now = Date.now();
      const adminEmail = (config.adminEmail || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
      const isAdmin = Boolean(adminEmail && normalizedEmail === adminEmail);
      const role = isAdmin ? 'admin' : 'user';

      // Hash password using bcryptjs
      const passwordHash = await bcrypt.hash(password, 10);

      if (user) {
        // Update user's password hash, name, phone
        await query.run(
          `UPDATE users SET name = ?, phone = ?, password_hash = ?, updated_at = ? WHERE lower(email) = ?`,
          [name || user.name || 'User', phone || user.phone || '', passwordHash, now, normalizedEmail]
        );
        user = await getUserByEmail(normalizedEmail);
      } else {
        const initialApiKey = generateApiKey();
        await query.run(
          `INSERT INTO users (email, name, phone, password_hash, photo_url, role, plan, qr_credits, api_key, gmail_connected, created_at, updated_at)
           VALUES (?, ?, ?, ?, '', ?, 'NONE', 0, ?, 0, ?, ?)`,
          [normalizedEmail, name || 'User', phone || '', passwordHash, role, initialApiKey, now, now]
        );
        user = await getUserByEmail(normalizedEmail);
      }

      // Sync to CloudSync (excluding plain password)
      if (user) {
        CloudSyncService.saveUser(user).catch(() => {});
      }

      // Generate secure JWT token
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      return res.json({
        success: true,
        message: 'Account registered and activated successfully!',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone || '',
          role: user.role,
          plan: user.plan,
          apiKey: user.api_key,
          hasActivePlan: user.plan && user.plan !== 'NONE'
        }
      });
    } catch (err) {
      console.error('[OtpController] Register error:', err);
      return res.status(500).json({ success: false, error: 'Failed to create account: ' + err.message });
    }
  },

  /**
   * POST /api/v1/auth/otp/login
   * Body: { email, password }
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;
      const normalizedEmail = (email || '').trim().toLowerCase();

      if (!normalizedEmail || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required' });
      }

      let user = await getUserByEmail(normalizedEmail);
      if (!user) {
        try {
          user = await CloudSyncService.getUser(normalizedEmail);
        } catch (_) {}
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'No merchant account found with this email. Please click "Register new account".'
        });
      }

      if (!user.password_hash) {
        return res.status(400).json({
          success: false,
          error: 'This account was signed in via Google or has no password set. Please use "Continue with Google" or click "Forgot password" to create a password.'
        });
      }

      // Verify password via bcryptjs (with backward-compatible plaintext auto-upgrade)
      let isMatch = false;
      const isBcrypt = user.password_hash.startsWith('$2a$') || user.password_hash.startsWith('$2b$');
      if (isBcrypt) {
        isMatch = await bcrypt.compare(password, user.password_hash);
      } else {
        // Legacy plaintext check -> upgrade to bcrypt
        if (user.password_hash === password) {
          isMatch = true;
          const upgradedHash = await bcrypt.hash(password, 10);
          await query.run('UPDATE users SET password_hash = ? WHERE id = ?', [upgradedHash, user.id]);
        }
      }

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          error: 'Invalid password. Please check your password or use "Forgot password".'
        });
      }

      // Generate signed JWT token
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      return res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          plan: user.plan,
          apiKey: user.api_key,
          hasActivePlan: user.plan && user.plan !== 'NONE'
        }
      });
    } catch (err) {
      console.error('[OtpController] Login error:', err);
      return res.status(500).json({ success: false, error: 'Login failed: ' + err.message });
    }
  },

  /**
   * POST /api/v1/auth/otp/reset-password
   * Body: { email, verificationToken, newPassword }
   */
  async resetPassword(req, res) {
    try {
      const { email, verificationToken, newPassword } = req.body;
      const normalizedEmail = (email || '').trim().toLowerCase();

      if (!normalizedEmail || !verificationToken || !newPassword) {
        return res.status(400).json({ success: false, error: 'Email, verification token, and new password are required' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long' });
      }

      // Validate token
      const isValid = OtpManager.validateVerificationToken(normalizedEmail, verificationToken, 'FORGOT_PASSWORD');
      if (!isValid) {
        return res.status(401).json({ success: false, error: 'Invalid or expired reset token. Please request a new OTP.' });
      }

      // Hash new password using bcryptjs
      const passwordHash = await bcrypt.hash(newPassword, 10);
      const now = Date.now();
      await query.run(
        `UPDATE users SET password_hash = ?, updated_at = ? WHERE lower(email) = ?`,
        [passwordHash, now, normalizedEmail]
      );

      const updated = await getUserByEmail(normalizedEmail);
      if (updated) {
        CloudSyncService.saveUser(updated).catch(() => {});
      }

      return res.json({
        success: true,
        message: 'Password reset successfully! You can now sign in with your new password.'
      });
    } catch (err) {
      console.error('[OtpController] Reset password error:', err);
      return res.status(500).json({ success: false, error: 'Failed to reset password: ' + err.message });
    }
  }
};

export default OtpController;
