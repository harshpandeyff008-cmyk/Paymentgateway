import { query } from '../../db/database.js';
import { CloudSyncService } from '../services/cloudSync.service.js';

export const OrderModel = {
  async create({ orderCode, amount, baseAmount = null, customerName = 'Guest', customerPhone = '', createdAt, expiresAt, webhookUrl = '', userEmail = '', brandName = '', brandLogoUrl = '', customNote = '', theme = 'tiranga', redirectUrl = '' }) {
    const finalBaseAmount = baseAmount !== null ? baseAmount : amount;
    const result = await query.run(
      `INSERT INTO orders (order_code, amount, base_amount, customer_name, customer_phone, status, created_at, expires_at, webhook_url, user_email, brand_name, brand_logo_url, custom_note, theme, redirect_url)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderCode, amount, finalBaseAmount, customerName, customerPhone, createdAt, expiresAt, webhookUrl, userEmail, brandName, brandLogoUrl, customNote, theme, redirectUrl]
    );
    return { id: result.lastID, orderCode, amount, baseAmount: finalBaseAmount, customerName, customerPhone, status: 'PENDING', createdAt, expiresAt, userEmail, brandName, brandLogoUrl, customNote, theme, redirectUrl };
  },

  async getByCode(orderCode) {
    return this.findByCode(orderCode);
  },

  async findByCode(orderCode) {
    if (!orderCode) return null;
    let order = await query.get('SELECT * FROM orders WHERE order_code = ? COLLATE NOCASE', [orderCode]);
    if (!order) {
      try {
        const cloudOrder = await CloudSyncService.getOrder(orderCode);
        if (cloudOrder) {
          const code = cloudOrder.order_code || cloudOrder.orderCode || orderCode;
          await query.run(
            `INSERT OR IGNORE INTO orders (
              order_code, amount, base_amount, customer_name, customer_phone,
              status, created_at, expires_at, paid_at, utr, sender_info,
              webhook_url, webhook_status, failure_reason, user_email, plan_id,
              credits_to_add, brand_name, brand_logo_url, custom_note, theme, redirect_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              code,
              Number(cloudOrder.amount) || 0,
              Number(cloudOrder.base_amount || cloudOrder.baseAmount || cloudOrder.amount) || 0,
              cloudOrder.customer_name || cloudOrder.customerName || 'Guest',
              cloudOrder.customer_phone || cloudOrder.customerPhone || '',
              cloudOrder.status || 'PENDING',
              Number(cloudOrder.created_at || cloudOrder.createdAt) || Date.now(),
              Number(cloudOrder.expires_at || cloudOrder.expiresAt) || (Date.now() + 20 * 60 * 1000),
              cloudOrder.paid_at || cloudOrder.paidAt || null,
              cloudOrder.utr || null,
              cloudOrder.sender_info || cloudOrder.senderInfo || null,
              cloudOrder.webhook_url || cloudOrder.webhookUrl || '',
              cloudOrder.webhook_status || cloudOrder.webhookStatus || null,
              cloudOrder.failure_reason || cloudOrder.failureReason || null,
              cloudOrder.user_email || cloudOrder.userEmail || '',
              cloudOrder.plan_id || cloudOrder.planId || null,
              cloudOrder.credits_to_add || cloudOrder.creditsToAdd || 0,
              cloudOrder.brand_name || cloudOrder.brandName || '',
              cloudOrder.brand_logo_url || cloudOrder.brandLogoUrl || '',
              cloudOrder.custom_note || cloudOrder.customNote || '',
              cloudOrder.theme || 'tiranga',
              cloudOrder.redirect_url || cloudOrder.redirectUrl || ''
            ]
          );
          order = await query.get('SELECT * FROM orders WHERE order_code = ? COLLATE NOCASE', [orderCode]);
        }
      } catch (err) {
        // Fallback error ignored
      }
    }
    return order;
  },

  async findById(id) {
    return query.get('SELECT * FROM orders WHERE id = ?', [id]);
  },

  async markAsPaid(id, { paidAt, utr, senderInfo }) {
    return query.run(
      `UPDATE orders SET status = 'PAID', paid_at = ?, utr = ?, sender_info = ? WHERE id = ?`,
      [paidAt, utr, senderInfo, id]
    );
  },

  async markAsExpired(id) {
    return query.run(`UPDATE orders SET status = 'EXPIRED', failure_reason = 'PAYMENT_EXPIRED' WHERE id = ?`, [id]);
  },

  async markAsFailed(id, reason = 'PAYMENT_FAILED') {
    return query.run(`UPDATE orders SET status = 'FAILED', failure_reason = ? WHERE id = ?`, [reason, id]);
  },

  async setSubmittedUtr(id, utr) {
    return query.run(`UPDATE orders SET utr = ? WHERE id = ?`, [utr, id]);
  },

  async list({ status = 'ALL', limit = 50 } = {}) {
    let sql = 'SELECT * FROM orders';
    const params = [];
    if (status !== 'ALL') {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    return query.all(sql, params);
  },

  async getStats() {
    const total = await query.get('SELECT COUNT(*) as count FROM orders');
    const paid = await query.get('SELECT COUNT(*) as count, SUM(amount) as revenue FROM orders WHERE status = "PAID"');
    const pending = await query.get('SELECT COUNT(*) as count FROM orders WHERE status = "PENDING"');
    return {
      total: total?.count || 0,
      paid: paid?.count || 0,
      revenue: paid?.revenue || 0,
      pending: pending?.count || 0
    };
  },

  async findExpiredPending(now = Date.now()) {
    return query.all('SELECT id, order_code, amount, webhook_url FROM orders WHERE status = "PENDING" AND expires_at < ?', [now]);
  },

  async updateWebhookStatus(id, status) {
    return query.run('UPDATE orders SET webhook_status = ? WHERE id = ?', [status, id]);
  }
};

export default OrderModel;
