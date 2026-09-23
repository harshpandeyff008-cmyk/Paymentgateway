// Dynamically resolve Gateway Backend URL (supports paypendicular.web.app, localhost, and Render)
const API_BASE = (window.location.hostname.includes('paypendicular') || window.location.hostname.includes('upigateway') || window.location.hostname.includes('web.app') || window.location.hostname.includes('firebaseapp.com')) 
  ? 'https://personal-payment-gateway.onrender.com' 
  : '';

// ==================== MASTER KEY AUTH & FETCH INTERCEPTOR ==================== //
function getAdminMasterKey() {
  return localStorage.getItem('admin_master_key') || 
         sessionStorage.getItem('gateway_master_key') || 
         'shivambhatt@admin';
}

const originalFetch = window.fetch;
window.fetch = async function (url, options = {}) {
  let urlStr = typeof url === 'string' ? url : (url?.url || '');
  
  // If this is a relative /api/ endpoint and API_BASE is configured (e.g. on paypendicular.web.app), prepend API_BASE!
  if (API_BASE && urlStr.startsWith('/api/')) {
    urlStr = API_BASE + urlStr;
    if (typeof url === 'string') {
      url = urlStr;
    }
  }

  // Attach x-admin-key to ANY admin endpoint (relative or absolute URL, including /api/admin and /api/v1/admin)
  if ((urlStr.includes('/api/admin') || urlStr.includes('/api/v1/admin')) && !urlStr.includes('/auth/verify-master-key')) {
    const key = getAdminMasterKey();
    options = options || {};
    options.headers = options.headers || {};

    if (options.headers instanceof Headers) {
      if (key && !options.headers.has('x-admin-key')) {
        options.headers.set('x-admin-key', key);
      }
    } else {
      if (key && !options.headers['x-admin-key']) {
        options.headers['x-admin-key'] = key;
      }
    }
  }

  const response = await originalFetch.call(this, url, options);

  if (response.status === 401 && (urlStr.includes('/api/admin') || urlStr.includes('/api/v1/admin')) && !urlStr.includes('/auth/verify-master-key')) {
    console.warn('[AdminAuth] Received 401 from', urlStr);
    showMasterKeyLockScreen();
  }

  return response;
};

function showMasterKeyLockScreen() {
  window.location.href = '/login';
}
window.showMasterKeyLockScreen = showMasterKeyLockScreen;

function hideMasterKeyLockScreen() {
  // no-op, lock screen replaced with unified /login
}
window.hideMasterKeyLockScreen = hideMasterKeyLockScreen;

function lockAdminDashboard() {
  sessionStorage.removeItem('gateway_admin_auth');
  sessionStorage.removeItem('gateway_admin_email');
  sessionStorage.removeItem('gateway_master_key');
  localStorage.removeItem('admin_master_key');
  if (fbAuth) fbAuth.signOut().catch(() => {});
  window.location.href = '/login';
}
window.lockAdminDashboard = lockAdminDashboard;

let socket = null;
let currentFilter = 'ALL';


// Elements - Metrics
const metricRevenue = document.getElementById('metricRevenue');
const metricTotalOrders = document.getElementById('metricTotalOrders');
const metricPaidOrders = document.getElementById('metricPaidOrders');
const metricConversion = document.getElementById('metricConversion');
const metricPendingOrders = document.getElementById('metricPendingOrders');

const imapDot = document.getElementById('imapDot');
const imapText = document.getElementById('imapText');
const uiImapBadge = document.getElementById('uiImapBadge');

const ordersTableBody = document.getElementById('ordersTableBody');
const paymentsFeed = document.getElementById('paymentsFeed');
const paymentsCount = document.getElementById('paymentsCount');

// Elements - Create Order Modal
const createOrderForm = document.getElementById('createOrderForm');
const orderAmount = document.getElementById('orderAmount');
const orderCustomerName = document.getElementById('orderCustomerName');
const orderCustomerPhone = document.getElementById('orderCustomerPhone');
const orderWebhook = document.getElementById('orderWebhook');

// Elements - Frontend Configurator
const frontendImapForm = document.getElementById('frontendImapForm');
const uiImapEnabled = document.getElementById('uiImapEnabled');
const uiImapUser = document.getElementById('uiImapUser');
const uiImapPass = document.getElementById('uiImapPass');
const uiImapFilter = document.getElementById('uiImapFilter');
const btnToggleShowPass = document.getElementById('btnToggleShowPass');
const uiBtnTestImap = document.getElementById('uiBtnTestImap');
const uiBtnSaveImap = document.getElementById('uiBtnSaveImap');
const uiImapFeedback = document.getElementById('uiImapFeedback');

const configMerchantVpa = document.getElementById('configMerchantVpa');
const configMerchantName = document.getElementById('configMerchantName');
const configExpiryMinutes = document.getElementById('configExpiryMinutes');
const settingsFeedback = document.getElementById('settingsFeedback');
const adminImapUpiVpa = document.getElementById('adminImapUpiVpa');
const adminImapMerchantName = document.getElementById('adminImapMerchantName');
const adminImapUpiFeedback = document.getElementById('adminImapUpiFeedback');

const uiBtnScanInbox = document.getElementById('uiBtnScanInbox');
const inboxScanResults = document.getElementById('inboxScanResults');

// Ledger DOM Elements
const btnSyncAllEmails = document.getElementById('btnSyncAllEmails');
const syncFeedback = document.getElementById('syncFeedback');
const ledgerTotalMoney = document.getElementById('ledgerTotalMoney');
const ledgerTotalCount = document.getElementById('ledgerTotalCount');
const ledgerTopCustomer = document.getElementById('ledgerTopCustomer');
const ledgerTopCustomerAmount = document.getElementById('ledgerTopCustomerAmount');
const ledgerTopSendersList = document.getElementById('ledgerTopSendersList');
const pasteEmailForm = document.getElementById('pasteEmailForm');
const pasteEmailInput = document.getElementById('pasteEmailInput');
const btnParsePaste = document.getElementById('btnParsePaste');
const pasteFeedback = document.getElementById('pasteFeedback');
const ledgerTableBody = document.getElementById('ledgerTableBody');

// Modern 2-Line Sidebar Navigation Switching
function switchAdminSidebar(viewId) {
  // Update sidebar active buttons
  document.querySelectorAll('.sidebar-item-2line').forEach(btn => btn.classList.remove('active'));
  const targetBtn = document.getElementById(`nav_admin_${viewId}`);
  if (targetBtn) targetBtn.classList.add('active');

  // Toggle content views
  document.querySelectorAll('.admin-view-section').forEach(view => view.classList.remove('active'));
  const targetView = document.getElementById(`view_admin_${viewId}`);
  if (targetView) targetView.classList.add('active');

  // Update topbar title
  const titleEl = document.getElementById('adminViewTitle');
  if (titleEl) {
    const titles = {
      users: '👥 Registered Users & Merchant Directory',
      subscriptions: '💳 Subscription Purchases & Plan Invoices',
      orders: '📦 Live Store Orders & Checkout Sessions',
      ledger: '💰 Bank Alerts & IMAP Payments Ledger',
      config: '⚡ Gateway Controls & Zero .env Settings',
      imap: '📧 IMAP & Settlement Setup',
      coupons: '🏷️ Coupons & Plan Pricing Control',
      apiKey: '🔑 Developer API Keys & Domain Locks',
      logs: '📝 System Activity Logs & Audit Trail'
    };
    titleEl.innerText = titles[viewId] || 'Admin Dashboard';
  }

  // Trigger loads based on active view
  if (viewId === 'users') {
    loadAdminUsers();
  } else if (viewId === 'subscriptions') {
    loadAdminSubscriptions();
  } else if (viewId === 'orders') {
    loadOrders('ALL');
  } else if (viewId === 'ledger') {
    loadLedger();
  } else if (viewId === 'config') {
    loadStats();
  } else if (viewId === 'imap') {
    loadImapStatus();
  } else if (viewId === 'coupons') {
    loadCoupons();
    loadPlanPrices();
  } else if (viewId === 'apiKey') {
    loadDomainKeysList();
  } else if (viewId === 'logs') {
    loadApiLogs();
  }
}
window.switchAdminSidebar = switchAdminSidebar;

// Backward-compatible switchTab mapping
function switchTab(tab) {
  const map = {
    dashboard: 'orders',
    ledger: 'ledger',
    config: 'config',
    apiKey: 'apiKey',
    users: 'users',
    logs: 'logs',
    subscriptions: 'subscriptions'
  };
  switchAdminSidebar(map[tab] || tab);
}
window.switchTab = switchTab;

// Modal Helpers
function openModal(id) {
  document.getElementById(id).classList.add('active');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}
window.closeModal = closeModal;

document.getElementById('btnOpenCreateOrder').addEventListener('click', () => openModal('modalCreateOrder'));

window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

// Show / Hide Password
btnToggleShowPass.addEventListener('click', () => {
  if (uiImapPass.type === 'password') {
    uiImapPass.type = 'text';
    btnToggleShowPass.innerText = '🔒';
  } else {
    uiImapPass.type = 'password';
    btnToggleShowPass.innerText = '👁️';
  }
});

