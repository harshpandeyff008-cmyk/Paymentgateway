import crypto from 'crypto';
import { query, logActivity, updateUserPlanAndCredits, getUserByEmail } from '../db/database.js';
import { CloudSyncService } from '../src/services/cloudSync.service.js';
import { config } from '../config.js';

let ioInstance = null;

export function setSocketIO(io) {
  ioInstance = io;
}

// Email alerts (esp. FamApp) can arrive minutes after the payment itself,
// often after the 5-minute order window has closed and the expiry cleaner
// has already flipped the order to EXPIRED. A verified payment email
// carrying the exact unique amount (or the gateway order code) is
// therefore still honoured for orders that expired within this grace
// window, reviving them to PAID instead of stranding the money as an
// unmatched payment.
const LATE_PAYMENT_GRACE_MS = 15 * 60 * 1000;

/**
 * Core Time-Window Matching Engine
 * Compares incoming payment amount and timestamp with pending active orders.
 * Strictly verifies that the order was active (within validity window) when payment arrived.
 */
export async function processIncomingPayment({
  amount,
  utr,
  orderCode = null,
  sender = 'Unknown',
  receivedAt = new Date(),
  source = 'IMAP',
  rawSnippet = '',
  merchantEmail = null
}) {
  const receivedTimestamp = receivedAt instanceof Date ? receivedAt.getTime() : Number(receivedAt);

  console.log(`[MatchingEngine] Processing payment: ₹${amount}, UTR: ${utr}${orderCode ? `, OrderCode: ${orderCode}` : ''}, Source: ${source}${merchantEmail ? ` (Merchant: ${merchantEmail})` : ''}`);

  // 1. Duplicate Check
  const existingPayment = await query.get(
    'SELECT * FROM payments WHERE utr = ?',
    [utr]
  );

  // If this UTR was ALREADY successfully matched to an order, reject as duplicate
  if (existingPayment && existingPayment.is_matched === 1) {
    console.warn(`[MatchingEngine] Duplicate payment received with UTR: ${utr}. Already matched to order #${existingPayment.matched_order_id}.`);
    return {
      success: false,
      matched: false,
      reason: 'DUPLICATE_PAYMENT',
      payment: existingPayment
    };
  }

  // 2. Matching Strategy:
  let matchingOrder = null;

  // Step 0: Instant Deterministic Match (Paytm Note / Order ID extracted from email)
  // The amount MUST also equal the order amount (or its base amount): a
  // note hit with the wrong amount must never mark an order paid - it
  // falls through to the amount-based steps below instead. Orders that
  // expired within the late-payment grace window are eligible too.
  if (orderCode) {
    const candidate = await query.get(
      `SELECT * FROM orders
       WHERE order_code = ?
         AND (status = 'PENDING' OR (status = 'EXPIRED' AND expires_at >= ? - ${LATE_PAYMENT_GRACE_MS}))
         AND created_at <= ? + 120000
       LIMIT 1`,
      [orderCode, receivedTimestamp, receivedTimestamp]
    );
    if (candidate) {
      const orderAmt = Number(candidate.amount);
      const baseAmt = candidate.base_amount != null ? Number(candidate.base_amount) : NaN;
      const amountOk = Math.abs(orderAmt - Number(amount)) <= 0.01 ||
                       (!isNaN(baseAmt) && Math.abs(baseAmt - Number(amount)) <= 0.01);
      if (amountOk) {
        matchingOrder = candidate;
        console.log(`[MatchingEngine] ⚡ Instant Deterministic Match for order ${matchingOrder.order_code} via Note/Email!`);
      } else {
        console.warn(`[MatchingEngine] Note/OrderCode match for ${candidate.order_code} rejected: payment ₹${amount} != order amount ₹${candidate.amount} (base ₹${candidate.base_amount}). Falling through to amount matching.`);
      }
    }
  }

  // Step A: Check if any pending / recently-expired order was claimed with this exact UTR or order code in raw snippet
  if (!matchingOrder) {
    matchingOrder = await query.get(
      `SELECT * FROM orders
       WHERE (status = 'PENDING' OR (status = 'EXPIRED' AND expires_at >= ? - ${LATE_PAYMENT_GRACE_MS}))
         AND (utr = ? OR (LENGTH(?) > 4 AND instr(?, order_code) > 0))
         AND ROUND(amount, 2) = ROUND(?, 2)
         AND created_at <= ? + 60000
         AND expires_at >= ? - ${LATE_PAYMENT_GRACE_MS}
       ORDER BY created_at DESC
       LIMIT 1`,
      [receivedTimestamp, utr, rawSnippet, rawSnippet, amount, receivedTimestamp, receivedTimestamp]
    );
  }

  // Step B1: If incoming payment is from a specific Merchant's Gmail, prioritize that merchant's orders
  if (!matchingOrder && merchantEmail) {
    matchingOrder = await query.get(
      `SELECT * FROM orders
       WHERE user_email = ?
         AND (status = 'PENDING' OR (status = 'EXPIRED' AND expires_at >= ? - ${LATE_PAYMENT_GRACE_MS}))
         AND ROUND(amount, 2) = ROUND(?, 2)
         AND created_at <= ? + 60000
         AND expires_at >= ? - ${LATE_PAYMENT_GRACE_MS}
       ORDER BY created_at DESC
       LIMIT 1`,
      [merchantEmail, receivedTimestamp, amount, receivedTimestamp, receivedTimestamp]
    );
  }

  // Step B2: General PENDING (or recently EXPIRED, within grace) orders matching this exact unique amount
  if (!matchingOrder) {
    matchingOrder = await query.get(
      `SELECT * FROM orders
       WHERE (status = 'PENDING' OR (status = 'EXPIRED' AND expires_at >= ? - ${LATE_PAYMENT_GRACE_MS}))
         AND ROUND(amount, 2) = ROUND(?, 2)
         AND created_at <= ? + 60000
         AND expires_at >= ? - ${LATE_PAYMENT_GRACE_MS}
       ORDER BY created_at DESC
       LIMIT 1`,
      [receivedTimestamp, amount, receivedTimestamp, receivedTimestamp]
    );
  }

  // Step E: CloudSync Fallback - Load pending orders from Firebase RTDB if SQLite cache was restarted
  if (!matchingOrder) {
    try {
      const cloudOrders = await CloudSyncService.getAllOrders();
      for (const co of cloudOrders) {
        if (!co) continue;
        const cStatus = co.status || 'PENDING';
        const cAmount = Number(co.amount) || 0;
        const cBaseAmount = Number(co.base_amount !== undefined ? co.base_amount : (co.baseAmount !== undefined ? co.baseAmount : cAmount)) || cAmount;
        const cCreatedAt = Number(co.created_at || co.createdAt) || Date.now();
        const cExpiresAt = Number(co.expires_at || co.expiresAt) || (cCreatedAt + 24 * 60 * 60 * 1000);
        const code = co.order_code || co.orderCode;
        if (code && (cStatus === 'PENDING' || cStatus === 'EXPIRED') && (Math.abs(cAmount - amount) <= 0.01 || Math.abs(cBaseAmount - amount) <= 0.01) && cCreatedAt <= receivedTimestamp + 300000 && cExpiresAt >= receivedTimestamp - LATE_PAYMENT_GRACE_MS) {
          // Insert into SQLite and use as matching order
          await query.run(
            `INSERT OR IGNORE INTO orders (
              order_code, amount, base_amount, customer_name, customer_phone,
              status, created_at, expires_at, paid_at, utr, sender_info,
              webhook_url, webhook_status, failure_reason, user_email, plan_id,
              credits_to_add, brand_name, brand_logo_url, custom_note, theme, redirect_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              code,
              cAmount,
              cBaseAmount,
              co.customer_name || co.customerName || 'Guest',
              co.customer_phone || co.customerPhone || '',
              cStatus,
              Number(co.created_at || co.createdAt) || Date.now(),
              Number(co.expires_at || co.expiresAt) || (Date.now() + 20 * 60 * 1000),
              co.paid_at || co.paidAt || null,
              co.utr || null,
              co.sender_info || co.senderInfo || null,
              co.webhook_url || co.webhookUrl || '',
              co.webhook_status || co.webhookStatus || null,
              co.failure_reason || co.failureReason || null,
              co.user_email || co.userEmail || '',
              co.plan_id || co.planId || null,
              co.credits_to_add || co.creditsToAdd || 0,
              co.brand_name || co.brandName || '',
              co.brand_logo_url || co.brandLogoUrl || '',
              co.custom_note || co.customNote || '',
              co.theme || 'tiranga',
              co.redirect_url || co.redirectUrl || ''
            ]
          );
          matchingOrder = await query.get('SELECT * FROM orders WHERE order_code = ? COLLATE NOCASE', [code]);
          if (matchingOrder) {
            console.log(`[MatchingEngine] CloudSync matched order ${matchingOrder.order_code} for payment!`);
            break;
          }
        }
      }
    } catch (csErr) {
      console.warn('[MatchingEngine] CloudSync fallback check warning:', csErr.message);
    }
  }

  if (matchingOrder) {
    console.log(`[MatchingEngine] Match found! Order: ${matchingOrder.order_code} for ₹${amount}`);

    if (matchingOrder.status === 'EXPIRED') {
      console.log(`[MatchingEngine] Reviving EXPIRED order ${matchingOrder.order_code}: verified payment arrived within the late-payment grace window.`);
    }

    // Update order to PAID
    await query.run(
      `UPDATE orders 
       SET status = 'PAID', paid_at = ?, utr = ?, sender_info = ?
       WHERE id = ?`,
      [receivedTimestamp, utr, sender, matchingOrder.id]
    );

    // Save or update payment as matched
    let paymentId = existingPayment ? existingPayment.id : null;
    if (existingPayment) {
      await query.run(
        `UPDATE payments 
         SET matched_order_id = ?, is_matched = 1, amount = ?, sender = ?, source = ?
         WHERE id = ?`,
        [matchingOrder.id, amount, sender, source, existingPayment.id]
      );
    } else {
      const paymentResult = await query.run(
        `INSERT INTO payments (utr, amount, sender, received_at, source, raw_snippet, matched_order_id, is_matched)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [utr, amount, sender, receivedTimestamp, source, rawSnippet, matchingOrder.id]
      );
      paymentId = paymentResult.lastID;
    }

    const updatedOrder = {
      ...matchingOrder,
      status: 'PAID',
      paid_at: receivedTimestamp,
      utr,
      sender_info: sender
    };

    // Immediately persist paid order and payment record to Firebase RTDB
    CloudSyncService.saveOrder(updatedOrder).catch(err => console.error('[MatchingEngine] CloudSync order error:', err.message));
    CloudSyncService.savePayment({
      utr,
      amount,
      sender,
      received_at: receivedTimestamp,
      source,
      raw_snippet: rawSnippet,
      matched_order_id: matchingOrder.id,
      matched_order_code: matchingOrder.order_code,
      is_matched: 1,
      merchant_email: merchantEmail || matchingOrder.user_email || ''
    }).catch(err => console.error('[MatchingEngine] CloudSync payment error:', err.message));

    // Log Activity
    const orderOrigin = matchingOrder.webhook_url ? (matchingOrder.webhook_url.startsWith('http') ? new URL(matchingOrder.webhook_url).origin : '') : '';
    await logActivity({
      eventType: 'ORDER_PAID',
      status: 'SUCCESS',
      title: `Order Paid: ${matchingOrder.order_code}`,
      details: `₹${amount} auto-matched via ${source}. UTR: ${utr}, Sender: ${sender}.`,
      origin: orderOrigin
    });

    // Automatic User Plan Activation & Credit Allocation
    let activatedUser = null;
    if (matchingOrder.user_email && matchingOrder.plan_id) {
      try {
        activatedUser = await updateUserPlanAndCredits(
          matchingOrder.user_email,
          matchingOrder.plan_id,
          matchingOrder.credits_to_add || 0
        );
        console.log(`[MatchingEngine] Plan activated for user: ${matchingOrder.user_email}. Plan: ${matchingOrder.plan_id}, Credits: ${matchingOrder.credits_to_add}`);
      } catch (userErr) {
        console.error('[MatchingEngine] Failed to auto-activate plan for user:', userErr.message);
      }
    }

    // Real-time notification via WebSockets
    if (ioInstance) {
      // Notify checkout room
      ioInstance.to(`order_${matchingOrder.order_code}`).emit('order_status_update', {
        orderCode: matchingOrder.order_code,
        status: 'PAID',
        amount,
        utr,
        sender,
        paidAt: receivedTimestamp,
        planActivated: !!activatedUser,
        user: activatedUser
      });

      // If user order, notify user's private channel
      if (matchingOrder.user_email) {
        ioInstance.to(`user_${matchingOrder.user_email}`).emit('user_plan_activated', {
          orderCode: matchingOrder.order_code,
          plan: matchingOrder.plan_id,
          creditsAdded: matchingOrder.credits_to_add,
          user: activatedUser
        });
      }

      // Notify admin dashboard
      ioInstance.to('admin_room').emit('payment_event', {
        type: 'ORDER_PAID',
        order: updatedOrder,
        paymentId,
        userEmail: matchingOrder.user_email || null,
        planId: matchingOrder.plan_id || null
      });

      ioInstance.to('admin_room').emit('api_log', {
        event_type: 'ORDER_PAID',
        status: 'SUCCESS',
        title: `Order Paid: ${matchingOrder.order_code}`,
        details: `₹${amount} auto-matched via ${source}. UTR: ${utr}${matchingOrder.plan_id ? ` (Plan: ${matchingOrder.plan_id})` : ''}`,
        origin: orderOrigin,
        created_at: Date.now()
      });
    }

    // Trigger webhook if provided
    if (matchingOrder.webhook_url) {
      triggerWebhook(matchingOrder.webhook_url, updatedOrder);
    }

    return {
      success: true,
      matched: true,
      order: updatedOrder,
        paymentId
    };
  } else {
    console.log(`[MatchingEngine] No active pending order found for ₹${amount} at time ${new Date(receivedTimestamp).toISOString()}`);

    let paymentId = existingPayment ? existingPayment.id : null;
    if (!existingPayment) {
      // Save unmatched payment for admin inspection or manual customer UTR claim
      const paymentResult = await query.run(
        `INSERT INTO payments (utr, amount, sender, received_at, source, raw_snippet, matched_order_id, is_matched)
         VALUES (?, ?, ?, ?, ?, ?, NULL, 0)`,
        [utr, amount, sender, receivedTimestamp, source, rawSnippet]
      );
      paymentId = paymentResult.lastID;

      // Persist unmatched bank alert to Firebase RTDB
      CloudSyncService.savePayment({
        utr,
        amount,
        sender,
        received_at: receivedTimestamp,
        source,
        raw_snippet: rawSnippet,
        matched_order_id: null,
        is_matched: 0,
        merchant_email: merchantEmail || ''
      }).catch(err => console.error('[MatchingEngine] CloudSync payment error:', err.message));

      // Log activity and notify admin only ONCE when payment is first discovered
      await logActivity({
        eventType: 'UNMATCHED_PAYMENT',
        status: 'WARNING',
        title: `Unmatched Payment: ₹${amount}`,
        details: `Received ₹${amount} (UTR: ${utr}) from ${sender}. No matching order open.`
      });

      if (ioInstance) {
        ioInstance.to('admin_room').emit('payment_event', {
          type: 'UNMATCHED_PAYMENT',
          payment: {
            id: paymentId,
            utr,
            amount,
            sender,
            received_at: receivedTimestamp,
            source
          }
        });
        ioInstance.to('admin_room').emit('api_log', {
          event_type: 'UNMATCHED_PAYMENT',
          status: 'WARNING',
          title: `Unmatched Payment: ₹${amount}`,
          details: `UTR: ${utr} (${sender})`,
          created_at: Date.now()
        });
      }
    }

    return {
      success: true,
      matched: false,
      reason: 'NO_ACTIVE_ORDER_FOUND',
      paymentId
    };
  }
}

/**
 * Fallback: Customer manually inputs UTR on Checkout page if email was slightly delayed
 */
export async function claimOrderWithUtr(orderCode, submittedUtr) {
  const cleanUtr = (submittedUtr || '').trim();
  if (!cleanUtr) {
    return { success: false, message: 'Invalid UTR' };
  }

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
    } catch (_) {}
  }

  if (!order) {
    return { success: false, message: 'Order not found' };
  }

  if (order.status === 'PAID') {
    return { success: true, message: 'Order is already paid', order };
  }

  // Check if this UTR exists in payments table (matched or unmatched)
  let payment = await query.get(
    'SELECT * FROM payments WHERE utr = ?',
    [cleanUtr]
  );

  // If not found in SQLite, check Firebase RTDB payments
  if (!payment) {
    try {
      const cloudPayment = await CloudSyncService.getPayment(cleanUtr);
      if (cloudPayment) {
        payment = cloudPayment;
      }
    } catch (_) {}
  }

  // If still not found, trigger immediate targeted on-demand scan of merchant's Gmail
  if (!payment) {
    try {
      const { scanMerchantNow, scanAndProcessRecentEmails } = await import('./imapListener.js');
      const { scanGoogleBankingAccounts } = await import('./gmailWatcher.service.js');
      const tasks = [
        scanAndProcessRecentEmails(),
        scanGoogleBankingAccounts()
      ];
      if (order.user_email) {
        tasks.push(scanMerchantNow(order.user_email));
      }
      await Promise.allSettled(tasks);
    } catch (_) {}

    payment = await query.get('SELECT * FROM payments WHERE utr = ?', [cleanUtr]);
    if (!payment) {
      try {
        payment = await CloudSyncService.getPayment(cleanUtr);
      } catch (_) {}
    }
  }

  if (payment) {
    if (payment.is_matched === 1 && payment.matched_order_id && payment.matched_order_id !== order.id) {
      return {
        success: false,
        message: 'This UTR has already been claimed for another order.'
      };
    }
    if (order.created_at && payment.received_at < (order.created_at - 30 * 60 * 1000)) {
      return {
        success: false,
        message: 'This payment timestamp is older than this order session.'
      };
    }

    // Validate amount matches either exact payable or base amount
    const baseAmt = Number(order.base_amount) || Number(order.amount);
    const matchesAmount = Math.abs(payment.amount - order.amount) <= 0.01 || Math.abs(payment.amount - baseAmt) <= 0.01;
    if (!matchesAmount) {
      return {
        success: false,
        message: `Payment amount (₹${payment.amount}) does not match order amount (₹${order.amount})`
      };
    }

    // Match them
    await query.run(
      `UPDATE orders SET status = 'PAID', paid_at = ?, utr = ?, sender_info = ? WHERE id = ?`,
      [payment.received_at, cleanUtr, payment.sender, order.id]
    );

    await query.run(
      `UPDATE payments SET matched_order_id = ?, is_matched = 1 WHERE id = ?`,
      [order.id, payment.id]
    );

    const updatedOrder = { 
      ...order, 
      status: 'PAID', 
      paid_at: payment.received_at, 
      utr: cleanUtr,
      sender_info: payment.sender 
    };

    // Automatic User Plan Activation & Credit Allocation if plan purchase
    let activatedUser = null;
    if (order.user_email && order.plan_id) {
      try {
        activatedUser = await updateUserPlanAndCredits(
          order.user_email,
          order.plan_id,
          order.credits_to_add || 0
        );
        console.log(`[MatchingEngine] Plan activated via UTR claim for user: ${order.user_email}. Plan: ${order.plan_id}`);
      } catch (userErr) {
        console.error('[MatchingEngine] Failed to auto-activate plan for user:', userErr.message);
      }
    }

    // Persist paid order to Firebase RTDB
    CloudSyncService.saveOrder(updatedOrder).catch(err => console.error('[MatchingEngine] CloudSync order error:', err.message));

    if (ioInstance) {
      ioInstance.to(`order_${order.order_code}`).emit('order_status_update', {
        orderCode: order.order_code,
        status: 'PAID',
        amount: order.amount,
        utr: cleanUtr,
        paidAt: payment.received_at,
        planActivated: !!activatedUser,
        user: activatedUser
      });

      if (order.user_email) {
        ioInstance.to(`user_${order.user_email}`).emit('user_plan_activated', {
          orderCode: order.order_code,
          plan: order.plan_id,
          creditsAdded: order.credits_to_add,
          user: activatedUser
        });
      }

      ioInstance.to('admin_room').emit('payment_event', { type: 'ORDER_PAID', order: updatedOrder });
    }

    if (order.webhook_url) {
      triggerWebhook(order.webhook_url, updatedOrder);
    }

    return { success: true, message: 'Payment verified successfully via UTR!', order: updatedOrder };
  } else {
    // Save UTR attempt on the order so when the email arrives, it matches immediately
    await query.run('UPDATE orders SET utr = ? WHERE id = ?', [cleanUtr, order.id]);
    return {
      success: false,
      message: 'UTR registered! Waiting for bank confirmation email... System will auto-verify within 30 seconds.'
    };
  }
}

