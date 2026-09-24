// ==========================================
// USER PANEL & 2-LINE SIDEBAR DASHBOARD
// ==========================================

// Dynamically resolve Gateway Backend URL (supports Firebase Hosting, custom domains, and Render)
const API_BASE = (window.location.hostname.includes('paypendicular') || window.location.hostname.includes('upigateway') || window.location.hostname.includes('web.app') || window.location.hostname.includes('firebaseapp.com')) 
  ? 'https://personal-payment-gateway.onrender.com' 
  : (window.location.hostname.includes('onrender.com') ? '' : 'https://personal-payment-gateway.onrender.com');

if (API_BASE) {
  const originalFetch = window.fetch;
  window.fetch = async function (url, options = {}) {
    let urlStr = typeof url === 'string' ? url : (url?.url || '');
    if (urlStr.startsWith('/api/')) {
      urlStr = API_BASE + urlStr;
      if (typeof url === 'string') url = urlStr;
    }
    return originalFetch.call(this, url, options);
  };
}

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
let socket = null;
let currentUser = null;
let activeOrderTimer = null;
let userOrdersList = [];
let currentOrderStatusFilter = 'ALL';

// Initialize Firebase
try {
  if (typeof firebase !== 'undefined') {
    fbApp = firebase.initializeApp(firebaseConfig);
    fbAuth = firebase.auth();
  }
} catch (e) {
  console.warn('Firebase init:', e.message);
}

// Initialize Socket.IO
try {
  socket = io();
  socket.on('connect', () => {
    console.log('[Socket] Connected as', socket.id);
    if (currentUser && currentUser.email) {
      socket.emit('join_user', currentUser.email);
    }
  });

  // Listen for real-time plan activation
  socket.on('user_plan_activated', (data) => {
    console.log('[Socket] Plan activated in real-time!', data);
    handleRealtimeActivation(data);
  });

  // Listen for real-time order updates
  socket.on('order_status_update', (update) => {
    console.log('[Socket] Order status update:', update);
    if (userOrdersList.some(o => o.order_code === update.orderCode || o.id === update.orderId)) {
      loadUserOrders();
    }
  });
} catch (err) {
  console.warn('[Socket] Init failed:', err.message);
}

// On Page Load
document.addEventListener('DOMContentLoaded', () => {
  if (fbAuth) {
    fbAuth.onAuthStateChanged((user) => {
      if (user) {
        onFirebaseUserAuthenticated(user);
      } else {
        const sessionUser = sessionStorage.getItem('gateway_user');
        if (sessionUser) {
          try {
            currentUser = JSON.parse(sessionUser);
            renderDashboard();
            loadUserOrders();
            return;
          } catch (_) {}
        }
        showLoginOverlay();
      }
    });
  } else {
    const sessionUser = sessionStorage.getItem('gateway_user');
    if (sessionUser) {
      currentUser = JSON.parse(sessionUser);
      renderDashboard();
      loadUserOrders();
    } else {
      showLoginOverlay();
    }
  }
});

// Google Sign-In Trigger
async function handleGoogleSignIn() {
  if (!fbAuth) {
    alert('Firebase Auth is still initializing. Please check your internet connection.');
    return;
  }
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await fbAuth.signInWithPopup(provider);
    await onFirebaseUserAuthenticated(result.user);
  } catch (err) {
    console.error('Google Sign-In Error:', err);
    alert('Sign-In Failed: ' + err.message);
  }
}

// Once user logs in with Google
async function onFirebaseUserAuthenticated(user) {
  const email = (user.email || '').toLowerCase().trim();

  // Single Login Rule: If Admin email logs in, immediately redirect to Admin Terminal!
  if (email === REQUIRED_ADMIN_EMAIL.toLowerCase()) {
    sessionStorage.setItem('gateway_admin_auth', 'google');
    sessionStorage.setItem('gateway_admin_email', email);
    sessionStorage.setItem('gateway_master_key', 'shivambhatt@admin');
    localStorage.setItem('admin_master_key', 'shivambhatt@admin');
    window.location.href = '/admin';
    return;
  }

  // Sync user with backend
  try {
    const res = await fetch('/api/v1/user/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        name: user.displayName || 'User',
        photoUrl: user.photoURL || ''
      })
    });

    const data = await res.json();
    if (data.success && data.user) {
      currentUser = data.user;
      sessionStorage.setItem('gateway_user', JSON.stringify(currentUser));
      hideLoginOverlay();

      if (socket && socket.connected) {
        socket.emit('join_user', currentUser.email);
      }

      renderDashboard();
      loadUserOrders();
    } else {
      alert('Could not sync user profile with backend.');
    }
  } catch (err) {
    console.error('User sync error:', err);
    currentUser = {
      email,
      name: user.displayName || 'User',
      photoUrl: user.photoURL || '',
      role: email === REQUIRED_ADMIN_EMAIL.toLowerCase() ? 'admin' : 'user',
      plan: 'NONE',
      qrCredits: 0,
      apiKey: 'pg_live_demo12345',
      hasActivePlan: false,
      isWebsiteLocked: false,
      websiteUrl: ''
    };
    renderDashboard();
  }
}

function handleSignOut() {
  if (fbAuth) {
    fbAuth.signOut();
  }
  sessionStorage.removeItem('gateway_user');
  sessionStorage.removeItem('gateway_admin_auth');
  currentUser = null;
  window.location.href = '/';
}

function showLoginOverlay() {
  window.location.href = '/login';
}

function hideLoginOverlay() {
  const overlay = document.getElementById('loginOverlay');
  if (overlay) overlay.style.display = 'none';
}

// Switch 2-Line Sidebar View
function switchSidebarView(viewId) {
  // Gate Settlement Engine behind active plan
  if (viewId === 'settlement' && (!currentUser || !currentUser.hasActivePlan)) {
    alert('🔒 Automated Settlement Engine unlocks automatically after activating any subscription plan. Please select a plan first.');
    switchSidebarView('plans');
    return;
  }

  // Update sidebar active buttons
  document.querySelectorAll('.sidebar-item-2line').forEach(btn => btn.classList.remove('active'));
  const targetBtn = document.getElementById(`nav_${viewId}`);
  if (targetBtn) targetBtn.classList.add('active');

  // Toggle content views
  document.querySelectorAll('.dashboard-view-section').forEach(view => view.classList.remove('active'));
  const targetView = document.getElementById(`view_${viewId}`);
  if (targetView) targetView.classList.add('active');

  // Update topbar title
  const titleEl = document.getElementById('activeViewTitle');
  if (titleEl) {
    const titles = {
      dashboard: '📊 Merchant Dashboard Overview',
      plans: '💳 Subscription Plans & Pricing',
      api: '🔑 API Key & Strict Website Lock',
      payments: '⚡ Live Payment Orders & UTR Tracking',
      customizer: '🎨 Customer Checkout Branding & API Customizer',
      docs: '📑 Developer API Docs & SDK Integration',
      settlement: '⚙️ Automated Settlement & UPI Routing Engine'
    };
    titleEl.innerText = titles[viewId] || 'Merchant Portal';
  }

  // If mobile, close sidebar
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('mobile-open');

  // Trigger loads
  if (viewId === 'payments' || viewId === 'dashboard') {
    loadUserOrders();
  } else if (viewId === 'plans') {
    loadUserSubscriptionInvoices();
  }
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('mobile-open');
}