// 1. Load Stats and Settings into UI
async function loadStats() {
  try {
    const res = await fetch(API_BASE + '/api/admin/stats');
    const data = await res.json();
    if (!data.success) return;

    const { stats } = data;
    metricRevenue.innerText = `₹ ${Number(stats.totalRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    metricTotalOrders.innerText = stats.totalOrders;
    metricPaidOrders.innerText = stats.paidOrders;
    metricPendingOrders.innerText = stats.pendingOrders;

    const rate = stats.totalOrders > 0 ? ((stats.paidOrders / stats.totalOrders) * 100).toFixed(1) : 0;
    metricConversion.innerText = `${rate}% Success Rate`;

    // IMAP Status
    updateImapPill(stats.imapStatus);

    // Populate Frontend Configurator and IMAP fields
    const vpa = stats.merchantVpa || '';
    const name = stats.merchantName || '';
    const exp = stats.expiryMinutes || 5;

    const elVpa = document.getElementById('configMerchantVpa');
    const elName = document.getElementById('configMerchantName');
    const elExp = document.getElementById('configExpiryMinutes');
    const elAdminVpa = document.getElementById('adminImapUpiVpa');
    const elAdminName = document.getElementById('adminImapMerchantName');

    if (elVpa) elVpa.value = vpa;
    if (elName) elName.value = name;
    if (elExp) elExp.value = exp;
    if (elAdminVpa) elAdminVpa.value = vpa;
    if (elAdminName) elAdminName.value = name;
    const elProvider = document.getElementById('configMerchantProvider');
    if (elProvider && stats.merchantUpiProvider) elProvider.value = stats.merchantUpiProvider;

    if (stats.imapStatus) {
      uiImapEnabled.checked = Boolean(stats.imapStatus.enabled);
      if (stats.imapStatus.user) uiImapUser.value = stats.imapStatus.user;
    }
    if (stats.imapFilter) {
      uiImapFilter.value = stats.imapFilter;
    }

  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

function updateImapPill(status) {
  if (!status) return;

  imapDot.className = 'status-dot';
  if (!status.enabled) {
    imapDot.classList.add('disconnected');
    imapText.innerText = 'IMAP: Disabled';
    if (uiImapBadge) {
      uiImapBadge.className = 'badge PENDING';
      uiImapBadge.innerText = 'Disabled';
    }
  } else if (status.connected && status.listening) {
    imapDot.classList.add('connected');
    imapText.innerText = 'IMAP: Live Listening';
    if (uiImapBadge) {
      uiImapBadge.className = 'badge PAID';
      uiImapBadge.innerText = 'Live Listening (Active)';
    }
  } else if (status.connected) {
    imapDot.classList.add('idle');
    imapText.innerText = 'IMAP: Connected';
    if (uiImapBadge) {
      uiImapBadge.className = 'badge PENDING';
      uiImapBadge.innerText = 'Connected (Idle)';
    }
  } else {
    imapDot.classList.add('disconnected');
    imapText.innerText = status.lastError ? `IMAP: Error` : 'IMAP: Disconnected';
    if (uiImapBadge) {
      uiImapBadge.className = 'badge EXPIRED';
      uiImapBadge.innerText = status.lastError || 'Disconnected';
    }
  }
}

// 2. Load Orders
async function loadOrders(filter = 'ALL') {
  currentFilter = filter;
  try {
    const res = await fetch(`${API_BASE}/api/admin/orders?status=${filter}`);
    const data = await res.json();
    if (!data.success) return;

    renderOrders(data.orders);
  } catch (err) {
    console.error('Failed to load orders:', err);
  }
}

function renderOrders(orders) {
  // Update Simulator Quick Chips with Active Pending Orders
  const pendingOrders = (orders || []).filter(o => o.status === 'PENDING');
  const simChips = document.getElementById('simPendingChips');
  if (simChips) {
    if (pendingOrders.length === 0) {
      simChips.innerHTML = `<span style="font-size: 11px; color: var(--accent-amber);">⚠️ No pending orders open. Click 1-Click test below!</span>`;
    } else {
      simChips.innerHTML = pendingOrders.slice(0, 4).map(o => `
        <button type="button" onclick="selectPendingOrderForSim('${o.order_code}', ${o.amount})" class="btn btn-secondary" style="padding: 2px 8px; font-size: 11px; border-color: rgba(56, 189, 248, 0.4); color: var(--primary); cursor: pointer;" title="Fill ₹${o.amount} into simulator">
          👉 ${o.order_code}: ₹${Number(o.amount).toFixed(2)}
        </button>
      `).join('');
    }
  }

  if (!orders || orders.length === 0) {
    ordersTableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-dim); padding: 30px;">
          No orders found. Click "+ Create Order" to generate one.
        </td>
      </tr>
    `;
    return;
  }

  ordersTableBody.innerHTML = orders.map(ord => {
    const isPending = ord.status === 'PENDING';
    const isPaid = ord.status === 'PAID';
    const isExpired = ord.status === 'EXPIRED';

    let timeDetail = '-';
    if (isPaid) {
      timeDetail = `<span style="color: var(--accent-green);">Paid @ ${new Date(ord.paid_at || ord.created_at).toLocaleTimeString()}</span><br><span style="font-family: 'JetBrains Mono'; font-size: 11px; color: var(--text-dim);">${ord.utr || 'Auto'}</span>`;
    } else if (isPending) {
      const remainingSecs = Math.max(0, Math.floor((ord.expires_at - Date.now()) / 1000));
      const mins = Math.floor(remainingSecs / 60);
      const secs = remainingSecs % 60;
      timeDetail = `<span style="color: var(--accent-amber);">Expires in ${mins}m ${secs}s</span>`;
    } else if (isExpired) {
      timeDetail = `<span style="color: var(--text-dim);">Expired</span>`;
    }

    return `
      <tr>
        <td>
          <a href="/checkout/${ord.order_code}" target="_blank" class="code-badge" title="Open Customer Checkout">
            ${ord.order_code} ↗
          </a>
        </td>
        <td style="font-weight: 700; font-size: 15px;">₹ ${Number(ord.amount).toFixed(2)}</td>
        <td><span class="badge ${ord.status}">${ord.status}</span></td>
        <td>
          <div>${ord.customer_name || 'Guest'}</div>
          <div style="font-size: 11px; color: var(--text-dim);">${ord.customer_phone || ''}</div>
        </td>
        <td>${timeDetail}</td>
        <td>
          <a href="/checkout/${ord.order_code}" target="_blank" class="btn btn-secondary" style="padding: 4px 10px; font-size: 11px;">
            Open Page
          </a>
        </td>
      </tr>
    `;
  }).join('');
}

// 3. Load Payments Log
async function loadPayments() {
  try {
    const res = await fetch(API_BASE + '/api/admin/payments');
    const data = await res.json();
    if (!data.success) return;

    renderPayments(data.payments);
  } catch (err) {
    console.error('Failed to load payments:', err);
  }
}

function renderPayments(payments) {
  paymentsCount.innerText = `${payments.length} items`;

  if (!payments || payments.length === 0) {
    paymentsFeed.innerHTML = `
      <div style="font-size: 12px; color: var(--text-dim); text-align: center; padding: 20px;">
        No payments recorded yet.
      </div>
    `;
    return;
  }

  paymentsFeed.innerHTML = payments.map(p => {
    const isMatched = p.is_matched === 1;
    return `
      <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-card); border-radius: var(--radius-sm); padding: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-weight: 700; color: ${isMatched ? 'var(--accent-green)' : 'var(--accent-amber)'}; font-size: 14px;">
            ₹ ${Number(p.amount).toFixed(2)}
          </span>
          <span class="badge ${isMatched ? 'PAID' : 'PENDING'}" style="font-size: 10px;">
            ${isMatched ? `Matched: ${p.matched_order_code}` : 'Unmatched'}
          </span>
        </div>
        <div style="font-size: 11px; color: var(--text-muted); font-family: 'JetBrains Mono'; margin-bottom: 2px;">
          Ref: ${p.utr}
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-dim);">
          <span>From: ${p.sender || 'Unknown'}</span>
          <span>${new Date(p.received_at).toLocaleTimeString()} (${p.source})</span>
        </div>
      </div>
    `;
  }).join('');
}

// 4. Create Order Handler
createOrderForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btnSubmitOrder');
  btn.disabled = true;
  btn.innerText = 'Creating...';

  try {
    const payload = {
      amount: orderAmount.value,
      customerName: orderCustomerName.value || 'Guest',
      customerPhone: orderCustomerPhone.value || '',
      webhookUrl: orderWebhook.value || ''
    };

    const headers = { 'Content-Type': 'application/json' };
    if (currentApiKey) {
      headers['x-api-key'] = currentApiKey;
    }

    const res = await fetch(API_BASE + '/api/orders/create', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success && data.order) {
      closeModal('modalCreateOrder');
      createOrderForm.reset();
      
      loadStats();
  loadDomainKeysList(); // auto-load
      loadOrders(currentFilter);

      simAmount.value = data.order.amount;
      window.open(data.order.checkoutUrl, '_blank');
    } else {
      alert(data.error || 'Failed to create order');
    }
  } catch (err) {
    alert('Error creating order: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = 'Generate Checkout Session';
  }
});

// 5. (Simulator removed — Real IMAP & FamPay auto-verification handles production payment matching)



// 6. Test IMAP 1-Click Button Handler
uiBtnTestImap.addEventListener('click', async () => {
  const user = uiImapUser.value.trim();
  const pass = uiImapPass.value.trim();

  if (!user || !pass) {
    uiImapFeedback.style.display = 'block';
    uiImapFeedback.style.background = 'rgba(239, 68, 68, 0.15)';
    uiImapFeedback.style.border = '1px solid rgba(239, 68, 68, 0.3)';
    uiImapFeedback.style.color = '#f87171';
    uiImapFeedback.innerText = '⚠️ Please enter both your Gmail address and 16-character Google App Password to test.';
    return;
  }

  uiBtnTestImap.disabled = true;
  uiBtnTestImap.innerText = '⏳ Connecting to Gmail...';
  uiImapFeedback.style.display = 'none';

  try {
    const res = await fetch(API_BASE + '/api/admin/imap/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, pass })
    });

    const data = await res.json();
    uiImapFeedback.style.display = 'block';

    if (data.success) {
      uiImapFeedback.style.background = 'rgba(16, 185, 129, 0.15)';
      uiImapFeedback.style.border = '1px solid rgba(16, 185, 129, 0.3)';
      uiImapFeedback.style.color = '#34d399';
      uiImapFeedback.innerHTML = `✅ <b>Connection Successful!</b><br>Logged into Gmail. Found <b>${data.totalMessages}</b> emails in INBOX (${data.unseenMessages} unread).`;
    } else {
      uiImapFeedback.style.background = 'rgba(239, 68, 68, 0.15)';
      uiImapFeedback.style.border = '1px solid rgba(239, 68, 68, 0.3)';
      uiImapFeedback.style.color = '#f87171';
      uiImapFeedback.innerHTML = `❌ <b>Connection Failed:</b><br>${data.error}`;
    }
  } catch (err) {
    uiImapFeedback.style.display = 'block';
    uiImapFeedback.style.background = 'rgba(239, 68, 68, 0.15)';
    uiImapFeedback.style.color = '#f87171';
    uiImapFeedback.innerText = 'Network error: ' + err.message;
  } finally {
    uiBtnTestImap.disabled = false;
    uiBtnTestImap.innerText = '🔍 Test Connection (1-Click)';
  }
});

// 7. Save & Start Live IMAP Listener Handler (Zero .env)
frontendImapForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  uiBtnSaveImap.disabled = true;
  uiBtnSaveImap.innerText = 'Saving to Database...';

  try {
    const payload = {
      enabled: uiImapEnabled.checked,
      user: uiImapUser.value.trim(),
      senderFilter: uiImapFilter.value.trim()
    };
    if (uiImapPass.value.trim()) {
      payload.pass = uiImapPass.value.trim();
    }

    const res = await fetch(API_BASE + '/api/admin/imap/restart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    uiImapFeedback.style.display = 'block';
    if (data.success) {
      uiImapFeedback.style.background = 'rgba(16, 185, 129, 0.15)';
      uiImapFeedback.style.border = '1px solid rgba(16, 185, 129, 0.3)';
      uiImapFeedback.style.color = '#34d399';
      uiImapFeedback.innerHTML = `💾 <b>Settings Saved to Database!</b><br>IMAP Live Listener is now <b>${payload.enabled ? '🟢 ACTIVE & LISTENING' : '⚪ DISABLED'}</b>.`;
      loadStats();
    } else {
      uiImapFeedback.style.background = 'rgba(239, 68, 68, 0.15)';
      uiImapFeedback.style.border = '1px solid rgba(239, 68, 68, 0.3)';
      uiImapFeedback.style.color = '#f87171';
      uiImapFeedback.innerHTML = `❌ ${data.error || 'Failed to apply settings'}`;
    }
  } catch (err) {
    uiImapFeedback.style.display = 'block';
    uiImapFeedback.style.background = 'rgba(239, 68, 68, 0.15)';
    uiImapFeedback.style.color = '#f87171';
    uiImapFeedback.innerText = 'Failed: ' + err.message;
  } finally {
    uiBtnSaveImap.disabled = false;
    uiBtnSaveImap.innerText = '💾 Save & Start Live Listener';
  }
});

// 8. Save UPI & Merchant Settings (Zero .env)
async function handleSaveSettings(e) {
  if (e) e.preventDefault();
  const vpa = document.getElementById('configMerchantVpa')?.value.trim();
  const name = document.getElementById('configMerchantName')?.value.trim();
  const expiry = document.getElementById('configExpiryMinutes')?.value;
  const provider = document.getElementById('configMerchantProvider')?.value || 'AUTO';
  const fb = document.getElementById('settingsFeedback');
  const btn = e?.target?.querySelector('button[type="submit"]');

  if (btn) { btn.disabled = true; btn.innerText = 'Saving...'; }
  if (fb) fb.style.display = 'none';

  try {
    const res = await fetch(API_BASE + '/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upiVpa: vpa, merchantName: name, expiryMinutes: expiry, upiProvider: provider })
    });
    const data = await res.json();
    if (fb) {
      fb.style.display = 'block';
      if (data.success) {
        fb.style.background = 'rgba(16, 185, 129, 0.15)';
        fb.style.border = '1px solid rgba(16, 185, 129, 0.3)';
        fb.style.color = '#34d399';
        fb.innerHTML = `✅ Platform settings saved! Merchant UPI: <b>${vpa}</b> (${name})`;
        const elAdminVpa = document.getElementById('adminImapUpiVpa');
        const elAdminName = document.getElementById('adminImapMerchantName');
        if (elAdminVpa) elAdminVpa.value = vpa;
        if (elAdminName) elAdminName.value = name;
      } else {
        fb.style.background = 'rgba(239, 68, 68, 0.15)';
        fb.style.color = '#f87171';
        fb.innerText = '❌ ' + (data.error || 'Failed');
      }
    }
  } catch (err) {
    if (fb) { fb.style.display = 'block'; fb.style.color = '#f87171'; fb.innerText = 'Error: ' + err.message; }
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = '💾 Save Platform Settings'; }
  }
}
window.handleSaveSettings = handleSaveSettings;

