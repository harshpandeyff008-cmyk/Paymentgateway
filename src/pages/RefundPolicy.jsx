import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react';
import Footer from '../components/Footer';

export default function RefundPolicy() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-indigo-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4">
      <div className="max-w-4xl mx-auto w-full pt-10 pb-6 relative z-10 flex-1 flex flex-col justify-center">
        {/* Navigation header */}
        <div className="flex items-center justify-between mb-8">
          <Link 
            to="/login" 
            className="inline-flex items-center gap-2 text-sm font-bold text-gray-650 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to login
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white dark:bg-gray-800 p-1 border border-gray-200 dark:border-gray-700 shadow-md flex items-center justify-center shrink-0">
              <img src="/garena-logo.png" alt="Garena Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-sm font-black text-gray-900 dark:text-white tracking-tight">FREE FIRE OFFICIAL DEALS</span>
          </div>
        </div>

        {/* Legal Document Container */}
        <div className="p-8 md:p-12 bg-white/70 dark:bg-gray-900/70 border border-gray-150 dark:border-gray-800 backdrop-blur-md rounded-3xl shadow-xl space-y-8 text-sm text-gray-650 dark:text-gray-300 font-medium leading-relaxed">
          
          {/* Header */}
          <div className="border-b border-gray-100 dark:border-gray-850 pb-6 text-center md:text-left">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 mb-4">
              <RefreshCw className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black text-gray-950 dark:text-white tracking-tight">
              Cancellation &amp; Refund Policy
            </h1>
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-1">
              Legal Operator: FREE FIRE OFFICIAL DEALS | Last Updated: Feb 24, 2026
            </p>
          </div>

          {/* Absolute Warning Box */}
          <div className="p-6 bg-rose-50/50 dark:bg-rose-955/15 border border-rose-200 dark:border-rose-900/40 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-rose-800 dark:text-rose-400 font-black uppercase text-xs tracking-wider">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>Absolute Non-Refundable Policy</span>
            </div>
            <p className="text-xs font-bold text-rose-700 dark:text-rose-455 leading-relaxed">
              All transactions completed on our platform for digital goods, account rentals, purchases, and validity extensions are final, binding, and strictly non-refundable. Under no conditions, exceptions, or circumstances shall a return, replacement, cancellation, or refund be issued once login credentials or access details have been provided.
            </p>
          </div>

          {/* Detailed Legal Sections */}
          <div className="space-y-6">
            
            <section className="space-y-2">
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white">1. Nature of Digital Goods</h2>
              <p>
                Our services comprise instant provisioning of temporary gaming accounts (specifically Free Fire IDs), codes, licenses, and panel subscriptions. Because these credentials represent virtual/digital assets that are fully delivered immediately upon checkout, there are no physical goods to return. Consequently, return or exchange requests are technically impossible and will not be entertained.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white">2. Validity Expiration &amp; Cancellation</h2>
              <p>
                Rentals carry a maximum active validity of 48 hours unless a custom duration was specifically negotiated and recorded. Once this validity period expires, access will be revoked automatically. We bear no obligation to extend, renew, or restore credentials without a new payment. Standard cancellation requests will simply stop future cycles but will not result in any partial or full refund of already paid fees.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white">3. Platform Commissions</h2>
              <p>
                Every transaction includes an integrated operational commission of ₹500 to ₹2000 (depending on account tiers). This commission facilitates platform security monitoring, credential verification, and server uptime. The commission is strictly non-refundable under all scenarios, even if an account becomes restricted or locked by the gaming publisher (e.g. Garena Free Fire) due to user actions or platform restrictions.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white">4. User Fault, Configuration Mistakes &amp; Third-Party Restrictions</h2>
              <p>
                All users are fully responsible for providing accurate credentials and matching configurations. Absolutely no refunds, extensions, or replacements will be issued for issues caused by user-side negligence or mistakes, including: (a) inputting an incorrect Garena recovery email or password, (b) triggering security blocks, 2-step verification prompts, or verification loops on third-party integrations (such as VK, Facebook, Google, or Garena mobile auth), (c) violating the 48-hour scanning cooldown restrictions, or (d) generating and binding license keys to the wrong mailbox. Any user-side configuration error completely forfeits transaction credit with zero exceptions.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white">5. Fraud Prevention</h2>
              <p>
                Initiating fraudulent chargebacks, credit card disputes, or filing false cyber complaints without contacting support will be treated as contractual breach and fraud. In such cases, we reserve the right to share all registration details, session IPs, chats, and screenshots with payment processors and local cyber authorities.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white">6. Inquiries</h2>
              <p>
                For any billing clarification, grievance, or support regarding your transaction history with <span className="font-extrabold text-gray-950 dark:text-white">FREE FIRE OFFICIAL DEALS</span>, please write to us at <span className="font-bold text-indigo-600 dark:text-indigo-400">Coming Soon (support@domain.com)</span> before initiating payments.
              </p>
            </section>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
