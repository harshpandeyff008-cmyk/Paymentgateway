import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { extendClientSubscription } from '../firebase/firestore';
import { X, Calendar, CreditCard, Sparkles, Loader } from 'lucide-react';

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function SubscriptionExtensionModal({ isOpen, onClose, onRefresh }) {
  const { currentUser, userDoc, clientData } = useAuth();
  const { showToast } = useToast();
  
  const [days, setDays] = useState('30');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !clientData) return null;

  // Calculate dynamic per-day charge
  const validityDays = Number(clientData.validityDays) || 0;
  const amountPaid = Number(clientData.amountPaid) || 0;
  
  // Daily charge is calculated as half of the initial amount paid
  const ratePerDay = amountPaid > 0 
    ? (amountPaid / 2) 
    : 500;

  const totalCost = Number(days) * ratePerDay;

  const handlePayment = async (e) => {
    e.preventDefault();
    const daysToExtend = parseInt(days, 10);
    if (isNaN(daysToExtend) || daysToExtend <= 0) {
      showToast("Please enter a valid number of days.", "error");
      return;
    }

    setLoading(true);
    const res = await loadRazorpayScript();

    if (!res) {
      showToast("Failed to load Razorpay checkout SDK. Check your network.", "error");
      setLoading(false);
      return;
    }

    const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_5qPj8u8Oq3sLp2';

    // Amount in paise (Razorpay takes amount in smallest currency unit)
    const amountInPaise = Math.round(totalCost * 100);

    const options = {
      key: keyId,
      amount: amountInPaise,
      currency: "INR",
      name: "Free Fire Official Deals",
      description: `Extend subscription by ${daysToExtend} Days`,
      image: "/garena-logo.png",
      handler: async function (response) {
        try {
          // Process updates in Firestore
          await extendClientSubscription(currentUser.uid, daysToExtend, totalCost);
          showToast(`Subscription extended by ${daysToExtend} days successfully!`, "success");
          
          if (onRefresh) {
            onRefresh();
          }
          onClose();
        } catch (err) {
          console.error("Firestore subscription update error:", err);
          showToast("Payment succeeded but subscription record update failed. Please contact admin.", "error");
        } finally {
          setLoading(false);
        }
      },
      prefill: {
        name: userDoc?.name || clientData.name || "Client",
        email: currentUser?.email || clientData.email || ""
      },
      theme: {
        color: "#4f46e5"
      },
      modal: {
        ondismiss: function () {
          setLoading(false);
        }
      }
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Razorpay initiation error:", err);
      showToast("Razorpay Checkout failed to initiate.", "error");
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl shadow-2xl overflow-hidden animate-scale-up z-10 flex flex-col">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-gray-150 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50">
          <div className="flex items-center gap-2 text-indigo-650 dark:text-indigo-400">
            <Sparkles className="w-5 h-5 shrink-0" />
            <h3 className="text-lg font-black tracking-tight text-gray-950 dark:text-white">Buy More Subscription</h3>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            disabled={loading}
            className="p-1.5 text-gray-400 hover:text-gray-650 dark:hover:text-gray-200 rounded-lg transition-colors"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handlePayment} className="p-6 space-y-5">
          {/* Current Subscription Card */}
          <div className="p-4 bg-indigo-50/30 dark:bg-indigo-955/10 border border-indigo-150/50 dark:border-indigo-900/30 rounded-2xl space-y-2.5 text-xs text-gray-750 dark:text-gray-300 font-semibold select-none">
            <div className="flex justify-between border-b border-indigo-100/50 dark:border-indigo-900/20 pb-1.5 text-[10px] text-indigo-700 dark:text-indigo-400 font-extrabold uppercase tracking-wider">
              <span>Current Status</span>
              <span>Active Plan</span>
            </div>
            <div className="grid grid-cols-2 gap-y-1.5 leading-relaxed">
              <p>Product: <span className="text-gray-900 dark:text-white font-extrabold">{clientData.productName || '-'}</span></p>
              <p>Amount Paid: <span className="text-gray-900 dark:text-white font-extrabold">₹{amountPaid.toFixed(2)}</span></p>
              <p>Validity: <span className="text-gray-900 dark:text-white font-extrabold">{validityDays} Days</span></p>
              <p>Expiry: <span className="text-gray-900 dark:text-white font-extrabold">{formatDate(clientData.expiryDate)}</span></p>
            </div>
          </div>

          {/* Rate Breakdown */}
          <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-850 p-3.5 rounded-2xl border border-gray-150 dark:border-gray-800 text-xs font-semibold">
            <span className="text-gray-450 dark:text-gray-500 font-bold uppercase tracking-wider text-[10px]">Calculated Charge Rate</span>
            <span className="text-indigo-650 dark:text-indigo-400 font-extrabold text-sm">
              ₹{ratePerDay.toFixed(2)} <span className="text-[10px] font-bold text-gray-400 dark:text-gray-550">/ day</span>
            </span>
          </div>

          {/* Inputs */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-550 dark:text-gray-450 uppercase">Days to Add</label>
            <input 
              type="number"
              min="1"
              required
              disabled={loading}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="Enter number of days..."
              className="w-full px-4 py-2.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-black dark:text-white transition-all font-bold"
            />
          </div>

          {/* Summary pricing */}
          <div className="p-4 bg-emerald-50/20 dark:bg-emerald-955/5 border border-emerald-150/40 dark:border-emerald-900/20 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-405 font-extrabold uppercase tracking-wider block">Grand Total Cost</span>
              <span className="text-xs text-gray-450 dark:text-gray-500 font-medium">Auto-calculated</span>
            </div>
            <span className="text-2xl font-black text-emerald-650 dark:text-emerald-400 tracking-tight">
              ₹{totalCost.toFixed(2)}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-3 border-t border-gray-100 dark:border-gray-850">
            <button 
              type="button" 
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-200 dark:border-gray-800 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading || totalCost <= 0}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-xl transition-all flex items-center gap-2"
            >
              {loading ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <CreditCard className="w-4 h-4" />
              )}
              <span>{loading ? 'Processing...' : 'Pay via Razorpay'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