async function saveAdminCollectionUpi() {
  const vpa = document.getElementById('adminImapUpiVpa')?.value.trim();
  const name = document.getElementById('adminImapMerchantName')?.value.trim();
  const fb = document.getElementById('adminImapUpiFeedback');

  if (!vpa || !name) {
    if (fb) {
      fb.style.display = 'block';
      fb.style.background = 'rgba(239, 68, 68, 0.15)';
      fb.style.color = '#f87171';
      fb.innerText = '⚠️ Please enter both UPI VPA and Business Name.';
    }
    return;
  }

  if (fb) fb.style.display = 'none';

  try {
    const res = await fetch(API_BASE + '/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upiVpa: vpa, merchantName: name })
    });
    const data = await res.json();
    if (fb) {
      fb.style.display = 'block';
      if (data.success) {
        fb.style.background = 'rgba(16, 185, 129, 0.15)';
        fb.style.border = '1px solid rgba(16, 185, 129, 0.3)';
        fb.style.color = '#34d399';
        fb.innerHTML = `✅ <b>Admin Collection UPI Saved!</b> Plan purchases will now go directly to <b>${vpa}</b>.`;
        const elVpa = document.getElementById('configMerchantVpa');
        const elName = document.getElementById('configMerchantName');
        if (elVpa) elVpa.value = vpa;
        if (elName) elName.value = name;
      } else {
        fb.style.background = 'rgba(239, 68, 68, 0.15)';
        fb.style.color = '#f87171';
        fb.innerText = '❌ ' + (data.error || 'Failed');
      }
    }
  } catch (err) {
    if (fb) { fb.style.display = 'block'; fb.style.color = '#f87171'; fb.innerText = 'Error: ' + err.message; }
  }
}
window.saveAdminCollectionUpi = saveAdminCollectionUpi;

