import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  merchant: {
    upiVpa: process.env.MERCHANT_UPI_VPA || 'ffdealsbyjena@fam',
    name: process.env.MERCHANT_NAME || 'ShivFFStore'
  },
  
  orderExpiryMinutes: parseInt(process.env.ORDER_EXPIRY_MINUTES || '5', 10),
  
  imap: {
    enabled: process.env.IMAP_ENABLED !== 'false',
    host: process.env.IMAP_HOST || 'imap.gmail.com',
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    secure: process.env.IMAP_SECURE !== 'false',
    user: process.env.IMAP_USER || 'shaahtasham9@gmail.com',
    pass: process.env.IMAP_PASS || 'zfeoyxxoxrmnmbcr',
    mailbox: process.env.IMAP_MAILBOX || 'INBOX',
    senderFilter: (process.env.IMAP_SENDER_FILTER || 'fampay,famapp,fam').split(',').map(s => s.trim().toLowerCase())
  },
  
  adminSecret: process.env.ADMIN_SECRET_KEY || 'shivambhatt@admin',
  
  auth: {
    apiKey: process.env.API_KEY || 'pg_live_549f404a2dddac4e59ff3ec1ed93d51de0b0',
    requireApiKey: process.env.REQUIRE_API_KEY !== 'false'
  },

  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'https://upigateway.web.app,https://upigateway.firebaseapp.com,https://upigateway-ccaa4.web.app,https://upigateway-ccaa4.firebaseapp.com,https://personal-payment-gateway.onrender.com,https://paypendicular.web.app,https://paypendicular.firebaseapp.com,https://dealsbyshiv.web.app,http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000')
    .split(',')
    .map(s => s.trim().replace(/\/+$/, ''))
    .filter(Boolean),

  cloudSync: {
    projectId: process.env.FIREBASE_PROJECT_ID || 'upigateway-ccaa4',
    apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyCdeUo_GtvqTlgq-gXG71wtPPehC2mCOpw',
    enabled: true
  }
};
