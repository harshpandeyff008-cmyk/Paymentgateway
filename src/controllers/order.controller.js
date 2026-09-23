import { OrderModel } from '../models/order.model.js';
import { claimOrderWithUtr, reconcileUnmatchedPayments } from '../services/matchingEngine.service.js';
import { buildUpiUri, streamQrPng, generateQrDataUrl } from '../utils/qr.util.js';
import { config } from '../../config.js';
import { logActivity, getUniquePayableAmount, getUserByEmail } from '../../db/database.js';

function generateOrderCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'ORD-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const OrderController = {
  async create(req, res, next) {
    try {
      const origin = req.headers.origin || req.headers.referer || '';
      const clientIp = req.ip || req.connection?.remoteAddress || '';
      const { amount, customerName = 'Guest', customerPhone = '', webhookUrl = '' } = req.body;
      const parsedAmount = parseFloat(amount);

      if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
        await logActivity({
          eventType: 'ORDER_CREATE_FAILED',
          status: 'FAILED',
          title: 'Order Creation Failed: Invalid Amount',
          details: `Received amount: "${amount}"`,
          clientIp,
          origin
        });
        return res.status(400).json({ success: false, error: 'Valid positive amount is required' });
      }

      // Unique Paise Offset Engine (Resolves multiple concurrent payments collision)
      const baseAmount = parsedAmount;
      const payableAmount = await getUniquePayableAmount(baseAmount, 20);

      const orderCode = generateOrderCode();
      const createdAt = Date.now();
      const expiresAt = createdAt + config.orderExpiryMinutes * 60 * 1000;

      const userEmail = req.userRecord?.email || '';
      const order = await OrderModel.create({
        orderCode,
        amount: payableAmount,
        baseAmount,
        customerName,
        customerPhone,
        createdAt,
        expiresAt,
        webhookUrl,
        userEmail
      });

      // Use merchant's own registered UPI VPA and business name if configured, otherwise fallback to platform defaults
      const merchantVpa = req.userRecord?.upi_vpa || config.merchant.upiVpa;
      const merchantName = req.userRecord?.business_name || req.userRecord?.name || config.merchant.name;

      const upiUri = buildUpiUri({
        vpa: merchantVpa,
        merchantName: merchantName,
        amount: payableAmount,
        orderCode
      });

      // Trigger immediate reconciliation in case customer already paid
      if (typeof reconcileUnmatchedPayments === 'function') reconcileUnmatchedPayments().catch(() => {});

      const qrDataUrl = await generateQrDataUrl(upiUri);

      // Construct absolute base URL (supports reverse proxies like Render, ngrok, Cloudflare)
      const forwardedProto = req.headers['x-forwarded-proto'];
      const protocol = forwardedProto ? forwardedProto.split(',')[0].trim() : (req.protocol || 'http');
      const host = req.headers['x-forwarded-host'] || req.get('host') || `localhost:${config.port}`;
      const baseUrl = `${protocol}://${host}`;
      const fullCheckoutUrl = `${baseUrl}/checkout/${orderCode}`;

      const orderData = {
        ...order,
        orderId: order.id,
        orderCode,
        amount: payableAmount,
        baseAmount,
        isUniqueOffset: payableAmount !== baseAmount,
        currency: 'INR',
        status: 'PENDING',
        expiryMinutes: config.orderExpiryMinutes,
        expiresAt,
        upiUri,
        checkoutUrl: `/checkout/${orderCode}`,
        fullCheckoutUrl,
        sessionUrl: fullCheckoutUrl,
        paymentUrl: fullCheckoutUrl,
        url: fullCheckoutUrl,
        relativeCheckoutUrl: `/checkout/${orderCode}`,
        qrDataUrl,
        qrImage: qrDataUrl,
        qrImageUrl: `${baseUrl}/api/qr?data=${encodeURIComponent(upiUri)}`
      };

      await logActivity({
        eventType: 'ORDER_CREATED',
        status: 'SUCCESS',
        title: `Order Created: ${orderCode}`,
        details: `Amount: ₹${parsedAmount.toFixed(2)} | Customer: ${customerName} | Webhook: ${webhookUrl || 'None'}`,
        clientIp,
        origin
      });

      if (req.io) {
        req.io.to('admin_room').emit('new_order', orderData);
        req.io.to('admin_room').emit('api_log', {
          event_type: 'ORDER_CREATED',
          status: 'SUCCESS',
          title: `Order Created: ${orderCode}`,
          details: `₹${parsedAmount.toFixed(2)} from ${origin || 'Client'}`,
          origin,
          created_at: createdAt
        });
      }

      return res.status(201).json({ success: true, order: orderData });
    } catch (err) {
      next(err);
    }
  },

  async getByCode(req, res, next) {
    try {
      const { code } = req.params;
      const order = await OrderModel.findByCode(code);

      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      // Dynamic expiry check
      if (order.status === 'PENDING' && Date.now() > order.expires_at) {
        await OrderModel.markAsExpired(order.id);
        order.status = 'EXPIRED';
      }

      const isPlanOrder = !!order.plan_id || (order.order_code && order.order_code.startsWith('PLAN-'));
      let merchantVpa = config.merchant.upiVpa;
      let merchantName = config.merchant.name;

      // Only merchant customer orders (non-plan orders) route to the merchant's own registered UPI VPA
      if (!isPlanOrder && order.user_email) {
        const u = await getUserByEmail(order.user_email);
        if (u) {
          if (u.upi_vpa) merchantVpa = u.upi_vpa;
          if (u.business_name || u.name) merchantName = u.business_name || u.name;
        }
      }

      const upiUri = buildUpiUri({
        vpa: merchantVpa,
        merchantName: merchantName,
        amount: order.amount,
        orderCode: order.order_code
      });

      const qrDataUrl = await generateQrDataUrl(upiUri);

      const forwardedProto = req.headers['x-forwarded-proto'];
      const protocol = forwardedProto ? forwardedProto.split(',')[0].trim() : (req.protocol || 'http');
      const host = req.headers['x-forwarded-host'] || req.get('host') || `localhost:${config.port}`;
      const baseUrl = `${protocol}://${host}`;
      const fullCheckoutUrl = `${baseUrl}/checkout/${order.order_code}`;

      return res.json({
        success: true,
        order: {
          ...order,
          orderId: order.id,
          orderCode: order.order_code,
          merchantName,
          merchantVpa,
          upiUri,
          checkoutUrl: `/checkout/${order.order_code}`,
          fullCheckoutUrl,
          sessionUrl: fullCheckoutUrl,
          paymentUrl: fullCheckoutUrl,
          url: fullCheckoutUrl,
          relativeCheckoutUrl: `/checkout/${order.order_code}`,
          qrDataUrl,
          qrImage: qrDataUrl,
          qrImageUrl: `${baseUrl}/api/qr?data=${encodeURIComponent(upiUri)}`,
          timeRemainingSeconds: Math.max(0, Math.floor((order.expires_at - Date.now()) / 1000))
        }
      });
    } catch (err) {
      next(err);
    }
  },

  async verifyUtr(req, res, next) {
    try {
      const { code } = req.params;
      const { utr } = req.body;

      if (!utr || utr.trim().length < 6) {
        return res.status(400).json({ success: false, error: 'Please enter a valid 12-digit UPI UTR / Ref number' });
      }

      const result = await claimOrderWithUtr(code, utr);
      return res.json(result);
    } catch (err) {
      next(err);
    }
  },

  getQrCode(req, res, next) {
    try {
      const { data } = req.query;
      if (!data) return res.status(400).send('Missing "data" query parameter');
      return streamQrPng(data, res);
    } catch (err) {
      next(err);
    }
  }
};

export default OrderController;
