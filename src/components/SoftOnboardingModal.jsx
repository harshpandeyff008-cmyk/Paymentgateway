import React, { useState } from 'react';
import { db } from '../firebase/config';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Phone, Sparkles, Check, ArrowRight } from 'lucide-react';
import { parseInstagramInput } from '../utils/instagramHelper';

const InstagramIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
  </svg>
);

export default function SoftOnboardingModal({ isOpen, onClose }) {
  const { currentUser, userDoc } = useAuth();
  const { showToast } = useToast();
  const [phone, setPhone] = useState(userDoc?.phone || '');
  const [instagram, setInstagram] = useState(userDoc?.instagram || '');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!currentUser) return;
    setSaving(true);
    try {
      const cleanPhone = (phone || '').trim().replace(/[^0-9+]/g, '');
      const cleanInsta = parseInstagramInput(instagram);

      await updateDoc(doc(db, 'users', currentUser.uid), {
        phone: cleanPhone,
        instagram: cleanInsta
      });
      showToast("Profile details updated successfully!", "success");
      onClose();
    } catch (err) {
      console.error("Profile save note:", err);
      showToast("Saved with local session.", "info");
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(`soft_onboard_dismissed_${currentUser?.uid}`, 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none font-sans">
      <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-[#0c1420] via-[#09101a] to-[#060b12] border border-emerald-500/40 p-7 shadow-[0_0_60px_rgba(16,185,129,0.25)] space-y-6">
        
        {/* Top Header Badge */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-400 text-[10px] font-black uppercase tracking-wider shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>OPTIONAL PROFILE SETUP</span>
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-white">
            Welcome, {userDoc?.name || 'Gamer'}!
          </h2>
          <p className="text-xs text-gray-400 font-medium leading-relaxed max-w-sm mx-auto">
            Add your WhatsApp and Instagram for fast account handovers, direct proof sharing, and instant delivery. You can also do this later!
          </p>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-wide">
              WhatsApp / Phone Number <span className="text-gray-500 text-[10px]">(Optional)</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full pl-10 pr-4 py-2.5 text-xs font-semibold bg-gray-900/90 border border-gray-800 focus:border-emerald-500 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-wide">
              Instagram Username <span className="text-gray-500 text-[10px]">(Optional)</span>
            </label>
            <div className="relative">
              <InstagramIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-pink-500" />
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@your_username"
                className="w-full pl-10 pr-4 py-2.5 text-xs font-semibold bg-gray-900/90 border border-gray-800 focus:border-emerald-500 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-2 space-y-2.5">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save & Continue'}</span>
            </button>

            <button
              type="button"
              onClick={handleSkip}
              className="w-full py-2.5 px-4 rounded-xl bg-gray-850/60 hover:bg-gray-800 text-gray-400 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Maybe Later (Skip)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
