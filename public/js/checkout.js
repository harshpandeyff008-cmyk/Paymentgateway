
// Extract orderCode from URL path (/checkout/:code)
const pathParts = window.location.pathname.split('/');
const orderCode = pathParts[pathParts.length - 1] || '';

// API Base configuration for static hosting (Firebase) vs local / monolithic server
const API_BASE = (window.location.hostname.includes('upigateway') || window.location.hostname.includes('nocostupi') || window.location.hostname.includes('web.app') || window.location.hostname.includes('firebaseapp.com'))
  ? 'https://personal-payment-gateway.vercel.app'
  : '';

let timerInterval = null;
let currentOrder = null;
let totalDurationSeconds = 300;

// Elements
const orderCodeBadge = document.getElementById('orderCodeBadge');
const orderCodeDisplay = document.getElementById('orderCodeDisplay');
const merchantName = document.getElementById('merchantName');
const amountDisplay = document.getElementById('amountDisplay');
const qrImage = document.getElementById('qrImage');
const timerClock = document.getElementById('timerClock');
const progressFill = document.getElementById('progressFill');
const statusMessage = document.getElementById('statusMessage');

const btnPayDirect = document.getElementById('btnPayDirect');
const btnGPay = document.getElementById('btnGPay');
const btnPhonePe = document.getElementById('btnPhonePe');
const btnPaytm = document.getElementById('btnPaytm');
const btnFamPay = document.getElementById('btnFamPay');
const btnNavi = document.getElementById('btnNavi');

const btnToggleUtr = document.getElementById('btnToggleUtr');
const utrBox = document.getElementById('utrBox');
const utrInput = document.getElementById('utrInput');
const btnSubmitUtr = document.getElementById('btnSubmitUtr');
const utrFeedback = document.getElementById('utrFeedback');

const successOverlay = document.getElementById('successOverlay');
const successOrderCode = document.getElementById('successOrderCode');
const successAmount = document.getElementById('successAmount');
const successUtr = document.getElementById('successUtr');
const successSender = document.getElementById('successSender');
const successTime = document.getElementById('successTime');

// 1. Fetch Order Details (Parallel Race: Fastest of API or Direct RTDB wins in <100ms)
async function loadOrder() {
  if (!orderCode) {
    showOrderNotFound('Error: Invalid order link.');
    return;
  }

  let order = null;
  const cleanCode = encodeURIComponent(String(orderCode).trim().toLowerCase().replace(/\./g, '_dot_'));
  const rtdbUrl = `https://upigateway-ccaa4-default-rtdb.firebaseio.com/orders/${cleanCode}.json`;
  const apiUrl = `${API_BASE}/api/orders/${orderCode}`;

  // Start both requests in parallel
  const apiPromise = fetch(apiUrl)
    .then(r => r.ok ? r.json() : null)
    .then(d => (d && d.success && d.order) ? d.order : null)
    .catch(() => null);

  const cloudPromise = fetch(rtdbUrl)
    .then(r => r.ok ? r.json() : null)
    .then(d => (d && (d.order_code || d.orderCode)) ? d : null)
    .catch(() => null);

  try {
    // Whichever returns valid data first displays immediately
    order = await Promise.any([
      apiPromise.then(res => res ? res : Promise.reject('no_api')),
      cloudPromise.then(res => res ? res : Promise.reject('no_cloud'))
    ]);
  } catch (_) {
    const [r1, r2] = await Promise.allSettled([apiPromise, cloudPromise]);
    order = (r1.status === 'fulfilled' ? r1.value : null) || (r2.status === 'fulfilled' ? r2.value : null);
  }

  if (!order) {
    showOrderNotFound('Order not found or has expired.');
    return;
  }

  currentOrder = order;
  renderOrder(currentOrder);

  // If already paid
  if (currentOrder.status === 'PAID') {
    showPaymentSuccess(currentOrder);
    return;
  }

  // If expired
  if (currentOrder.status === 'EXPIRED') {
    showExpired();
    return;
  }

  // Calculate live countdown timer
  const expiresAt = Number(currentOrder.expires_at || currentOrder.expiresAt || 0);
  const now = Date.now();
  const timeRemaining = expiresAt > now ? Math.floor((expiresAt - now) / 1000) : (currentOrder.timeRemainingSeconds || 300);
  startCountdown(timeRemaining);

  // Connect to WebSockets
  initRealtimeSocket();
}

