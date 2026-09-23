import { Router } from 'express';
import { UserController } from '../controllers/user.controller.js';
import { CouponController } from '../controllers/coupon.controller.js';

const router = Router();

// Public routes
router.get('/plans', UserController.getPlans);
router.post('/sync', UserController.sync);
router.get('/marketplace-docs', UserController.getMarketplaceDocs);

// Coupon Validation (public - user applies during checkout)
router.get('/coupon/validate', CouponController.validateCouponForUser);

// User Profile & Order Routes
router.get('/profile', UserController.getProfile);
router.get('/me', UserController.getProfile);
router.get('/orders', UserController.getUserOrders);
router.get('/subscription-invoices', UserController.getUserSubscriptionInvoices);
router.post('/buy-plan', UserController.buyPlan);

// Gated Features (Require Active Plan)
router.post('/gmail-config', UserController.connectGmail);
router.post('/banking/google-link', UserController.connectGoogleBanking);
router.post('/banking/imap-link', UserController.connectImapBanking);
router.post('/banking/disconnect', UserController.disconnectBanking);
router.get('/banking/payments', UserController.getMerchantPayments);
router.post('/bind-website', UserController.bindWebsite);
router.post('/regenerate-key', UserController.regenerateApiKey);
router.post('/payment-links', UserController.createPaymentLink);
router.post('/checkout-branding', UserController.saveCheckoutBranding);

export default router;
