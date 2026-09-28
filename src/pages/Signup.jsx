import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useToast } from '../context/ToastContext';
import { parseInstagramInput } from '../utils/instagramHelper';
import { 
  KeyRound, 
  User, 
  Mail, 
  Phone, 
  Lock, 
  Loader, 
  ShieldCheck, 
  ArrowRight 
} from 'lucide-react';

export default function Signup() {
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Form State
  const [licenseKey, setLicenseKey] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [instagramId, setInstagramId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [dpdpConsent, setDpdpConsent] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();

    if (!dpdpConsent) {
      showToast("You must agree to the Privacy Policy and DPDP consent to register.", "error");
      return;
    }

    if (password !== confirmPassword) {
      showToast("Passwords do not match.", "error");
      return;
    }
    if (password.length < 6) {
      showToast("Password must be at least 6 characters.", "error");
      return;
    }

    setLoading(true);
    try {
      // 1. Verify License Key in Firestore
      const cleanKey = licenseKey.trim();
      const keyRef = doc(db, 'license_keys', cleanKey);
      const keySnap = await getDoc(keyRef);

      if (!keySnap.exists()) {
        showToast("Invalid License Key. Please contact the administrator.", "error");
        setLoading(false);
        return;
      }

      const keyData = keySnap.data();
      if (keyData.status !== 'active') {
        showToast("This License Key has already been redeemed or revoked.", "error");
        setLoading(false);
        return;
      }

      // 2. Create User in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      const now = new Date();
      const expiry = new Date(now.getTime() + 48 * 60 * 60 * 1000); // Exactly 48 hours validity

      const { username: parsedInstaUser, link: parsedInstaLink } = parseInstagramInput(instagramId);
      const userProfile = {
        uid: user.uid,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        mobile: mobile.trim(),
        instagramId: parsedInstaUser || '',
        instagram_link: parsedInstaLink || '',
        role: 'client',
        status: 'Active',
        createdAt: now.toISOString(),
        usedLicenseKey: cleanKey,
        // DPDP Act Consent Record
        dpdpConsentGiven: true,
        dpdpConsentTimestamp: now.toISOString(),
        dpdpConsentVersion: 'v1.0-sept2026'
      };

      // Assign the mailbox linked inside the license key
      if (keyData.mailboxType === 'gmail') {
        userProfile.linkedGmail = keyData.assignedMailbox;
      } else if (keyData.mailboxType === 'zoho') {
        userProfile.linkedZoho = keyData.assignedMailbox;
      } else if (keyData.mailboxType === 'imap') {
        userProfile.linkedImap = keyData.assignedMailbox;
      }

      // Create subscription payload
      const userSubscription = {
        productName: "License Key Activation",
        purchaseDate: now.toISOString(),
        expiryDate: expiry.toISOString(),
        validityDays: 2,
        amountPaid: 0,
        remainingBalance: 0,
        commission: 0,
        commissionPaid: 0,
        status: 'Active',
        notes: `Activated via License Key: ${cleanKey}`,
        updatedAt: now.toISOString()
      };

      // Save both user profile and subscription details in Firestore
      await setDoc(doc(db, 'users', user.uid), userProfile);
      await setDoc(doc(db, 'subscriptions', user.uid), userSubscription);

      // 4. Mark key as redeemed
      await updateDoc(keyRef, {
        status: 'redeemed',
        redeemedBy: user.uid,
        redeemedAt: new Date().toISOString()
      });

      showToast("Account registered successfully! Welcome.", "success");
      navigate('/client-dashboard');
    } catch (err) {
      console.error("Signup failed:", err);
      // Friendly messages for standard errors
      if (err.code === 'auth/email-already-in-use') {
        showToast("This email address is already in use.", "error");
      } else {
        showToast(err.message || "Failed to register account.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 py-8 relative overflow-hidden">
      {/* Background aesthetics */}
      <div className="absolute top-0 right-0 -translate-y-1/3 translate-x-1/3 w-[500px] h-[500px] rounded-full bg-indigo-650/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-[500px] h-[500px] rounded-full bg-teal-500/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 relative z-10">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 shadow-inner mb-2">
            <KeyRound className="w-6 h-6" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase">
            Client Portal Register
          </h2>
          <p className="text-xs text-gray-450 dark:text-gray-500 font-semibold leading-normal">
            Enter your registration license key to setup your security sandbox mailbox.
          </p>
        </div>

        {/* Signup Form */}
        <form onSubmit={handleSignup} className="space-y-4">
          
          {/* License Key */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-gray-450 dark:text-gray-500 uppercase tracking-wider">
              Registration License Key
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                required
                placeholder="e.g. Ab7D-9kL2-mN5p-Qw3R"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white font-mono font-bold tracking-wider"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-gray-450 dark:text-gray-500 uppercase tracking-wider">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white font-semibold"
                />
              </div>
            </div>

            {/* Mobile Number */}
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-gray-450 dark:text-gray-500 uppercase tracking-wider">
                Mobile Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  required
                  placeholder="+91 9999999999"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Email Address */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-gray-450 dark:text-gray-500 uppercase tracking-wider">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                required
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white font-semibold"
              />
            </div>
          </div>

          {/* Instagram ID (Optional) */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-gray-450 dark:text-gray-500 uppercase tracking-wider flex items-center justify-between">
              <span>Instagram Username or Link</span>
              <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 lowercase">(optional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">📸</span>
              <input
                type="text"
                placeholder="Username ya profile link (e.g. shivam_ff ya instagram.com/...)"
                value={instagramId}
                onChange={(e) => setInstagramId(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Password */}
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-gray-450 dark:text-gray-500 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white font-semibold"
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-gray-450 dark:text-gray-500 uppercase tracking-wider">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white font-semibold"
                />
              </div>
            </div>
          </div>

          {/* DPDP Act Consent & Age Declaration */}
          <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-xl space-y-2.5">
            <label className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={dpdpConsent}
                onChange={(e) => setDpdpConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 shrink-0 cursor-pointer"
              />
              <span className="text-[10.5px] text-gray-600 dark:text-gray-400 font-semibold leading-relaxed">
                I confirm that I am <span className="font-extrabold text-gray-900 dark:text-white">18 years of age or older</span> and I freely give my informed consent to the collection, storage, and processing of my personal data (including name, email, mobile, IP address, device information, and session telemetry) as described in the{' '}
                <Link to="/privacy-policy" target="_blank" className="text-indigo-600 dark:text-indigo-400 font-extrabold hover:underline">
                  Privacy Policy
                </Link>
                , in accordance with the <span className="font-extrabold text-gray-900 dark:text-white">Digital Personal Data Protection Act, 2023 (DPDP Act)</span> and the Information Technology Act, 2000.
              </span>
            </label>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider pl-6">
              <ShieldCheck className="w-3 h-3 text-indigo-500" />
              <span>DPDP Act 2023 • IT Act 2000 • Consumer Protection Rules 2020</span>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !dpdpConsent}
            className={`w-full flex items-center justify-center gap-2 py-3 text-white font-bold text-xs rounded-xl shadow-lg transition-all ${
              dpdpConsent 
                ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-650/20 hover:shadow-xl' 
                : 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            <span>{loading ? "Creating Profile..." : "Verify & Register Account"}</span>
          </button>
        </form>

        {/* Footer info link */}
        <div className="text-center pt-2 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-450 dark:text-gray-500 font-semibold">
            Already have an active account?{' '}
            <Link 
              to="/login" 
              className="text-indigo-600 hover:text-indigo-700 font-black hover:underline inline-flex items-center gap-0.5"
            >
              <span>Sign In</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