// Render Dashboard based on current user state
function renderDashboard() {
  if (!currentUser) return;

  const hasActivePlan = currentUser.plan && currentUser.plan !== 'NONE';
  const isLocked = !!currentUser.isWebsiteLocked && !!currentUser.websiteUrl;

  // 1. Sidebar User Profile Info
  const avatar = document.getElementById('sidebarUserAvatar');
  const nameEl = document.getElementById('sidebarUserName');
  const emailEl = document.getElementById('sidebarUserEmail');
  const planPill = document.getElementById('sidebarUserPlanPill');
  const adminNav = document.getElementById('nav_admin');
  const navSettlement = document.getElementById('nav_settlement');

  if (avatar) avatar.src = currentUser.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name || 'User')}&background=0ea5e9&color=fff`;
  if (nameEl) nameEl.innerText = currentUser.name || 'User';
  if (emailEl) emailEl.innerText = currentUser.email;
  if (planPill) {
    planPill.innerText = hasActivePlan ? `${currentUser.plan} PLAN` : 'NO ACTIVE PLAN';
    planPill.style.background = hasActivePlan ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)';
    planPill.style.color = hasActivePlan ? '#34d399' : '#f43f5e';
    planPill.style.borderColor = hasActivePlan ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)';
  }

  // Hide or Show Settlement Engine based on plan purchase
  if (navSettlement) {
    navSettlement.style.display = hasActivePlan ? 'flex' : 'none';
  }

  // Show Admin Portal link if admin
  if (adminNav) {
    const isAdmin = currentUser.role === 'admin' || currentUser.email?.toLowerCase() === REQUIRED_ADMIN_EMAIL.toLowerCase();
    adminNav.style.display = isAdmin ? 'flex' : 'none';
  }

  // 2. Topbar Quick Stats
  const topPlan = document.getElementById('topbarPlanName');
  const topCredits = document.getElementById('topbarCredits');
  const topWebsite = document.getElementById('topbarWebsiteDomain');
  if (topPlan) topPlan.innerText = currentUser.plan || 'NONE';
  if (topCredits) topCredits.innerText = '♾️ UNLIMITED';
  if (topWebsite) {
    if (isLocked) {
      const cleanDom = currentUser.websiteUrl.replace(/^[a-zA-Z]+:\/\//, '').split('/')[0];
      topWebsite.innerText = '🔒 ' + cleanDom;
      topWebsite.style.color = 'var(--accent-emerald)';
    } else {
      topWebsite.innerText = 'NOT BOUND';
      topWebsite.style.color = 'var(--accent-amber)';
    }
  }

  // 3. Urgent Website Lock Banner (Warning shown if plan is active but website not locked)
  const urgentBanner = document.getElementById('urgentWebsiteBanner');
  const sidebarApiBadge = document.getElementById('sidebarApiBadge');
  if (urgentBanner) {
    urgentBanner.style.display = (hasActivePlan && !isLocked) ? 'flex' : 'none';
  }
  if (sidebarApiBadge) {
    sidebarApiBadge.style.display = 'inline-block';
    if (!hasActivePlan) {
      sidebarApiBadge.className = 'sidebar-item-badge';
      sidebarApiBadge.innerText = 'NO PLAN';
      sidebarApiBadge.style.background = 'rgba(255,255,255,0.06)';
      sidebarApiBadge.style.color = 'var(--text-dim)';
      sidebarApiBadge.style.borderColor = 'transparent';
    } else if (!isLocked) {
      sidebarApiBadge.className = 'sidebar-item-badge warning';
      sidebarApiBadge.innerText = 'LOCK REQ';
    } else {
      sidebarApiBadge.className = 'sidebar-item-badge success';
      sidebarApiBadge.innerText = 'ACTIVE';
    }
  }

  // 4. Dashboard View Stats
  const dashPlan = document.getElementById('dashStatPlan');
  const dashWebsite = document.getElementById('dashStatWebsite');
  const dashEngine = document.getElementById('dashStatEngine');
  if (dashPlan) dashPlan.innerText = currentUser.plan ? `${currentUser.plan} PLAN` : 'NONE';
  if (dashWebsite) {
    if (isLocked) {
      const cleanDom = currentUser.websiteUrl.replace(/^[a-zA-Z]+:\/\//, '').split('/')[0];
      dashWebsite.innerText = '🔒 ' + cleanDom;
      dashWebsite.style.color = 'var(--accent-emerald)';
    } else {
      dashWebsite.innerText = 'NOT LINKED';
      dashWebsite.style.color = 'var(--accent-amber)';
    }
  }
  if (dashEngine) {
    dashEngine.innerText = currentUser.gmailConnected ? 'ACTIVE (1-SEC SYNC)' : 'READY (1-SEC)';
  }

  // 5. API Key & Website Lock View State
  const apiKeyStatusBadge = document.getElementById('apiKeyStatusBadge');
  const displayApiKey = document.getElementById('displayApiKey');
  const apiKeyNotice = document.getElementById('apiKeyLockNotice');
  const websiteUnlockedBox = document.getElementById('websiteUnlockedBox');
  const websiteLockedBox = document.getElementById('websiteLockedBox');
  const lockedWebsitesContainer = document.getElementById('lockedWebsitesContainer');
  const websiteSlotsBadge = document.getElementById('websiteSlotsBadge');

  if (displayApiKey) {
    displayApiKey.innerText = currentUser.apiKey || 'pg_live_demo12345';
  }

  const maxWebsites = currentUser.maxWebsites || (currentUser.plan?.includes('DUAL') ? 2 : 1);
  const lockedWebsites = currentUser.lockedWebsites || (isLocked ? [{ url: currentUser.websiteUrl, domain: currentUser.websiteUrl.replace(/^[a-zA-Z]+:\/\//, '').split('/')[0] }] : []);
  const remainingSlots = Math.max(0, maxWebsites - lockedWebsites.length);

  if (websiteSlotsBadge) {
    websiteSlotsBadge.innerText = `Slots: ${lockedWebsites.length} of ${maxWebsites} Bound`;
    websiteSlotsBadge.className = remainingSlots === 0 ? 'sidebar-item-badge success' : 'sidebar-item-badge warning';
  }

  if (isLocked) {
    if (apiKeyStatusBadge) {
      apiKeyStatusBadge.className = 'sidebar-item-badge success';
      apiKeyStatusBadge.innerText = '🟢 ACTIVE & PRODUCTION READY';
    }
    if (apiKeyNotice) {
      apiKeyNotice.style.display = 'block';
      apiKeyNotice.style.background = 'rgba(16, 185, 129, 0.1)';
      apiKeyNotice.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      apiKeyNotice.style.color = '#34d399';
      apiKeyNotice.innerHTML = `🛡️ <strong>API Status Active:</strong> Verified and locked to <b>${lockedWebsites.map(w => w.url || w.domain || w).join(', ')}</b>. Payment creation requests from your domain are live.`;
    }

    if (websiteLockedBox) websiteLockedBox.style.display = 'block';
    if (lockedWebsitesContainer) {
      lockedWebsitesContainer.innerHTML = lockedWebsites.map((site, idx) => `
        <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); padding: 12px 16px; border-radius: 8px; margin-bottom: 8px;">
          <div>
            <div style="font-size: 11px; color: var(--text-dim); font-weight: 700;">SLOT #${idx + 1} (PERMANENTLY LOCKED)</div>
            <div style="color: #38bdf8; font-family: 'JetBrains Mono', monospace; font-size: 14.5px; font-weight: 700; margin-top: 2px;">
              ${site.url || site.domain || site}
            </div>
          </div>
          <span style="font-size: 12px; color: #34d399; font-weight: 700; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 10px; border-radius: 6px;">
            🔒 LOCKED
          </span>
        </div>
      `).join('');
    }

    // If multi-site plan has remaining slots, show form for next slot
    if (remainingSlots > 0 && websiteUnlockedBox) {
      websiteUnlockedBox.style.display = 'block';
    } else if (websiteUnlockedBox) {
      websiteUnlockedBox.style.display = 'none';
    }
  } else {
    if (apiKeyStatusBadge) {
      apiKeyStatusBadge.className = 'sidebar-item-badge warning';
      apiKeyStatusBadge.innerText = '🔴 INACTIVE (WEBSITE LOCK REQUIRED)';
    }
    if (apiKeyNotice) {
      apiKeyNotice.style.display = 'block';
      apiKeyNotice.style.background = 'rgba(245, 158, 11, 0.1)';
      apiKeyNotice.style.borderColor = 'rgba(245, 158, 11, 0.25)';
      apiKeyNotice.style.color = '#fbbf24';
      apiKeyNotice.innerHTML = `⚠️ <strong>Action Required:</strong> Enter your website URL below to activate this API Key. Until locked, any payment creation request will be rejected automatically.`;
    }
    if (websiteUnlockedBox) websiteUnlockedBox.style.display = 'block';
    if (websiteLockedBox) websiteLockedBox.style.display = 'none';
  }

  // 6. Inject user's API Key into SDK snippets
  document.querySelectorAll('.inject-api-key').forEach(el => {
    el.innerText = currentUser.apiKey || 'pg_live_your_key';
  });

  // 7. Settlement Overview Routing Pills & Inputs
  const settlementCurrentUpi = document.getElementById('settlementCurrentUpi');
  const settlementCurrentBusiness = document.getElementById('settlementCurrentBusiness');
  const settlementCurrentGmail = document.getElementById('settlementCurrentGmail');

  if (settlementCurrentUpi) settlementCurrentUpi.innerText = currentUser.upiVpa || 'Not Configured';
  if (settlementCurrentBusiness) settlementCurrentBusiness.innerText = currentUser.businessName || 'Default';
  if (settlementCurrentGmail) {
    if (currentUser.gmailConnected) {
      settlementCurrentGmail.innerText = (currentUser.gmailEmail || 'Linked') + (currentUser.settlementType === 'IMAP' ? ' (IMAP)' : ' (Google 1-Click)');
    } else {
      settlementCurrentGmail.innerText = 'Not Connected';
    }
  }

  const inUpi = document.getElementById('inputMerchantUpi');
  const inBiz = document.getElementById('inputMerchantBusiness');
  const inImapEmail = document.getElementById('inputImapEmail');
  if (inUpi && !inUpi.value) inUpi.value = currentUser.upiVpa || '';
  if (inBiz && !inBiz.value) inBiz.value = currentUser.businessName || '';
  if (inImapEmail && !inImapEmail.value) inImapEmail.value = currentUser.gmailEmail || currentUser.email || '';

  // Restore saved UPI Provider choice
  if (currentUser.upiProvider) {
    setUpiProviderChoice(currentUser.upiProvider, true);
  } else if (currentUser.upiVpa) {
    autoDetectUpiProvider(currentUser.upiVpa);
  }

  // Google Link UI state update
  const googleConnectedCard = document.getElementById('googleConnectedCard');
  const googleConnectActionBox = document.getElementById('googleConnectActionBox');
  const googleLinkStatusBadge = document.getElementById('googleLinkStatusBadge');
  const googleLinkedEmailText = document.getElementById('googleLinkedEmailText');

  if (currentUser.gmailConnected) {
    if (googleConnectedCard) googleConnectedCard.style.display = 'block';
    if (googleConnectActionBox) googleConnectActionBox.style.display = 'none';
    if (googleLinkedEmailText) googleLinkedEmailText.innerText = currentUser.gmailEmail || currentUser.email;
    if (googleLinkStatusBadge) {
      googleLinkStatusBadge.innerHTML = `<span style="color: #34d399;">🟢 Active (${currentUser.settlementType === 'IMAP' ? 'IMAP' : 'Google Link'})</span>`;
    }
  } else {
    if (googleConnectedCard) googleConnectedCard.style.display = 'none';
    if (googleConnectActionBox) googleConnectActionBox.style.display = 'block';
    if (googleLinkStatusBadge) {
      googleLinkStatusBadge.innerHTML = `<span style="color: #94a3b8;">⚪ Not Linked</span>`;
    }
  }

  // 8. Checkout Branding & Customizer state
  const custName = document.getElementById('customizerBrandName');
  const custLogo = document.getElementById('customizerBrandLogo');
  const custTheme = document.getElementById('customizerTheme');
  const custRedir = document.getElementById('customizerRedirectUrl');
  const custNote = document.getElementById('customizerCustomNote');

  if (custName && !custName.value) custName.value = currentUser.defaultBrandName || currentUser.default_brand_name || '';
  if (custLogo && !custLogo.value) custLogo.value = currentUser.defaultBrandLogoUrl || currentUser.default_brand_logo_url || '';
  if (custTheme && (!custTheme.value || custTheme.value === 'tiranga')) custTheme.value = currentUser.defaultTheme || currentUser.default_theme || 'tiranga';
  if (custRedir && !custRedir.value) custRedir.value = currentUser.defaultRedirectUrl || currentUser.default_redirect_url || '';
  if (custNote && !custNote.value) custNote.value = currentUser.defaultCustomNote || currentUser.default_custom_note || '';

  updateLiveStandPreview();

  // Check mandatory DPDP and non-refundable terms consent upon dashboard load
  checkMandatoryConsent();

  // Update Plan Pricing Cards for Extend & Upgrade states
  updatePlanCardsUI();
  loadMerchantLivePayments();
}

// Plan Tier Configuration for Extend vs Upgrade Hierarchy
const PLAN_TIER_CONFIG = {
  'SINGLE_MONTHLY': { name: '1-Website Monthly', amount: 299, period: '+30 Days', cycle: 'monthly', weight: 10 },
  'DUAL_MONTHLY':   { name: '2-Websites Monthly', amount: 549, period: '+30 Days', cycle: 'monthly', weight: 20 },
  'TRIPLE_MONTHLY': { name: '3-Websites Monthly', amount: 799, period: '+30 Days', cycle: 'monthly', weight: 30 },
  'QUAD_MONTHLY':   { name: '4-Websites Monthly', amount: 999, period: '+30 Days', cycle: 'monthly', weight: 40 },
  'FLEET_MONTHLY':  { name: '5-Websites Monthly', amount: 1199, period: '+30 Days', cycle: 'monthly', weight: 50 },
  'SINGLE_ANNUAL':  { name: '1-Website 1-Year', amount: 1999, period: '+1 Year', cycle: 'annual', weight: 60 },
  'DUAL_ANNUAL':    { name: '2-Websites 1-Year', amount: 3699, period: '+1 Year', cycle: 'annual', weight: 70 },
  'TRIPLE_ANNUAL':  { name: '3-Websites 1-Year', amount: 5399, period: '+1 Year', cycle: 'annual', weight: 80 },
  'QUAD_ANNUAL':    { name: '4-Websites 1-Year', amount: 6799, period: '+1 Year', cycle: 'annual', weight: 90 },
  'FLEET_ANNUAL':   { name: '5-Websites 1-Year', amount: 7999, period: '+1 Year', cycle: 'annual', weight: 100 }
};

function updatePlanCardsUI() {
  const userPlan = (currentUser && currentUser.plan && currentUser.plan !== 'NONE') ? currentUser.plan : null;
  const userPlanInfo = userPlan ? PLAN_TIER_CONFIG[userPlan] : null;

  document.querySelectorAll('.plan-card[data-plan-id]').forEach(card => {
    const planId = card.getAttribute('data-plan-id');
    const info = PLAN_TIER_CONFIG[planId];
    if (!info) return;

    const btn = card.querySelector(`[data-plan-btn="${planId}"]`) || card.querySelector('.btn-buy-plan');
    let badge = card.querySelector('.current-plan-badge-pill');

    if (userPlan && userPlan === planId) {
      // 1. Current Active Plan -> Highlight with glowing green & offer "Extend Validity"
      card.classList.add('current-active-plan');
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'current-plan-badge-pill';
        badge.innerHTML = '<span>✅</span> YOUR CURRENT ACTIVE PLAN';
        const nameEl = card.querySelector('.plan-name');
        if (nameEl) card.insertBefore(badge, nameEl);
      } else {
        badge.style.display = 'inline-flex';
      }

      if (btn) {
        btn.className = 'btn-buy-plan active-extend-btn';
        btn.innerHTML = `<span>🔄 Extend Plan Validity (${info.period} • ₹${info.amount})</span><span>➔</span>`;
        btn.title = `Click to extend validity of your ${info.name} plan`;
      }
    } else if (userPlan && userPlanInfo && info.weight > userPlanInfo.weight) {
      // 2. Higher Tier Plan -> Upgrade option
      card.classList.remove('current-active-plan');
      if (badge) badge.style.display = 'none';

      if (btn) {
        btn.className = 'btn-buy-plan upgrade-btn';
        btn.innerHTML = `<span>⚡ Upgrade to ${info.name} (₹${info.amount})</span><span>➔</span>`;
        btn.title = `Click to upgrade to ${info.name}`;
      }
    } else if (userPlan && userPlanInfo && info.weight < userPlanInfo.weight) {
      // 3. Lower Tier Plan -> Switch option
      card.classList.remove('current-active-plan');
      if (badge) badge.style.display = 'none';

      if (btn) {
        btn.className = 'btn-buy-plan';
        btn.innerHTML = `<span>Switch to ${info.name} (₹${info.amount})</span><span>➔</span>`;
      }
    } else {
      // 4. Default / No active plan
      card.classList.remove('current-active-plan');
      if (badge) badge.style.display = 'none';

      if (btn) {
        btn.className = info.cycle === 'annual' || planId.includes('FLEET') ? 'btn-buy-plan purple' : 'btn-buy-plan';
        btn.innerHTML = `<span>Buy ${info.name} (₹${info.amount}${info.cycle === 'annual' ? '/yr' : '/mo'})</span><span>➔</span>`;
      }
    }
  });
}

// Load User Orders for Payment Tracking & Dashboard
async function loadUserOrders() {
  if (!currentUser || !currentUser.email) return;

  try {
    const res = await fetch(`/api/v1/user/orders?email=${encodeURIComponent(currentUser.email)}&status=${currentOrderStatusFilter}`);
    const data = await res.json();
    if (data.success && data.orders) {
      userOrdersList = data.orders;
      renderOrdersTables(userOrdersList);
    }
  } catch (err) {
    console.warn('Failed to load user orders:', err);
  }
}

// Load User's Own Subscription Invoices
async function loadUserSubscriptionInvoices() {
  if (!currentUser || !currentUser.email) return;
  const tbody = document.getElementById('userSubscriptionInvoicesTbody');
  if (!tbody) return;

  try {
    const res = await fetch(`/api/v1/user/subscription-invoices?email=${encodeURIComponent(currentUser.email)}`);
    const data = await res.json();
    if (data.success && data.invoices) {
      if (data.invoices.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; color: var(--text-dim); padding: 24px;">
              No subscription receipts found. Once you activate a plan, billing receipts will appear here.
            </td>
          </tr>
        `;
        return;
      }
      tbody.innerHTML = data.invoices.map(inv => {
        const statusClass = (inv.status || 'PENDING').toLowerCase();
        const dateStr = inv.created_at ? new Date(inv.created_at).toLocaleString() : 'N/A';
        return `
          <tr>
            <td><span style="font-family: 'JetBrains Mono', monospace; font-weight: 700; color: #fff;">${inv.order_code}</span></td>
            <td><span class="badge-status paid" style="background: rgba(168,85,247,0.15); color: #c084fc; border-color: rgba(168,85,247,0.3);">${inv.plan_id || 'Plan'}</span></td>
            <td><strong>₹${Number(inv.amount).toFixed(2)}</strong></td>
            <td><span class="badge-status ${statusClass}">${inv.status}</span></td>
            <td>${inv.utr ? `<span style="font-family: 'JetBrains Mono', monospace; color: #34d399; font-weight: 700;">${inv.utr}</span>` : '<span style="color: var(--text-dim); font-size: 12px;">Awaiting Bank</span>'}</td>
            <td style="font-size: 12px; color: var(--text-dim);">${dateStr}</td>
            <td>
              <a href="/checkout/${inv.order_code}" target="_blank" class="nav-btn" style="padding: 4px 10px; font-size: 11px; display: inline-flex; color: var(--accent-cyan);">
                View Receipt ↗
              </a>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.warn('Failed to load subscription invoices:', err);
  }
}

// Render Orders in Tracking Table and Dashboard Snapshot
function renderOrdersTables(orders) {
  const paymentsTbody = document.getElementById('paymentsTableBody');
  const dashTbody = document.getElementById('dashOrdersTbody');

  if (!orders || orders.length === 0) {
    const emptyRow = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-dim); padding: 36px;">
          No payment orders found. When customers pay via your API, orders appear here with live real-time auto-verification.
        </td>
      </tr>
    `;
    if (paymentsTbody) paymentsTbody.innerHTML = emptyRow;
    if (dashTbody) dashTbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-dim); padding: 30px;">
          No payment orders yet. Once orders are created via your API, they will appear here.
        </td>
      </tr>
    `;
    return;
  }

  // Render Live Payment Tracking Table
  if (paymentsTbody) {
    paymentsTbody.innerHTML = orders.map(order => {
      const statusClass = (order.status || 'PENDING').toLowerCase();
      const dateStr = order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A';
      const isOffset = order.base_amount && Number(order.base_amount) !== Number(order.amount);
      const amountHtml = isOffset 
        ? `<strong>₹${Number(order.amount).toFixed(2)}</strong> <span style="font-size: 11px; color: #38bdf8;">(unique)</span>`
        : `<strong>₹${Number(order.amount).toFixed(2)}</strong>`;

      const utrHtml = order.utr 
        ? `<span style="font-family: 'JetBrains Mono', monospace; color: #34d399; font-weight: 700;">${order.utr}</span>
           <button type="button" class="btn-icon-copy" onclick="copyToClipboard('${order.utr}')" title="Copy UTR">📋</button>`
        : `<span style="color: var(--text-dim); font-size: 12px;">Awaiting Bank</span>`;

      return `
        <tr>
          <td><span style="font-family: 'JetBrains Mono', monospace; font-weight: 700; color: #fff;">${order.order_code}</span></td>
          <td>${amountHtml}</td>
          <td>
            <div style="font-weight: 600; color: #fff;">${order.customer_name || 'Guest'}</div>
            <div style="font-size: 11px; color: var(--text-dim);">${order.customer_phone || ''}</div>
          </td>
          <td><span class="badge-status ${statusClass}">${order.status}</span></td>
          <td>${utrHtml}</td>
          <td style="font-size: 12px; color: var(--text-dim);">${dateStr}</td>
          <td>
            <a href="/checkout/${order.order_code}" target="_blank" class="nav-btn" style="padding: 4px 10px; font-size: 12px; color: var(--accent-cyan); display: inline-flex;">
              Open ↗
            </a>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Render Dashboard Top 5 Orders
  if (dashTbody) {
    const topOrders = orders.slice(0, 5);
    dashTbody.innerHTML = topOrders.map(order => {
      const statusClass = (order.status || 'PENDING').toLowerCase();
      const dateStr = order.created_at ? new Date(order.created_at).toLocaleTimeString() : 'N/A';
      return `
        <tr>
          <td><span style="font-family: 'JetBrains Mono', monospace; font-weight: 700; color: #fff;">${order.order_code}</span></td>
          <td><strong>₹${Number(order.amount).toFixed(2)}</strong></td>
          <td>${order.customer_name || 'Guest'}</td>
          <td><span class="badge-status ${statusClass}">${order.status}</span></td>
          <td>${order.utr ? `<span style="font-family: 'JetBrains Mono', monospace; color: #34d399;">${order.utr}</span>` : '<span style="color: var(--text-dim);">—</span>'}</td>
          <td style="font-size: 12px; color: var(--text-dim);">${dateStr}</td>
        </tr>
      `;
    }).join('');
  }
}