function isBlockedWebhookHost(hostname) {
  const h = (hostname || '').toLowerCase().trim();
  if (!h || h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1' || h === '169.254.169.254') {
    return true;
  }
  const ipv4Match = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) {
      return true;
    }
  }
  return false;
}

/**
 * Asynchronous Webhook Dispatcher
 */
export async function triggerWebhook(webhookUrl, orderData, eventType = 'payment.success') {
  if (!webhookUrl) return;
  let parsedUrl = null;
  try {
    parsedUrl = new URL(webhookUrl);
  } catch (_) {
    console.warn(`[Webhook] Invalid webhook URL: ${webhookUrl}`);
    return { success: false, error: 'Invalid URL' };
  }

  // SSRF Protection: Block private IP ranges, localhost, and cloud metadata endpoints
  if (isBlockedWebhookHost(parsedUrl.hostname)) {
    console.warn(`[Webhook] SSRF blocked target: ${webhookUrl}`);
    return { success: false, error: 'Blocked internal or loopback destination' };
  }

  const origin = parsedUrl.origin;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const payload = {
      event: eventType,
      timestamp: Date.now(),
      data: {
        orderCode: orderData.order_code,
        amount: orderData.amount,
        status: orderData.status || (eventType === 'payment.success' ? 'PAID' : (eventType === 'order.expired' ? 'EXPIRED' : 'FAILED')),
        utr: orderData.utr || null,
        sender: orderData.sender_info || null,
        paidAt: orderData.paid_at || null,
        failureReason: orderData.failure_reason || null
      }
    };

    const webhookSecret = config.webhookSecret || config.adminSecret || 'whsec_personal_gateway';
    const payloadString = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', webhookSecret).update(payloadString).digest('hex');

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Gateway-Signature': `sha256=${signature}`,
        'User-Agent': 'Personal-UPI-Gateway-Webhook/1.0'
      },
      body: payloadString,
      signal: controller.signal
    });
    clearTimeout(timeout);

    const status = response.ok ? 'SUCCESS' : 'FAILED';
    if (orderData.id) {
      await query.run('UPDATE orders SET webhook_status = ? WHERE id = ?', [status, orderData.id]);
    }

    await logActivity({
      eventType: 'WEBHOOK_DISPATCH',
      status: response.ok ? 'SUCCESS' : 'FAILED',
      title: `Webhook Dispatched: ${eventType} (${status})`,
      details: `Event "${eventType}" for ${orderData.order_code} (₹${orderData.amount}) dispatched to ${webhookUrl}. HTTP Status: ${response.status}`,
      origin
    });

    if (ioInstance) {
      ioInstance.to('admin_room').emit('api_log', {
        event_type: 'WEBHOOK_DISPATCH',
        status: response.ok ? 'SUCCESS' : 'FAILED',
        title: `Webhook ${eventType} -> ${status}`,
        details: `${orderData.order_code} -> ${webhookUrl}`,
        origin,
        created_at: Date.now()
      });
    }

    return { success: response.ok, status: response.status };
  } catch (err) {
    console.error(`[Webhook] Failed to dispatch ${eventType} to ${webhookUrl}:`, err.message);
    if (orderData.id) {
      await query.run('UPDATE orders SET webhook_status = ? WHERE id = ?', ['FAILED', orderData.id]);
    }

    await logActivity({
      eventType: 'WEBHOOK_DISPATCH',
      status: 'FAILED',
      title: `Webhook Dispatch Failed: ${eventType}`,
      details: `Failed to deliver ${eventType} for ${orderData.order_code} to ${webhookUrl}: ${err.message}`,
      origin
    });

    if (ioInstance) {
      ioInstance.to('admin_room').emit('api_log', {
        event_type: 'WEBHOOK_DISPATCH',
        status: 'FAILED',
        title: `Webhook ${eventType} Failed`,
        details: `${orderData.order_code} -> ${webhookUrl}: ${err.message}`,
        origin,
        created_at: Date.now()
      });
    }

    return { success: false, error: err.message };
  }
}

export default { processIncomingPayment, claimOrderWithUtr, setSocketIO, triggerWebhook };


/**
 * Auto-Reconciliation Engine: Scans unmatched payments and matches them with pending/expired orders
 */
export async function reconcileUnmatchedPayments() {
  try {
    const unmatched = await query.all(
      `SELECT * FROM payments 
       WHERE is_matched = 0 
       ORDER BY received_at DESC 
       LIMIT 20`
    );

    for (const p of unmatched) {
      await processIncomingPayment({
        amount: p.amount,
        utr: p.utr,
        sender: p.sender,
        receivedAt: new Date(p.received_at),
        source: p.source || 'RECONCILER',
        rawSnippet: p.raw_snippet || ''
      });
    }
  } catch (err) {
    console.warn('[Reconcile Engine Notice]:', err.message);
  }
}