// 9. Scan Inbox Now Button (Diagnostic live tester)
uiBtnScanInbox.addEventListener('click', async () => {
  uiBtnScanInbox.disabled = true;
  uiBtnScanInbox.innerText = 'Scanning...';
  inboxScanResults.innerHTML = '<div style="text-align:center; color: var(--text-dim); padding: 14px;">Connecting to Gmail & scanning latest emails...</div>';

  try {
    const res = await fetch(API_BASE + '/api/admin/imap/recent');
    const data = await res.json();

    if (data.success && data.emails && data.emails.length > 0) {
      inboxScanResults.innerHTML = data.emails.map(em => {
        const hasPayment = em.parsedPayment !== null;
        return `
          <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-card); border-radius: 8px; padding: 10px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 600; font-size: 12px; color: #fff;">${em.subject}</span>
              <span class="badge ${hasPayment ? 'PAID' : 'PENDING'}" style="font-size: 10px;">
                ${hasPayment ? `Parsed: ₹${em.parsedPayment.amount}` : 'No Payment Pattern'}
              </span>
            </div>
            <div style="font-size: 11px; color: var(--text-dim);">From: ${em.from}</div>
            ${hasPayment ? `
              <div style="font-size: 11px; color: var(--accent-green); margin-top: 4px; font-family: 'JetBrains Mono';">
                UTR: ${em.parsedPayment.utr} | Sender: ${em.parsedPayment.sender}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    } else {
      inboxScanResults.innerHTML = `<div style="color: var(--accent-amber); font-size: 12px; padding: 14px; text-align: center;">${data.error || 'No matching emails found or IMAP credentials not connected yet.'}</div>`;
    }
  } catch (err) {
    inboxScanResults.innerHTML = `<div style="color: #ef4444; font-size: 12px; padding: 14px; text-align: center;">Error scanning: ${err.message}</div>`;
  } finally {
    uiBtnScanInbox.disabled = false;
    uiBtnScanInbox.innerText = '📥 Scan Inbox Now';
  }
});

// 10. WebSockets Realtime Sync
function initSocket() {
  if (typeof io === 'undefined') return;

  socket = io();

  socket.on('connect', () => {
    console.log('[Socket Admin] Connected.');
    socket.emit('join_admin');
  });

  socket.on('new_order', () => {
    loadStats();
    loadOrders(currentFilter);
    loadAdminUsers();
    loadAdminSubscriptions();
    loadApiLogs();
  });

  socket.on('payment_event', () => {
    loadStats();
    loadOrders(currentFilter);
    loadPayments();
    loadLedger();
    loadAdminUsers();
    loadAdminSubscriptions();
    loadApiLogs();
  });

  socket.on('order_expired', () => {
    loadStats();
    loadOrders(currentFilter);
    loadApiLogs();
  });

  socket.on('imap_status', (status) => {
    updateImapPill(status);
  });

  socket.on('api_log', () => {
    loadApiLogs();
  });
}

// 10b. Load & Render Request Notes & API Logs
async function loadApiLogs() {
  try {
    const res = await fetch('/api/admin/logs?limit=50');
    const data = await res.json();
    if (!data.success) return;
    renderApiLogs(data.logs);
  } catch (err) {
    console.error('Failed to load api logs:', err);
  }
}
window.loadApiLogs = loadApiLogs;

function renderApiLogs(logs) {
  const tableBody = document.getElementById('apiLogsTableBody');
  const countSpan = document.getElementById('apiLogsCount');
  const miniFeed = document.getElementById('dashboardMiniLogsFeed');

  if (countSpan) countSpan.innerText = `${logs.length} entries`;

  // Render main logs table
  if (tableBody) {
    if (!logs || logs.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-dim); padding: 30px;">
            No requests or activity recorded yet. Requests from https://dealsbyshiv.web.app will show up here live!
          </td>
        </tr>
      `;
    } else {
      tableBody.innerHTML = logs.map(l => {
        const isSuccess = l.status === 'SUCCESS';
        const isFailed = l.status === 'FAILED';
        const badgeClass = isSuccess ? 'PAID' : (isFailed ? 'EXPIRED' : 'PENDING');
        const timeStr = new Date(l.created_at).toLocaleTimeString();
        const dateStr = new Date(l.created_at).toLocaleDateString();

        return `
          <tr>
            <td style="font-size: 11.5px; color: var(--text-muted); font-family: 'JetBrains Mono';">
              <div>${timeStr}</div>
              <div style="font-size: 10px; color: var(--text-dim);">${dateStr}</div>
            </td>
            <td><span class="badge ${badgeClass}">${l.status}</span></td>
            <td><span style="font-size: 11px; font-weight: 600; color: var(--primary);">${l.event_type}</span></td>
            <td>
              <div style="font-weight: 600; font-size: 13px; color: #fff;">${escapeHtml(l.title)}</div>
              <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">${escapeHtml(l.details || '')}</div>
            </td>
            <td style="font-size: 11px; color: var(--text-dim); font-family: 'JetBrains Mono';">
              <div style="color: var(--primary);">${escapeHtml(l.origin || 'Direct')}</div>
              <div style="font-size: 10px;">${escapeHtml(l.client_ip || '')}</div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // Render Dashboard Mini Feed
  if (miniFeed) {
    if (!logs || logs.length === 0) {
      miniFeed.innerHTML = `
        <div style="font-size: 12px; color: var(--text-dim); text-align: center; padding: 15px;">
          Waiting for requests from https://dealsbyshiv.web.app...
        </div>
      `;
    } else {
      miniFeed.innerHTML = logs.slice(0, 6).map(l => {
        const isSuccess = l.status === 'SUCCESS';
        const badgeColor = isSuccess ? 'var(--accent-green)' : (l.status === 'FAILED' ? 'var(--accent-red)' : 'var(--accent-amber)');
        return `
          <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-card); border-radius: var(--radius-sm); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${badgeColor}; flex-shrink: 0;"></span>
              <div style="min-width: 0;">
                <div style="font-size: 12.5px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(l.title)}</div>
                <div style="font-size: 11px; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(l.details || '')}</div>
              </div>
            </div>
            <div style="text-align: right; flex-shrink: 0;">
              <span style="font-size: 10px; color: var(--text-dim);">${new Date(l.created_at).toLocaleTimeString()}</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}

// 11. Load Financial Ledger (Hisab-Kitab)
async function loadLedger() {
  try {
    const res = await fetch(API_BASE + '/api/admin/ledger');
    const data = await res.json();
    if (!data.success || !data.ledger) return;

    const { totalCollected, totalTransactions, topSenders, payments } = data.ledger;

    // Metrics
    ledgerTotalMoney.innerText = `₹ ${Number(totalCollected).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    ledgerTotalCount.innerText = totalTransactions;

    if (topSenders && topSenders.length > 0) {
      ledgerTopCustomer.innerText = topSenders[0].sender;
      ledgerTopCustomerAmount.innerText = `₹${Number(topSenders[0].total).toFixed(2)} (${topSenders[0].count} payments)`;

      // Render Top Senders Breakdown
      ledgerTopSendersList.innerHTML = topSenders.map((s, idx) => {
        const pct = totalCollected > 0 ? ((s.total / totalCollected) * 100).toFixed(0) : 0;
        return `
          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-card); border-radius: var(--radius-sm); padding: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-weight: 700; color: #fff; font-size: 13px;">
                #${idx + 1} ${s.sender}
              </span>
              <span style="font-weight: 700; color: var(--accent-green); font-size: 14px;">
                ₹ ${Number(s.total).toFixed(2)}
              </span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-dim);">
              <span>${s.count} transactions</span>
              <span>${pct}% of total</span>
            </div>
          </div>
        `;
      }).join('');
    } else {
      ledgerTopCustomer.innerText = '-';
      ledgerTopCustomerAmount.innerText = 'No payments recorded yet';
      ledgerTopSendersList.innerHTML = `
        <div style="text-align: center; color: var(--text-dim); padding: 20px; font-size: 13px;">
          No customer history recorded yet. Sync with Gmail or paste an email.
        </div>
      `;
    }

    // Render Full Historical Ledger Table
    if (payments && payments.length > 0) {
      ledgerTableBody.innerHTML = payments.map(p => {
        return `
          <tr>
            <td style="font-size: 12px; color: var(--text-muted);">${new Date(p.received_at).toLocaleString()}</td>
            <td style="font-weight: 700; font-size: 15px; color: var(--accent-green);">₹ ${Number(p.amount).toFixed(2)}</td>
            <td style="font-weight: 600;">${p.sender || 'Unknown'}</td>
            <td style="font-family: 'JetBrains Mono'; font-size: 12px; color: #38bdf8;">${p.utr}</td>
            <td style="font-size: 12px; color: var(--text-dim);">${p.source}</td>
            <td><span class="badge PAID">VERIFIED IN LEDGER</span></td>
          </tr>
        `;
      }).join('');
    } else {
      ledgerTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-dim); padding: 30px;">
            No historical payments in ledger. Click "Sync Past Payments from Gmail" above!
          </td>
        </tr>
      `;
    }

  } catch (err) {
    console.error('Failed to load ledger:', err);
  }
}
window.loadLedger = loadLedger;

// 12. 1-Click Sync Past Payments from Gmail
btnSyncAllEmails.addEventListener('click', async () => {
  btnSyncAllEmails.disabled = true;
  btnSyncAllEmails.innerText = '⏳ Syncing All Past Emails from Gmail...';
  syncFeedback.style.display = 'block';
  syncFeedback.style.background = 'rgba(56, 189, 248, 0.15)';
  syncFeedback.style.border = '1px solid rgba(56, 189, 248, 0.3)';
  syncFeedback.style.color = '#38bdf8';
  syncFeedback.innerHTML = 'Connecting to Gmail inbox and scanning past payment receipts... Please wait 5-10 seconds.';

  try {
    const res = await fetch(API_BASE + '/api/admin/imap/sync-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxEmails: 100 })
    });
    const data = await res.json();

    if (data.success) {
      syncFeedback.style.background = 'rgba(16, 185, 129, 0.15)';
      syncFeedback.style.border = '1px solid rgba(16, 185, 129, 0.3)';
      syncFeedback.style.color = '#34d399';
      syncFeedback.innerHTML = `
        🎉 <b>Hisab-Kitab Complete!</b><br>
        Scanned <b>${data.scannedCount}</b> past emails.<br>
        Found & Imported <b>${data.importedCount}</b> payments totaling <b>₹${data.totalAmount.toFixed(2)}</b>!<br>
        (${data.duplicateCount} already existed in ledger).
      `;
      loadLedger();
      loadStats();
      loadPayments();
    } else {
      syncFeedback.style.background = 'rgba(239, 68, 68, 0.15)';
      syncFeedback.style.border = '1px solid rgba(239, 68, 68, 0.3)';
      syncFeedback.style.color = '#f87171';
      syncFeedback.innerHTML = `❌ <b>Sync Failed:</b><br>${data.error}`;
    }
  } catch (err) {
    syncFeedback.style.background = 'rgba(239, 68, 68, 0.15)';
    syncFeedback.style.border = '1px solid rgba(239, 68, 68, 0.3)';
    syncFeedback.style.color = '#f87171';
    syncFeedback.innerText = 'Network error: ' + err.message;
  } finally {
    btnSyncAllEmails.disabled = false;
    btnSyncAllEmails.innerText = '🔄 1-Click Sync Past Payments from Gmail';
  }
});

// 13. Quick Paste Email to Parse & Add to Ledger
pasteEmailForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const rawText = pasteEmailInput.value.trim();
  if (!rawText) return;

  btnParsePaste.disabled = true;
  btnParsePaste.innerText = 'Parsing...';
  pasteFeedback.style.display = 'none';

  try {
    const res = await fetch(API_BASE + '/api/admin/ledger/parse-paste', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: rawText })
    });
    const data = await res.json();

    pasteFeedback.style.display = 'block';
    if (data.success) {
      pasteFeedback.style.background = 'rgba(16, 185, 129, 0.15)';
      pasteFeedback.style.border = '1px solid rgba(16, 185, 129, 0.3)';
      pasteFeedback.style.color = '#34d399';
      pasteFeedback.innerHTML = `✅ <b>${data.message}</b>`;
      pasteEmailInput.value = '';
      loadLedger();
      loadStats();
      loadPayments();
    } else {
      pasteFeedback.style.background = 'rgba(239, 68, 68, 0.15)';
      pasteFeedback.style.border = '1px solid rgba(239, 68, 68, 0.3)';
      pasteFeedback.style.color = '#f87171';
      pasteFeedback.innerHTML = `❌ ${data.error}`;
    }
  } catch (err) {
    pasteFeedback.style.display = 'block';
    pasteFeedback.style.background = 'rgba(239, 68, 68, 0.15)';
    pasteFeedback.style.color = '#f87171';
    pasteFeedback.innerText = 'Error parsing: ' + err.message;
  } finally {
    btnParsePaste.disabled = false;
    btnParsePaste.innerText = '⚡ Parse & Add to Ledger';
  }
});

// ==================== 14. API KEY MANAGEMENT & INTEGRATION ==================== //
let currentApiKey = '';
let currentKeyCreated = null;
let currentRequireApiKey = true;
let isKeyVisible = false;
let activeSnippetLang = 'curl';

async function loadApiKeyDetails() {
  try {
    const res = await fetch(API_BASE + '/api/admin/api-key');
    const data = await res.json();
    if (!data.success) return;

    currentApiKey = data.apiKey;
    currentRequireApiKey = data.requireApiKey;
    currentKeyCreated = data.createdAt;

    const input = document.getElementById('uiApiKeyInput');
    if (input) {
      input.value = currentApiKey;
      input.type = isKeyVisible ? 'text' : 'password';
    }

    const createdLabel = document.getElementById('apiKeyCreatedAt');
    if (createdLabel && data.createdAt) {
      createdLabel.innerText = `Created: ${new Date(data.createdAt).toLocaleDateString()} ${new Date(data.createdAt).toLocaleTimeString()}`;
    }

    const toggle = document.getElementById('uiToggleRequireApiKey');
    if (toggle) {
      toggle.checked = currentRequireApiKey;
    }

    const badge = document.getElementById('apiKeyStatusBadge');
    if (badge) {
      badge.className = currentRequireApiKey ? 'badge badge-success' : 'badge badge-pending';
      badge.innerText = currentRequireApiKey ? '🟢 Strictly Enforced' : '🔓 Open Testing';
    }

    renderCurrentSnippet();
  } catch (err) {
    console.error('Failed to load API key details:', err);
  }
}
window.loadApiKeyDetails = loadApiKeyDetails;

function toggleApiKeyVisibility() {
  const input = document.getElementById('uiApiKeyInput');
  const btn = document.getElementById('btnToggleApiKeyVisibility');
  if (!input) return;

  isKeyVisible = !isKeyVisible;
  input.type = isKeyVisible ? 'text' : 'password';
  btn.innerText = isKeyVisible ? '🙈' : '👁️';
}
window.toggleApiKeyVisibility = toggleApiKeyVisibility;

function copyApiKeyToClipboard() {
  if (!currentApiKey) return;
  navigator.clipboard.writeText(currentApiKey).then(() => {
    const feedback = document.getElementById('apiKeyCopyFeedback');
    if (feedback) {
      feedback.style.display = 'block';
      setTimeout(() => {
        feedback.style.display = 'none';
      }, 2500);
    }
  }).catch(err => {
    console.error('Clipboard copy error:', err);
  });
}
window.copyApiKeyToClipboard = copyApiKeyToClipboard;

async function confirmRegenerateApiKey() {
  const confirmed = confirm("⚠️ ARE YOU SURE?\\n\\nRegenerating this API Key will immediately invalidate the current key. Any external apps or websites using the old key will fail until updated.");
  if (!confirmed) return;

  try {
    const res = await fetch('/api/admin/api-key/regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      alert(`🎉 New API Key Generated!\\n\\nKey: ${data.apiKey}\\n\\nPlease copy and update your applications.`);
      loadApiKeyDetails();
    } else {
      alert(`❌ Error: ${data.error}`);
    }
  } catch (err) {
    alert('Failed to regenerate API Key: ' + err.message);
  }
}
window.confirmRegenerateApiKey = confirmRegenerateApiKey;

async function toggleRequireApiKey(isRequired) {
  try {
    const res = await fetch('/api/admin/api-key/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ required: isRequired })
    });
    const data = await res.json();
    if (data.success) {
      const badge = document.getElementById('apiKeyStatusBadge');
      if (badge) {
        badge.className = data.requireApiKey ? 'badge badge-success' : 'badge badge-pending';
        badge.innerText = data.requireApiKey ? '🟢 Strictly Enforced' : '🔓 Open Testing';
      }
    }
  } catch (err) {
    console.error('Failed to toggle require API key:', err);
  }
}
window.toggleRequireApiKey = toggleRequireApiKey;

function switchCodeSnippet(lang) {
  activeSnippetLang = lang;
  document.getElementById('codeTabCurl')?.classList.toggle('active', lang === 'curl');
  document.getElementById('codeTabNodejs')?.classList.toggle('active', lang === 'nodejs');
  document.getElementById('codeTabPython')?.classList.toggle('active', lang === 'python');
  document.getElementById('codeTabPhp')?.classList.toggle('active', lang === 'php');
  renderCurrentSnippet();
}
window.switchCodeSnippet = switchCodeSnippet;

function renderCurrentSnippet() {
  const box = document.getElementById('codeSnippetBox');
  if (!box) return;

  const origin = window.location.origin;
  const key = currentApiKey || 'pg_live_YOUR_API_KEY_HERE';

  if (activeSnippetLang === 'curl') {
    box.innerText = `curl -X POST "${origin}/api/orders/create" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${key}" \\
  -d '{
    "amount": 500.00,
    "customerName": "Rahul Sharma",
    "customerPhone": "9876543210",
    "webhookUrl": "https://your-domain.com/webhook"
  }'`;
  } else if (activeSnippetLang === 'nodejs') {
    box.innerText = `// Node.js (v18+ with native fetch)
const response = await fetch('${origin}/api/orders/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': '${key}'
  },
  body: JSON.stringify({
    amount: 500.00,
    customerName: 'Rahul Sharma',
    customerPhone: '9876543210',
    webhookUrl: 'https://your-domain.com/webhook'
  })
});

const data = await response.json();
if (data.success) {
  console.log('Order Code:', data.order.orderCode);
  console.log('Redirect User to Checkout Session:', data.order.checkoutUrl);
  console.log('Direct Payment Link:', data.order.paymentUrl);
  console.log('UPI Intent URI:', data.order.upiUri);
}`;
  } else if (activeSnippetLang === 'python') {
    box.innerText = `import requests

url = "${origin}/api/orders/create"
headers = {
    "Content-Type": "application/json",
    "x-api-key": "${key}"
}
payload = {
    "amount": 500.00,
    "customerName": "Rahul Sharma",
    "customerPhone": "9876543210",
    "webhookUrl": "https://your-domain.com/webhook"
}

response = requests.post(url, json=payload, headers=headers)
data = response.json()

if data.get("success"):
    print("Order Code:", data["order"]["orderCode"])
    print("Checkout URL:", data["order"]["checkoutUrl"])`;
  } else if (activeSnippetLang === 'php') {
    box.innerText = `<?php
$curl = curl_init();

$payload = json_encode([
    "amount" => 500.00,
    "customerName" => "Rahul Sharma",
    "customerPhone" => "9876543210",
    "webhookUrl" => "https://your-domain.com/webhook"
]);

curl_setopt_array($curl, [
    CURLOPT_URL => "${origin}/api/orders/create",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST => "POST",
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_HTTPHEADER => [
        "Content-Type: application/json",
        "x-api-key: ${key}"
    ],
]);

$response = curl_exec($curl);
curl_close($curl);

$data = json_decode($response, true);
if ($data['success']) {
    echo "Order Code: " . $data['order']['orderCode'] . "\\n";
    echo "Checkout URL: ${origin}" . $data['order']['checkoutUrl'] . "\\n";
}`;
  }
}

function copyCurrentSnippet() {
  const box = document.getElementById('codeSnippetBox');
  if (!box) return;
  navigator.clipboard.writeText(box.innerText).then(() => {
    alert('✅ Code snippet copied to clipboard!');
  });
}
window.copyCurrentSnippet = copyCurrentSnippet;

async function testApiKeyOrderCreation() {
  const amountInput = document.getElementById('testOrderAmount');
  const resultBox = document.getElementById('apiTestConsoleResult');
  const amt = parseFloat(amountInput.value) || 10;

  resultBox.style.display = 'block';
  resultBox.innerText = 'Sending HTTP POST request with x-api-key...';

  try {
    const start = Date.now();
    const res = await fetch(API_BASE + '/api/orders/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': currentApiKey
      },
      body: JSON.stringify({
        amount: amt,
        customerName: 'API Key Test Runner',
        customerPhone: '9999999999'
      })
    });
    const duration = Date.now() - start;
    const json = await res.json();

    resultBox.innerText = `HTTP ${res.status} ${res.statusText} (${duration}ms)\\n` + JSON.stringify(json, null, 2);
    if (json.success) {
      loadStats();
      loadOrders(currentFilter);
    }
  } catch (err) {
    resultBox.innerText = 'Network Error: ' + err.message;
  }
}
window.testApiKeyOrderCreation = testApiKeyOrderCreation;

function initDashboardData() {
  loadAdminUsers();
  loadAdminSubscriptions();
  loadStats();
  loadOrders('ALL');
  loadPayments();
  loadLedger();
  loadApiKeyDetails();
  loadDomainKeysList();
  loadApiLogs();
  initSocket();
}

function refreshAdminAll() {
  loadAdminUsers();
  loadAdminSubscriptions();
  loadStats();
  loadOrders(currentFilter);
  loadPayments();
  loadLedger();
  loadApiKeyDetails();
  loadDomainKeysList();
  loadApiLogs();
}
window.refreshAdminAll = refreshAdminAll;

async function checkAdminAuthOnStartup() {
  const savedKey = getAdminMasterKey();
  if (!savedKey) {
    showMasterKeyLockScreen();
    return;
  }

  try {
    const res = await originalFetch((API_BASE || '') + '/api/admin/auth/verify-master-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ masterKey: savedKey })
    });
    const data = await res.json();
    if (data.success) {
      hideMasterKeyLockScreen();
      initDashboardData();
    } else {
      if (res.status === 401) {
        localStorage.removeItem('admin_master_key');
        sessionStorage.removeItem('gateway_master_key');
      }
      showMasterKeyLockScreen();
    }
  } catch (_) {
    // If transient network error / Render spin-up, do NOT wipe saved key; unlock and let requests sync
    hideMasterKeyLockScreen();
    initDashboardData();
  }
}

// Verify Master Key authentication before loading any data
checkAdminAuthOnStartup();


// ==========================================
// MULTI-DOMAIN API KEY MANAGEMENT LOGIC
// ==========================================
let allDomainKeys = [];

function generateRandomKeyToInput() {
  const chars = '0123456789abcdef';
  let rand = '';
  for (let i = 0; i < 36; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)];
  }
  const input = document.getElementById('inputNewKeyValue');
  if (input) input.value = 'pg_live_' + rand;
}
window.generateRandomKeyToInput = generateRandomKeyToInput;

async function loadDomainKeysList() {
  try {
    const res = await fetch(API_BASE + '/api/admin/domain-keys');
    const data = await res.json();
    if (!data.success) return;

    allDomainKeys = data.keys || [];
    currentRequireApiKey = data.requireApiKey;

    const countLabel = document.getElementById('domainKeysCount');
    if (countLabel) countLabel.innerText = allDomainKeys.length;

    const toggle = document.getElementById('uiToggleRequireApiKey');
    if (toggle) toggle.checked = currentRequireApiKey;

    const badge = document.getElementById('apiKeyStatusBadge');
    if (badge) {
      badge.className = currentRequireApiKey ? 'badge badge-success' : 'badge badge-pending';
      badge.innerText = currentRequireApiKey ? '🟢 Strictly Enforced' : '🔓 Open Testing';
    }

    // Populate test selector
    const testSelect = document.getElementById('testDomainKeySelect');
    if (testSelect) {
      testSelect.innerHTML = '<option value="">Select Domain Key to Test</option>';
      allDomainKeys.forEach(k => {
        const opt = document.createElement('option');
        opt.value = k.apiKey;
        opt.innerText = `${k.domain} (${k.keyName || 'Store'})`;
        testSelect.appendChild(opt);
      });
      if (allDomainKeys.length > 0) {
        testSelect.selectedIndex = 1;
        currentApiKey = allDomainKeys[0].apiKey;
      }
    }

    renderDomainKeysCards();
    renderCurrentSnippet();
  } catch (err) {
    console.error('Failed to load domain keys:', err);
  }
}
window.loadDomainKeysList = loadDomainKeysList;

function renderDomainKeysCards() {
  const container = document.getElementById('domainKeysListContainer');
  if (!container) return;

  if (allDomainKeys.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-dim); padding: 24px; font-size: 12px; background: rgba(255,255,255,0.02); border-radius: 8px;">Koi API key nahi hai. Upar diye gaye form se nayi key banayein.</div>';
    return;
  }

  container.innerHTML = allDomainKeys.map(k => {
    const createdStr = k.createdAt ? new Date(k.createdAt).toLocaleDateString() : 'Active';
    const isWildcard = k.domain === '*';
    const domainBadgeColor = isWildcard ? '#a855f7' : '#38bdf8';

    return `
      <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-card); border-radius: var(--radius-sm); padding: 12px; position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
          <div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 600; color: ${domainBadgeColor}; background: rgba(56, 189, 248, 0.1); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(56, 189, 248, 0.2);">
                🌐 ${k.domain}
              </span>
              <span style="font-size: 12px; font-weight: 500; color: #fff;">${k.keyName || 'Store Key'}</span>
            </div>
            <div style="font-size: 10px; color: var(--text-dim); margin-top: 3px;">Created: ${createdStr}</div>
          </div>
          <button class="btn btn-secondary" onclick="deleteDomainKeyById(${k.id}, '${k.domain}')" style="padding: 3px 8px; font-size: 11px; color: #f87171; border-color: rgba(239, 68, 68, 0.3);" title="Revoke Key">
            🗑️ Revoke
          </button>
        </div>

        <div style="display: flex; gap: 6px; align-items: center; margin-top: 8px;">
          <input type="password" id="domainKeyInput_${k.id}" class="form-control" readonly style="font-family: 'JetBrains Mono', monospace; font-size: 11.5px; padding: 4px 8px; height: 32px; color: var(--primary);" value="${k.apiKey}">
          <button class="btn btn-secondary" onclick="toggleDomainKeyVisibility(${k.id})" style="padding: 0 8px; height: 32px;" title="Show/Hide">
            👁️
          </button>
          <button class="btn btn-primary" onclick="copyDomainKeyToClip('${k.apiKey}', this)" style="padding: 0 10px; height: 32px; font-size: 11px;" title="Copy Key">
            📋 Copy
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function toggleDomainKeyVisibility(id) {
  const input = document.getElementById(`domainKeyInput_${id}`);
  if (input) {
    input.type = input.type === 'password' ? 'text' : 'password';
  }
}
window.toggleDomainKeyVisibility = toggleDomainKeyVisibility;

function copyDomainKeyToClip(key, btn) {
  navigator.clipboard.writeText(key).then(() => {
    const orig = btn.innerText;
    btn.innerText = '✅ Copied!';
    setTimeout(() => { btn.innerText = orig; }, 2000);
  });
}
window.copyDomainKeyToClip = copyDomainKeyToClip;

async function handleCreateDomainKey(e) {
  e.preventDefault();
  const domain = document.getElementById('inputNewKeyDomain').value.trim();
  const keyName = document.getElementById('inputNewKeyLabel').value.trim();
  const apiKey = document.getElementById('inputNewKeyValue').value.trim();
  const feedback = document.getElementById('addKeyFeedback');
  const btn = document.getElementById('btnSubmitNewKey');

  btn.disabled = true;
  btn.innerText = 'Saving...';

  try {
    const res = await fetch(API_BASE + '/api/admin/domain-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, keyName, apiKey })
    });
    const data = await res.json();

    feedback.style.display = 'block';
    if (data.success) {
      feedback.style.background = 'rgba(16, 185, 129, 0.15)';
      feedback.style.color = '#34d399';
      feedback.innerText = '✅ ' + data.message;
      document.getElementById('inputNewKeyDomain').value = '';
      document.getElementById('inputNewKeyLabel').value = '';
      document.getElementById('inputNewKeyValue').value = '';
      await loadDomainKeysList();
      setTimeout(() => { feedback.style.display = 'none'; }, 4000);
    } else {
      feedback.style.background = 'rgba(239, 68, 68, 0.15)';
      feedback.style.color = '#f87171';
      feedback.innerText = '❌ ' + data.error;
    }
  } catch (err) {
    feedback.style.display = 'block';
    feedback.style.background = 'rgba(239, 68, 68, 0.15)';
    feedback.style.color = '#f87171';
    feedback.innerText = 'Error: ' + err.message;
  } finally {
    btn.disabled = false;
    btn.innerText = '💾 Register & Activate Domain Key';
  }
}
window.handleCreateDomainKey = handleCreateDomainKey;

async function deleteDomainKeyById(id, domain) {
  const confirmed = confirm(`⚠️ Are you sure you want to revoke the API Key for "${domain}"?\n\nAny store or app using this key will immediately stop working.`);
  if (!confirmed) return;

  try {
    const res = await fetch(`${API_BASE}/api/admin/domain-keys/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      await loadDomainKeysList();
    } else {
      alert('Failed: ' + data.error);
    }
  } catch (err) {
    alert('Network error: ' + err.message);
  }
}
window.deleteDomainKeyById = deleteDomainKeyById;