// Filter orders in tracking table
function setOrderStatusFilter(status, btn) {
  currentOrderStatusFilter = status;
  document.querySelectorAll('.table-filter-pills .filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  loadUserOrders();
}

function filterOrdersTable() {
  const query = (document.getElementById('paymentsSearchInput')?.value || '').toLowerCase().trim();
  if (!query) {
    renderOrdersTables(userOrdersList);
    return;
  }
  const filtered = userOrdersList.filter(o => 
    (o.order_code && o.order_code.toLowerCase().includes(query)) ||
    (o.customer_name && o.customer_name.toLowerCase().includes(query)) ||
    (o.utr && o.utr.toLowerCase().includes(query))
  );
  renderOrdersTables(filtered);
}

let currentBuyingPlanId = null;
let currentAppliedCoupon = null;

// BUY PLAN: Opens Dynamic UPI QR Modal
async function initiateBuyPlan(planId, couponCode = '') {
  if (!currentUser) {
    showLoginOverlay();
    return;
  }

  currentBuyingPlanId = planId;
  const effectiveCoupon = (couponCode !== undefined ? couponCode : (currentAppliedCoupon || '')).trim().toUpperCase();

  const modal = document.getElementById('paymentModal');
  const modalPlanName = document.getElementById('modalPlanName');
  const modalPlanAmount = document.getElementById('modalPlanAmount');
  const modalQrImg = document.getElementById('modalQrImage');
  const modalOrderCode = document.getElementById('modalOrderCode');
  const modalStatusText = document.getElementById('modalStatusText');
  const modalCelebration = document.getElementById('modalCelebration');
  const modalPaymentDetails = document.getElementById('modalPaymentDetails');

  // Reset modal state
  if (modalCelebration) modalCelebration.style.display = 'none';
  if (modalPaymentDetails) modalPaymentDetails.style.display = 'block';
  if (modalStatusText) modalStatusText.innerHTML = '<div class="spinner"></div> Generating secure UPI payment order...';
  if (modal) modal.classList.add('open');

  try {
    const payload = {
      planId: planId,
      userEmail: currentUser.email
    };
    if (effectiveCoupon) {
      payload.couponCode = effectiveCoupon;
    }

    const res = await fetch('/api/v1/user/buy-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!data.success) {
      const fb = document.getElementById('modalCouponFeedback');
      if (fb && effectiveCoupon) {
        fb.style.display = 'block';
        fb.style.color = '#f87171';
        fb.innerText = '❌ ' + (data.error || 'Failed to apply coupon');
      } else {
        alert('Error creating plan order: ' + (data.error || 'Server error'));
        closePaymentModal();
      }
      return;
    }

    const order = data.order;

    // Check for 100% OFF Free Activation
    if (data.isFreeActivation || Number(order.amount) <= 0 || order.status === 'PAID') {
      if (modalFastPoller) clearInterval(modalFastPoller);
      if (activeOrderTimer) clearInterval(activeOrderTimer);
      handlePaymentSuccess({ status: 'PAID', amount: 0, utr: `100% FREE (${order.couponApplied?.code || 'COUPON'})` }, order);
      if (typeof confetti === 'function') {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
      return;
    }

    if (modalPlanName) modalPlanName.innerText = order.planName;
    if (modalPlanAmount) modalPlanAmount.innerText = `₹${Number(order.amount).toFixed(2)}`;
    if (modalOrderCode) modalOrderCode.innerText = order.orderCode;
    if (modalQrImg) modalQrImg.src = order.qrDataUrl;

    // Handle coupon UI in modal
    const couponBox = document.getElementById('modalCouponAppliedBox');
    const couponAppliedText = document.getElementById('modalCouponAppliedText');
    const couponFeedback = document.getElementById('modalCouponFeedback');
    const couponInput = document.getElementById('modalCouponInput');

    if (order.couponApplied) {
      currentAppliedCoupon = order.couponApplied.code;
      if (couponBox) couponBox.style.display = 'flex';
      if (couponAppliedText) {
        couponAppliedText.innerHTML = `🎉 <b>${order.couponApplied.code}</b> (${order.couponApplied.discountPercent}% OFF)`;
      }
      if (couponFeedback) {
        couponFeedback.style.display = 'block';
        couponFeedback.style.color = '#34d399';
        couponFeedback.innerHTML = `✅ Saved ₹${order.couponApplied.discountAmount.toFixed(2)}! Was ₹${order.baseAmount} ➔ <b>₹${order.amount.toFixed(2)}</b>`;
      }
      if (couponInput) couponInput.value = order.couponApplied.code;
    } else {
      if (couponBox) couponBox.style.display = 'none';
      if (couponFeedback) couponFeedback.style.display = 'none';
    }

    const isCurrentPlan = currentUser.plan && currentUser.plan === planId;
    const currentWeight = (PLAN_TIER_CONFIG[currentUser.plan] || {}).weight || 0;
    const targetWeight = (PLAN_TIER_CONFIG[planId] || {}).weight || 0;
    const isUpgrade = currentWeight > 0 && targetWeight > currentWeight;

    const modalCheckoutType = document.getElementById('modalCheckoutType');
    const modalCheckoutSubtitle = document.getElementById('modalCheckoutSubtitle');

    if (modalCheckoutType) {
      if (isCurrentPlan) {
        modalCheckoutType.innerText = '🔄 EXTEND PLAN VALIDITY';
        modalCheckoutType.style.color = '#34d399';
      } else if (isUpgrade) {
        modalCheckoutType.innerText = '⚡ UPGRADE SUBSCRIPTION';
        modalCheckoutType.style.color = '#c084fc';
      } else {
        modalCheckoutType.innerText = '💳 ACTIVATE SUBSCRIPTION';
        modalCheckoutType.style.color = 'var(--accent-cyan)';
      }
    }

    if (modalCheckoutSubtitle) {
      if (isCurrentPlan) {
        modalCheckoutSubtitle.style.display = 'block';
        modalCheckoutSubtitle.innerHTML = `Extending your active <b>${order.planName}</b>. Your plan validity will be extended by +${PLAN_TIER_CONFIG[planId]?.period || '30 Days'}!`;
      } else if (isUpgrade) {
        modalCheckoutSubtitle.style.display = 'block';
        modalCheckoutSubtitle.innerHTML = `Upgrading from <b>${currentUser.plan}</b> to <b>${order.planName}</b>. Unlocks additional website slots immediately!`;
      } else {
        modalCheckoutSubtitle.style.display = 'none';
      }
    }

    // Clean notice without tracking code explanation
    const modalNotice = document.getElementById('modalUniqueNotice');
    if (modalNotice) {
      modalNotice.innerHTML = `⚡ <span>Pay exact <b>₹${Number(order.amount).toFixed(2)}</b> for 1-second auto-verification</span>`;
    }

    // Mobile Intent links
    const btnGpay = document.getElementById('btnIntentGpay');
    const btnPhonepe = document.getElementById('btnIntentPhonepe');
    const btnPaytm = document.getElementById('btnIntentPaytm');
    if (btnGpay && order.intents) btnGpay.href = order.intents.gpay;
    if (btnPhonepe && order.intents) btnPhonepe.href = order.intents.phonepe;
    if (btnPaytm && order.intents) btnPaytm.href = order.intents.paytm;

    if (modalStatusText) {
      modalStatusText.innerHTML = `
        <div class="spinner"></div>
        <span>Awaiting instant bank settlement confirmation...</span>
      `;
    }

    if (socket && socket.connected) {
      socket.emit('join_order', order.orderCode);
    }

    startCountdownTimer(order.expiresAt);

    // Fast 1.5s Poller Fallback for Instant Plan Verification
    if (modalFastPoller) clearInterval(modalFastPoller);
    modalFastPoller = setInterval(async () => {
      try {
        const res = await fetch((API_BASE || '') + `/api/v1/orders/${order.orderCode}`);
        if (!res.ok) return;
        const oData = await res.json();
        if (oData.success && oData.order && oData.order.status === 'PAID') {
          if (modalFastPoller) clearInterval(modalFastPoller);
          handlePaymentSuccess({
            orderCode: oData.order.orderCode,
            status: 'PAID',
            amount: oData.order.amount,
            utr: oData.order.utr
          }, order);
        }
      } catch (_) {}
    }, 1500);

    const onOrderUpdate = (update) => {
      if (update.orderCode === order.orderCode && update.status === 'PAID') {
        if (modalFastPoller) clearInterval(modalFastPoller);
        socket.off('order_status_update', onOrderUpdate);
        handlePaymentSuccess(update, order);
      }
    };
    socket.on('order_status_update', onOrderUpdate);

  } catch (err) {
    console.error('Plan purchase error:', err);
    alert('Failed to initiate plan purchase. Please try again.');
    closePaymentModal();
  }
}

let modalFastPoller = null;

function startCountdownTimer(expiresAt) {
  if (activeOrderTimer) clearInterval(activeOrderTimer);
  const timerEl = document.getElementById('modalTimerText');

  const update = () => {
    const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    if (timerEl) timerEl.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    if (diff <= 0) {
      clearInterval(activeOrderTimer);
      if (modalFastPoller) clearInterval(modalFastPoller);
      const statusEl = document.getElementById('modalStatusText');
      if (statusEl) statusEl.innerHTML = '<span style="color: var(--accent-rose);">Order Expired. Please try again.</span>';
    }
  };

  update();
  activeOrderTimer = setInterval(update, 1000);
}

function handlePaymentSuccess(update, order) {
  if (activeOrderTimer) clearInterval(activeOrderTimer);
  if (modalFastPoller) clearInterval(modalFastPoller);

  const modalPaymentDetails = document.getElementById('modalPaymentDetails');
  const modalCelebration = document.getElementById('modalCelebration');
  const celebrationPlanText = document.getElementById('celebrationPlanText');

  if (modalPaymentDetails) modalPaymentDetails.style.display = 'none';
  if (modalCelebration) modalCelebration.style.display = 'block';

  if (celebrationPlanText) celebrationPlanText.innerText = `${order.planName} (₹${order.amount})`;

  currentUser.plan = order.planId;
  currentUser.hasActivePlan = true;
  if (order.planId?.includes('DUAL')) {
    currentUser.maxWebsites = 2;
  }
  if (update.user && update.user.api_key) {
    currentUser.apiKey = update.user.api_key;
  }
  sessionStorage.setItem('gateway_user', JSON.stringify(currentUser));

  renderDashboard();
  loadUserOrders();
}

function handleRealtimeActivation(data) {
  if (!data || !currentUser) return;
  currentUser.plan = data.plan;
  currentUser.hasActivePlan = true;
  if (data.plan?.includes('DUAL')) {
    currentUser.maxWebsites = 2;
  }
  if (data.user && data.user.api_key) {
    currentUser.apiKey = data.user.api_key;
  }
  sessionStorage.setItem('gateway_user', JSON.stringify(currentUser));
  renderDashboard();
  loadUserOrders();
  alert(`🎉 Payment Verified! Your ${data.plan} plan is now active with ♾️ UNLIMITED QR Credits!`);
}

function closePaymentModal() {
  const modal = document.getElementById('paymentModal');
  if (modal) modal.classList.remove('open');
  if (activeOrderTimer) clearInterval(activeOrderTimer);
  if (modalFastPoller) clearInterval(modalFastPoller);
  currentAppliedCoupon = null;
  const input = document.getElementById('modalCouponInput');
  if (input) input.value = '';
  const fb = document.getElementById('modalCouponFeedback');
  if (fb) fb.style.display = 'none';
  const box = document.getElementById('modalCouponAppliedBox');
  if (box) box.style.display = 'none';
}
window.closePaymentModal = closePaymentModal;

async function applyModalCoupon() {
  const input = document.getElementById('modalCouponInput');
  const fb = document.getElementById('modalCouponFeedback');
  const code = (input?.value || '').trim().toUpperCase();
  if (!code) {
    if (fb) {
      fb.style.display = 'block';
      fb.style.color = '#f87171';
      fb.innerText = '⚠️ Please enter a coupon code.';
    }
    return;
  }
  if (!currentBuyingPlanId) return;

  const btn = document.getElementById('btnApplyCouponModal');
  if (btn) { btn.disabled = true; btn.innerText = 'Validating...'; }
  if (fb) fb.style.display = 'none';

  try {
    const res = await fetch((API_BASE || '') + `/api/v1/user/coupon/validate?code=${encodeURIComponent(code)}&planId=${encodeURIComponent(currentBuyingPlanId)}`);
    const data = await res.json();
    if (!data.success || !data.valid) {
      if (fb) {
        fb.style.display = 'block';
        fb.style.color = '#f87171';
        fb.innerText = '❌ ' + (data.error || 'Invalid or expired coupon code.');
      }
      return;
    }

    currentAppliedCoupon = code;
    await initiateBuyPlan(currentBuyingPlanId, code);
  } catch (err) {
    if (fb) {
      fb.style.display = 'block';
      fb.style.color = '#f87171';
      fb.innerText = 'Network error: ' + err.message;
    }
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = 'Apply'; }
  }
}
window.applyModalCoupon = applyModalCoupon;

async function removeModalCoupon() {
  currentAppliedCoupon = null;
  const input = document.getElementById('modalCouponInput');
  if (input) input.value = '';
  const fb = document.getElementById('modalCouponFeedback');
  if (fb) fb.style.display = 'none';
  const box = document.getElementById('modalCouponAppliedBox');
  if (box) box.style.display = 'none';
  if (currentBuyingPlanId) {
    await initiateBuyPlan(currentBuyingPlanId, '');
  }
}
window.removeModalCoupon = removeModalCoupon;

// Bind and Permanently Lock Website Domain
async function handleBindWebsite(event) {
  event.preventDefault();
  if (!currentUser) return;

  const urlInput = document.getElementById('inputWebsiteUrl').value.trim();
  const feedback = document.getElementById('websiteLockFeedback');

  if (!urlInput) {
    alert('Please enter your website URL.');
    return;
  }

  const confirmMsg = `⚠️ STRICT POLICY: 1 API KEY = 1 WEBSITE.\n\nYou can only bind your website ONCE.\nAre you sure you want to permanently lock your API Key to:\n"${urlInput}"?\n\nThis cannot be modified or unlocked.`;
  if (!confirm(confirmMsg)) {
    return;
  }

  try {
    const res = await fetch('/api/v1/user/bind-website', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail: currentUser.email,
        websiteUrl: urlInput
      })
    });

    const data = await res.json();
    if (data.success) {
      currentUser.websiteUrl = data.user.websiteUrl;
      currentUser.isWebsiteLocked = true;
      currentUser.lockedWebsites = data.user.lockedWebsites;
      currentUser.maxWebsites = data.user.maxWebsites;
      currentUser.remainingWebsiteSlots = data.user.remainingWebsiteSlots;

      sessionStorage.setItem('gateway_user', JSON.stringify(currentUser));
      renderDashboard();

      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.color = '#34d399';
        feedback.innerText = '✅ ' + data.message;
      }
      alert('🎉 Success! Your website domain has been permanently locked to your API Key. The API Key is now ACTIVE!');
    } else {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.color = '#f87171';
        feedback.innerText = '❌ ' + (data.error || 'Failed to bind website');
      }
      alert('Error: ' + (data.error || 'Failed to bind website'));
    }
  } catch (err) {
    alert('Error binding website: ' + err.message);
  }
}

