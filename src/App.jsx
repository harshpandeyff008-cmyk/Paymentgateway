import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import ClientDashboard from './pages/ClientDashboard';
import Profile from './pages/Profile';
import SetupAdmin from './pages/SetupAdmin';
import Pricing from './pages/Pricing';
import TermsAndConditions from './pages/TermsAndConditions';
import PrivacyPolicy from './pages/PrivacyPolicy';
import RefundPolicy from './pages/RefundPolicy';
import ContactUs from './pages/ContactUs';
import OAuthCallback from './pages/OAuthCallback';
import ZohoCallback from './pages/ZohoCallback';
import GmailMonitor from './pages/GmailMonitor';
import SubscriptionInfo from './pages/SubscriptionInfo';
import PremiumDashboard from './pages/PremiumDashboard';
import LicenseKeys from './pages/LicenseKeys';
import ApiKeys from './pages/ApiKeys';
import FFStore from './pages/FFStore';
import Inventory from './pages/Inventory';
import Signup from './pages/Signup';
import Maintenance from './pages/Maintenance';
import TelegramLicenses from './pages/TelegramLicenses';
import FFStorePublicUpload from './pages/FFStorePublicUpload';
import PublicStore from './pages/PublicStore';
import TermsEditor from './pages/TermsEditor';
import SuspiciousLogs from './pages/SuspiciousLogs';
import UserDashboard from './pages/UserDashboard';
import AdminUsers from './pages/AdminUsers';
import GarenaSplashLoader from './components/GarenaSplashLoader';
import CookieConsentBanner from './components/CookieConsentBanner';
import { AdminGuard, ClientGuard, AuthGuard, StoreStaffGuard } from './components/RouteGuard';
import { subscribeToMaintenanceMode } from './firebase/firestore';
import { Wrench } from 'lucide-react';

import { useLocation } from 'react-router-dom';
import { logoutUser } from './firebase/auth';

