import { OrderModel } from '../models/order.model.js';
import { PaymentModel } from '../models/payment.model.js';
import { SettingModel } from '../models/setting.model.js';
import { processIncomingPayment, claimOrderWithUtr, triggerWebhook, reconcileUnmatchedPayments } from '../services/matchingEngine.service.js';
import { getImapStatus } from '../services/imapListener.service.js';
import { config } from '../../config.js';
import { query, getRecentApiLogs, getAllUsers, updateUserPlanAndCredits } from '../../db/database.js';

export const AdminController = {
  async getStats(req, res, next) {
    try {
      const orderStats = await OrderModel.getStats();
      const paymentSummary = await PaymentModel.getLedgerSummary();

      return res.json({
        success: true,
        stats: {
          totalOrders: orderStats.total,
          paidOrders: orderStats.paid,
          pendingOrders: orderStats.pending,
          totalRevenue: orderStats.revenue,
          totalPaymentsRecorded: paymentSummary.totalTransactions,
          imapStatus: getImapStatus(),
          merchantVpa: config.merchant.upiVpa,
          merchantName: config.merchant.name,
          expiryMinutes: config.orderExpiryMinutes,
          imapUser: config.imap.user || '',
          hasImapPass: Boolean(config.imap.pass),
          imapFilter: config.imap.senderFilter.join(', '),
          allowedOrigins: config.allowedOrigins || []
        }
      });
    } catch (err) {
      next(err);
    }
  },

  async getLogs(req, res, next) {
    try {
      const limit = parseInt(req.query.limit || 50, 10);
      const logs = await getRecentApiLogs(limit);
      return res.json({ success: true, logs });
    } catch (err) {
      next(err);
    }
  },

  async getOrders(req, res, next) {
    try {
      const { status = 'ALL', limit = 100, type = 'ALL' } = req.query;
      let sql = 'SELECT * FROM orders';
      const params = [];
      const conditions = [];

      if (status !== 'ALL') {
        conditions.push('status = ?');
        params.push(status);
      }

      if (type === 'PLANS') {
        conditions.push('(order_code LIKE "PLAN-%" OR plan_id IS NOT NULL)');
      } else if (type === 'MERCHANT') {
        conditions.push('(order_code NOT LIKE "PLAN-%" AND (plan_id IS NULL OR plan_id = ""))');
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      sql += ' ORDER BY created_at DESC LIMIT ?';
      params.push(parseInt(limit, 10));

      const orders = await query.all(sql, params);
      return res.json({ success: true, orders });
    } catch (err) {
      next(err);
    }
  },

  async getPayments(req, res, next) {
    try {
      const { limit = 50 } = req.query;
      const payments = await PaymentModel.listRecent(parseInt(limit, 10));
      return res.json({ success: true, payments });
    } catch (err) {
      next(err);
    }
  },

  async simulatePayment(req, res, next) {
    try {
      const { amount, utr, sender = 'Test Customer (Simulated)', offsetSeconds = 0 } = req.body;
      const parsedAmount = parseFloat(amount);

      if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ success: false, error: 'Valid positive amount is required' });
      }

      const testUtr = utr || `SIM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const paymentTimestamp = Date.now() + (parseInt(offsetSeconds, 10) * 1000);

      const result = await processIncomingPayment({
        amount: parsedAmount,
        utr: testUtr,
        sender,
        receivedAt: paymentTimestamp,
        source: 'SIMULATION',
        rawSnippet: `[SIMULATED] Received INR ${parsedAmount} from ${sender}. Ref: ${testUtr}`
      });

      return res.json({ success: true, result });
    } catch (err) {
      next(err);
    }
  },

    async reconcileOrder(req, res, next) {
    try {
      const { orderCode, utr } = req.body;
      if (!orderCode) return res.status(400).json({ success: false, error: 'Order code is required' });

      const order = await OrderModel.findByCode(orderCode);
      if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

      const utrToUse = (utr && utr.trim()) ? utr.trim() : (order.utr || '');
      const result = await claimOrderWithUtr(orderCode, utrToUse);

      return res.json({ success: true, result });
    } catch (err) {
      next(err);
    }
  },

  async markOrderPaidManually(req, res, next) {
    try {
      const { orderCode } = req.params;
      const { utr, sender = 'Manual Verification (Admin)' } = req.body;

      const order = await OrderModel.findByCode(orderCode);
      if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

      const now = Date.now();
      const finalUtr = (utr && utr.trim()) ? utr.trim() : `MANUAL-${now}`;

      await query.run(
        `UPDATE orders SET status = 'PAID', paid_at = ?, utr = ?, sender_info = ? WHERE id = ?`,
        [now, finalUtr, sender, order.id]
      );

      // Check or insert payment
      const existing = await query.get('SELECT id FROM payments WHERE utr = ?', [finalUtr]);
      if (existing) {
        await query.run('UPDATE payments SET matched_order_id = ?, is_matched = 1 WHERE id = ?', [order.id, existing.id]);
      } else {
        await query.run(
          `INSERT INTO payments (utr, amount, sender, received_at, source, raw_snippet, matched_order_id, is_matched)
           VALUES (?, ?, ?, ?, 'MANUAL_ADMIN', 'Manually verified by admin', ?, 1)`,
          [finalUtr, order.amount, sender, now, order.id]
        );
      }

      if (req.io) {
        req.io.to(`order_${order.order_code}`).emit('order_status_update', {
          orderCode: order.order_code,
          status: 'PAID',
          amount: order.amount,
          utr: finalUtr,
          paidAt: now
        });
        req.io.to('admin_room').emit('payment_event', {
          type: 'ORDER_PAID',
          order: { ...order, status: 'PAID', utr: finalUtr, paid_at: now }
        });
      }

      if (order.webhook_url) {
        triggerWebhook(order.webhook_url, { ...order, status: 'PAID', utr: finalUtr, sender_info: sender, paid_at: now });
      }
      return res.json({ success: true, message: `Order ${orderCode} marked as PAID!` });
    } catch (err) {
      next(err);
    }
  },

  async updateSettings(req, res, next) {
    try {
      const { upiVpa, merchantName, expiryMinutes } = req.body;

      if (upiVpa) {
        config.merchant.upiVpa = upiVpa.trim();
        await SettingModel.set('merchant_upi_vpa', config.merchant.upiVpa);
      }
      if (merchantName) {
        config.merchant.name = merchantName.trim();
        await SettingModel.set('merchant_name', config.merchant.name);
      }
      if (expiryMinutes) {
        config.orderExpiryMinutes = parseInt(expiryMinutes, 10);
        await SettingModel.set('order_expiry_minutes', config.orderExpiryMinutes);
      }

      if (req.io) {
        req.io.to('admin_room').emit('settings_updated', {
          merchantVpa: config.merchant.upiVpa,
          merchantName: config.merchant.name,
          expiryMinutes: config.orderExpiryMinutes
        });
      }

      return res.json({ success: true, message: 'Settings saved to database successfully!' });
    } catch (err) {
      next(err);
    }
  },

  async getUsers(req, res, next) {
    try {
      const users = await getAllUsers();
      return res.json({ success: true, users });
    } catch (err) {
      next(err);
    }
  },

  async adjustUser(req, res, next) {
    try {
      const { email, plan, creditsToAdd } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required' });
      }
      const updated = await updateUserPlanAndCredits(email, plan || 'NONE', creditsToAdd || 0);
      return res.json({ success: true, user: updated });
    } catch (err) {
      next(err);
    }
  }
};

export default AdminController;