// Interactive API Test Playground: Proves website lock behavior
async function handleTestApiCall(event) {
  event.preventDefault();
  if (!currentUser) return;

  const amount = document.getElementById('testApiAmount').value;
  const customerName = document.getElementById('testApiCustomer').value;
  const resultBox = document.getElementById('testApiResult');

  if (resultBox) {
    resultBox.style.display = 'block';
    resultBox.style.background = 'rgba(0,0,0,0.5)';
    resultBox.style.border = '1px solid var(--border-subtle)';
    resultBox.style.color = '#cbd5e1';
    resultBox.innerHTML = '<div class="spinner"></div> Calling POST /api/v1/orders with your API key...';
  }

  try {
    const res = await fetch('/api/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': currentUser.apiKey || ''
      },
      body: JSON.stringify({
        amount: parseFloat(amount),
        customerName: customerName,
        customerPhone: '9876543210'
      })
    });

    const data = await res.json();

    if (resultBox) {
      if (!res.ok || !data.success) {
        // Blocked as expected if website is not locked
        resultBox.style.background = 'rgba(244, 63, 94, 0.12)';
        resultBox.style.border = '1px solid rgba(244, 63, 94, 0.35)';
        resultBox.style.color = '#f87171';
        resultBox.innerHTML = `
          <strong>❌ HTTP ${res.status} ${res.statusText}:</strong><br>
          ${data.error || 'Payment creation failed'}<br><br>
          <span style="color: #cbd5e1; font-size: 11.5px;">
            💡 Note: This demonstrates our strict protection: API keys cannot process payments until a website domain is registered and locked.
          </span>
        `;
      } else {
        // Successful order creation
        resultBox.style.background = 'rgba(16, 185, 129, 0.12)';
        resultBox.style.border = '1px solid rgba(16, 185, 129, 0.35)';
        resultBox.style.color = '#34d399';
        resultBox.innerHTML = `
          <strong>✅ Order Successfully Created!</strong><br>
          Order Code: <b>${data.order.orderCode}</b> | Amount: <b>₹${data.order.amount}</b><br>
          Status: <b>${data.order.status}</b><br>
          <div style="margin-top: 10px;">
            <a href="${data.order.checkoutUrl}" target="_blank" class="nav-btn" style="display: inline-flex; padding: 4px 10px; font-size: 12px; background: rgba(16, 185, 129, 0.2); color: #fff;">
              Open Test Checkout ↗
            </a>
          </div>
        `;
        loadUserOrders();
      }
    }
  } catch (err) {
    if (resultBox) {
      resultBox.style.background = 'rgba(244, 63, 94, 0.12)';
      resultBox.style.color = '#f87171';
      resultBox.innerHTML = `<strong>❌ Network Error:</strong> ${err.message}`;
    }
  }
}

