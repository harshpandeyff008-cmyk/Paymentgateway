import {
  listCoupons,
  createCoupon,
  deleteCoupon,
  validateCoupon,
  getPlanPriceOverrides,
  setPlanPriceOverride,
  deletePlanPriceOverride
} from '../../db/database.js';
import { PLANS } from './user.controller.js';

// ─── Admin Coupon Management ──────────────────────────────────────────────────

export const CouponController = {
  async listCoupons(req, res, next) {
    try {
      const coupons = await listCoupons();
      return res.json({ success: true, coupons });
    } catch (err) { next(err); }
  },

  async createCoupon(req, res, next) {
    try {
      const { code, discountPercent, maxUses = -1, expiresAt = null } = req.body;
      if (!code || !discountPercent) {
        return res.status(400).json({ success: false, error: 'code and discountPercent are required' });
      }
      if (parseFloat(discountPercent) <= 0 || parseFloat(discountPercent) > 100) {
        return res.status(400).json({ success: false, error: 'discountPercent must be between 1 and 100' });
      }
      const coupon = await createCoupon({ code, discountPercent, maxUses, expiresAt });
      return res.json({ success: true, coupon });
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE constraint')) {
        return res.status(409).json({ success: false, error: 'Coupon code already exists.' });
      }
      next(err);
    }
  },

  async deleteCoupon(req, res, next) {
    try {
      const { id } = req.params;
      await deleteCoupon(id);
      return res.json({ success: true, message: 'Coupon deactivated.' });
    } catch (err) { next(err); }
  },

  // ─── Plan Price Overrides ──────────────────────────────────────────────────

  async getPlanPrices(req, res, next) {
    try {
      const overrides = await getPlanPriceOverrides();
      const uniquePlans = Object.values(PLANS).filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);
      const plans = uniquePlans.map(p => ({
        id: p.id,
        name: p.name,
        basePrice: p.amount,
        currentPrice: overrides[p.id] !== undefined ? overrides[p.id] : p.amount,
        isOverridden: overrides[p.id] !== undefined,
        period: p.period,
        durationDays: p.durationDays,
        maxWebsites: p.maxWebsites
      }));
      return res.json({ success: true, plans, overrides });
    } catch (err) { next(err); }
  },

  async setPlanPrice(req, res, next) {
    try {
      const { planId, price } = req.body;
      if (!planId || price === undefined || price === null) {
        return res.status(400).json({ success: false, error: 'planId and price are required' });
      }
      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 1) {
        return res.status(400).json({ success: false, error: 'Price must be a positive number' });
      }
      if (price === '' || price === 0 || parsedPrice === 0) {
        await deletePlanPriceOverride(planId);
        return res.json({ success: true, message: `Plan ${planId} price reset to default.` });
      }
      await setPlanPriceOverride(planId, parsedPrice);
      return res.json({ success: true, message: `Plan ${planId} price updated to ₹${parsedPrice}` });
    } catch (err) { next(err); }
  },

  async resetPlanPrice(req, res, next) {
    try {
      const { planId } = req.params;
      await deletePlanPriceOverride(planId);
      return res.json({ success: true, message: `Plan ${planId} price reset to default.` });
    } catch (err) { next(err); }
  },

  // ─── User-facing Coupon Validation ────────────────────────────────────────

  async validateCouponForUser(req, res, next) {
    try {
      const { code, planId } = req.query;
      if (!code || !planId) {
        return res.status(400).json({ success: false, error: 'code and planId are required' });
      }

      const result = await validateCoupon(code);
      if (!result.valid) {
        return res.status(400).json({ success: false, error: result.error });
      }

      const overrides = await getPlanPriceOverrides();
      const plan = PLANS[planId.toUpperCase()];
      if (!plan) {
        return res.status(400).json({ success: false, error: 'Invalid plan ID' });
      }

      const basePrice = overrides[plan.id] !== undefined ? overrides[plan.id] : plan.amount;
      const discountAmount = parseFloat(((basePrice * result.coupon.discount_percent) / 100).toFixed(2));
      const finalPrice = parseFloat((basePrice - discountAmount).toFixed(2));

      return res.json({
        success: true,
        valid: true,
        coupon: {
          code: result.coupon.code,
          discountPercent: result.coupon.discount_percent,
          discountAmount,
          originalPrice: basePrice,
          finalPrice
        }
      });
    } catch (err) { next(err); }
  }
};

export default CouponController;
