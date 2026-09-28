import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Cookie, X, ChevronDown, ChevronUp } from 'lucide-react';

const CONSENT_KEY = 'dpdp_consent';
const CONSENT_TIMESTAMP_KEY = 'dpdp_consent_timestamp';

/**
 * Check if user has already given DPDP cookie/tracking consent.
 */
export const hasDpdpConsent = () => {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'accepted';
  } catch {
    return false;
  }
};

/**
 * Withdraw DPDP consent (for use in profile/settings).
 */
export const withdrawDpdpConsent = () => {
  try {
    localStorage.removeItem(CONSENT_KEY);
    localStorage.removeItem(CONSENT_TIMESTAMP_KEY);
  } catch {
    // Silent fail
  }
};

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Show banner only if consent hasn't been given yet
    try {
      const consent = localStorage.getItem(CONSENT_KEY);
      if (!consent) {
        // Small delay so it doesn't flash during splash screen
        const timer = setTimeout(() => setVisible(true), 1500);
        return () => clearTimeout(timer);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem(CONSENT_KEY, 'accepted');
      localStorage.setItem(CONSENT_TIMESTAMP_KEY, new Date().toISOString());
    } catch {
      // Silent fail
    }
    setVisible(false);
  };

  const handleDecline = () => {
    try {
      localStorage.setItem(CONSENT_KEY, 'declined');
      localStorage.setItem(CONSENT_TIMESTAMP_KEY, new Date().toISOString());
    } catch {
      // Silent fail
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-[9998] animate-slide-up"
      style={{ animation: 'slideUp 0.4s ease-out forwards' }}
    >
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <div className="mx-auto max-w-4xl px-4 pb-4">
        <div className="relative bg-gradient-to-r from-gray-900/98 via-gray-950/98 to-gray-900/98 backdrop-blur-xl border border-emerald-500/30 rounded-2xl shadow-[0_-8px_40px_rgba(16,185,129,0.15)] p-5 sm:p-6">
          
          {/* Close button */}
          <button
            onClick={handleDecline}
            className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-all"
            aria-label="Close consent banner"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1 pr-6">
              <h3 className="text-sm font-black text-white uppercase tracking-wide">
                Data Privacy & Cookie Notice
              </h3>
              <p className="text-xs text-gray-400 font-medium leading-relaxed">
                In accordance with the <span className="font-bold text-emerald-400">Digital Personal Data Protection Act, 2023 (DPDP Act)</span>, we need your consent before collecting any personal data including cookies, IP address, device info, and location data.
              </p>
            </div>
          </div>

          {/* Expandable Details */}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors mb-3 cursor-pointer"
          >
            <Cookie className="w-3.5 h-3.5" />
            <span>{expanded ? 'Hide Details' : 'What data do we collect?'}</span>
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {expanded && (
            <div className="mb-4 p-3.5 rounded-xl bg-gray-800/60 border border-gray-700/60 text-xs text-gray-300 font-medium space-y-2 leading-relaxed">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block">Essential Data</span>
                  <ul className="space-y-0.5 text-gray-400">
                    <li>• Login session cookies (Firebase Auth)</li>
                    <li>• Theme preference (light/dark mode)</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block">Analytics & Security</span>
                  <ul className="space-y-0.5 text-gray-400">
                    <li>• IP address & country (security audit)</li>
                    <li>• Device/browser info (anti-fraud)</li>
                    <li>• Geolocation (with browser permission)</li>
                    <li>• Screen resolution & connection type</li>
                  </ul>
                </div>
              </div>
              <p className="text-[10px] text-gray-500 pt-1 border-t border-gray-700/50">
                Read our full{' '}
                <Link to="/privacy-policy" className="text-emerald-400 hover:underline font-bold">Privacy Policy</Link>
                {' '}for details on data usage, retention, and your rights under the DPDP Act.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <button
              onClick={handleAccept}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Accept All</span>
            </button>
            <button
              onClick={handleDecline}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-bold border border-gray-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Essential Only</span>
            </button>
            <Link
              to="/privacy-policy"
              className="text-center text-[11px] font-bold text-gray-500 hover:text-emerald-400 transition-colors py-2 sm:py-0 sm:ml-2"
            >
              Privacy Policy →
            </Link>
          </div>

          {/* DPDP Compliance Tag */}
          <div className="mt-3 flex items-center gap-1.5 text-[9px] font-bold text-gray-600 uppercase tracking-widest">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>DPDP Act 2023 Compliant • Digital Personal Data Protection</span>
          </div>
        </div>
      </div>
    </div>
  );
}