// Regenerate API Key
async function handleRegenerateKey() {
  if (!currentUser) return;
  if (!confirm('Are you sure you want to regenerate your API Key? Integrations using your previous key will stop working.')) {
    return;
  }
  try {
    const res = await fetch('/api/v1/user/regenerate-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail: currentUser.email })
    });
    const data = await res.json();
    if (data.success) {
      currentUser.apiKey = data.apiKey;
      sessionStorage.setItem('gateway_user', JSON.stringify(currentUser));
      renderDashboard();
      alert('API Key regenerated successfully!');
    } else {
      alert('Error: ' + data.error);
    }
  } catch (err) {
    alert('Failed to regenerate key: ' + err.message);
  }
}

// Switch Monthly / Annual Billing View
function switchBillingCycle(cycle) {
  const btnMonthly = document.getElementById('btnTabMonthly');
  const btnAnnual = document.getElementById('btnTabAnnual');
  const gridMonthly = document.getElementById('gridMonthlyPlans');
  const gridAnnual = document.getElementById('gridAnnualPlans');

  if (cycle === 'annual') {
    if (btnMonthly) btnMonthly.classList.remove('active');
    if (btnAnnual) btnAnnual.classList.add('active');
    if (gridMonthly) gridMonthly.style.display = 'none';
    if (gridAnnual) gridAnnual.style.display = 'grid';
  } else {
    if (btnAnnual) btnAnnual.classList.remove('active');
    if (btnMonthly) btnMonthly.classList.add('active');
    if (gridAnnual) gridAnnual.style.display = 'none';
    if (gridMonthly) gridMonthly.style.display = 'grid';
  }

  updatePlanCardsUI();
}

