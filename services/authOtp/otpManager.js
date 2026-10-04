import crypto from 'crypto';

// In-memory OTP storage with automatic TTL cleanup
// Map<key, { otp: string, expiry: number, attempts: number, token?: string }>
const otpStore = new Map();

const OTP_TTL_MS = 5 * 60 * 1000; // 5 Minutes
const MAX_ATTEMPTS = 5;

// Periodically purge expired tokens every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of otpStore.entries()) {
    if (val.expiry < now) {
      otpStore.delete(key);
    }
  }
}, 2 * 60 * 1000);

export const OtpManager = {
  /**
   * Generate a 6-digit numeric OTP and store it
   */
  generateOtp(email, purpose = 'SIGNUP') {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const key = `${purpose}:${normalizedEmail}`;

    // Generate 6-digit cryptographically secure OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiry = Date.now() + OTP_TTL_MS;

    otpStore.set(key, {
      otp,
      expiry,
      attempts: 0,
      createdAt: Date.now()
    });

    return { otp, expirySeconds: 300 };
  },

  /**
   * Verify an entered OTP
   */
  verifyOtp(email, enteredOtp, purpose = 'SIGNUP') {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const key = `${purpose}:${normalizedEmail}`;

    const record = otpStore.get(key);
    if (!record) {
      return { success: false, error: 'OTP expired or not requested. Please request a new code.' };
    }

    if (Date.now() > record.expiry) {
      otpStore.delete(key);
      return { success: false, error: 'OTP has expired (valid for 5 minutes). Please request a new code.' };
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      otpStore.delete(key);
      return { success: false, error: 'Too many incorrect attempts. Please request a new OTP.' };
    }

    if (record.otp !== String(enteredOtp).trim()) {
      record.attempts += 1;
      return { success: false, error: `Invalid OTP code. ${MAX_ATTEMPTS - record.attempts} attempts remaining.` };
    }

    // Success! Generate a temporary verification token (valid for 10 minutes)
    const verificationToken = crypto.randomBytes(24).toString('hex');
    otpStore.delete(key);

    // Store temporary verification token for password reset or signup completion
    const tokenKey = `TOKEN:${normalizedEmail}:${verificationToken}`;
    otpStore.set(tokenKey, {
      purpose,
      expiry: Date.now() + 10 * 60 * 1000
    });

    return {
      success: true,
      message: 'OTP verified successfully!',
      verificationToken
    };
  },

  /**
   * Validate a previously issued verification token
   */
  validateVerificationToken(email, token, purpose = 'FORGOT_PASSWORD') {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const tokenKey = `TOKEN:${normalizedEmail}:${token}`;

    const record = otpStore.get(tokenKey);
    if (!record || record.purpose !== purpose || Date.now() > record.expiry) {
      return false;
    }

    otpStore.delete(tokenKey);
    return true;
  }
};

export default OtpManager;
