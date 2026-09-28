import fs from 'fs';
import path from 'path';

const gatewayRoot = 'c:\\Users\\harsh\\Desktop\\personal gateway';

// 1. Update config.js
const configPath = path.join(gatewayRoot, 'config.js');
let configCode = fs.readFileSync(configPath, 'utf8');
if (!configCode.includes('paypendicular.web.app')) {
  configCode = configCode.replace(
    'https://dealsbyshiv.web.app',
    'https://paypendicular.web.app,https://paypendicular.firebaseapp.com,https://dealsbyshiv.web.app'
  );
  fs.writeFileSync(configPath, configCode, 'utf8');
  console.log('✅ Updated config.js with paypendicular origins');
}

// 2. Update src/app.js
const appJsPath = path.join(gatewayRoot, 'src', 'app.js');
let appJsCode = fs.readFileSync(appJsPath, 'utf8');
if (!appJsCode.includes('paypendicular')) {
  appJsCode = appJsCode.replace(
    "'https://dealsbyshiv.web.app',",
    "'https://paypendicular.web.app',\n    'https://paypendicular.firebaseapp.com',\n    'https://dealsbyshiv.web.app',"
  );
  appJsCode = appJsCode.replace(
    "normalized.includes('dealsbyshiv') ||",
    "normalized.includes('paypendicular') ||\n      normalized.includes('dealsbyshiv') ||"
  );
  fs.writeFileSync(appJsPath, appJsCode, 'utf8');
  console.log('✅ Updated src/app.js with paypendicular CORS support');
}

// 3. Update apiKeyAuth.js to allow paypendicular as admin test
const authPath = path.join(gatewayRoot, 'src', 'middlewares', 'apiKeyAuth.js');
let authCode = fs.readFileSync(authPath, 'utf8');
if (!authCode.includes('paypendicular')) {
  authCode = authCode.replace(
    "const isAdminConsoleTest = req.headers['x-admin-test'] === 'true' ||",
    "const isAdminConsoleTest = req.headers['x-admin-test'] === 'true' || originDomain.includes('paypendicular') ||"
  );
  fs.writeFileSync(authPath, authCode, 'utf8');
  console.log('✅ Updated apiKeyAuth.js with paypendicular admin test exemption');
}

// 4. Update public/admin.html
const adminHtmlPath = path.join(gatewayRoot, 'public', 'admin.html');
let adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');

// Ensure external CDN for Socket.IO is used so it works on standalone hosting
adminHtml = adminHtml.replace('<script src="/socket.io/socket.io.js"></script>', '<script src="https://cdn.socket.io/4.8.1/socket.io.min.js"></script>');

// Ensure Firebase CDN scripts in <head>
if (!adminHtml.includes('firebase-app-compat.js')) {
  adminHtml = adminHtml.replace('</head>', `  <!-- Firebase SDK for Google Admin Authentication -->
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
</head>`);
}

// Ensure Lock Screen has Google Sign-in & Master key
const lockScreenStart = '<div id="masterKeyLockScreen"';
const lockScreenEnd = '<!-- Top Navbar -->';