// Hook domain keys load into the main tab switch
const origSwitchTab = window.switchTab;
window.switchTab = function(tabId) {
  if (typeof origSwitchTab === 'function') origSwitchTab(tabId);
  if (tabId === 'apikeys') {
    loadDomainKeysList();
  }
};

async function testApiKeyOrderCreation() {
  const resultBox = document.getElementById('apiTestConsoleResult');
  const amountInput = document.getElementById('testOrderAmount');
  const testSelect = document.getElementById('testDomainKeySelect');
  const keyToUse = (testSelect && testSelect.value) ? testSelect.value : currentApiKey;

  resultBox.style.display = 'block';
  resultBox.innerHTML = '<span style="color: var(--text-dim);">Connecting to /api/orders/create with selected Domain Key...</span>';

  try {
    const res = await fetch(API_BASE + '/api/orders/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': keyToUse,
        'x-admin-test': 'true'
      },
      body: JSON.stringify({
        amount: parseFloat(amountInput.value) || 10,
        customerName: 'Admin Authenticator Test',
        customerPhone: '9999999999'
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      resultBox.innerHTML = `<span style="color: var(--accent-green); font-weight: 600;">✅ HTTP ${res.status} OK - Order Created Successfully!</span>\n\n` +
        `Order Code:    ${data.order.orderCode}\n` +
        `Amount:        ₹${data.order.amount}\n` +
        `Checkout URL:  ${data.checkoutUrl}\n` +
        `Key Used:      ${keyToUse.slice(0, 10)}...\n` +
        `Domain Auth:   ACCEPTED`;
    } else {
      resultBox.innerHTML = `<span style="color: var(--accent-red); font-weight: 600;">❌ HTTP ${res.status} ${data.error || 'Authentication Failed'}</span>\n\n` +
        JSON.stringify(data, null, 2);
    }
  } catch (err) {
    resultBox.innerHTML = `<span style="color: var(--accent-red);">Network Error: ${err.message}</span>`;
  }
}
window.testApiKeyOrderCreation = testApiKeyOrderCreation;


// ==========================================
// FIREBASE GOOGLE AUTH & ACCESS CONTROL
// ==========================================
const REQUIRED_ADMIN_EMAIL = 'hapa1929@gmail.com';

const firebaseConfig = {
  apiKey: "AIzaSyCdeUo_GtvqTlgq-gXG71wtPPehC2mCOpw",
  authDomain: "upigateway-ccaa4.firebaseapp.com",
  databaseURL: "https://upigateway-ccaa4-default-rtdb.firebaseio.com",
  projectId: "upigateway-ccaa4",
  storageBucket: "upigateway-ccaa4.firebasestorage.app",
  messagingSenderId: "493744816437",
  appId: "1:493744816437:web:6316a146951e7f0b8d0c7c",
  measurementId: "G-096R1MKTV2"
};

let fbApp = null;
let fbAuth = null;

try {
  if (typeof firebase !== 'undefined') {
    fbApp = firebase.initializeApp(firebaseConfig);
    fbAuth = firebase.auth();
  }
} catch (e) {
  console.warn('Firebase init:', e.message);
}

// Auto-check stored session or Firebase Auth state
(function checkStoredAuth() {
  const storedAuth = sessionStorage.getItem('gateway_admin_auth');
  const storedEmail = (sessionStorage.getItem('gateway_admin_email') || '').toLowerCase().trim();

  if (storedAuth === 'google' && storedEmail === REQUIRED_ADMIN_EMAIL.toLowerCase()) {
    updateAdminProfileUI(storedEmail);
    return;
  }

  // If no valid session, check Firebase Auth
  if (fbAuth) {
    fbAuth.onAuthStateChanged((user) => {
      if (!user) {
        window.location.href = '/login';
      } else {
        const userEmail = (user.email || '').toLowerCase().trim();
        if (userEmail === REQUIRED_ADMIN_EMAIL.toLowerCase()) {
          sessionStorage.setItem('gateway_admin_auth', 'google');
          sessionStorage.setItem('gateway_admin_email', userEmail);
          sessionStorage.setItem('gateway_master_key', 'shivambhatt@admin');
          localStorage.setItem('admin_master_key', 'shivambhatt@admin');
          updateAdminProfileUI(userEmail, user.photoURL, user.displayName);
        } else {
          // Regular merchant entered /admin -> redirect to user panel
          window.location.href = '/user';
        }
      }
    });
  } else {
    window.location.href = '/login';
  }
})();

function updateAdminProfileUI(email, photo, name) {
  const avatar = document.getElementById('adminSidebarAvatar');
  const nameEl = document.getElementById('adminSidebarName');
  const emailEl = document.getElementById('adminSidebarEmail');
  if (avatar && photo) avatar.src = photo;
  if (nameEl && name) nameEl.innerText = name;
  if (emailEl) emailEl.innerText = email;
}

async function handleAdminLogout() {
  lockAdminDashboard();
}
window.handleAdminLogout = handleAdminLogout;

// ==========================================
// ADMIN USER TRACKING & SUBSCRIPTIONS
// ==========================================
let adminUsersList = [];
let currentUserFilter = 'ALL';

async function loadAdminUsers() {
  const tbody = document.getElementById('adminUsersTableBody');
  const countEl = document.getElementById('adminUsersCount');
  if (!tbody) return;

  try {
    const res = await fetch((API_BASE || '') + '/api/v1/admin/users', {
      headers: {
        'x-admin-key': getAdminMasterKey()
      }
    });
    const data = await res.json();
    if (!data.success || !data.users) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--accent-red); padding: 24px;">Failed to load user directory.</td></tr>';
      return;
    }

    adminUsersList = data.users || [];

    // Calculate Analytics & Metrics
    const totalUsers = adminUsersList.length;
    const paidUsers = adminUsersList.filter(u => u.plan && u.plan !== 'NONE').length;
    const freeUsers = totalUsers - paidUsers;
    const convRate = totalUsers > 0 ? ((paidUsers / totalUsers) * 100).toFixed(1) : '0.0';
    const lockedWebsites = adminUsersList.filter(u => u.is_website_locked || (u.website_url && u.website_url.trim().length > 0)).length;

    // Update Metric Cards
    const elTotal = document.getElementById('metricAdminUsersTotal');
    const elPaid = document.getElementById('metricAdminUsersPaid');
    const elSubRate = document.getElementById('metricAdminSubRate');
    const elFree = document.getElementById('metricAdminUsersFree');
    const elConv = document.getElementById('metricAdminConversion');
    const elLocked = document.getElementById('metricAdminLockedWebsites');

    if (elTotal) elTotal.innerText = totalUsers;
    if (elPaid) elPaid.innerText = paidUsers;
    if (elSubRate) elSubRate.innerText = `${convRate}% of registered merchants`;
    if (elFree) elFree.innerText = freeUsers;
    if (elConv) elConv.innerText = `${convRate}%`;
    if (elLocked) elLocked.innerText = lockedWebsites;

    // Update Topbar Badges
    const tbTotal = document.getElementById('topbarStatTotalUsers');
    const tbPaid = document.getElementById('topbarStatPaidUsers');
    const tbFree = document.getElementById('topbarStatFreeUsers');
    const badgeTotal = document.getElementById('badgeTotalUsersCount');

    if (tbTotal) tbTotal.innerText = totalUsers;
    if (tbPaid) tbPaid.innerText = paidUsers;
    if (tbFree) tbFree.innerText = freeUsers;
    if (badgeTotal) badgeTotal.innerText = totalUsers;

    filterAdminUsersTable();
  } catch (err) {
    console.error('Failed to load admin users:', err);
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--accent-red); padding: 24px;">Network error loading user records.</td></tr>';
  }
}
window.loadAdminUsers = loadAdminUsers;

