import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  merchant: {
    upiVpa: process.env.MERCHANT_UPI_VPA || '',
    name: process.env.MERCHANT_NAME || 'Personal Gateway',
    upiProvider: process.env.MERCHANT_UPI_PROVIDER || 'AUTO'
  },
  
  orderExpiryMinutes: parseInt(process.env.ORDER_EXPIRY_MINUTES || '5', 10),
  
  imap: {
    enabled: process.env.IMAP_ENABLED === 'true',
    host: process.env.IMAP_HOST || 'imap.gmail.com',
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    secure: process.env.IMAP_SECURE !== 'false',
    user: process.env.IMAP_USER || '',
    pass: process.env.IMAP_PASS || '',
    mailbox: process.env.IMAP_MAILBOX || 'INBOX',
    senderFilter: (process.env.IMAP_SENDER_FILTER || 'fampay,famapp,fam').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  },
  
  adminSecret: process.env.ADMIN_SECRET_KEY || '',
  jwtSecret: process.env.JWT_SECRET || process.env.ADMIN_SECRET_KEY || 'default_jwt_secret_change_in_env',
  webhookSecret: process.env.WEBHOOK_SECRET || process.env.ADMIN_SECRET_KEY || '',
  adminEmail: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
  
  auth: {
    apiKey: process.env.API_KEY || '',
    requireApiKey: process.env.REQUIRE_API_KEY !== 'false'
  },

  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'https://upigateway.web.app,https://upigateway.firebaseapp.com,https://upigateway-ccaa4.web.app,https://upigateway-ccaa4.firebaseapp.com,https://personal-payment-gateway.onrender.com,http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000')
    .split(',')
    .map(s => s.trim().replace(/\/+$/, ''))
    .filter(Boolean),

  cloudSync: {
    projectId: process.env.FIREBASE_PROJECT_ID || 'upigateway-ccaa4',
    apiKey: process.env.FIREBASE_API_KEY || '',
    databaseSecret: process.env.FIREBASE_DATABASE_SECRET || '',
    enabled: process.env.CLOUD_SYNC_ENABLED !== 'false'
  },

  googleOAuth: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || ''
  }
};
