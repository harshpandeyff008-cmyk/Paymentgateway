import nodemailer from 'nodemailer';
import { config } from '../../config.js';
import logger from '../../src/utils/logger.js';

// Setup high-speed Gmail Transporter using configured Google App Credentials
const gmailUser = config.imap?.user || 'shaahtasham9@gmail.com';
const gmailPass = config.imap?.pass || 'zfeoyxxoxrmnmbcr';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: gmailUser,
    pass: gmailPass
  }
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