const newLockScreenHtml = `<div id="masterKeyLockScreen" style="display: flex; position: fixed; inset: 0; background: radial-gradient(circle at 50% 20%, rgba(30, 41, 59, 0.98), rgba(11, 15, 25, 0.99)); backdrop-filter: blur(30px); z-index: 99999; align-items: center; justify-content: center; padding: 20px;">
    <div style="background: rgba(18, 24, 39, 0.90); border: 1px solid rgba(56, 189, 248, 0.3); box-shadow: 0 25px 70px rgba(0, 0, 0, 0.85), 0 0 50px rgba(56, 189, 248, 0.2); border-radius: 24px; max-width: 440px; width: 100%; padding: 42px 32px; text-align: center; position: relative; overflow: hidden;">
      
      <!-- Top Cyber Neon Glow Line -->
      <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #38bdf8, #a855f7, #10b981);"></div>

      <!-- Glowing Shield Icon -->
      <div style="width: 76px; height: 76px; background: linear-gradient(135deg, rgba(56, 189, 248, 0.25) 0%, rgba(168, 85, 247, 0.25) 100%); border: 1px solid rgba(56, 189, 248, 0.5); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 34px; box-shadow: 0 0 30px rgba(56, 189, 248, 0.4);">
        🛡️
      </div>

      <h2 style="font-size: 24px; font-weight: 700; color: #fff; margin-bottom: 6px; letter-spacing: -0.5px;">PayPerpendicular Terminal</h2>
      <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 24px; line-height: 1.5;">
        Protected Access. Sirf authorized superadmin <span style="color: #38bdf8; font-weight: 600;">hapa1929@gmail.com</span> ke liye permitted hai.
      </p>

      <!-- Google Sign In Button -->
      <button type="button" id="btnGoogleSignIn" onclick="handleGoogleSignIn()" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 12px; padding: 14px 20px; font-size: 15px; font-weight: 600; color: #fff; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 12px; cursor: pointer; transition: all 0.25s ease; box-shadow: 0 4px 20px rgba(0,0,0,0.4);" onmouseover="this.style.background='rgba(255,255,255,0.15)'; this.style.borderColor='#38bdf8'; this.style.transform='translateY(-1px)';" onmouseout="this.style.background='rgba(255,255,255,0.08)'; this.style.borderColor='rgba(255,255,255,0.25)'; this.style.transform='none';">
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
        </svg>
        <span>Sign in with Google</span>
      </button>

      <!-- Feedback / Error Area -->
      <div id="googleAuthFeedback" style="display: none; font-size: 12.5px; padding: 12px 14px; border-radius: 8px; margin-top: 14px; text-align: left; line-height: 1.4;"></div>

      <!-- Divider -->
      <div style="display: flex; align-items: center; margin: 24px 0 18px; color: var(--text-dim); font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">
        <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.08);"></div>
        <span style="padding: 0 10px;">or master key</span>
        <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.08);"></div>
      </div>

      <!-- Master Key Fallback Form -->
      <form id="masterKeyForm" onsubmit="submitMasterKey(event)">
        <div class="form-group" style="margin-bottom: 14px;">
          <div style="position: relative;">
            <input type="password" id="inputMasterKey" class="form-control" placeholder="Enter Master Key" style="font-size: 13px; padding-right: 44px; text-align: center; letter-spacing: 0.5px;">
            <button type="button" onclick="toggleMasterKeyInputVisibility()" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 15px;">
              👁️
            </button>
          </div>
          <div id="masterKeyError" style="display: none; font-size: 11.5px; color: var(--accent-red); margin-top: 6px; font-weight: 500;">
            ❌ Invalid Master Key. Access Denied.
          </div>
        </div>

        <button type="submit" class="btn btn-secondary" id="btnUnlockDashboard" style="width: 100%; justify-content: center; padding: 9px; font-size: 12.5px;">
          🔓 Unlock with Master Key
        </button>
      </form>

      <div style="margin-top: 24px; font-size: 11px; color: var(--text-dim);">
        Live Hosting: <code style="color: #38bdf8;">paypendicular.web.app</code>
      </div>
    </div>
  </div>

  `;

if (adminHtml.includes(lockScreenStart) && adminHtml.includes(lockScreenEnd)) {
  const sIdx = adminHtml.indexOf(lockScreenStart);
  const eIdx = adminHtml.indexOf(lockScreenEnd);
  adminHtml = adminHtml.substring(0, sIdx) + newLockScreenHtml + adminHtml.substring(eIdx);
}

// Add user profile pill & logout button in navbar if not present
const navbarActionsTarget = '<button class="btn btn-primary btn-sm" onclick="openCreateOrderModal()">+ Create Order</button>';
const navbarUserPill = `<div id="navUserProfile" style="display: none; align-items: center; gap: 8px; background: rgba(255,255,255,0.05); padding: 4px 10px 4px 6px; border-radius: 30px; border: 1px solid rgba(255,255,255,0.1);">
        <img id="navUserAvatar" src="https://lh3.googleusercontent.com/a/default-user" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;" alt="Admin">
        <span id="navUserEmail" style="font-size: 11.5px; font-weight: 500; color: #38bdf8;">hapa1929@gmail.com</span>
        <button onclick="handleAdminLogout()" style="background: none; border: none; color: #f87171; cursor: pointer; font-size: 13px; margin-left: 4px;" title="Logout">🚪</button>
      </div>\n      ` + navbarActionsTarget;

if (adminHtml.includes(navbarActionsTarget) && !adminHtml.includes('navUserProfile')) {
  adminHtml = adminHtml.replace(navbarActionsTarget, navbarUserPill);
}

fs.writeFileSync(adminHtmlPath, adminHtml, 'utf8');

// Copy admin.html to index.html for root hosting
fs.writeFileSync(path.join(gatewayRoot, 'public', 'index.html'), adminHtml, 'utf8');
console.log('✅ Created public/index.html from admin.html for paypendicular root serving');

// 5. Update public/js/admin.js
const adminJsPath = path.join(gatewayRoot, 'public', 'js', 'admin.js');
let adminJs = fs.readFileSync(adminJsPath, 'utf8');

