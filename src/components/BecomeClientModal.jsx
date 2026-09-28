import React, { useState } from 'react';
import { db } from '../firebase/config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { KeyRound, Shield, CheckCircle2, X, Sparkles, Loader } from 'lucide-react';

export default function BecomeClientModal({ isOpen, onClose, onSuccess }) {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleRedeem = async (e) => {
    e.preventDefault();
    const cleanKey = licenseKey.trim();
    if (!cleanKey) {
      showToast("Please enter a valid License Key.", "error");
      return;
    }

    setLoading(true);
    try {
      const keyRef = doc(db, 'license_keys', cleanKey);
      const keySnap = await getDoc(keyRef);

      if (!keySnap.exists()) {
        showToast("Invalid License Key. Please contact support.", "error");
        setLoading(false);
        return;
      }

      const keyData = keySnap.data();
      if (keyData.status !== 'active') {
        showToast("This License Key has already been redeemed or revoked.", "error");
        setLoading(false);
        return;
      }

      const now = new Date();
      const durationHours = Number(keyData.durationHours) || 48;
      const expiry = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

      // 1. Redeem key
      await updateDoc(keyRef, {
        status: 'redeemed',
        redeemedBy: currentUser.email,
        redeemedAt: now.toISOString()
      });

      // 2. Upgrade user to client
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        role: 'client',
        planExpiresAt: expiry.toISOString(),
        licenseKey: cleanKey,
        isBlocked: false,
        status: 'active'
      });

      showToast("🎉 Congratulations! Upgraded to Client with active OTP & Mailbox monitor access!", "success");
      onClose();
      if (onSuccess) onSuccess();
      // Reload page to reflect updated AuthContext role
      setTimeout(() => {
        window.location.href = '/client-dashboard';
      }, 1000);
    } catch (err) {
      console.error("License key upgrade error:", err);
      showToast(err.message || "Failed to redeem license key.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none font-sans">
      <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-[#0c1420] via-[#09101a] to-[#060b12] border border-emerald-500/40 p-7 shadow-[0_0_60px_rgba(16,185,129,0.25)] space-y-6">
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-xl bg-gray-800 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Top Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-400 text-[10px] font-black uppercase tracking-wider shadow-sm">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>UPGRADE TO CLIENT ACCESS</span>
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-white">
            Activate License Key
          </h2>
          <p className="text-xs text-gray-400 font-medium leading-relaxed max-w-xs mx-auto">
            Unlock automated Free Fire Mailbox Monitoring, live OTP reader, and security code protocols.
          </p>
        </div>

        {/* Key Form */}
        <form onSubmit={handleRedeem} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-wide">
              Your License Key
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
              <input
                type="text"
                required
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="e.g. GS-ABCD-1234-XYZ"
                className="w-full pl-10 pr-4 py-3 text-xs font-mono font-bold uppercase tracking-wider bg-gray-900 border border-gray-800 focus:border-emerald-500 rounded-xl text-emerald-400 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <p className="text-[10px] text-gray-500 mt-1 font-medium">
              Don't have a license key? Contact Official Telegram Escrow Agent <a href="https://t.me/alexccseller" target="_blank" rel="noreferrer" className="text-emerald-400 font-bold hover:underline">@ALEXCCSELLER</a>.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{loading ? 'Verifying Key...' : 'Activate Client Access'}</span>
          </button>
        </form>

      </div>
    </div>
  );
}
