import { Router } from 'express';
import { UserController } from '../controllers/user.controller.js';
import { CouponController } from '../controllers/coupon.controller.js';
import { userAuth } from '../middlewares/userAuth.js';

const router = Router();

// Public routes
router.get('/plans', UserController.getPlans);
router.post('/sync', UserController.sync);
router.get('/marketplace-docs', UserController.getMarketplaceDocs);

// Coupon Validation (public - user applies during checkout)
router.get('/coupon/validate', CouponController.validateCouponForUser);

// Google OAuth Callback (public callback from Google with state signature verification)
router.get('/banking/google/callback', UserController.googleOAuthCallback);

// Protected User Routes (Require Authenticated User JWT Token)
router.use(userAuth);

router.get('/profile', UserController.getProfile);
router.get('/me', UserController.getProfile);
router.get('/orders', UserController.getUserOrders);
router.get('/subscription-invoices', UserController.getUserSubscriptionInvoices);
router.post('/buy-plan', UserController.buyPlan);

// Gated Features (Require Active Plan & Authenticated User)
router.post('/gmail-config', UserController.connectGmail);
router.post('/banking/google-link', UserController.connectGoogleBanking);
router.get('/banking/google/auth-url', UserController.getGoogleAuthUrl);
router.post('/banking/imap-link', UserController.connectImapBanking);
router.post('/banking/test-imap', UserController.testImapConnection);
router.post('/banking/disconnect', UserController.disconnectBanking);
router.get('/banking/payments', UserController.getMerchantPayments);
router.post('/bind-website', UserController.bindWebsite);
router.post('/regenerate-key', UserController.regenerateApiKey);
router.post('/payment-links', UserController.createPaymentLink);
router.post('/checkout-branding', UserController.saveCheckoutBranding);

export default router;
