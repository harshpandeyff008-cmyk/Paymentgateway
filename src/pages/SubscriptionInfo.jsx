import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import SupportChatWidget from '../components/SupportChatWidget';
import SubscriptionExtensionModal from '../components/SubscriptionExtensionModal';
import { 
  Calendar, 
  CreditCard, 
  DollarSign, 
  Mail, 
  Phone, 
  Clock, 
  Sparkles,
  ShieldCheck,
  CalendarDays,
  Loader
} from 'lucide-react';

export default function SubscriptionInfo() {
  const { clientData } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [extensionModalOpen, setExtensionModalOpen] = useState(false);

  if (!clientData) {
    return (
      <div className="min-h-screen bg-gray-55 dark:bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-8 h-8 animate-spin text-indigo-650 dark:text-indigo-400" />
          <span className="text-sm font-bold text-gray-550 dark:text-gray-400">Loading subscription details...</span>
        </div>
      </div>
    );
  }

  // Get active countdown label and styling
  const getCountdownStatus = () => {
    if (!clientData.expiryDate) {
      return { label: 'Days Remaining', value: '0 Days', bg: 'bg-gray-50 dark:bg-gray-900 border-gray-150 dark:border-gray-800 text-gray-400', text: 'text-gray-500' };
    }
    
    const expiry = new Date(clientData.expiryDate);
    const today = new Date();
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) {
      return {
        label: 'Expired Status',
        value: 'Expired',
        bg: 'bg-rose-55 dark:bg-rose-955/20 border-rose-150 dark:border-rose-900/40 text-rose-600 dark:text-rose-400',
        text: 'text-rose-600 dark:text-rose-455'
      };
    }
    
    if (diffDays <= 7) {
      return {
        label: 'Days Remaining',
        value: `${diffDays} Days`,
        bg: 'bg-amber-50 dark:bg-amber-955/20 border-amber-150 dark:border-amber-900/40 text-amber-600 dark:text-amber-400',
        text: 'text-amber-600 dark:text-amber-400'
      };
    }
    
    return {
      label: 'Days Remaining',
      value: `${diffDays} Days`,
      bg: 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-150 dark:border-indigo-900/40 text-indigo-650 dark:text-indigo-400',
      text: 'text-indigo-650 dark:text-indigo-455'
    };
  };

  const countdownStyles = getCountdownStatus();

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex font-sans">
      {/* Navigation Sidebar */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Main Content Pane */}
      <div className="flex-1 lg:pl-72 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} title="Subscription Info" />

        <main className="flex-1 p-6 lg:p-8 space-y-8 overflow-y-auto">
          {/* Welcome Dashboard Panel */}
          <div className="p-8 rounded-3xl bg-gradient-to-br from-indigo-600 to-indigo-850 text-white shadow-xl relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl transform translate-x-10 -translate-y-10" />
            <div className="relative space-y-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-white/10 backdrop-blur-md border border-white/10 uppercase tracking-wide">
                Subscription Dashboard
              </span>
              <h2 className="text-3xl font-black tracking-tight">Welcome, {clientData.name}!</h2>
              <p className="text-indigo-100 max-w-xl text-sm font-medium">
                Monitor your active license contracts, billing statements, and announcements below.
              </p>
            </div>
            <button
              onClick={() => setExtensionModalOpen(true)}
              className="relative shrink-0 px-6 py-3 bg-white text-indigo-700 hover:bg-indigo-50 rounded-2xl text-sm font-black transition-all shadow-lg shadow-black/10 active:scale-95 flex items-center gap-2"
            >
              <Sparkles className="w-4.5 h-4.5 text-indigo-650" />
              <span>Extend Subscription</span>
            </button>
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
            
            {/* Left columns: detailed metrics & metadata */}
            <div className="xl:col-span-2 space-y-6">
              
              {/* Detailed billing parameters */}
              <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-855 pb-3">
                  Subscription Parameters & Contact Info
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                  <div className="space-y-4">
                    <div>
                      <span className="text-xs font-bold text-gray-400 dark:text-gray-550 uppercase block">Product Purchased</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-250 mt-1 block">{clientData.productName || '-'}</span>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-400 dark:text-gray-555 uppercase block">Purchase Date</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-250 mt-1 block">{formatDate(clientData.purchaseDate)}</span>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-400 dark:text-gray-555 uppercase block">Expiration Date</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-250 mt-1 block">{formatDate(clientData.expiryDate)}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <span className="text-xs font-bold text-gray-400 dark:text-gray-555 uppercase block">Account Username/Email</span>
                      <div className="flex items-center gap-2 mt-1 text-gray-850 dark:text-gray-300 font-semibold">
                        <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                        <span>{clientData.email || '-'}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-400 dark:text-gray-555 uppercase block">Mobile Contact</span>
                      <div className="flex items-center gap-2 mt-1 text-gray-850 dark:text-gray-300 font-semibold">
                        <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                        <span>{clientData.mobile || '-'}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-400 dark:text-gray-555 uppercase block">Registration Status</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold mt-1.5 border border-indigo-200 dark:border-indigo-900/60 text-indigo-700 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20`}>
                        Active Client Access
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-400 dark:text-gray-555 uppercase block">Terms & Conditions</span>
                      <div className="mt-1.5">
                        {clientData.termsAccepted ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-900/50 px-2.5 py-0.5 rounded-full text-xs">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Accepted on {formatDate(clientData.termsAcceptedAt?.toDate?.() || clientData.termsAcceptedAt)}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-455 font-bold bg-rose-50 dark:bg-rose-955/20 border border-rose-250 dark:border-rose-900/50 px-2.5 py-0.5 rounded-full text-xs">
                            <span>Pending Acceptance</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* pricing details cards grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                
                {/* Paid amount card */}
                <div className="p-6 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl shadow-sm flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-gray-555 dark:text-gray-400 uppercase tracking-wider block">
                      Amount Paid
                    </span>
                    <span className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                      ₹{Number(clientData.amountPaid || 0).toFixed(2)}
                    </span>
                  </div>
                  <CreditCard className="w-10 h-10 text-emerald-550 dark:text-emerald-400" />
                </div>

                {/* Remaining Balance card */}
                <div className="p-6 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl shadow-sm flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-gray-555 dark:text-gray-400 uppercase tracking-wider block">
                      Remaining Balance
                    </span>
                    <span className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                      ₹{Number(clientData.remainingBalance || 0).toFixed(2)}
                    </span>
                  </div>
                  <DollarSign className="w-10 h-10 text-indigo-650 dark:text-indigo-400" />
                </div>

                {/* Commission Due card */}
                <div className="p-6 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl shadow-sm flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-gray-555 dark:text-gray-400 uppercase tracking-wider block">
                      Commission Due
                    </span>
                    <span className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                      ₹{Number(clientData.commission || 0).toFixed(2)}
                    </span>
                  </div>
                  <DollarSign className="w-10 h-10 text-amber-550 dark:text-amber-400" />
                </div>

                {/* Commission Paid card */}
                <div className="p-6 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl shadow-sm flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-gray-555 dark:text-gray-400 uppercase tracking-wider block">
                      Commission Paid
                    </span>
                    <span className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                      ₹{Number(clientData.commissionPaid || 0).toFixed(2)}
                    </span>
                  </div>
                  <DollarSign className="w-10 h-10 text-emerald-550 dark:text-emerald-400" />
                </div>

              </div>

            </div>

            {/* Right column: Days countdown widget */}
            <div className="xl:col-span-1 space-y-6">
              <div className={`p-6 rounded-2xl border shadow-sm transition-all duration-300 flex items-center justify-between ${countdownStyles.bg}`}>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                    {countdownStyles.label}
                  </span>
                  <span className={`text-3xl font-extrabold tracking-tight ${countdownStyles.text}`}>
                    {countdownStyles.value}
                  </span>
                </div>
                <Clock className={`w-10 h-10 opacity-70 ${countdownStyles.text}`} />
              </div>
            </div>

          </div>
        </main>
      </div>

      <SupportChatWidget />
      <SubscriptionExtensionModal 
        isOpen={extensionModalOpen} 
        onClose={() => setExtensionModalOpen(false)} 
      />
    </div>
  );
}