function filterAdminUsersTable() {
  const searchInput = document.getElementById('adminUsersSearchInput');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  let filtered = adminUsersList;

  // Filter by Plan Status
  if (currentUserFilter === 'PAID') {
    filtered = filtered.filter(u => u.plan && u.plan !== 'NONE');
  } else if (currentUserFilter === 'FREE') {
    filtered = filtered.filter(u => !u.plan || u.plan === 'NONE');
  }

  // Filter by Search Query
  if (query) {
    filtered = filtered.filter(u => {
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const upi = (u.upi_vpa || '').toLowerCase();
      const plan = (u.plan || '').toLowerCase();
      const website = (u.website_url || '').toLowerCase();
      const apiKey = (u.api_key || '').toLowerCase();
      return name.includes(query) || email.includes(query) || upi.includes(query) || plan.includes(query) || website.includes(query) || apiKey.includes(query);
    });
  }

  renderAdminUsersTable(filtered);
}
window.filterAdminUsersTable = filterAdminUsersTable;

function setUserFilter(filter, btn) {
  currentUserFilter = filter;
  ['filterUserBtnAll', 'filterUserBtnPaid', 'filterUserBtnFree'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });
  if (btn) btn.classList.add('active');
  filterAdminUsersTable();
}
window.setUserFilter = setUserFilter;

