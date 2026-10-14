import nodemailer from 'nodemailer';
import { config } from '../../config.js';
import logger from '../../src/utils/logger.js';

// Credentials from environment / config
const gmailUser = config.imap?.user || process.env.IMAP_USER || '';
const gmailPass = config.imap?.pass || process.env.IMAP_PASS || '';

// API Keys / Webhooks for Cloud Deployment (Render Free tier blocks SMTP 465/587)
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const GMAIL_WEBHOOK_URL = process.env.GMAIL_WEBHOOK_URL || '';

// Nodemailer transporter (works on localhost/VPS)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '465', 10),
  secure: true,
  auth: {
    user: gmailUser,
    pass: gmailPass
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 200,
  connectionTimeout: 8000,
  greetingTimeout: 5000,
  socketTimeout: 10000
});

export const EmailSender = {
  /**
   * Send transactional HTML OTP email directly to recipient inbox
   * Automatically selects HTTPS REST API (Port 443) on Render / Cloud or SMTP on Localhost
   */
  async sendHtmlEmail({ to, subject, htmlContent, senderName = 'ZeroFee UPI' }) {
    const targetEmail = (to || '').trim().toLowerCase();
    if (!targetEmail) throw new Error('Recipient email is required');

    logger.info(`[AuthOtp] Dispatching OTP email to: ${targetEmail}...`);

    // Method 1: Google Apps Script HTTPS Relay (Port 443 - zero block on Render)
    if (GMAIL_WEBHOOK_URL) {
      try {
        const response = await fetch(GMAIL_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: targetEmail,
            subject: subject,
            htmlBody: htmlContent,
            senderName: senderName
          })
        });
        if (response.ok) {
          logger.info(`[AuthOtp] ✅ OTP Email delivered via Google HTTPS Relay to ${targetEmail}`);
          return { success: true, provider: 'GOOGLE_APPS_SCRIPT_HTTPS' };
        }
      } catch (err) {
        logger.warn(`[AuthOtp] Google Apps Script relay failed: ${err.message}, trying next provider...`);
      }
    }

    // Method 2: Resend REST API (Port 443 - Cloud friendly)
    if (RESEND_API_KEY) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: `${senderName} <onboarding@resend.dev>`,
            to: [targetEmail],
            subject: subject,
            html: htmlContent
          })
        });
        const data = await response.json();
        if (response.ok) {
          logger.info(`[AuthOtp] ✅ OTP Email delivered via Resend REST API to ${targetEmail} (ID: ${data.id})`);
          return { success: true, provider: 'RESEND_HTTPS', messageId: data.id };
        } else {
          logger.warn(`[AuthOtp] Resend API error: ${JSON.stringify(data)}`);
        }
      } catch (err) {
        logger.warn(`[AuthOtp] Resend API failed: ${err.message}, trying next provider...`);
      }
    }

    // Method 3: Brevo REST API (Port 443 - Cloud friendly)
    if (BREVO_API_KEY) {
      try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': BREVO_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sender: { name: senderName, email: gmailUser },
            to: [{ email: targetEmail }],
            subject: subject,
            htmlContent: htmlContent
          })
        });
        const data = await response.json();
        if (response.ok) {
          logger.info(`[AuthOtp] ✅ OTP Email delivered via Brevo REST API to ${targetEmail} (MsgID: ${data.messageId})`);
          return { success: true, provider: 'BREVO_HTTPS', messageId: data.messageId };
        } else {
          logger.warn(`[AuthOtp] Brevo API error: ${JSON.stringify(data)}`);
        }
      } catch (err) {
        logger.warn(`[AuthOtp] Brevo API failed: ${err.message}, trying next provider...`);
      }
    }

    // Method 4: Nodemailer SMTP direct SSL (Default for Localhost / Unrestricted servers)
    try {
      const info = await transporter.sendMail({
        from: `"${senderName}" <${gmailUser}>`,
        to: targetEmail,
        subject: subject,
        text: `Your ZeroFee UPI verification code is in this email. If you did not request this, please ignore.`,
        html: htmlContent,
        headers: {
          'X-Priority': '1',
          'X-MSMail-Priority': 'High',
          'Importance': 'High'
        }
      });

      logger.info(`[AuthOtp] ✅ OTP Email delivered successfully via SMTP to ${targetEmail} (MsgID: ${info.messageId})`);
      return { success: true, provider: 'GMAIL_SMTP', messageId: info.messageId };
    } catch (err) {
      logger.error(`[AuthOtp] ❌ Failed to dispatch email via SMTP to ${targetEmail}: ${err.message}`);
      throw err;
    }
  }
};

export default EmailSender;