function MaintenanceWrapper({ children }) {
  const { currentUser, userDoc, loading: authLoading } = useAuth();
  const [maintenance, setMaintenance] = useState({ maintenanceMode: false, maintenanceMessage: '', allowAdminLogin: true });
  const [loading, setLoading] = useState(true);
  const [splashFinished, setSplashFinished] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const unsub = subscribeToMaintenanceMode((data) => {
      setMaintenance(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Normalise role
  const userRole = (userDoc?.role || '').toLowerCase().trim();
  const isClientOrUser = userRole === 'client' || userRole === 'user';

  // Auto-kill client & user sessions immediately if maintenance mode is active
  useEffect(() => {
    if (maintenance.maintenanceMode && currentUser && isClientOrUser) {
      logoutUser().catch(console.error);
    }
  }, [maintenance.maintenanceMode, currentUser, isClientOrUser]);

  // Wait for userDoc if currentUser is authenticated so role is never undetermined
  if (loading || authLoading || (currentUser && !userDoc) || !splashFinished) {
    return (
      <GarenaSplashLoader onFinished={() => setSplashFinished(true)} />
    );
  }

  // Strict Privilege Check: ONLY verified Admin, SuperAdmin, Employee, Staff can bypass maintenance
  const isPrivileged = userRole === 'admin' || userRole === 'superadmin' || userRole === 'employee' || userRole === 'staff';
  
  const pathname = (location?.pathname || '').toLowerCase();
  const isLoginRoute = pathname === '/login' || pathname === '/setup-admin';

  // Hard Blocking Rule:
  // 1. Clients & Users see ONLY maintenance screen everywhere (even /login).
  // 2. Unauthenticated visitors see ONLY maintenance screen everywhere (except /login so admin can login).
  // 3. Admins & Staff can freely access, login anytime, and manage dashboard.
  const shouldBlock = maintenance.maintenanceMode && !isPrivileged && (isClientOrUser || !isLoginRoute);

  if (shouldBlock) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-955 flex items-center justify-center p-6 select-none font-sans">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 border border-emerald-100 dark:border-emerald-950/20 rounded-3xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-100 dark:border-emerald-900/50 shadow-inner animate-bounce">
            <Wrench className="w-10 h-10" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase">System Maintenance</h2>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              We'll be back shortly!
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-semibold">
              Our website is currently undergoing essential system optimization or database maintenance to improve your experience.
            </p>
          </div>

          {maintenance.maintenanceMessage && (
            <div className="bg-emerald-50/50 dark:bg-emerald-955/10 p-4 rounded-2xl border border-emerald-150/40 dark:border-emerald-900/30 text-left space-y-1">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Notice from Admin</span>
              <p className="text-xs text-emerald-900 dark:text-emerald-300 font-semibold leading-relaxed">
                {maintenance.maintenanceMessage}
              </p>
            </div>
          )}

          <div className="flex justify-center items-center gap-1.5 text-xs font-semibold text-gray-400 dark:text-gray-600">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span>Restructuring services...</span>
          </div>

          {/* If a client or gamer is logged in, offer quick sign out option */}
          {isClientOrUser && (
            <div className="pt-2">
              <button
                type="button"
                onClick={async () => {
                  await logoutUser();
                  window.location.href = '/login';
                }}
                className="text-xs font-bold text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 underline cursor-pointer"
              >
                Sign out of current account
              </button>
            </div>
          )}

          {/* Admin Login Access Link: Only shown to unauthenticated guests, NOT logged-in clients/gamers */}
          {!isClientOrUser && (
            <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-col items-center gap-2">
              <a
                href="/login"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 hover:bg-black dark:bg-gray-800 dark:hover:bg-gray-700 text-white text-xs font-bold transition-all shadow-xs"
              >
                <span>Staff &amp; Admin Login</span>
                <span>→</span>
              </a>
              <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500">
                Only authorized administrators can access the portal during maintenance
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return children;
}

// Domain-Aware Root and Fallback Route Handler
function RootRouteHandler() {
  const hostname = window.location.hostname.toLowerCase();
  // On custom storefront domains (e.g. garena, dealsbyshiv, freefire), show Public Store directly
  if (hostname.includes('garena') || hostname.includes('dealsbyshiv') || hostname.includes('freefire')) {
    return <PublicStore />;
  }
  // On ff-store-4a61e, localhost, or standard portal domain, go directly to Login
  return <Navigate to="/login" replace />;
}

function App() {
  return (
    <ToastProvider>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <MaintenanceWrapper>
              <Routes>
                {/* Domain-Aware Root Route */}
                <Route path="/" element={<RootRouteHandler />} />

                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/setup-admin" element={<SetupAdmin />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
                <Route path="/terms" element={<TermsAndConditions />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/refund-policy" element={<RefundPolicy />} />
                <Route path="/contact-us" element={<ContactUs />} />
                <Route path="/ff-store-upload" element={<FFStorePublicUpload />} />
                <Route path="/ff-store/upload" element={<FFStorePublicUpload />} />
                <Route path="/store" element={<PublicStore />} />
                <Route path="/marketplace" element={<PublicStore />} />
                <Route path="/shop" element={<PublicStore />} />

                {/* Protected Admin Routes */}
                <Route 
                  path="/admin-dashboard" 
                  element={
                    <AdminGuard>
                      <AdminDashboard />
                    </AdminGuard>
                  } 
                />
                <Route 
                  path="/admin/gmail-monitor" 
                  element={
                    <AdminGuard>
                      <GmailMonitor />
                    </AdminGuard>
                  } 
                />
                <Route 
                  path="/admin/premium-dashboard" 
                  element={
                    <AdminGuard>
                      <PremiumDashboard />
                    </AdminGuard>
                  } 
                />
                <Route 
                  path="/admin/license-keys" 
                  element={
                    <AdminGuard>
                      <LicenseKeys />
                    </AdminGuard>
                  } 
                />
                <Route 
                  path="/admin/api-keys" 
                  element={
                    <AdminGuard>
                      <ApiKeys />
                    </AdminGuard>
                  } 
                />
                <Route 
                  path="/admin/ff-store" 
                  element={
                    <StoreStaffGuard>
                      <FFStore />
                    </StoreStaffGuard>
                  } 
                />
                <Route 
                  path="/ff-store" 
                  element={
                    <StoreStaffGuard>
                      <FFStore />
                    </StoreStaffGuard>
                  } 
                />
                <Route 
                  path="/admin/inventory" 
                  element={
                    <AdminGuard>
                      <Inventory />
                    </AdminGuard>
                  } 
                />
                <Route 
                  path="/admin/maintenance" 
                  element={
                    <AdminGuard>
                      <Maintenance />
                    </AdminGuard>
                  } 
                />
                <Route 
                  path="/admin/telegram-licenses" 
                  element={
                    <AdminGuard>
                      <TelegramLicenses />
                    </AdminGuard>
                  } 
                />
                <Route 
                  path="/admin/terms-editor" 
                  element={
                    <AdminGuard>
                      <TermsEditor />
                    </AdminGuard>
                  } 
                />
                <Route 
                  path="/admin/suspicious-logs" 
                  element={
                    <AdminGuard>
                      <SuspiciousLogs />
                    </AdminGuard>
                  } 
                />
                <Route 
                  path="/admin/users" 
                  element={
                    <AdminGuard>
                      <AdminUsers />
                    </AdminGuard>
                  } 
                />

                {/* Protected Client Routes */}
                <Route 
                  path="/client-dashboard" 
                  element={
                    <ClientGuard>
                      <ClientDashboard />
                    </ClientGuard>
                  } 
                />
                <Route 
                  path="/client/subscription-info" 
                  element={
                    <ClientGuard>
                      <SubscriptionInfo />
                    </ClientGuard>
                  } 
                />

                {/* Protected User & Generic Routes */}
                <Route 
                  path="/user-dashboard" 
                  element={
                    <AuthGuard>
                      <UserDashboard />
                    </AuthGuard>
                  } 
                />
                <Route 
                  path="/profile" 
                  element={
                    <AuthGuard>
                      <Profile />
                    </AuthGuard>
                  } 
                />
                <Route 
                  path="/oauth-callback" 
                  element={
                    <AuthGuard>
                      <OAuthCallback />
                    </AuthGuard>
                  } 
                />
                <Route 
                  path="/zoho-callback" 
                  element={
                    <AuthGuard>
                      <ZohoCallback />
                    </AuthGuard>
                  } 
                />

                {/* Default Domain-Aware Fallback Redirect */}
                <Route path="*" element={<RootRouteHandler />} />
              </Routes>
            </MaintenanceWrapper>
            <CookieConsentBanner />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </ToastProvider>
  );
}

export default App;