function renderAdminUsersTable(users) {
  const tbody = document.getElementById('adminUsersTableBody');
  const countEl = document.getElementById('adminUsersCount');
  if (!tbody) return;

  if (countEl) countEl.innerText = `${users.length} shown (of ${adminUsersList.length})`;

  if (!users || users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; color: var(--text-dim); padding: 30px;">
          No matching users found in directory.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const isNone = !u.plan || u.plan === 'NONE';
    const isPaid = !isNone;

    const planBadge = isNone
      ? '<span class="badge" style="background: rgba(255,255,255,0.06); color: var(--text-dim); border: 1px solid var(--border-card);">NO PLAN</span>'
      : `<span class="badge PAID" style="background: rgba(168,85,247,0.18); color: #c084fc; border: 1px solid rgba(168,85,247,0.4); font-weight: 700;">${u.plan}</span>`;

    const subStatusBadge = isPaid
      ? '<span class="badge PAID" style="font-size: 10px;">👑 SUBSCRIBED</span>'
      : '<span class="badge EXPIRED" style="font-size: 10px; background: rgba(239,68,68,0.1); color: #f87171; border-color: rgba(239,68,68,0.3);">FREE / NONE</span>';

    const upiDisplay = u.upi_vpa
      ? `<div style="font-family: 'JetBrains Mono', monospace; font-size: 11.5px; font-weight: 700; color: #38bdf8;">${escapeHtml(u.upi_vpa)}</div><div style="font-size: 10px; color: var(--text-dim);">${escapeHtml(u.business_name || '')}</div>`
      : '<span style="color: var(--text-dim); font-size: 11px;">Not Configured</span>';

    const websiteBadge = u.is_website_locked
      ? `<div style="color: #34d399; font-weight: 600; font-size: 11.5px; display: flex; align-items: center; gap: 4px;" title="${escapeHtml(u.website_url || '')}"><span>🔒</span><span>${escapeHtml(u.website_url ? u.website_url.replace(/^[a-zA-Z]+:\/\//, '').split('/')[0] : 'Locked')}</span></div>`
      : (u.website_url ? `<span style="color: var(--primary); font-size: 11px;">${escapeHtml(u.website_url)}</span>` : '<span style="color: var(--text-dim); font-size: 11px;">Not Bound</span>');

    const gmailBadge = u.gmail_connected
      ? `<div style="color: #34d399; font-weight: 600; font-size: 11px;">✅ Active</div><div style="font-size: 9.5px; color: var(--text-dim);">${escapeHtml(u.gmail_email || '')}</div>`
      : '<span style="color: var(--text-dim); font-size: 11px;">Standby</span>';

    const apiKeyDisplay = u.api_key
      ? `<div style="display: flex; align-items: center; gap: 4px;"><span style="font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--primary);">${u.api_key.substring(0, 10)}...</span><button type="button" class="btn btn-secondary" onclick="navigator.clipboard.writeText('${u.api_key}'); alert('API Key Copied!');" style="padding: 2px 6px; font-size: 10px;" title="Copy Full Key">📋</button></div>`
      : '<span style="color: var(--text-dim); font-size: 11px;">-</span>';

    const userInitial = (u.name || u.email || 'U').charAt(0).toUpperCase();

    return `
      <tr>
        <td style="color: var(--text-dim); font-size: 11.5px; font-family: 'JetBrains Mono';">#${u.id}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, var(--accent-purple), var(--primary)); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #fff; flex-shrink: 0;">
              ${userInitial}
            </div>
            <div>
              <div style="font-weight: 600; color: #fff; font-size: 12.5px;">${escapeHtml(u.name || 'Merchant User')}</div>
              <div style="font-size: 11px; color: var(--text-dim);">${escapeHtml(u.email)}</div>
            </div>
          </div>
        </td>
        <td>${planBadge}</td>
        <td>${subStatusBadge}</td>
        <td>${upiDisplay}</td>
        <td>${websiteBadge}</td>
        <td>${gmailBadge}</td>
        <td>${apiKeyDisplay}</td>
        <td>
          <button type="button" class="btn btn-secondary" onclick="openAdjustUserModal('${escapeHtml(u.email)}', '${escapeHtml(u.plan || 'NONE')}')" style="padding: 4px 10px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;">
            <span>⚙️</span> Manage
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function openAdjustUserModal(email, currentPlan) {
  const emailHidden = document.getElementById('adjustUserEmailHidden');
  const emailDisplay = document.getElementById('adjustUserEmailDisplay');
  const planSelect = document.getElementById('adjustUserPlanSelect');
  const feedback = document.getElementById('adjustUserFeedback');

  if (emailHidden) emailHidden.value = email;
  if (emailDisplay) emailDisplay.innerText = email;
  if (planSelect) planSelect.value = currentPlan || 'NONE';
  if (feedback) feedback.style.display = 'none';

  openModal('modalAdjustUser');
}
window.openAdjustUserModal = openAdjustUserModal;

async function handleAdminAdjustUser(event) {
  if (event) event.preventDefault();
  const email = document.getElementById('adjustUserEmailHidden').value;
  const plan = document.getElementById('adjustUserPlanSelect').value;
  const creditsToAdd = parseInt(document.getElementById('adjustUserCreditsInput').value, 10) || 999999;
  const feedback = document.getElementById('adjustUserFeedback');

  if (feedback) {
    feedback.style.display = 'block';
    feedback.style.background = 'rgba(56, 189, 248, 0.15)';
    feedback.style.color = '#38bdf8';
    feedback.innerText = 'Updating user plan and settings...';
  }

  try {
    const res = await fetch((API_BASE || '') + '/api/v1/admin/users/adjust', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': getAdminMasterKey()
      },
      body: JSON.stringify({ email, plan, creditsToAdd })
    });
    const data = await res.json();
    if (data.success) {
      if (feedback) {
        feedback.style.background = 'rgba(16, 185, 129, 0.15)';
        feedback.style.color = '#34d399';
        feedback.innerText = `✅ Successfully updated plan to ${plan}!`;
      }
      await loadAdminUsers();
      setTimeout(() => {
        closeModal('modalAdjustUser');
      }, 1000);
    } else {
      if (feedback) {
        feedback.style.background = 'rgba(239, 68, 68, 0.15)';
        feedback.style.color = '#f87171';
        feedback.innerText = `❌ Error: ${data.error || 'Failed to update'}`;
      }
    }
  } catch (err) {
    if (feedback) {
      feedback.style.background = 'rgba(239, 68, 68, 0.15)';
      feedback.style.color = '#f87171';
      feedback.innerText = `Network error: ${err.message}`;
    }
  }
}
window.handleAdminAdjustUser = handleAdminAdjustUser;

async function loadAdminSubscriptions() {
  const tbody = document.getElementById('adminSubscriptionsTableBody');
  const countEl = document.getElementById('adminSubscriptionsCount');
  if (!tbody) return;

  try {
    const res = await fetch((API_BASE || '') + '/api/admin/orders?type=PLANS&limit=100');
    const data = await res.json();

    if (!data.success || !data.orders) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--accent-red); padding: 24px;">Failed to load subscriptions.</td></tr>';
      return;
    }

    const orders = data.orders || [];
    if (countEl) countEl.innerText = `${orders.length} orders`;

    // Compute Subscription Revenue
    const totalSubRevenue = orders
      .filter(o => o.status === 'PAID')
      .reduce((sum, o) => sum + Number(o.amount || 0), 0);

    const elSubRev = document.getElementById('metricAdminSubRevenue');
    const tbSubRev = document.getElementById('topbarStatSubRevenue');
    const formattedRev = `₹ ${totalSubRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    if (elSubRev) elSubRev.innerText = formattedRev;
    if (tbSubRev) tbSubRev.innerText = formattedRev;

    if (orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-dim); padding: 30px;">No subscription orders recorded yet.</td></tr>';
      return;
    }

    tbody.innerHTML = orders.map(o => {
      const isPaid = o.status === 'PAID';
      const isExpired = o.status === 'EXPIRED';
      const isPending = o.status === 'PENDING';
      const dateStr = o.created_at ? new Date(o.created_at).toLocaleString() : 'N/A';

      const statusBadge = isPaid
        ? '<span class="badge PAID">✅ PAID</span>'
        : (isExpired ? '<span class="badge EXPIRED">EXPIRED</span>' : '<span class="badge PENDING">⏳ PENDING</span>');

      const utrDisplay = o.utr
        ? `<div style="font-family: 'JetBrains Mono', monospace; color: #34d399; font-weight: 700; font-size: 11.5px;">${escapeHtml(o.utr)}</div>`
        : '<span style="color: var(--text-dim); font-size: 11px;">Awaiting Bank</span>';

      return `
        <tr>
          <td>
            <a href="/checkout/${escapeHtml(o.order_code)}" target="_blank" class="code-badge" title="Open Subscription Checkout">
              ${escapeHtml(o.order_code)} ↗
            </a>
          </td>
          <td>
            <div style="font-weight: 600; color: #fff; font-size: 12.5px;">${escapeHtml(o.customer_name || 'Merchant')}</div>
            <div style="font-size: 11px; color: var(--text-dim);">${escapeHtml(o.user_email || o.customer_phone || '')}</div>
          </td>
          <td>
            <span class="badge PAID" style="background: rgba(168,85,247,0.2); color: #c084fc; border: 1px solid rgba(168,85,247,0.35); font-weight: 700;">
              ${escapeHtml(o.plan_id || 'Subscription')}
            </span>
          </td>
          <td style="font-weight: 700; font-size: 14px; color: #fff;">
            ₹ ${Number(o.amount).toFixed(2)}
          </td>
          <td>${statusBadge}</td>
          <td>${utrDisplay}</td>
          <td style="font-size: 11.5px; color: var(--text-dim);">${dateStr}</td>
          <td>
            <a href="/checkout/${escapeHtml(o.order_code)}" target="_blank" class="btn btn-secondary" style="padding: 3px 8px; font-size: 11px;">
              View QR ↗
            </a>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load subscriptions:', err);
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--accent-red); padding: 24px;">Network error loading subscriptions.</td></tr>';
  }
}
window.loadAdminSubscriptions = loadAdminSubscriptions;

// ─── IMAP Status & New Tab Functions ────────────────────────────────────────

function switchAdminBankingTab(tab) {
  const tabGoogle = document.getElementById('adminBankingTabGoogle');
  const tabImap = document.getElementById('adminBankingTabImap');
  const btnGoogle = document.getElementById('adminTabBtnGoogle');
  const btnImap = document.getElementById('adminTabBtnImap');

  if (tab === 'google') {
    if (tabGoogle) tabGoogle.style.display = 'block';
    if (tabImap) tabImap.style.display = 'none';
    if (btnGoogle) {
      btnGoogle.classList.add('active');
      btnGoogle.style.background = 'rgba(56, 189, 248, 0.2)';
      btnGoogle.style.borderColor = '#38bdf8';
      btnGoogle.style.color = '#fff';
    }
    if (btnImap) {
      btnImap.classList.remove('active');
      btnImap.style.background = 'transparent';
      btnImap.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      btnImap.style.color = 'var(--text-muted)';
    }
  } else {
    if (tabGoogle) tabGoogle.style.display = 'none';
    if (tabImap) tabImap.style.display = 'block';
    if (btnImap) {
      btnImap.classList.add('active');
      btnImap.style.background = 'rgba(56, 189, 248, 0.2)';
      btnImap.style.borderColor = '#38bdf8';
      btnImap.style.color = '#fff';
    }
    if (btnGoogle) {
      btnGoogle.classList.remove('active');
      btnGoogle.style.background = 'transparent';
      btnGoogle.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      btnGoogle.style.color = 'var(--text-muted)';
    }
  }
}
window.switchAdminBankingTab = switchAdminBankingTab;

async function linkAdminGoogleBanking() {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
    provider.setCustomParameters({ prompt: 'select_account' });

    const btn = document.getElementById('btnAdminLinkGoogle');
    if (btn) btn.innerHTML = '<span>Connecting Google...</span> ⏳';

    const result = await firebase.auth().signInWithPopup(provider);
    const accessToken = result.credential ? result.credential.accessToken : null;
    const googleEmail = result.user ? result.user.email : '';

    if (!accessToken) {
      alert('Could not obtain Google authorization token.');
      if (btn) btn.innerHTML = '<span>🔗 Link Admin Banking Gmail with 1-Click (Read-Only)</span> <span>⚡</span>';
      return;
    }

    const res = await fetch(API_BASE + '/api/admin/banking/google-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken, googleEmail })
    });
    const data = await res.json();
    if (data.success) {
      alert(`🎉 Admin Banking email (${googleEmail}) linked with Google OAuth! Bank credit alerts will now auto-verify plan subscriptions.`);
      loadImapStatus();
    } else {
      alert('Error: ' + (data.error || 'Failed to link Google banking email'));
    }
  } catch (err) {
    alert('Google linking failed: ' + err.message);
  } finally {
    const btn = document.getElementById('btnAdminLinkGoogle');
    if (btn) btn.innerHTML = '<span>🔗 Link Admin Banking Gmail with 1-Click (Read-Only)</span> <span>⚡</span>';
  }
}
window.linkAdminGoogleBanking = linkAdminGoogleBanking;

async function disconnectAdminGoogleBanking() {
  if (!confirm('Disconnect Admin Google Banking Link and switch back to manual IMAP?')) return;
  try {
    const res = await fetch(API_BASE + '/api/admin/banking/disconnect-google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      alert('Admin Google banking link disconnected.');
      loadImapStatus();
    }
  } catch (err) {
    alert('Failed to disconnect: ' + err.message);
  }
}
window.disconnectAdminGoogleBanking = disconnectAdminGoogleBanking;

async function loadImapStatus() {
  try {
    const res = await fetch(API_BASE + '/api/admin/stats');
    const data = await res.json();
    if (!data.success) return;
    const status = data.stats.imapStatus || {};
    const isConnected = !!(status.isConnected || status.connected);
    const dot = document.getElementById('imapDotImap');
    const txt = document.getElementById('imapTextImap');
    const topDot = document.getElementById('imapDot');
    const topTxt = document.getElementById('imapText');

    // Check Google Banking status
    try {
      const bRes = await fetch(API_BASE + '/api/admin/banking/status');
      const bData = await bRes.json();
      if (bData.success) {
        const isGoogleActive = bData.settlementType === 'GOOGLE_OAUTH' && bData.google && bData.google.connected;
        const gCard = document.getElementById('adminGoogleConnectedCard');
        const gAction = document.getElementById('adminGoogleConnectActionBox');
        const gEmail = document.getElementById('adminGoogleLinkedEmail');

        if (isGoogleActive) {
          if (gCard) gCard.style.display = 'block';
          if (gAction) gAction.style.display = 'none';
          if (gEmail) gEmail.textContent = bData.google.email;
          if (topDot) topDot.className = 'status-dot connected';
          if (topTxt) topTxt.textContent = 'Google Bank: Active';
          if (dot) dot.className = 'status-dot connected';
          if (txt) txt.textContent = `✅ Google Banking Linked · ${bData.google.email}`;
          return;
        } else {
          if (gCard) gCard.style.display = 'none';
          if (gAction) gAction.style.display = 'block';
        }
      }
    } catch (_) {}

    const cls = isConnected ? 'connected' : 'disconnected';
    const label = isConnected ? `✅ IMAP Connected · ${data.stats.imapUser || ''}` : '⚠️ IMAP Disconnected — Click Save below to start';

    if (dot) dot.className = `status-dot ${cls}`;
    if (txt) txt.textContent = label;
    if (topDot) topDot.className = `status-dot ${cls}`;
    if (topTxt) topTxt.textContent = isConnected ? 'IMAP: Connected' : 'IMAP: Off';

    // Pre-fill IMAP form
    const userEl = document.getElementById('uiImapUser');
    const filterEl = document.getElementById('uiImapFilter');
    const enabledEl = document.getElementById('uiImapEnabled');
    if (userEl && !userEl.value) userEl.value = data.stats.imapUser || '';
    if (filterEl && !filterEl.value) filterEl.value = data.stats.imapFilter || 'fampay,famapp,fam';
    if (enabledEl && status.enabled !== undefined) enabledEl.checked = status.enabled !== false;
  } catch (err) { console.error('[IMAP Status]', err); }
}
window.loadImapStatus = loadImapStatus;


function handleTestImapConnection() {
  const user = document.getElementById('uiImapUser');
  const pass = document.getElementById('uiImapPass');
  const fb = document.getElementById('uiImapFeedback');
  const btn = document.getElementById('uiBtnTestImap');
  if (!user || !pass) return;

  if (!user.value.trim() || !pass.value.trim()) {
    if (fb) { fb.style.display='block'; fb.style.background='rgba(239,68,68,0.15)'; fb.style.border='1px solid rgba(239,68,68,0.3)'; fb.style.color='#f87171'; fb.innerText='⚠️ Enter Gmail and App Password first.'; }
    return;
  }
  if (btn) { btn.disabled=true; btn.innerText='⏳ Connecting...'; }
  if (fb) fb.style.display='none';

  fetch(API_BASE + '/api/admin/imap/test', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ user: user.value.trim(), pass: pass.value.trim() }) })
    .then(r => r.json())
    .then(data => {
      if (!fb) return;
      fb.style.display = 'block';
      if (data.success) {
        fb.style.background='rgba(16,185,129,0.15)'; fb.style.border='1px solid rgba(16,185,129,0.3)'; fb.style.color='#34d399';
        fb.innerHTML = `✅ <b>Connected!</b> Found ${data.totalMessages} emails (${data.unseenMessages} unread). FamPay & bank alerts will be auto-scanned.`;
      } else {
        fb.style.background='rgba(239,68,68,0.15)'; fb.style.border='1px solid rgba(239,68,68,0.3)'; fb.style.color='#f87171';
        fb.innerHTML = `❌ <b>Failed:</b> ${data.error || 'Connection error'}`;
      }
    })
    .catch(err => { if (fb) { fb.style.display='block'; fb.style.color='#f87171'; fb.innerText='Network error: '+err.message; } })
    .finally(() => { if (btn) { btn.disabled=false; btn.innerText='🔌 Test Connection'; } });
}
window.handleTestImapConnection = handleTestImapConnection;

function handleSaveImapSettings(e) {
  if (e) e.preventDefault();
  const user = document.getElementById('uiImapUser');
  const pass = document.getElementById('uiImapPass');
  const filter = document.getElementById('uiImapFilter');
  const enabled = document.getElementById('uiImapEnabled');
  const fb = document.getElementById('uiImapFeedback');
  const btn = document.getElementById('uiBtnSaveImap');

  if (btn) { btn.disabled=true; btn.innerText='⏳ Saving...'; }
  if (fb) fb.style.display='none';

  const payload = { enabled: enabled ? enabled.checked : true, user: user ? user.value.trim() : '', senderFilter: filter ? filter.value.trim() : 'fampay,famapp,fam' };
  if (pass && pass.value.trim()) payload.pass = pass.value.trim();

  fetch(API_BASE + '/api/admin/imap/restart', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    .then(r => r.json())
    .then(data => {
      if (!fb) return;
      fb.style.display='block';
      if (data.success) {
        fb.style.background='rgba(16,185,129,0.15)'; fb.style.border='1px solid rgba(16,185,129,0.3)'; fb.style.color='#34d399';
        fb.innerHTML = `💾 <b>Saved!</b> IMAP is now <b>${payload.enabled ? '🟢 ACTIVE — scanning FamPay, GPay, bank alerts' : '⚪ DISABLED'}</b>.`;
        loadImapStatus();
      } else {
        fb.style.background='rgba(239,68,68,0.15)'; fb.style.color='#f87171';
        fb.innerText = '❌ ' + (data.error || 'Failed');
      }
    })
    .catch(err => { if (fb) { fb.style.display='block'; fb.style.color='#f87171'; fb.innerText='Error: '+err.message; } })
    .finally(() => { if (btn) { btn.disabled=false; btn.innerText='💾 Save & Restart IMAP Listener'; } });
}
window.handleSaveImapSettings = handleSaveImapSettings;

// ─── Coupons Management ──────────────────────────────────────────────────────

async function loadCoupons() {
  const tbody = document.getElementById('couponsTableBody');
  const badge = document.getElementById('badgeCouponsCount');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-dim);">Loading...</td></tr>';
  try {
    const res = await fetch(API_BASE + '/api/admin/coupons');
    const data = await res.json();
    if (!data.success) { tbody.innerHTML='<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--accent-red);">Failed to load</td></tr>'; return; }
    const coupons = data.coupons || [];
    if (badge) badge.textContent = coupons.filter(c=>c.is_active).length;
    if (!coupons.length) { tbody.innerHTML='<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-dim);">No coupons yet. Create your first one above! 🏷️</td></tr>'; return; }
    tbody.innerHTML = coupons.map(c => {
      const expiry = c.expires_at ? new Date(c.expires_at).toLocaleDateString('en-IN') : 'Never';
      const isExpired = c.expires_at && Date.now() > c.expires_at;
      const usageMax = c.max_uses === -1 ? '∞' : c.max_uses;
      const statusBadge = (!c.is_active || isExpired)
        ? `<span style="font-size:11px;padding:2px 8px;background:rgba(239,68,68,0.15);color:#f87171;border-radius:20px;border:1px solid rgba(239,68,68,0.3);">Inactive</span>`
        : `<span style="font-size:11px;padding:2px 8px;background:rgba(16,185,129,0.15);color:#34d399;border-radius:20px;border:1px solid rgba(16,185,129,0.3);">Active</span>`;
      return `<tr>
        <td><span style="font-family:monospace;font-weight:800;font-size:14px;color:#fbbf24;letter-spacing:1px;">${escapeHtml(c.code)}</span></td>
        <td><span style="font-weight:700;color:#34d399;">${c.discount_percent}% OFF</span></td>
        <td>${usageMax}</td>
        <td>${c.used_count}</td>
        <td style="font-size:12px;color:${isExpired?'#f87171':'var(--text-dim)'};">${expiry}</td>
        <td>${statusBadge}</td>
        <td><button onclick="deleteCouponById(${c.id},'${escapeHtml(c.code)}')" class="btn btn-secondary" style="padding:3px 8px;font-size:11px;color:#f87171;border-color:rgba(239,68,68,0.3);">🗑️</button></td>
      </tr>`;
    }).join('');
  } catch (err) { tbody.innerHTML=`<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--accent-red);">${err.message}</td></tr>`; }
}
window.loadCoupons = loadCoupons;

async function handleCreateCoupon(e) {
  e.preventDefault();
  const code = document.getElementById('couponCode')?.value.trim();
  const discount = document.getElementById('couponDiscount')?.value;
  const maxUses = document.getElementById('couponMaxUses')?.value ?? -1;
  const expiryEl = document.getElementById('couponExpiry');
  const fb = document.getElementById('createCouponFeedback');
  const btn = e.target.querySelector('button[type="submit"]');
  if (!code || !discount) { if(fb){fb.style.display='block';fb.style.color='#f87171';fb.innerText='Code and discount are required.';} return; }
  if (btn) { btn.disabled=true; btn.innerText='⏳ Creating...'; }
  if (fb) fb.style.display='none';
  const payload = { code, discountPercent: parseFloat(discount), maxUses: parseInt(maxUses), expiresAt: expiryEl?.value ? new Date(expiryEl.value).getTime() : null };
  try {
    const res = await fetch(API_BASE+'/api/admin/coupons',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data = await res.json();
    if (fb) {
      fb.style.display='block';
      if (data.success) {
        fb.style.background='rgba(16,185,129,0.15)';fb.style.border='1px solid rgba(16,185,129,0.3)';fb.style.color='#34d399';
        fb.innerHTML=`✅ Coupon <b>${escapeHtml(data.coupon.code)}</b> created — ${data.coupon.discount_percent}% discount!`;
        e.target.reset(); loadCoupons();
      } else { fb.style.background='rgba(239,68,68,0.15)';fb.style.color='#f87171';fb.innerText='❌ '+(data.error||'Failed'); }
    }
  } catch(err){ if(fb){fb.style.display='block';fb.style.color='#f87171';fb.innerText='Error: '+err.message;} }
  finally { if(btn){btn.disabled=false;btn.innerText='🏷️ Create Coupon Code';} }
}
window.handleCreateCoupon = handleCreateCoupon;

async function deleteCouponById(id, code) {
  if (!confirm(`Deactivate coupon "${code}"?`)) return;
  try {
    const res = await fetch(`${API_BASE}/api/admin/coupons/${id}`,{method:'DELETE'});
    const data = await res.json();
    if (data.success) loadCoupons(); else alert('Failed: '+data.error);
  } catch(err){ alert('Error: '+err.message); }
}
window.deleteCouponById = deleteCouponById;

// ─── Plan Price Override ─────────────────────────────────────────────────────

async function loadPlanPrices() {
  const container = document.getElementById('planPricesContainer');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-dim);">Loading plan prices...</div>';
  try {
    const res = await fetch(API_BASE+'/api/admin/plan-prices');
    const data = await res.json();
    if (!data.success) { container.innerHTML='<div style="color:var(--accent-red);padding:20px;">Failed to load.</div>'; return; }
    const plans = data.plans||[];
    if (!plans.length) { container.innerHTML='<div style="color:var(--text-dim);padding:20px;">No plans found.</div>'; return; }
    container.innerHTML=`<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:0;border:1px solid var(--border-card);border-radius:10px;overflow:hidden;">
      <div style="background:rgba(255,255,255,0.04);padding:10px 14px;font-size:11px;font-weight:700;color:var(--text-dim);text-transform:uppercase;">Plan</div>
      <div style="background:rgba(255,255,255,0.04);padding:10px 14px;font-size:11px;font-weight:700;color:var(--text-dim);text-transform:uppercase;">Default</div>
      <div style="background:rgba(255,255,255,0.04);padding:10px 14px;font-size:11px;font-weight:700;color:var(--text-dim);text-transform:uppercase;">Current</div>
      <div style="background:rgba(255,255,255,0.04);padding:10px 14px;font-size:11px;font-weight:700;color:var(--text-dim);text-transform:uppercase;">New Price (₹)</div>
      <div style="background:rgba(255,255,255,0.04);padding:10px 14px;font-size:11px;font-weight:700;color:var(--text-dim);text-transform:uppercase;">Save</div>
      ${plans.map(p=>`
        <div style="padding:10px 14px;border-top:1px solid var(--border-card);">
          <div style="font-weight:700;color:#fff;font-size:13px;">${escapeHtml(p.name)}</div>
          <div style="font-size:11px;color:var(--text-dim);">${p.period} · ${p.maxWebsites}W</div>
        </div>
        <div style="padding:10px 14px;border-top:1px solid var(--border-card);color:var(--text-muted);">₹${p.basePrice}</div>
        <div style="padding:10px 14px;border-top:1px solid var(--border-card);font-weight:700;color:${p.isOverridden?'#fbbf24':'#34d399'};">₹${p.currentPrice}${p.isOverridden?' ✏️':''}</div>
        <div style="padding:8px 14px;border-top:1px solid var(--border-card);">
          <input type="number" id="priceInput_${p.id}" value="${p.currentPrice}" min="1" class="form-control" style="padding:5px 8px;font-size:13px;width:90px;">
        </div>
        <div style="padding:8px 14px;border-top:1px solid var(--border-card);display:flex;gap:6px;align-items:center;">
          <button onclick="savePlanPrice('${p.id}')" class="btn btn-primary" style="padding:4px 10px;font-size:11px;">💾</button>
          ${p.isOverridden?`<button onclick="resetPlanPrice('${p.id}')" class="btn btn-secondary" style="padding:4px 8px;font-size:11px;" title="Reset to default">↩️</button>`:''}
        </div>
      `).join('')}
    </div>`;
  } catch(err){ container.innerHTML=`<div style="color:var(--accent-red);padding:20px;">${err.message}</div>`; }
}
window.loadPlanPrices = loadPlanPrices;

async function savePlanPrice(planId) {
  const input = document.getElementById(`priceInput_${planId}`);
  if (!input) return;
  const price = parseFloat(input.value);
  if (!price || price < 1) { alert('Enter valid price (min ₹1)'); return; }
  try {
    const res = await fetch(API_BASE+'/api/admin/plan-prices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({planId,price})});
    const data = await res.json();
    if (data.success) { input.style.borderColor='#34d399'; setTimeout(()=>{ input.style.borderColor=''; loadPlanPrices(); },800); }
    else alert('Failed: '+data.error);
  } catch(err){ alert('Error: '+err.message); }
}
window.savePlanPrice = savePlanPrice;

async function resetPlanPrice(planId) {
  if (!confirm('Reset price to default?')) return;
  try {
    const res = await fetch(`${API_BASE}/api/admin/plan-prices/${planId}`,{method:'DELETE'});
    const data = await res.json();
    if (data.success) loadPlanPrices(); else alert('Failed: '+data.error);
  } catch(err){ alert('Error: '+err.message); }
}
window.resetPlanPrice = resetPlanPrice;