// 2. Render Order & QR
function renderOrder(order) {
  const code = order.order_code || order.orderCode || orderCode;
  orderCodeDisplay.innerText = code;
  amountDisplay.innerText = `₹ ${Number(order.amount).toFixed(2)}`;
  if (merchantName) {
    merchantName.innerText = order.merchantName || order.merchant_name || order.brandName || order.brand_name || 'Personal Gateway';
  }

  // Custom Merchant Logo
  const merchantLogoImg = document.getElementById('merchantLogoImg');
  const logoUrl = order.brandLogoUrl || order.customLogoUrl || order.brand_logo_url || order.custom_logo_url || order.defaultBrandLogoUrl;
  if (merchantLogoImg && logoUrl) {
    merchantLogoImg.src = logoUrl;
  }

  // Custom Note or Order Description
  const customNoteBox = document.getElementById('customNoteBox');
  const customNoteText = order.customNote || order.description || order.custom_note || order.defaultCustomNote;
  if (customNoteBox && customNoteText) {
    customNoteBox.innerText = `📝 ${customNoteText}`;
    customNoteBox.style.display = 'block';
  }

  // Dynamic Theme Styling
  const theme = order.theme || order.defaultTheme || 'tiranga';
  if (theme && theme !== 'tiranga') {
    applyThemeStyling(theme);
  }

  const uniqueNotice = document.getElementById('uniqueAmountNotice');
  if (uniqueNotice) {
    uniqueNotice.innerHTML = `⚡ <span>Pay exact <b>₹${Number(order.amount).toFixed(2)}</b> for 1-second auto-verification</span>`;
  }

  // Construct fallback UPI URI if missing
  const merchantVpa = order.merchantVpa || order.merchant_vpa || order.upi_vpa || 'ffdealsbydas@fam';
  const resolvedUpiUri = order.upiUri || order.upi_uri || `upi://pay?pa=${encodeURIComponent(merchantVpa)}&pn=${encodeURIComponent(order.merchantName || order.merchant_name || 'Merchant')}&am=${Number(order.amount).toFixed(2)}&tr=${code}&tn=${code}&cu=INR&mode=00`;

  // Set dynamic QR code image source (instant base64 or stream endpoint)
  const qrLoader = document.getElementById('qrLoadingSpinner');
  qrImage.onload = () => {
    qrImage.style.opacity = '1';
    if (qrLoader) qrLoader.style.display = 'none';
  };
  qrImage.src = order.qrDataUrl || order.qrImageUrl || order.qrImage || `/api/qr?data=${encodeURIComponent(resolvedUpiUri)}`;
  if (qrImage.complete && qrImage.naturalWidth > 0) {
    qrImage.style.opacity = '1';
    if (qrLoader) qrLoader.style.display = 'none';
  }

  // Mobile Intent Links — corrected deep-link schemes per each app's actual handler
  const upiParams = resolvedUpiUri.replace(/^upi:\/\/pay\?/, '');
  btnPayDirect.href = resolvedUpiUri;

  // GPay: tez://upi/pay? is the correct scheme (not gpay://)
  btnGPay.href = `tez://upi/pay?${upiParams}`;

  // PhonePe: phonepe://pay? is correct (not phonepe://upi)
  btnPhonePe.href = `phonepe://pay?${upiParams}`;

  // Paytm: use Android intent for reliability (paytmmp:// is not consistent)
  const isAndroid = /android/i.test(navigator.userAgent);
  if (isAndroid) {
    btnPaytm.href = `intent://pay?${upiParams}#Intent;scheme=upi;package=net.one97.paytm;end`;
  } else {
    btnPaytm.href = `paytmmp://pay?${upiParams}`;
  }

  btnFamPay.href = resolvedUpiUri; // FamPay registers standard upi:// scheme

  if (btnNavi) {
    if (isAndroid) {
      btnNavi.href = `intent://pay?${upiParams}#Intent;scheme=upi;package=com.naviapp;end`;
    } else {
      btnNavi.href = resolvedUpiUri;
    }
  }
}

// 3. Live Countdown
function startCountdown(remainingSeconds) {
  let timeLeft = remainingSeconds;
  totalDurationSeconds = remainingSeconds > 0 ? remainingSeconds : 300;

  updateTimerDisplay(timeLeft);

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      updateTimerDisplay(0);
      showExpired();
    } else {
      updateTimerDisplay(timeLeft);
    }
  }, 1000);
}

function updateTimerDisplay(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    timerClock.innerText = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  } else {
    timerClock.innerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  
  const percentage = (seconds / totalDurationSeconds) * 100;
  progressFill.style.width = `${Math.max(0, percentage)}%`;

  if (seconds < 60) {
    timerClock.style.color = '#ef4444';
    progressFill.style.background = '#ef4444';
  } else {
    timerClock.style.color = '';
    progressFill.style.background = '';
  }
}

