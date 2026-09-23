import { 
  syncUser, 
  getUserByEmail, 
  updateUserPlanAndCredits, 
  updateUserGmailConfig, 
  updateUserSettlementConfig,
  updateUserGoogleBankingLink,
  updateUserImapBankingLink,
  disconnectUserBanking,
  getUserPayments,
  regenerateUserApiKey, 
  lockUserWebsite,
  parseUserWebsites,
  query, 
  logActivity,
  getUniquePayableAmount,
  validateCoupon,
  markCouponUsed,
  getPlanPriceOverrides
} from '../../db/database.js';
import { buildUpiUri, generateQrDataUrl } from '../utils/qr.util.js';
import { config } from '../../config.js';

export const PLANS = {
  // 1-WEBSITE
  SINGLE_MONTHLY: {
    id: 'SINGLE_MONTHLY',
    name: '1-Website Monthly',
    amount: 299,
    period: '/ month',
    durationDays: 30,
    maxWebsites: 1,
    qrCredits: 999999,
    badge: '1 Website • Unlimited QRs',
    features: [
      '♾️ Unlimited Dynamic UPI QR Codes',
      '1 Website Bound to API Key (Permanent Lock)',
      'Instant 1-Second Auto-Verification',
      'Direct Bank Settlement (0% Commission)',
      'Real-Time Webhook Callbacks',
      'Full 30 Days Unlimited Access'
    ]
  },
  SINGLE_ANNUAL: {
    id: 'SINGLE_ANNUAL',
    name: '1-Website 1-Year',
    amount: 1999,
    period: '/ year',
    durationDays: 365,
    maxWebsites: 1,
    qrCredits: 999999,
    popular: true,
    badge: '🔥 Best Deal • Save ₹1,589',
    features: [
      '♾️ Unlimited Dynamic UPI QR Codes (Full Year)',
      '1 Website Bound to API Key (Permanent Lock)',
      'Priority Ultra-Speed Auto-Verification',
      'Direct Bank Settlement (0% Commission)',
      '365 Days Unlimited Access (Zero Monthly Renewal)',
      'Priority 24/7 Developer VIP Support'
    ]
  },

  // 2-WEBSITES (DUAL)
  DUAL_MONTHLY: {
    id: 'DUAL_MONTHLY',
    name: '2-Websites Monthly',
    amount: 549,
    period: '/ month',
    durationDays: 30,
    maxWebsites: 2,
    qrCredits: 999999,
    badge: '2 Websites • Dual Store',
    features: [
      '♾️ Unlimited Dynamic UPI QR Codes (Both Sites)',
      '2 Websites Bound to API Key (Permanent Lock)',
      'Instant 1-Second Auto-Verification',
      'Direct Bank Settlement (0% Commission)',
      'Multi-Domain Webhook Delivery & Retries',
      'Full 30 Days Unlimited Access'
    ]
  },
  DUAL_ANNUAL: {
    id: 'DUAL_ANNUAL',
    name: '2-Websites 1-Year',
    amount: 3699,
    period: '/ year',
    durationDays: 365,
    maxWebsites: 2,
    qrCredits: 999999,
    badge: '🚀 Dual Store • Save ₹2,889',
    features: [
      '♾️ Unlimited Dynamic UPI QR Codes (Both Sites)',
      '2 Websites Bound to API Key (Permanent Lock)',
      'Priority High-Speed Auto-Verification',
      'Direct Bank Settlement (0% Commission)',
      '365 Days Unlimited Access on 2 Domains',
      'Priority 24/7 Dedicated Account Manager'
    ]
  },

  // 3-WEBSITES (TRIPLE / GROWTH)
  TRIPLE_MONTHLY: {
    id: 'TRIPLE_MONTHLY',
    name: '3-Websites Monthly',
    amount: 799,
    period: '/ month',
    durationDays: 30,
    maxWebsites: 3,
    qrCredits: 999999,
    badge: '3 Websites • Growth Fleet',
    features: [
      '♾️ Unlimited Dynamic UPI QR Codes (All 3 Sites)',
      '3 Websites Bound to API Key (Permanent Lock)',
      'Instant 1-Second Auto-Verification',
      'Direct Bank Settlement (0% Commission)',
      'Multi-Domain Webhook Delivery',
      'Full 30 Days Unlimited Access'
    ]
  },
  TRIPLE_ANNUAL: {
    id: 'TRIPLE_ANNUAL',
    name: '3-Websites 1-Year',
    amount: 5399,
    period: '/ year',
    durationDays: 365,
    maxWebsites: 3,
    qrCredits: 999999,
    popular: true,
    badge: '⚡ 3-Store Annual • Save ₹4,189',
    features: [
      '♾️ Unlimited Dynamic UPI QR Codes (All 3 Sites)',
      '3 Websites Bound to API Key (Permanent Lock)',
      'Priority Ultra-Speed Auto-Verification',
      'Direct Bank Settlement (0% Commission)',
      '365 Days Unlimited Multi-Site Access',
      'Priority 24/7 VIP Support'
    ]
  },

  // 4-WEBSITES (QUAD / BUSINESS)
  QUAD_MONTHLY: {
    id: 'QUAD_MONTHLY',
    name: '4-Websites Monthly',
    amount: 999,
    period: '/ month',
    durationDays: 30,
    maxWebsites: 4,
    qrCredits: 999999,
    badge: '4 Websites • Business Quad',
    features: [
      '♾️ Unlimited Dynamic UPI QR Codes (All 4 Sites)',
      '4 Websites Bound to API Key (Permanent Lock)',
      'Instant 1-Second Auto-Verification',
      'Direct Bank Settlement (0% Commission)',
      'Multi-Domain Webhook Delivery & Retries',
      'Full 30 Days Unlimited Access'
    ]
  },
  QUAD_ANNUAL: {
    id: 'QUAD_ANNUAL',
    name: '4-Websites 1-Year',
    amount: 6799,
    period: '/ year',
    durationDays: 365,
    maxWebsites: 4,
    qrCredits: 999999,
    badge: '💼 Business 4-Store • Save ₹5,189',
    features: [
      '♾️ Unlimited Dynamic UPI QR Codes (All 4 Sites)',
      '4 Websites Bound to API Key (Permanent Lock)',
      'High-Priority Infrastructure Bandwidth',
      'Direct Bank Settlement (0% Commission)',
      '365 Days Unlimited Access across 4 Domains',
      'Dedicated Technical Account Manager'
    ]
  },

  // 5-WEBSITES (FLEET / SCALE)
  FLEET_MONTHLY: {
    id: 'FLEET_MONTHLY',
    name: '5-Websites Monthly',
    amount: 1199,
    period: '/ month',
    durationDays: 30,
    maxWebsites: 5,
    qrCredits: 999999,
    badge: '5 Websites • Agency Fleet',
    features: [
      '♾️ Unlimited Dynamic UPI QR Codes (All 5 Sites)',
      '5 Websites Bound to API Key (Permanent Lock)',
      'Instant 1-Second Auto-Verification',
      'Direct Bank Settlement (0% Commission)',
      'Multi-Domain Webhook Delivery & Retries',
      'Full 30 Days Unlimited Access'
    ]
  },
  FLEET_ANNUAL: {
    id: 'FLEET_ANNUAL',
    name: '5-Websites 1-Year',
    amount: 7999,
    period: '/ year',
    durationDays: 365,
    maxWebsites: 5,
    qrCredits: 999999,
    popular: true,
    badge: '👑 5-Store Fleet • Save ₹6,389',
    features: [
      '♾️ Unlimited Dynamic UPI QR Codes (All 5 Sites)',
      '5 Websites Bound to API Key (Permanent Lock)',
      'Dedicated Verification Routing Bandwidth',
      'Direct Bank Settlement (0% Commission)',
      '365 Days Guaranteed Uninterrupted Access',
      '24/7 Dedicated Priority Hotline Support'
    ]
  }
};

