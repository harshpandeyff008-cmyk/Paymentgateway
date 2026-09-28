import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginUser, loginWithGoogle, logoutUser } from '../firebase/auth';
import { useToast } from '../context/ToastContext';
import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { subscribeToMaintenanceMode } from '../firebase/firestore';
import { KeyRound, Mail, Loader, Eye, EyeOff, AlertTriangle, ShieldCheck, Sparkles, Flame, CheckCircle, Shield, Wrench } from 'lucide-react';
import Footer from '../components/Footer';

/**
 * Single Login Page for all roles.
 * Authenticates with Firebase Auth and redirects based on the Firestore user role.
 */
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [maintenance, setMaintenance] = useState({ maintenanceMode: false, maintenanceMessage: '', allowAdminLogin: true });
  
  const { currentUser, userDoc, blockInfo, setBlockInfo } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const isLocalhost = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.')
  );

  // Subscribe to real-time maintenance status
  useEffect(() => {
    const unsub = subscribeToMaintenanceMode((data) => {
      setMaintenance(data || { maintenanceMode: false, maintenanceMessage: '', allowAdminLogin: true });
    });
    return () => unsub();
  }, []);

  // Route user automatically if session exists
  useEffect(() => {
    if (currentUser && userDoc) {
      const role = (userDoc.role || '').toLowerCase().trim();
      const isPrivileged = role === 'admin' || role === 'superadmin' || role === 'employee' || role === 'staff';

      // If maintenance mode is active and user is NOT privileged staff/admin, disconnect immediately
      if (maintenance.maintenanceMode && !isPrivileged) {
        logoutUser();
        return;
      }

      if (role === 'admin' || role === 'superadmin') {
        navigate('/admin-dashboard', { replace: true });
      } else if (role === 'employee' || role === 'staff') {
        navigate('/admin/ff-store', { replace: true });
      } else if (role === 'client') {
        navigate('/client-dashboard', { replace: true });
      } else {
        navigate('/user-dashboard', { replace: true });
      }
    }
  }, [currentUser, userDoc, maintenance.maintenanceMode, navigate]);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const user = await loginWithGoogle();

      try {
        const uDocSnap = await getDoc(doc(db, 'users', user.uid));
        const uData = uDocSnap.exists() ? uDocSnap.data() : {};
        const role = (uData.role || 'user').toLowerCase().trim();
        const isPrivileged = role === 'admin' || role === 'superadmin' || role === 'employee' || role === 'staff';

        // STRICT LOCKDOWN CHECK: Reject client/user during maintenance mode
        if (maintenance.maintenanceMode && !isPrivileged) {
          await logoutUser();
          showToast("System Maintenance Active: Client and Gamer accounts cannot sign in right now.", "error");
          setGoogleLoading(false);
          return;
        }

        showToast("Signed in with Google successfully!", "success");

        if (role === 'admin' || role === 'superadmin') {
          navigate('/admin-dashboard', { replace: true });
        } else if (role === 'employee' || role === 'staff') {
          navigate('/admin/ff-store', { replace: true });
        } else if (role === 'client') {
          navigate('/client-dashboard', { replace: true });
        } else {
          navigate('/user-dashboard', { replace: true });
        }
      } catch (err) {
        console.error("Google sign in verification err:", err);
        if (maintenance.maintenanceMode) {
          await logoutUser();
          showToast("System Maintenance Active: Login is restricted.", "error");
          setGoogleLoading(false);
          return;
        }
        navigate('/user-dashboard', { replace: true });
      }
    } catch (err) {
      console.error("Google sign in note:", err);
      if (err.code !== 'auth/popup-closed-by-user') {
        showToast(err.message || "Failed to sign in with Google.", "error");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await loginUser(email, password);
      const user = userCredential.user || userCredential;

      try {
        const uDocSnap = await getDoc(doc(db, 'users', user.uid));
        const uData = uDocSnap.exists() ? uDocSnap.data() : {};
        const role = (uData.role || 'user').toLowerCase().trim();
        const isPrivileged = role === 'admin' || role === 'superadmin' || role === 'employee' || role === 'staff';

        // STRICT LOCKDOWN CHECK: Reject client/user during maintenance mode
        if (maintenance.maintenanceMode && !isPrivileged) {
          await logoutUser();
          showToast("System Maintenance Active: Client and Gamer accounts cannot sign in right now.", "error");
          setLoading(false);
          return;
        }

        showToast("Logged in successfully!", "success");

        if (role === 'admin' || role === 'superadmin') {
          navigate('/admin-dashboard', { replace: true });
        } else if (role === 'employee' || role === 'staff') {
          navigate('/admin/ff-store', { replace: true });
        } else if (role === 'client') {
          navigate('/client-dashboard', { replace: true });
        } else {
          navigate('/user-dashboard', { replace: true });
        }
      } catch (navErr) {
        console.warn("Direct navigation check skipped:", navErr);
        if (maintenance.maintenanceMode) {
          await logoutUser();
          showToast("System Maintenance Active: Login is restricted.", "error");
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.error("Login failure:", err);
      let errMsg = "Invalid email or password.";
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errMsg = "Invalid login credentials.";
      } else if (err.code === 'auth/invalid-email') {
        errMsg = "Please enter a valid email address.";
      }
      showToast(errMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-between min-h-[100dvh] bg-[#07090e] text-white px-4 overflow-x-hidden select-none">
      {/* Dynamic Cyber Ambient Background Grid & Glows */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(16, 185, 129, 0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(16, 185, 129, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(circle at center, black 40%, transparent 85%)'
        }}
      />
      <div className="absolute top-1/4 left-10 w-[420px] h-[420px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-10 w-[450px] h-[450px] bg-teal-500/10 rounded-full blur-[130px] pointer-events-none" />

      {/* Main Container - 3 Column Layout (Alok Hero | Login Card | Kelly Hero) */}
      <div className="flex-1 flex items-center justify-center w-full max-w-7xl py-8 lg:py-12 relative z-10 gap-6 xl:gap-10">
        
        {/* LEFT COLUMN: Free Fire Alok Character + Floating FF Diamonds & Tokens Showcase */}
        <div className="hidden lg:flex flex-col items-center w-72 xl:w-80 shrink-0 space-y-4 animate-fade-in">
          {/* Main Character Showcase Card */}
          <div className="relative w-full rounded-3xl overflow-hidden border border-emerald-500/30 bg-gradient-to-b from-[#0e1622]/90 to-[#080d14]/95 shadow-[0_0_35px_rgba(16,185,129,0.15)] group transition-all duration-300 hover:border-emerald-500/50">
            {/* Top Tag */}
            <div className="absolute top-3.5 left-3.5 right-3.5 z-20 flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-emerald-500/40 text-[9.5px] font-black tracking-widest text-emerald-400 uppercase shadow-md flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                LEGENDARY ALOK
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-[9px] font-black text-emerald-300 border border-emerald-500/30">
                PRO TIER
              </span>
            </div>

            {/* Character Image */}
            <div className="relative h-88 overflow-hidden">
              <img 
                src="/ff-character-alok.jpg" 
                alt="Free Fire Hero Character Alok" 
                className="w-full h-full object-cover object-top filter brightness-95 group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#080d14] via-transparent to-transparent opacity-90" />
            </div>

            {/* Bottom Card Overlay */}
            <div className="p-4 -mt-10 relative z-10 space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="font-black text-sm uppercase tracking-wide text-white">
                  Battle Royale Ready
                </h3>
              </div>
              <p className="text-[11px] font-medium text-gray-400 leading-relaxed">
                100% verified Free Fire esports assets with verified video proofs &amp; zero ban history.
              </p>
            </div>
          </div>

          {/* Floating FF Diamonds & Tokens Mini Card */}
          <div className="w-full rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-[#0a1824]/90 to-[#07131d]/90 backdrop-blur-md p-3 shadow-lg flex items-center gap-3.5 group hover:border-cyan-400/50 transition-all">
            <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-cyan-400/40 bg-black/50 shadow-md">
              <img 
                src="/ff-diamonds-tokens.jpg" 
                alt="Free Fire Diamonds and Tokens" 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-black text-white uppercase tracking-tight">
                  FF TOKENS &amp; DIAMONDS
                </span>
              </div>
              <p className="text-[10px] font-bold text-cyan-400">
                💎 5,600+ Gem Reserves Verified
              </p>
              <p className="text-[9.5px] font-medium text-gray-400">
                Direct safe escrow inventory
              </p>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: The Authentic Glassmorphic Login Card */}
        <div className="w-full max-w-md mx-auto">
          <div className="relative rounded-3xl p-7 sm:p-9 bg-gradient-to-b from-[#0c121e]/95 via-[#0a0f18]/95 to-[#070b12]/98 border border-emerald-500/35 shadow-[0_0_50px_rgba(16,185,129,0.18)] space-y-6 backdrop-blur-xl">
            
            {/* Top Verified Escrow Banner Pill */}
            <div className="flex justify-center -mt-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-400 text-[10px] font-black uppercase tracking-wider shadow-sm">
                <Shield className="w-3 h-3 text-emerald-400 fill-emerald-400/20" />
                <span>OFFICIAL VERIFIED ESCROW DESK</span>
              </div>
            </div>

            {/* Header / Logo */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-black/60 p-2 shadow-xl shadow-emerald-500/20 border border-emerald-500/40 mb-1 transform hover:scale-105 transition-transform duration-200">
                <img src="/garena-logo.png" alt="Free Fire Official Logo" className="w-full h-full object-contain filter drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight uppercase">
                FREE FIRE OFFICIAL DEALS
              </h2>
              <p className="text-xs text-gray-400 font-medium">
                Official Account Management &amp; Escrow Portal
              </p>
            </div>

            {/* Display Block/Suspended Info if present */}
            {blockInfo && (
              <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 space-y-2.5 text-left animate-fade-in shadow-sm">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <h4 className="font-bold text-rose-300 text-xs uppercase tracking-wide">
                    Access Revoked ({blockInfo.actionType === 'Removed' ? 'Account Removed' : 'Account Suspended'})
                  </h4>
                </div>
                <div className="text-xs text-rose-300 font-medium space-y-1 leading-relaxed">
                  <p><span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Reason:</span> {blockInfo.reason}</p>
                  {blockInfo.message && (
                    <p><span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Note from Admin:</span> "{blockInfo.message}"</p>
                  )}
                  <p className="text-[10px] text-rose-400 pt-1 font-semibold">
                    Date: {new Date(blockInfo.date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="pt-1">
                  <button 
                    type="button" 
                    onClick={() => setBlockInfo(null)}
                    className="px-3 py-1 bg-rose-900/50 hover:bg-rose-800/60 text-rose-200 rounded-lg text-xs font-bold transition-all"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* System Maintenance Alert Banner */}
            {maintenance.maintenanceMode && (
              <div className="p-4 rounded-2xl bg-amber-950/50 border border-amber-500/60 space-y-2 text-left animate-fade-in shadow-xl shadow-amber-950/40">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
                  <h4 className="font-black text-amber-300 text-xs uppercase tracking-wider">
                    High Security Maintenance Lockdown
                  </h4>
                </div>
                <p className="text-xs text-amber-200/90 leading-relaxed font-semibold">
                  Access is strictly restricted to verified Staff &amp; Administrators only. Client &amp; Gamer accounts cannot sign in until maintenance concludes.
                </p>
                {maintenance.maintenanceMessage && (
                  <div className="p-2.5 rounded-xl bg-amber-900/40 border border-amber-600/30 text-[11px] text-amber-100 font-mono">
                    <span className="font-bold text-amber-400 uppercase text-[9px] block">Notice:</span>
                    {maintenance.maintenanceMessage}
                  </div>
                )}
              </div>
            )}

            {/* 1-Click Google Sign In */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading || googleLoading}
              className="w-full py-3 px-4 bg-white hover:bg-gray-100 text-gray-900 font-black rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-wider cursor-pointer"
            >
              {googleLoading ? (
                <Loader className="w-4 h-4 animate-spin text-emerald-600" />
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              )}
              <span>Continue with Google</span>
            </button>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-1">
              <div className="border-t border-gray-800 w-full"></div>
              <span className={`bg-[#0b1019] px-3 text-[9.5px] font-bold uppercase tracking-widest shrink-0 ${maintenance.maintenanceMode ? 'text-amber-400' : 'text-gray-500'}`}>
                {maintenance.maintenanceMode ? 'Staff & Admin Login Only' : 'Or Staff Login'}
              </span>
              <div className="border-t border-gray-800 w-full"></div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-wide">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" aria-hidden="true" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@domain.com"
                    className="w-full pl-11 pr-4 py-2.5 text-sm bg-gray-900/80 border border-gray-800 focus:border-emerald-500 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 text-white placeholder-gray-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-wide">
                  Password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" aria-hidden="true" />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-11 pr-11 py-2.5 text-sm bg-gray-900/80 border border-gray-800 focus:border-emerald-500 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 text-white placeholder-gray-500 transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white transition-colors rounded"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 mt-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/50 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                {loading && <Loader className="w-4 h-4 animate-spin" />}
                <span>Sign In To Portal</span>
              </button>
            </form>

            {/* Registration & Storefront Redirects */}
            <div className="space-y-3 pt-3 border-t border-gray-800/80 text-center">
              {maintenance.maintenanceMode ? (
                <div className="p-2.5 rounded-xl bg-gray-900/80 border border-amber-500/30 text-[11px] text-amber-400 font-bold">
                  🔒 New registrations &amp; public storefront are paused during system maintenance.
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-400 font-semibold">
                    New user?{' '}
                    <Link 
                      to="/signup" 
                      className="text-emerald-400 hover:text-emerald-300 font-extrabold hover:underline"
                    >
                      Sign up with License Key
                    </Link>
                  </p>

                  {/* Direct Storefront Link */}
                  <div className="pt-1">
                    <a
                      href="https://dealsbyshiv.web.app/store"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-gray-400 hover:text-white transition-colors"
                    >
                      <span>Browse Public Storefront</span>
                      <span className="text-emerald-400">→</span>
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Free Fire Kelly Operative + Esports Tournament Card */}
        <div className="hidden lg:flex flex-col items-center w-72 xl:w-80 shrink-0 space-y-4 animate-fade-in">
          {/* Main Character Showcase Card */}
          <div className="relative w-full rounded-3xl overflow-hidden border border-emerald-500/30 bg-gradient-to-b from-[#0e1622]/90 to-[#080d14]/95 shadow-[0_0_35px_rgba(16,185,129,0.15)] group transition-all duration-300 hover:border-emerald-500/50">
            {/* Top Tag */}
            <div className="absolute top-3.5 left-3.5 right-3.5 z-20 flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-emerald-500/40 text-[9.5px] font-black tracking-widest text-emerald-400 uppercase shadow-md flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                OPERATIVE KELLY
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-[9px] font-black text-emerald-300 border border-emerald-500/30">
                CHAMPIONSHIP
              </span>
            </div>

            {/* Character Image */}
            <div className="relative h-88 overflow-hidden">
              <img 
                src="/ff-character-kelly.jpg" 
                alt="Free Fire Operative Kelly" 
                className="w-full h-full object-cover object-top filter brightness-95 group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#080d14] via-transparent to-transparent opacity-90" />
            </div>

            {/* Bottom Card Overlay */}
            <div className="p-4 -mt-10 relative z-10 space-y-1">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-emerald-400" />
                <h3 className="font-black text-sm uppercase tracking-wide text-white">
                  Grandmaster Tier IDs
                </h3>
              </div>
              <p className="text-[11px] font-medium text-gray-400 leading-relaxed">
                Evo Guns maxed, Criminal bundles, Angelic pants, and elite pass badges verified.
              </p>
            </div>
          </div>

          {/* Floating Verification Badge Card */}
          <div className="w-full rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-[#0a1824]/90 to-[#07131d]/90 backdrop-blur-md p-3 shadow-lg flex items-center gap-3.5 group hover:border-emerald-400/50 transition-all">
            <div className="w-11 h-11 rounded-xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-1">
                <span className="text-xs font-black text-white uppercase tracking-tight">
                  LIVE OTP HANDOVER
                </span>
              </div>
              <p className="text-[10px] font-bold text-emerald-400">
                Zero Scam Guarantee
              </p>
              <p className="text-[9.5px] font-medium text-gray-400">
                Admin supervised security
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