function showExpired() {
  statusMessage.innerText = 'Payment session expired! Please create a new order.';
  statusMessage.style.color = '#ef4444';
  qrImage.style.filter = 'grayscale(100%) opacity(30%)';
  btnPayDirect.style.pointerEvents = 'none';
  btnPayDirect.style.opacity = '0.5';
}

function showOrderNotFound(msg) {
  if (statusMessage) {
    statusMessage.innerHTML = `
      <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 12px; padding: 18px; margin: 12px 0; color: #fca5a5; font-size: 13.5px; line-height: 1.6; text-align: center;">
        <div style="font-size: 28px; margin-bottom: 8px;">⚠️</div>
        <strong style="color: #ffffff; font-size: 16px; display: block; margin-bottom: 6px;">Order Not Found or Expired</strong>
        <span>${msg}</span>
        <div style="margin-top: 10px; font-size: 12px; color: #94a3b8;">
          Ye order code (<b>${orderCode || 'Invalid'}</b>) active session me maujood nahi hai ya 5 minute ke baad expire ho gaya hai.<br>
          Kripya apne merchant store ya app se naya order create karein.
        </div>
      </div>
    `;
  }
  const qrBox = document.querySelector('.qr-wrapper');
  if (qrBox) qrBox.style.display = 'none';
  const payDirect = document.querySelector('.direct-pay-actions');
  if (payDirect) payDirect.style.display = 'none';
  const appGrid = document.querySelector('.upi-app-grid');
  if (appGrid) appGrid.style.display = 'none';
  const utrSection = document.querySelector('.utr-fallback-section');
  if (utrSection) utrSection.style.display = 'none';
  const timerSection = document.querySelector('.timer-section');
  if (timerSection) timerSection.style.display = 'none';
}

// 4. Connect WebSockets for Instant Push Alert + 1.5s Poller Fallback
let fastPoller = null;

function initRealtimeSocket() {
  // Ultra-fast HTTP Polling Fallback (with in-flight guard to prevent request queueing)
  if (orderCode) {
    if (fastPoller) clearInterval(fastPoller);
    let isPolling = false;
    let pollCycle = 0;
    fastPoller = setInterval(async () => {
      if (isPolling) return;
      isPolling = true;
      pollCycle++;
      try {
        const res = await fetch(`${API_BASE}/api/v1/orders/${orderCode}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.order && data.order.status === 'PAID') {
            clearInterval(fastPoller);
            showPaymentSuccess({
              orderCode: data.order.orderCode || data.order.order_code,
              amount: data.order.amount,
              utr: data.order.utr,
              sender: data.order.sender || data.order.sender_info,
              paidAt: data.order.paidAt || data.order.paid_at
            });
            return;
          }
        }

        // Direct RTDB check every 3rd cycle for double redundancy
        if (pollCycle % 3 === 0) {
          const cleanCode = encodeURIComponent(String(orderCode).trim().toLowerCase().replace(/\./g, '_dot_'));
          const rtdbRes = await fetch(`https://upigateway-ccaa4-default-rtdb.firebaseio.com/orders/${cleanCode}.json`);
          if (rtdbRes.ok) {
            const rtdbOrder = await rtdbRes.json();
            if (rtdbOrder && rtdbOrder.status === 'PAID') {
              clearInterval(fastPoller);
              showPaymentSuccess({
                orderCode: rtdbOrder.orderCode || rtdbOrder.order_code,
                amount: rtdbOrder.amount,
                utr: rtdbOrder.utr,
                sender: rtdbOrder.sender || rtdbOrder.sender_info,
                paidAt: rtdbOrder.paidAt || rtdbOrder.paid_at
              });
              return;
            }
          }
        }
      } catch (_) {}
      finally {
        isPolling = false;
      }
    }, 2000);
  }

  if (typeof io === 'undefined') return;

  const socket = io(API_BASE || undefined);

  socket.on('connect', () => {
    console.log('[Socket] Connected to realtime gateway.');
    // Join this specific order room
    socket.emit('join_order', orderCode);
  });

  socket?.on?.('order_status_update', (data) => {
    console.log('[Socket] Order update received:', data);
    if (data.status === 'PAID') {
      if (fastPoller) clearInterval(fastPoller);
      showPaymentSuccess(data);
    } else if (data.status === 'EXPIRED') {
      if (fastPoller) clearInterval(fastPoller);
      showExpired();
    }
  });
}