// Open / Close VIP Contact Modal
function openContactModal() {
  const modal = document.getElementById('contactEnterpriseModal');
  if (modal) modal.style.display = 'flex';
}

function closeContactModal() {
  const modal = document.getElementById('contactEnterpriseModal');
  if (modal) modal.style.display = 'none';
}

// UPI Provider Auto-Detection & Selection
function autoDetectUpiProvider(vpa) {
  if (!vpa) return;
  const clean = vpa.trim().toLowerCase();
  const badge = document.getElementById('detectedProviderBadge');

  if (clean.includes('@paytm')) {
    setUpiProviderChoice('PAYTM', true);
    if (badge) badge.innerHTML = '📱 Auto-Detected: Paytm Business';
  } else if (clean.includes('@ybl') || clean.includes('@ibl') || clean.includes('@axl')) {
    setUpiProviderChoice('PHONEPE', true);
    if (badge) badge.innerHTML = '🟣 Auto-Detected: PhonePe UPI';
  } else if (clean.includes('@fam') || clean.includes('@fampay')) {
    setUpiProviderChoice('FAMPAY', true);
    if (badge) badge.innerHTML = '🟡 Auto-Detected: FamPay (@fam)';
  } else if (clean.includes('@okhdfcbank') || clean.includes('@okaxis') || clean.includes('@oksbi') || clean.includes('@okicici') || clean.includes('@upi')) {
    setUpiProviderChoice('BANK', true);
    if (badge) badge.innerHTML = '🏦 Auto-Detected: Bank / GPay';
  }
}

function setUpiProviderChoice(choice, isAuto = false) {
  const input = document.getElementById('inputMerchantProvider');
  if (input) input.value = choice;

  document.querySelectorAll('.upi-provider-chip').forEach(c => c.classList.remove('active'));
  const activeBtn = document.getElementById(`chip_${choice}`);
  if (activeBtn) activeBtn.classList.add('active');

  const badge = document.getElementById('detectedProviderBadge');
  if (badge && !isAuto) {
    const labels = {
      AUTO: '⚡ Auto-Detect: Ready',
      PAYTM: '📱 Selected: Paytm Business',
      PHONEPE: '🟣 Selected: PhonePe UPI',
      FAMPAY: '🟡 Selected: FamPay (@fam)',
      BANK: '🏦 Selected: Bank / GPay'
    };
    badge.innerHTML = labels[choice] || `⚡ Selected: ${choice}`;
  }
}

// Tab switching between 1-Click Google and Manual IMAP
function switchSettlementTab(tab) {
  const tabGoogle = document.getElementById('settlementTabGoogle');
  const tabImap = document.getElementById('settlementTabImap');
  const btnGoogle = document.getElementById('tabBtnGoogle');
  const btnImap = document.getElementById('tabBtnImap');

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
      btnImap.style.background = 'rgba(255, 255, 255, 0.05)';
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
      btnGoogle.style.background = 'rgba(255, 255, 255, 0.05)';
      btnGoogle.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      btnGoogle.style.color = 'var(--text-muted)';
    }
  }
}

