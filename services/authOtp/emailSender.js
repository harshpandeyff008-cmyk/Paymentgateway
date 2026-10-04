import nodemailer from 'nodemailer';
import { config } from '../../config.js';
import logger from '../../src/utils/logger.js';

// Setup high-speed Gmail Direct SSL Transporter with connection pooling
const gmailUser = config.imap?.user || 'shaahtasham9@gmail.com';
const gmailPass = config.imap?.pass || 'zfeoyxxoxrmnmbcr';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // Direct SSL handshake (fastest, eliminates STARTTLS port 587 timeouts)
  auth: {
    user: gmailUser,
    pass: gmailPass
  },
  pool: true, // Reuse open connection
  maxConnections: 5,
  maxMessages: 200,
  connectionTimeout: 10000, // 10s max connection timeout
  greetingTimeout: 5000,
  socketTimeout: 15000
});


export const EmailSender = {
  /**
   * Send transactional HTML OTP email directly to recipient inbox
   */
  async sendHtmlEmail({ to, subject, htmlContent, senderName = 'ZeroFee UPI' }) {
    const targetEmail = (to || '').trim().toLowerCase();
    if (!targetEmail) throw new Error('Recipient email is required');

    logger.info(`[AuthOtp] Dispatching OTP email to: ${targetEmail}...`);

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

      logger.info(`[AuthOtp] ✅ OTP Email delivered successfully to ${targetEmail} (MsgID: ${info.messageId})`);
      return { success: true, provider: 'GMAIL_SMTP', messageId: info.messageId };
    } catch (err) {
      logger.error(`[AuthOtp] ❌ Failed to dispatch email to ${targetEmail}: ${err.message}`);
      throw err;
    }
  }
};

export default EmailSender;