// 5. Success Screen & Confetti
function showPaymentSuccess(data) {
  if (fastPoller) clearInterval(fastPoller);
  clearInterval(timerInterval);

  successOrderCode.innerText = data.orderCode || orderCode;
  successAmount.innerText = `₹ ${Number(data.amount || currentOrder.amount).toFixed(2)}`;
  successUtr.innerText = data.utr || 'Auto-Verified';
  successSender.innerText = data.sender || 'UPI Verified';
  successTime.innerText = new Date(data.paidAt || Date.now()).toLocaleTimeString();

  successOverlay.classList.add('active');

  // Trigger audio chime (Web Audio API synthesized tone)
  playSuccessSound();

  // Confetti explosion!
  triggerConfetti();

  // Check if Merchant configured an automated redirect URL
  const targetRedirect = currentOrder?.redirectUrl || currentOrder?.returnUrl || currentOrder?.redirect_url || currentOrder?.return_url;
  if (targetRedirect && targetRedirect.startsWith('http')) {
    const redirectBox = document.getElementById('redirectBox');
    const redirectTimer = document.getElementById('redirectTimer');
    if (redirectBox && redirectTimer) {
      redirectBox.style.display = 'block';
      let secLeft = 3;
      redirectTimer.innerText = secLeft;
      const rInterval = setInterval(() => {
        secLeft--;
        if (secLeft <= 0) {
          clearInterval(rInterval);
          // Append verification query parameters to return URL
          const delim = targetRedirect.includes('?') ? '&' : '?';
          window.location.href = `${targetRedirect}${delim}order_code=${encodeURIComponent(data.orderCode || orderCode)}&status=PAID&utr=${encodeURIComponent(data.utr || '')}&amount=${encodeURIComponent(data.amount || currentOrder.amount)}`;
        } else {
          redirectTimer.innerText = secLeft;
        }
      }, 1000);
    }
  }
}

function applyThemeStyling(themeName) {
  const root = document.documentElement;
  if (themeName === 'cyan') {
    root.style.setProperty('--primary', '#38bdf8');
    root.style.setProperty('--primary-glow', 'rgba(56, 189, 248, 0.4)');
  } else if (themeName === 'purple') {
    root.style.setProperty('--primary', '#a855f7');
    root.style.setProperty('--primary-glow', 'rgba(168, 85, 247, 0.4)');
  } else if (themeName === 'emerald') {
    root.style.setProperty('--primary', '#10b981');
    root.style.setProperty('--primary-glow', 'rgba(16, 185, 129, 0.4)');
  } else if (themeName === 'amber') {
    root.style.setProperty('--primary', '#f59e0b');
    root.style.setProperty('--primary-glow', 'rgba(245, 158, 11, 0.4)');
  }
}

function playSuccessSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (_) {}
}

function triggerConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      });
    }, 250);
  }
}

// 6. UTR Fallback Submission
btnToggleUtr.addEventListener('click', () => {
  utrBox.classList.toggle('open');
});

btnSubmitUtr.addEventListener('click', async () => {
  const val = utrInput.value.trim();
  if (val.length < 6) {
    utrFeedback.innerText = 'Please enter a valid 12-digit UTR/Ref number';
    utrFeedback.style.color = '#ef4444';
    return;
  }

  btnSubmitUtr.disabled = true;
  btnSubmitUtr.innerText = 'Verifying...';
  utrFeedback.innerText = '';

  try {
    const res = await fetch(`${API_BASE}/api/orders/${orderCode}/verify-utr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ utr: val })
    });

    const data = await res.json();
    if (data.success && data.order?.status === 'PAID') {
      showPaymentSuccess(data.order);
    } else {
      utrFeedback.innerText = data.message || 'Payment not found for this UTR yet.';
      utrFeedback.style.color = '#f59e0b';
    }
  } catch (err) {
    utrFeedback.innerText = 'Error submitting UTR. Please retry.';
    utrFeedback.style.color = '#ef4444';
  } finally {
    btnSubmitUtr.disabled = false;
    btnSubmitUtr.innerText = 'Verify';
  }
});

// Copy Order ID
orderCodeBadge.addEventListener('click', () => {
  navigator.clipboard.writeText(orderCode);
  const oldText = orderCodeDisplay.innerText;
  orderCodeDisplay.innerText = 'Copied!';
  setTimeout(() => { orderCodeDisplay.innerText = oldText; }, 1500);
});

// Start
loadOrder();