// 1-Click Google Banking Link (uses gmail.readonly scope)
async function linkGoogleBankingGmail() {
  if (!currentUser) return;
  const upiInput = (document.getElementById('inputMerchantUpi')?.value || currentUser.upiVpa || '').trim();
  const bizInput = (document.getElementById('inputMerchantBusiness')?.value || currentUser.businessName || '').trim();
  const feedback = document.getElementById('settlementConfigFeedback');

  if (!upiInput) {
    alert('Please enter your Merchant UPI ID (e.g. yourname@okhdfcbank) first in Step 1 so customers can pay directly to your account.');
    document.getElementById('inputMerchantUpi')?.focus();
    return;
  }

  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
    provider.setCustomParameters({ prompt: 'select_account' });

    const btn = document.getElementById('btnLinkGoogleBanking');
    if (btn) btn.innerHTML = '<span>Connecting with Google...</span> ⏳';

    const result = await firebase.auth().signInWithPopup(provider);
    const accessToken = result.credential ? result.credential.accessToken : null;
    const googleEmail = result.user ? result.user.email : '';

    if (!accessToken) {
      alert('Could not obtain Google authorization token. Please ensure popup is permitted and try again.');
      if (btn) btn.innerHTML = '<span>🔗 Connect Banking Gmail with 1-Click (Read-Only)</span> <span>⚡</span>';
      return;
    }

    const providerInput = (document.getElementById('inputMerchantProvider')?.value || currentUser.upiProvider || 'AUTO').trim();

    const res = await fetch(`${API_BASE}/api/v1/user/banking/google-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail: currentUser.email,
        accessToken,
        googleEmail,
        upiVpa: upiInput,
        businessName: bizInput,
        upiProvider: providerInput
      })
    });

    const data = await res.json();
    if (data.success) {
      currentUser.upiVpa = data.user.upiVpa || upiInput;
      currentUser.businessName = data.user.businessName || bizInput;
      currentUser.upiProvider = data.user.upiProvider || providerInput;
      currentUser.gmailConnected = true;
      currentUser.gmailEmail = data.user.gmailEmail || googleEmail;
      currentUser.settlementType = 'GOOGLE_OAUTH';
      sessionStorage.setItem('gateway_user', JSON.stringify(currentUser));
      renderDashboard();

      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = 'rgba(16, 185, 129, 0.12)';
        feedback.style.border = '1px solid rgba(16, 185, 129, 0.3)';
        feedback.style.color = '#34d399';
        feedback.innerText = '✅ ' + data.message;
      }
      alert(`🎉 Success! Banking email (${currentUser.gmailEmail}) connected with 1-Click Read-Only Google sync! All customer payments to UPI ID (${currentUser.upiVpa}) will be verified in 1 second.`);
    } else {
      alert('Error: ' + (data.error || 'Failed to link Google banking email'));
    }
  } catch (err) {
    alert('Google connection cancelled or failed: ' + err.message);
  } finally {
    const btn = document.getElementById('btnLinkGoogleBanking');
    if (btn) btn.innerHTML = '<span>🔗 Connect Banking Gmail with 1-Click (Read-Only)</span> <span>⚡</span>';
  }
}

// Manual IMAP Banking Link
async function saveImapSettlementConfig(event) {
  event.preventDefault();
  if (!currentUser) return;

  const upiInput = (document.getElementById('inputMerchantUpi')?.value || currentUser.upiVpa || '').trim();
  const bizInput = (document.getElementById('inputMerchantBusiness')?.value || currentUser.businessName || '').trim();
  const emailInput = (document.getElementById('inputImapEmail')?.value || '').trim();
  const passInput = (document.getElementById('inputImapPass')?.value || '').trim();
  const hostInput = (document.getElementById('inputImapHost')?.value || 'imap.gmail.com').trim();
  const portInput = (document.getElementById('inputImapPort')?.value || '993').trim();
  const feedback = document.getElementById('settlementConfigFeedback');

  if (!upiInput) {
    alert('Please enter your Merchant UPI ID in Step 1 first.');
    document.getElementById('inputMerchantUpi')?.focus();
    return;
  }
  if (!emailInput || !passInput) {
    alert('Please enter both the Bank Alert Email and App Password.');
    return;
  }

  const providerInput = (document.getElementById('inputMerchantProvider')?.value || currentUser.upiProvider || 'AUTO').trim();

  try {
    const res = await fetch(`${API_BASE}/api/v1/user/banking/imap-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail: currentUser.email,
        upiVpa: upiInput,
        businessName: bizInput,
        upiProvider: providerInput,
        gmailEmail: emailInput,
        gmailAppPass: passInput,
        imapHost: hostInput,
        imapPort: portInput
      })
    });

    const data = await res.json();
    if (data.success) {
      currentUser.upiVpa = data.user.upiVpa || upiInput;
      currentUser.businessName = data.user.businessName || bizInput;
      currentUser.upiProvider = data.user.upiProvider || providerInput;
      currentUser.gmailConnected = true;
      currentUser.gmailEmail = data.user.gmailEmail || emailInput;
      currentUser.settlementType = 'IMAP';
      sessionStorage.setItem('gateway_user', JSON.stringify(currentUser));
      renderDashboard();

      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = 'rgba(16, 185, 129, 0.12)';
        feedback.style.border = '1px solid rgba(16, 185, 129, 0.3)';
        feedback.style.color = '#34d399';
        feedback.innerText = '✅ ' + data.message;
      }
      alert(`🎉 Success! Custom IMAP listener connected for ${currentUser.gmailEmail}. Direct payments will route to ${currentUser.upiVpa}!`);
    } else {
      alert('Error: ' + (data.error || 'Failed to save IMAP configuration'));
    }
  } catch (err) {
    alert('Error saving IMAP config: ' + err.message);
  }
}

// Disconnect Banking Channel
async function disconnectBankingChannel() {
  if (!currentUser) return;
  if (!confirm('Are you sure you want to disconnect this banking alert channel? Auto-verification will pause until you re-link.')) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/v1/user/banking/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail: currentUser.email })
    });
    const data = await res.json();
    if (data.success) {
      currentUser.gmailConnected = false;
      currentUser.gmailEmail = '';
      sessionStorage.setItem('gateway_user', JSON.stringify(currentUser));
      renderDashboard();
      alert('Banking alert channel disconnected.');
    }
  } catch (err) {
    alert('Failed to disconnect: ' + err.message);
  }
}

// Live Payment Monitor Feed for Merchant
async function loadMerchantLivePayments() {
  if (!currentUser || !currentUser.email) return;
  const tbody = document.getElementById('merchantLivePaymentsTableBody');
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/api/v1/user/banking/payments?email=${encodeURIComponent(currentUser.email)}`);
    const data = await res.json();

    if (data.success && data.payments && data.payments.length > 0) {
      tbody.innerHTML = data.payments.map(p => {
        const dateStr = p.received_at ? new Date(Number(p.received_at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : '-';
        const sourceLabel = p.source ? (p.source.includes('GOOGLE') ? '⚡ Google Link' : '⚙️ Bank IMAP') : 'Bank Sync';
        return `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
            <td style="padding: 10px 12px; font-weight: 800; color: #34d399; font-size: 13.5px;">₹${Number(p.amount).toFixed(2)}</td>
            <td style="padding: 10px 12px; font-family: monospace; color: #38bdf8; font-weight: 700;">${p.utr || 'Auto-Verified'}</td>
            <td style="padding: 10px 12px; font-weight: 600; color: #fff;">${p.order_code || 'Direct Store Order'}</td>
            <td style="padding: 10px 12px;"><span style="background: rgba(56,189,248,0.15); color: #38bdf8; padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: 700;">${sourceLabel}</span></td>
            <td style="padding: 10px 12px; color: var(--text-dim);">${dateStr}</td>
            <td style="padding: 10px 12px; text-align: right;"><span style="background: rgba(16,185,129,0.2); color: #34d399; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 4px;">🟢 SETTLED</span></td>
          </tr>
        `;
      }).join('');
    } else {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="padding: 24px; text-align: center; color: var(--text-muted);">
            No customer payments detected yet. When payments arrive at your UPI ID (${currentUser.upiVpa || 'VPA'}), they will appear here instantly!
          </td>
        </tr>
      `;
    }
  } catch (err) {
    // Ignore transient network errors
  }
}

// Backward compatibility alias
const saveSettlementConfig = saveImapSettlementConfig;
const saveGmailConfig = saveImapSettlementConfig;


function copyToClipboard(text) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    alert('Copied to clipboard: ' + text);
  }).catch(() => {
    prompt('Copy to clipboard:', text);
  });
}

// Payment Link Modal Handlers
function openPaymentLinkModal() {
  const modal = document.getElementById('paymentLinkModal');
  if (modal) modal.style.display = 'flex';
  const resultBox = document.getElementById('paymentLinkResultBox');
  if (resultBox) resultBox.style.display = 'none';
  document.getElementById('linkAmountInput')?.focus();
}

function closePaymentLinkModal() {
  const modal = document.getElementById('paymentLinkModal');
  if (modal) modal.style.display = 'none';
}

function setPaymentLinkExpiry(mins, el) {
  const input = document.getElementById('linkExpiryInput');
  if (input) input.value = mins;

  document.querySelectorAll('.expiry-pill').forEach(btn => btn.classList.remove('active'));
  if (el) el.classList.add('active');

  const lbl = document.getElementById('selectedExpiryLabel');
  if (lbl) {
    const textMap = {
      15: '⚡ 15 Minutes',
      30: '⏱️ 30 Minutes',
      60: '🕒 1 Hour (Standard)',
      360: '🌇 6 Hours',
      720: '🌙 12 Hours',
      1440: '⏳ 24 Hours (Full Day Max)'
    };
    lbl.innerText = textMap[mins] || `${mins} Mins`;
  }
}