// Aliases for backward compatibility
PLANS.MONTHLY = PLANS.SINGLE_MONTHLY;
PLANS.ANNUAL = PLANS.SINGLE_ANNUAL;
PLANS.STARTER = PLANS.SINGLE_MONTHLY;
PLANS.GROWTH = PLANS.DUAL_MONTHLY;
PLANS.PRO = PLANS.DUAL_ANNUAL;

export const UserController = {
  // 1. Get available plans catalogue (with dynamic price overrides)
  async getPlans(req, res) {
    const overrides = await getPlanPriceOverrides();
    const uniquePlans = Object.values(PLANS).filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);
    return res.json({
      success: true,
      plans: uniquePlans.map(p => ({
        ...p,
        amount: overrides[p.id] !== undefined ? overrides[p.id] : p.amount,
        baseAmount: p.amount,
        isOverridden: overrides[p.id] !== undefined
      }))
    });
  },

  // 2. Sync / Login user with Firebase Google Auth
  async sync(req, res) {
    try {
      const { email, name = 'User', photoUrl = '' } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required' });
      }

      const user = await syncUser({ email, name, photoUrl });
      const hasActivePlan = user.plan && user.plan !== 'NONE';

      const lockedWebsites = parseUserWebsites(user);
      const maxWebsites = user.max_websites || 1;
      const remainingSlots = Math.max(0, maxWebsites - lockedWebsites.length);

      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          photoUrl: user.photo_url,
          role: user.role,
          plan: user.plan,
          qrCredits: user.qr_credits,
          apiKey: user.api_key,
          gmailConnected: !!user.gmail_connected,
          gmailEmail: user.gmail_email || '',
          websiteUrl: user.website_url || '',
          isWebsiteLocked: !!user.is_website_locked,
          websiteLockedAt: user.website_locked_at || null,
          maxWebsites,
          lockedWebsites,
          remainingWebsiteSlots: remainingSlots,
          upiVpa: user.upi_vpa || '',
          businessName: user.business_name || '',
          settlementType: user.settlement_type || 'GOOGLE_OAUTH',
          hasActivePlan
        }
      });
    } catch (err) {
      console.error('[UserController] Sync error:', err.message);
      return res.status(500).json({ success: false, error: 'Failed to sync user' });
    }
  },

  // 3. Get User Profile & Dashboard State
  async getProfile(req, res) {
    try {
      const email = req.query.email || req.headers['x-user-email'];
      if (!email) {
        return res.status(400).json({ success: false, error: 'Email parameter or header is required' });
      }

      const user = await getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const hasActivePlan = user.plan && user.plan !== 'NONE';
      const lockedWebsites = parseUserWebsites(user);
      const maxWebsites = user.max_websites || 1;
      const remainingSlots = Math.max(0, maxWebsites - lockedWebsites.length);

      // Fetch user's recent customer orders (excluding internal plan subscriptions)
      const userOrders = await query.all(
        'SELECT * FROM orders WHERE user_email = ? AND (plan_id IS NULL OR plan_id = "") AND order_code NOT LIKE "PLAN-%" ORDER BY id DESC LIMIT 20',
        [user.email]
      );

      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          photoUrl: user.photo_url,
          role: user.role,
          plan: user.plan,
          qrCredits: user.qr_credits,
          apiKey: user.api_key,
          gmailConnected: !!user.gmail_connected,
          gmailEmail: user.gmail_email || '',
          websiteUrl: user.website_url || '',
          isWebsiteLocked: !!user.is_website_locked,
          websiteLockedAt: user.website_locked_at || null,
          maxWebsites,
          lockedWebsites,
          remainingWebsiteSlots: remainingSlots,
          upiVpa: user.upi_vpa || '',
          businessName: user.business_name || '',
          settlementType: user.settlement_type || 'GOOGLE_OAUTH',
          hasActivePlan,
          createdAt: user.created_at
        },
        orders: userOrders
      });
    } catch (err) {
      console.error('[UserController] getProfile error:', err.message);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  },

  // 3.1 Get User Orders for Payment Tracking Table (EXCLUDES own subscription plan purchases)
  async getUserOrders(req, res) {
    try {
      const email = req.query.email || req.headers['x-user-email'];
      if (!email) {
        return res.status(400).json({ success: false, error: 'User email is required' });
      }

      const status = req.query.status || 'ALL';
      // Strictly exclude internal plan subscriptions. This table is exclusively for customer payments.
      let sql = 'SELECT * FROM orders WHERE user_email = ? AND (plan_id IS NULL OR plan_id = "") AND order_code NOT LIKE "PLAN-%"';
      const params = [email];

      if (status !== 'ALL') {
        sql += ' AND status = ?';
        params.push(status);
      }
      sql += ' ORDER BY id DESC LIMIT 100';

      const orders = await query.all(sql, params);
      return res.json({ success: true, orders });
    } catch (err) {
      console.error('[UserController] getUserOrders error:', err.message);
      return res.status(500).json({ success: false, error: 'Failed to fetch user orders' });
    }
  },

  // 3.2 Get User Subscription Invoices (only PLAN-... orders)
  async getUserSubscriptionInvoices(req, res) {
    try {
      const email = req.query.email || req.headers['x-user-email'];
      if (!email) {
        return res.status(400).json({ success: false, error: 'User email is required' });
      }
      const invoices = await query.all(
        'SELECT * FROM orders WHERE user_email = ? AND (plan_id IS NOT NULL OR order_code LIKE "PLAN-%") ORDER BY id DESC',
        [email]
      );
      return res.json({ success: true, invoices });
    } catch (err) {
      console.error('[UserController] getUserSubscriptionInvoices error:', err.message);
      return res.status(500).json({ success: false, error: 'Failed to fetch subscription invoices' });
    }
  },

  // 4. Buy Plan -> Creates dynamic UPI payment order with QR
  async buyPlan(req, res) {
    try {
      const { planId, userEmail, couponCode = '' } = req.body;
      if (!planId || !userEmail) {
        return res.status(400).json({ success: false, error: 'planId and userEmail are required' });
      }

      const targetPlan = PLANS[planId.toUpperCase()];
      if (!targetPlan) {
        return res.status(400).json({ success: false, error: `Invalid plan. Must be one of: ${Object.keys(PLANS).join(', ')}` });
      }

      const user = await getUserByEmail(userEmail);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User does not exist. Please sign in first.' });
      }

      // Apply plan price override (admin-set custom price)
      const priceOverrides = await getPlanPriceOverrides();
      const basePlanPrice = priceOverrides[targetPlan.id] !== undefined ? priceOverrides[targetPlan.id] : targetPlan.amount;

      // Validate and apply coupon discount
      let couponApplied = null;
      let discountAmount = 0;
      let finalBasePrice = basePlanPrice;

      if (couponCode && couponCode.trim()) {
        const couponResult = await validateCoupon(couponCode.trim());
        if (!couponResult.valid) {
          return res.status(400).json({ success: false, error: couponResult.error });
        }
        discountAmount = parseFloat(((basePlanPrice * couponResult.coupon.discount_percent) / 100).toFixed(2));
        finalBasePrice = parseFloat((basePlanPrice - discountAmount).toFixed(2));
        couponApplied = {
          code: couponResult.coupon.code,
          discountPercent: couponResult.coupon.discount_percent,
          discountAmount
        };
      }

      const orderCode = `PLAN-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
      const now = Date.now();
      const expiresAt = now + 10 * 60 * 1000; // 10 minutes expiry

      // Calculate unique payable amount with paise offset (e.g. 299, 299.01, 299.02)
      const payableAmount = await getUniquePayableAmount(finalBasePrice, 20);

      // Insert into orders table
      const insertResult = await query.run(
        `INSERT INTO orders (
          order_code, amount, base_amount, customer_name, customer_phone, status, 
          created_at, expires_at, user_email, plan_id, credits_to_add
        ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?)`,
        [
          orderCode,
          payableAmount,
          basePlanPrice,
          user.name || 'User',
          userEmail,
          now,
          expiresAt,
          user.email,
          targetPlan.id,
          targetPlan.qrCredits
        ]
      );

      // Mark coupon as used after order is created
      if (couponApplied) {
        await markCouponUsed(couponApplied.code, user.email, orderCode, discountAmount);
      }

      // Generate UPI URI with unique payable amount
      const upiUri = buildUpiUri({
        vpa: config.merchant.upiVpa,
        merchantName: config.merchant.name,
        amount: payableAmount,
        orderCode
      });

      const qrDataUrl = await generateQrDataUrl(upiUri);

      // Generate UPI Intent Links for Mobile
      const gpayUri = `upi://pay?pa=${encodeURIComponent(config.merchant.upiVpa)}&pn=${encodeURIComponent(config.merchant.name)}&am=${payableAmount}&cu=INR&tn=${encodeURIComponent(orderCode)}`;
      const phonepeUri = `phonepe://pay?pa=${encodeURIComponent(config.merchant.upiVpa)}&pn=${encodeURIComponent(config.merchant.name)}&am=${payableAmount}&cu=INR&tn=${encodeURIComponent(orderCode)}`;
      const paytmUri = `paytmmp://pay?pa=${encodeURIComponent(config.merchant.upiVpa)}&pn=${encodeURIComponent(config.merchant.name)}&am=${payableAmount}&cu=INR&tn=${encodeURIComponent(orderCode)}`;

      await logActivity({
        eventType: 'PLAN_ORDER_CREATED',
        status: 'INFO',
        title: `Plan Order Created: ${orderCode}`,
        details: `User ${user.email} initiated purchase for ${targetPlan.name} (₹${payableAmount}${
          couponApplied ? ` with coupon ${couponApplied.code} (-₹${discountAmount})` : ''
        }${payableAmount !== finalBasePrice ? ` [unique offset]` : ''})`,
        clientIp: req.ip || '',
        origin: req.headers.origin || ''
      });

      return res.json({
        success: true,
        order: {
          id: insertResult.lastID,
          orderCode,
          amount: payableAmount,
          baseAmount: basePlanPrice,
          finalBasePrice,
          isUniqueOffset: payableAmount !== finalBasePrice,
          couponApplied,
          planId: targetPlan.id,
          planName: targetPlan.name,
          qrCredits: targetPlan.qrCredits,
          expiresAt,
          upiUri,
          qrDataUrl,
          merchantVpa: config.merchant.upiVpa,
          merchantName: config.merchant.name,
          intents: {
            generic: upiUri,
            gpay: gpayUri,
            phonepe: phonepeUri,
            paytm: paytmUri
          }
        }
      });
    } catch (err) {
      console.error('[UserController] buyPlan error:', err.message);
      return res.status(500).json({ success: false, error: 'Failed to create plan order' });
    }
  },

  // 5. Connect Settlement Channel & Merchant UPI Configuration - GATED: Requires Active Plan
  async connectGmail(req, res) {
    return UserController.connectImapBanking(req, res);
  },

  // 5.1 Link Banking Gmail (1-Click Google OAuth with gmail.readonly)
  async connectGoogleBanking(req, res) {
    try {
      const { userEmail, accessToken, googleEmail, upiVpa = '', businessName = '' } = req.body;
      if (!userEmail || !accessToken) {
        return res.status(400).json({ success: false, error: 'userEmail and Google accessToken are required' });
      }

      const user = await getUserByEmail(userEmail);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      if (!user.plan || user.plan === 'NONE') {
        return res.status(403).json({
          success: false,
          code: 'PLAN_REQUIRED',
          error: 'Please choose and activate a plan first to unlock your automated settlement channel.'
        });
      }

      const cleanUpi = (upiVpa || user.upi_vpa || '').trim();
      const cleanBusiness = (businessName || user.business_name || '').trim();
      const cleanGoogleEmail = (googleEmail || userEmail).trim();

      const updated = await updateUserGoogleBankingLink(userEmail, {
        upiVpa: cleanUpi,
        businessName: cleanBusiness,
        googleEmail: cleanGoogleEmail,
        accessToken: accessToken.trim()
      });

      await logActivity({
        eventType: 'BANKING_GOOGLE_LINKED',
        status: 'SUCCESS',
        title: `Google Banking Email Linked for ${userEmail}`,
        details: `UPI VPA: ${cleanUpi || 'Unchanged'} | Business: ${cleanBusiness || 'Unchanged'} | Gmail: ${cleanGoogleEmail}`,
        clientIp: req.ip || '',
        origin: req.headers.origin || ''
      });

      return res.json({
        success: true,
        message: 'Google Banking Gmail linked successfully! Auto-monitoring bank credit alerts in real time.',
        user: {
          email: updated.email,
          upiVpa: updated.upi_vpa || '',
          businessName: updated.business_name || '',
          settlementType: 'GOOGLE_OAUTH',
          gmailConnected: true,
          gmailEmail: updated.gmail_email || cleanGoogleEmail
        }
      });
    } catch (err) {
      console.error('[UserController] connectGoogleBanking error:', err.message);
      return res.status(500).json({ success: false, error: 'Failed to link Google banking email: ' + err.message });
    }
  },

  // 5.2 Link Banking IMAP (Manual Host/Port/App Password)
  async connectImapBanking(req, res) {
    try {
      const { userEmail, upiVpa = '', businessName = '', gmailEmail = '', gmailAppPass = '', imapHost = 'imap.gmail.com', imapPort = 993 } = req.body;
      if (!userEmail) {
        return res.status(400).json({ success: false, error: 'userEmail is required' });
      }

      const user = await getUserByEmail(userEmail);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      if (!user.plan || user.plan === 'NONE') {
        return res.status(403).json({
          success: false,
          code: 'PLAN_REQUIRED',
          error: 'Please choose and activate a plan first to unlock your automated settlement channel.'
        });
      }

      const cleanUpi = (upiVpa || user.upi_vpa || '').trim();
      const cleanBusiness = (businessName || user.business_name || '').trim();
      const cleanEmail = (gmailEmail || userEmail).trim();
      const cleanPass = (gmailAppPass || '').trim();

      const updated = await updateUserImapBankingLink(userEmail, {
        upiVpa: cleanUpi,
        businessName: cleanBusiness,
        imapEmail: cleanEmail,
        imapAppPass: cleanPass,
        imapHost: imapHost || 'imap.gmail.com',
        imapPort: Number(imapPort) || 993,
        imapSecure: 1
      });

      await logActivity({
        eventType: 'SETTLEMENT_CONFIG_UPDATED',
        status: 'SUCCESS',
        title: `IMAP Settlement Config Updated for ${userEmail}`,
        details: `UPI VPA: ${cleanUpi || 'Unchanged'} | Business: ${cleanBusiness || 'Unchanged'} | Gmail/IMAP: ${cleanEmail}`,
        clientIp: req.ip || '',
        origin: req.headers.origin || ''
      });

      return res.json({
        success: true,
        message: 'IMAP bank monitor configuration saved successfully! Payments will route directly to your registered UPI ID.',
        user: {
          email: updated.email,
          upiVpa: updated.upi_vpa || '',
          businessName: updated.business_name || '',
          settlementType: 'IMAP',
          gmailConnected: true,
          gmailEmail: updated.gmail_email || ''
        }
      });
    } catch (err) {
      console.error('[UserController] connectImapBanking error:', err.message);
      return res.status(500).json({ success: false, error: 'Failed to update IMAP configuration' });
    }
  },

  // 5.3 Disconnect Banking Monitor
  async disconnectBanking(req, res) {
    try {
      const { userEmail } = req.body;
      if (!userEmail) return res.status(400).json({ success: false, error: 'userEmail is required' });

      const updated = await disconnectUserBanking(userEmail);
      return res.json({
        success: true,
        message: 'Banking monitor disconnected successfully.',
        user: {
          email: updated.email,
          gmailConnected: false,
          gmailEmail: updated.gmail_email || ''
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // 5.4 Live Payment Monitor Feed for Merchant
  async getMerchantPayments(req, res) {
    try {
      const email = req.query.email || req.headers['x-user-email'];
      if (!email) return res.status(400).json({ success: false, error: 'Email is required' });
      const payments = await getUserPayments(email, 50);
      return res.json({ success: true, payments });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Failed to fetch merchant payments' });
    }
  },

  // 5.5 Bind and Lock Single Website Domain - GATED & ONE-TIME PERMANENT LOCK
  async bindWebsite(req, res) {
    try {
      const { userEmail, websiteUrl } = req.body;
      if (!userEmail || !websiteUrl) {
        return res.status(400).json({ success: false, error: 'userEmail and websiteUrl are required' });
      }

      const user = await getUserByEmail(userEmail);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User account not found' });
      }

      if (!user.plan || user.plan === 'NONE') {
        return res.status(403).json({
          success: false,
          code: 'PLAN_REQUIRED',
          error: 'Please activate a plan (Monthly or 1-Year) first to bind and lock your website domain.'
        });
      }

      const result = await lockUserWebsite(userEmail, websiteUrl);
      if (!result.success) {
        return res.status(400).json(result);
      }

      await logActivity({
        eventType: 'WEBSITE_LOCKED',
        status: 'SUCCESS',
        title: `Website Permanently Locked for ${userEmail}`,
        details: `Domain: ${result.domain}, Full URL: ${websiteUrl.trim()}`,
        clientIp: req.ip || '',
        origin: req.headers.origin || ''
      });

      return res.json({
        success: true,
        message: `Website successfully locked to "${result.domain}"! Your API key is permanently bound to this domain.`,
        user: {
          email: result.user.email,
          websiteUrl: result.user.website_url,
          isWebsiteLocked: !!result.user.is_website_locked,
          websiteLockedAt: result.user.website_locked_at,
          maxWebsites: result.user.max_websites || 1,
          lockedWebsites: result.lockedWebsites,
          remainingWebsiteSlots: result.remainingSlots,
          domain: result.domain
        }
      });
    } catch (err) {
      console.error('[UserController] bindWebsite error:', err.message);
      return res.status(500).json({ success: false, error: 'Failed to bind and lock website' });
    }
  },

  // 6. Regenerate API Key - GATED: Requires Active Plan
  async regenerateApiKey(req, res) {
    try {
      const { userEmail } = req.body;
      if (!userEmail) {
        return res.status(400).json({ success: false, error: 'userEmail is required' });
      }

      const user = await getUserByEmail(userEmail);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      if (!user.plan || user.plan === 'NONE') {
        return res.status(403).json({
          success: false,
          code: 'PLAN_REQUIRED',
          error: 'Please activate a plan first to generate or view production API keys.'
        });
      }

      const newKey = await regenerateUserApiKey(userEmail);
      return res.json({
        success: true,
        apiKey: newKey,
        message: 'API Key regenerated successfully.'
      });
    } catch (err) {
      console.error('[UserController] regenerateApiKey error:', err.message);
      return res.status(500).json({ success: false, error: 'Failed to regenerate API key' });
    }
  },

  // 7. Marketplace & API Documentation metadata
  getMarketplaceDocs(req, res) {
    const origin = `${req.protocol}://${req.get('host')}`;
    return res.json({
      success: true,
      baseUrl: origin,
      endpoints: [
        {
          method: 'POST',
          path: '/api/v1/orders',
          title: 'Generate Dynamic UPI QR Order',
          description: 'Generates a payment order with dynamic UPI URI, QR Base64 image, and automatic real-time matching.',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'YOUR_API_KEY'
          },
          body: {
            amount: 150.00,
            customerName: 'Aarav Sharma',
            customerPhone: '9876543210',
            webhookUrl: 'https://yourwebsite.com/api/payment-webhook'
          }
        },
        {
          method: 'GET',
          path: '/api/v1/orders/:orderCode',
          title: 'Check Order Payment Status',
          description: 'Poll or verify order payment status (PENDING, PAID, EXPIRED). Returns UTR, paid_at timestamp, and sender.',
          headers: {
            'x-api-key': 'YOUR_API_KEY'
          }
        },
        {
          method: 'POST',
          path: '/api/v1/orders/claim-utr',
          title: 'Manual UTR Verification & Fallback Claim',
          description: 'Allows a customer to claim their order by submitting the 12-digit bank UTR if needed.',
          body: {
            orderCode: 'ORD-XXXXXX',
            utr: '123456789012'
          }
        }
      ]
    });
  }
};