// Ensure API_BASE is defined at the very top of admin.js
const apiBaseDef = `// Dynamically resolve Gateway Backend URL (supports paypendicular.web.app, localhost, and Render)
const API_BASE = (window.location.hostname.includes('paypendicular') || window.location.hostname.includes('web.app') || window.location.hostname.includes('firebaseapp.com')) 
  ? 'https://payment-gateway-ydl1.onrender.com' 
  : '';
`;

if (!adminJs.includes('const API_BASE =')) {
  adminJs = apiBaseDef + '\n' + adminJs;
}

// Replace relative fetch endpoints with API_BASE + endpoint
const fetchEndpoints = [
  "'/api/admin/stats'",
  "'/api/admin/orders'",
  "'/api/admin/payments'",
  "'/api/admin/logs'",
  "'/api/admin/domain-keys'",
  "'/api/admin/api-key'",
  "'/api/admin/settings'",
  "'/api/admin/simulate-payment'",
  "'/api/admin/auth/verify-master-key'",
  "'/api/admin/auth/change-master-key'",
  "'/api/admin/imap/test'",
  "'/api/admin/imap/restart'",
  "'/api/admin/imap/recent'",
  "'/api/admin/imap/sync-history'",
  "'/api/admin/ledger'",
  "'/api/admin/ledger/parse-paste'",
  "'/api/orders/create'"
];

fetchEndpoints.forEach(ep => {
  const target1 = `fetch(${ep}`;
  const repl1 = `fetch(API_BASE + ${ep}`;
  adminJs = adminJs.replaceAll(target1, repl1);

  const targetBacktick = `fetch(\`${ep.slice(1, -1)}`;
  const replBacktick = `fetch(\`\${API_BASE}${ep.slice(1, -1)}`;
  adminJs = adminJs.replaceAll(targetBacktick, replBacktick);
});

// Also replace dynamic domain-keys DELETE fetch: `/api/admin/domain-keys/${id}`
adminJs = adminJs.replaceAll("fetch(`/api/admin/domain-keys/", "fetch(`${API_BASE}/api/admin/domain-keys/");

// Update socket connection to point to API_BASE
adminJs = adminJs.replace("const socket = io();", "const socket = io(API_BASE || undefined);");