async function handleCreatePaymentLink(event) {
  event.preventDefault();
  if (!currentUser) {
    alert('Please sign in first.');
    return;
  }

  const amountInput = document.getElementById('linkAmountInput');
  const customerInput = document.getElementById('linkCustomerInput');
  const phoneInput = document.getElementById('linkPhoneInput');
  const expiryInput = document.getElementById('linkExpiryInput');
  const btn = document.getElementById('btnSubmitCreateLink');

  const amount = parseFloat(amountInput?.value);
  if (!amount || isNaN(amount) || amount <= 0) {
    alert('Please enter a valid amount (e.g. 100)');
    amountInput?.focus();
    return;
  }

  const customerName = (customerInput?.value || 'Customer').trim();
  const customerPhone = (phoneInput?.value || '').trim();
  const expiryMinutes = parseInt(expiryInput?.value || '60', 10);

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>Reserving Unique Amount...</span> ⏳';
  }

  try {
    const res = await fetch(`${API_BASE}/api/v1/user/payment-links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail: currentUser.email,
        amount,
        customerName,
        customerPhone,
        expiryMinutes
      })
    });

    const data = await res.json();
    if (data.success && data.order) {
      const ord = data.order;
      const resultBox = document.getElementById('paymentLinkResultBox');
      const resCode = document.getElementById('resultOrderCode');
      const resAmount = document.getElementById('resultPayableAmount');
      const resExpiry = document.getElementById('resultExpiryText');
      const resUrl = document.getElementById('resultUrlInput');
      const btnWa = document.getElementById('btnShareWhatsApp');
      const btnOpen = document.getElementById('btnOpenCheckoutPage');

      if (resCode) resCode.innerText = ord.orderCode;
      if (resAmount) resAmount.innerText = `₹ ${Number(ord.amount).toFixed(2)}`;
      
      const expiryText = ord.expiryMinutes >= 60 
        ? `${Math.round(ord.expiryMinutes / 60)} hour${ord.expiryMinutes > 60 ? 's' : ''}`
        : `${ord.expiryMinutes} minutes`;
      if (resExpiry) resExpiry.innerText = `⏱️ Reserved exclusively for ${expiryText} (Ends: ${new Date(ord.expiresAt).toLocaleTimeString()})`;

      if (resUrl) resUrl.value = ord.checkoutUrl;
      if (btnWa) btnWa.href = ord.whatsappUrl;
      if (btnOpen) btnOpen.href = ord.checkoutUrl;

      if (resultBox) {
        resultBox.style.display = 'block';
        resultBox.scrollIntoView({ behavior: 'smooth' });
      }

      // Refresh recent orders
      loadUserOrders();
    } else {
      alert('Failed to generate payment link: ' + (data.error || 'Server error'));
    }
  } catch (err) {
    alert('Network error creating payment link: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>🚀 Generate Secure Payment Link</span>';
    }
  }
}

function copyPaymentLinkUrl() {
  const input = document.getElementById('resultUrlInput');
  if (!input || !input.value) return;
  navigator.clipboard.writeText(input.value);
  alert('📋 Payment link copied to clipboard!\n\n' + input.value);
}

// ==========================================
// CHECKOUT CUSTOMIZER & BRANDING CONTROLS
// ==========================================

function updateLiveStandPreview() {
  const nameInput = document.getElementById('customizerBrandName');
  const logoInput = document.getElementById('customizerBrandLogo');
  const themeInput = document.getElementById('customizerTheme');
  const noteInput = document.getElementById('customizerCustomNote');

  const previewName = document.getElementById('previewMerchantName');
  const previewLogo = document.getElementById('previewMerchantLogo');
  const previewNote = document.getElementById('previewCustomNote');
  const previewStrip = document.getElementById('previewTricolorStrip');
  const previewCard = document.getElementById('previewStandCard');

  if (previewName) {
    const val = nameInput?.value?.trim();
    previewName.innerText = val || (currentUser?.name ? `${currentUser.name}'s Store` : 'Your Brand Name');
  }

  if (previewLogo) {
    const url = logoInput?.value?.trim();
    if (url) {
      previewLogo.src = url;
    } else {
      previewLogo.src = '/images/logo.png';
    }
    previewLogo.onerror = () => {
      previewLogo.src = '/images/logo.png';
    };
  }

  if (previewNote) {
    const note = noteInput?.value?.trim();
    if (note) {
      previewNote.innerText = '📝 ' + note;
      previewNote.style.display = 'inline-block';
    } else {
      previewNote.innerText = '📝 Instant License Delivery on Payment';
      previewNote.style.display = 'inline-block';
    }
  }

  const theme = themeInput?.value || 'tiranga';
  if (previewStrip && previewCard) {
    if (theme === 'cyan') {
      previewStrip.style.background = 'linear-gradient(90deg, #06b6d4, #3b82f6)';
      previewCard.style.boxShadow = '0 16px 36px rgba(0,0,0,0.6), 0 0 25px rgba(6,182,212,0.3)';
    } else if (theme === 'purple') {
      previewStrip.style.background = 'linear-gradient(90deg, #8b5cf6, #ec4899)';
      previewCard.style.boxShadow = '0 16px 36px rgba(0,0,0,0.6), 0 0 25px rgba(139,92,246,0.3)';
    } else if (theme === 'emerald') {
      previewStrip.style.background = 'linear-gradient(90deg, #10b981, #059669)';
      previewCard.style.boxShadow = '0 16px 36px rgba(0,0,0,0.6), 0 0 25px rgba(16,185,129,0.3)';
    } else if (theme === 'amber') {
      previewStrip.style.background = 'linear-gradient(90deg, #f59e0b, #d97706)';
      previewCard.style.boxShadow = '0 16px 36px rgba(0,0,0,0.6), 0 0 25px rgba(245,158,11,0.3)';
    } else {
      // Default: Tiranga
      previewStrip.style.background = 'linear-gradient(90deg, #FF671F 0%, #FFFFFF 50%, #046A38 100%)';
      previewCard.style.boxShadow = '0 16px 36px rgba(0,0,0,0.6), 0 0 25px rgba(255,103,31,0.2)';
    }
  }
}

async function handleSaveBranding(event) {
  event.preventDefault();
  if (!currentUser || !currentUser.email) {
    alert('Please log in first.');
    return;
  }

  const name = document.getElementById('customizerBrandName')?.value?.trim() || '';
  const logo = document.getElementById('customizerBrandLogo')?.value?.trim() || '';
  const theme = document.getElementById('customizerTheme')?.value || 'tiranga';
  const redirectUrl = document.getElementById('customizerRedirectUrl')?.value?.trim() || '';
  const customNote = document.getElementById('customizerCustomNote')?.value?.trim() || '';
  const feedback = document.getElementById('brandingSaveFeedback');

  const btn = event.target.querySelector('button[type="submit"]');
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Saving Customizer Defaults...';
  }

  try {
    const res = await fetch(`${API_BASE}/api/v1/user/checkout-branding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail: currentUser.email,
        defaultBrandName: name,
        defaultBrandLogoUrl: logo,
        defaultTheme: theme,
        defaultRedirectUrl: redirectUrl,
        defaultCustomNote: customNote
      })
    });

    const data = await res.json();
    if (data.success) {
      currentUser.defaultBrandName = name;
      currentUser.defaultBrandLogoUrl = logo;
      currentUser.defaultTheme = theme;
      currentUser.defaultRedirectUrl = redirectUrl;
      currentUser.defaultCustomNote = customNote;
      sessionStorage.setItem('gateway_user', JSON.stringify(currentUser));

      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = 'rgba(16, 185, 129, 0.15)';
        feedback.style.color = '#34d399';
        feedback.style.border = '1px solid rgba(16, 185, 129, 0.3)';
        feedback.innerHTML = '✅ <strong>Branding Saved!</strong> Customer checkout pages and API orders will now reflect these customized styling defaults.';
        setTimeout(() => { if (feedback) feedback.style.display = 'none'; }, 6000);
      }
    } else {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = 'rgba(239, 68, 68, 0.15)';
        feedback.style.color = '#f87171';
        feedback.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        feedback.innerHTML = '❌ ' + (data.error || 'Failed to update checkout branding');
      }
    }
  } catch (err) {
    if (feedback) {
      feedback.style.display = 'block';
      feedback.style.background = 'rgba(239, 68, 68, 0.15)';
      feedback.style.color = '#f87171';
      feedback.style.border = '1px solid rgba(239, 68, 68, 0.3)';
      feedback.innerHTML = '❌ Network error: ' + err.message;
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>💾 Save Default Branding</span>';
    }
  }
}

// ==========================================
// MANDATORY DPDP & COOKIE CONSENT CONTROLS
// ==========================================

function checkMandatoryConsent() {
  if (!currentUser || !currentUser.email) return;
  const key = 'dpdp_consent_accepted_' + currentUser.email.toLowerCase().trim();
  const accepted = localStorage.getItem(key);
  const modal = document.getElementById('modalDpdpConsent');
  if (!accepted && modal) {
    modal.style.display = 'flex';
  }
}

function updateConsentBtnState() {
  const c1 = document.getElementById('modalCheckTerms');
  const c2 = document.getElementById('modalCheckPrivacy');
  const btn = document.getElementById('btnAcceptConsentModal');
  if (btn) {
    const isReady = !!(c1 && c1.checked && c2 && c2.checked);
    btn.disabled = !isReady;
    btn.style.opacity = isReady ? '1' : '0.5';
    btn.style.cursor = isReady ? 'pointer' : 'not-allowed';
  }
}

function submitUserConsent() {
  const c1 = document.getElementById('modalCheckTerms');
  const c2 = document.getElementById('modalCheckPrivacy');
  if (!c1?.checked || !c2?.checked) {
    alert('Please check both boxes to agree to our Terms & Conditions (100% Non-Refundable Policy) and Privacy Policy.');
    return;
  }
  if (currentUser && currentUser.email) {
    const key = 'dpdp_consent_accepted_' + currentUser.email.toLowerCase().trim();
    localStorage.setItem(key, String(Date.now()));
  }
  localStorage.setItem('cookie_consent_accepted', 'true');
  const modal = document.getElementById('modalDpdpConsent');
  if (modal) modal.style.display = 'none';
}