// Ensure Google Auth code is present
const googleAuthJsCode = `
// ==========================================
// FIREBASE GOOGLE AUTH & ACCESS CONTROL
// ==========================================
const REQUIRED_ADMIN_EMAIL = 'hapa1929@gmail.com';

const firebaseConfig = {
  apiKey: "AIzaSyCBdKUeKjvShFwL3_S5F9M0uYdQHf5poRU",
  authDomain: "payment-gatway-18d03.firebaseapp.com",
  projectId: "payment-gatway-18d03",
  storageBucket: "payment-gatway-18d03.firebasestorage.app",
  messagingSenderId: "90403754513",
  appId: "1:90403754513:web:5f3cc2279461ec14d797b0",
  measurementId: "G-Z8H449C6LX"
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

// Auto-check stored session
(function checkStoredAuth() {
  const storedAuth = sessionStorage.getItem('gateway_admin_auth');
  const storedEmail = sessionStorage.getItem('gateway_admin_email');
  if (storedAuth === 'google' && storedEmail === REQUIRED_ADMIN_EMAIL.toLowerCase()) {
    setTimeout(() => {
      const lockScreen = document.getElementById('masterKeyLockScreen');
      if (lockScreen) lockScreen.style.display = 'none';
      const navPill = document.getElementById('navUserProfile');
      if (navPill) navPill.style.display = 'flex';
      const navEmail = document.getElementById('navUserEmail');
      if (navEmail) navEmail.innerText = storedEmail;
    }, 100);
  }
})();

// Monitor Auth State
if (fbAuth) {
  fbAuth.onAuthStateChanged((user) => {
    if (user) {
      verifyAdminUser(user);
    }
  });
}

async function handleGoogleSignIn() {
  if (!fbAuth) {
    alert('Firebase Auth library is still loading. Please check your internet connection.');
    return;
  }

  const feedback = document.getElementById('googleAuthFeedback');
  const btn = document.getElementById('btnGoogleSignIn');

  btn.disabled = true;
  btn.style.opacity = '0.7';
  if (feedback) {
    feedback.style.display = 'block';
    feedback.style.background = 'rgba(56, 189, 248, 0.1)';
    feedback.style.border = '1px solid rgba(56, 189, 248, 0.2)';
    feedback.style.color = '#38bdf8';
    feedback.innerText = 'Google Login popup khul raha hai...';
  }

  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await fbAuth.signInWithPopup(provider);
    const user = result.user;
    await verifyAdminUser(user);
  } catch (err) {
    console.error('Google Sign In Error:', err);
    if (feedback) {
      feedback.style.display = 'block';
      feedback.style.background = 'rgba(239, 68, 68, 0.15)';
      feedback.style.border = '1px solid rgba(239, 68, 68, 0.3)';
      feedback.style.color = '#f87171';
      feedback.innerText = 'Login Failed: ' + (err.message || 'Popup closed');
    }
  } finally {
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}
window.handleGoogleSignIn = handleGoogleSignIn;

async function verifyAdminUser(user) {
  const feedback = document.getElementById('googleAuthFeedback');
  const userEmail = (user.email || '').toLowerCase().trim();

  if (userEmail === REQUIRED_ADMIN_EMAIL.toLowerCase()) {
    // ACCESS GRANTED!
    sessionStorage.setItem('gateway_admin_auth', 'google');
    sessionStorage.setItem('gateway_admin_email', userEmail);
    sessionStorage.setItem('gateway_master_key', 'shivambhatt@admin');

    if (feedback) {
      feedback.style.display = 'block';
      feedback.style.background = 'rgba(16, 185, 129, 0.15)';
      feedback.style.border = '1px solid rgba(16, 185, 129, 0.3)';
      feedback.style.color = '#34d399';
      feedback.innerHTML = '✅ <b>Access Granted!</b> Welcome Harsh (' + userEmail + '). Loading PayPerpendicular...';
    }

    const navPill = document.getElementById('navUserProfile');
    const navAvatar = document.getElementById('navUserAvatar');
    const navEmail = document.getElementById('navUserEmail');
    if (navPill) navPill.style.display = 'flex';
    if (navAvatar && user.photoURL) navAvatar.src = user.photoURL;
    if (navEmail) navEmail.innerText = userEmail;

    setTimeout(() => {
      document.getElementById('masterKeyLockScreen').style.display = 'none';
      if (typeof loadStats === 'function') loadStats();
      if (typeof loadOrders === 'function') loadOrders();
      if (typeof loadDomainKeysList === 'function') loadDomainKeysList();
    }, 600);

  } else {
    // ACCESS DENIED!
    if (feedback) {
      feedback.style.display = 'block';
      feedback.style.background = 'rgba(239, 68, 68, 0.2)';
      feedback.style.border = '1px solid rgba(239, 68, 68, 0.4)';
      feedback.style.color = '#fca5a5';
      feedback.innerHTML = '⛔ <b>ACCESS DENIED!</b><br>Yeh account (' + (user.email || 'unknown') + ') authorized nahi hai. Sirf <b>' + REQUIRED_ADMIN_EMAIL + '</b> ko is gateway ka access hai.';
    }
    await fbAuth.signOut();
  }
}

async function handleAdminLogout() {
  if (fbAuth) {
    await fbAuth.signOut();
  }
  sessionStorage.removeItem('gateway_admin_auth');
  sessionStorage.removeItem('gateway_admin_email');
  sessionStorage.removeItem('gateway_master_key');
  window.location.reload();
}
window.handleAdminLogout = handleAdminLogout;
`;

if (!adminJs.includes('FIREBASE GOOGLE AUTH & ACCESS CONTROL')) {
  adminJs += '\n' + googleAuthJsCode;
}
fs.writeFileSync(adminJsPath, adminJs, 'utf8');
console.log('✅ Updated public/js/admin.js with API_BASE and Google Auth');

// 6. Create firebase.json inside personal gateway targeted to site paypendicular
const firebaseJsonPath = path.join(gatewayRoot, 'firebase.json');
const firebaseJsonContent = JSON.stringify({
  "hosting": {
    "site": "paypendicular",
    "public": "public",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}, null, 2);

fs.writeFileSync(firebaseJsonPath, firebaseJsonContent, 'utf8');
console.log('✅ Created firebase.json in personal gateway pointing to paypendicular site');

// 7. Create .firebaserc inside personal gateway
const firebasercPath = path.join(gatewayRoot, '.firebaserc');
const firebasercContent = JSON.stringify({
  "projects": {
    "default": "payment-gatway-18d03"
  }
}, null, 2);
fs.writeFileSync(firebasercPath, firebasercContent, 'utf8');
console.log('✅ Created .firebaserc pointing to payment-gatway-18d03');

console.log('🎉 Setup for PayPerpendicular completed successfully!');
