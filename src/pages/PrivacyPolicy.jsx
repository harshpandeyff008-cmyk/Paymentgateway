import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Database, Globe, Clock, UserCheck, AlertTriangle, FileText, Lock } from 'lucide-react';
import Footer from '../components/Footer';

export default function PrivacyPolicy() {
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

        {/* Article Box */}
        <div className="p-8 md:p-12 bg-white/70 dark:bg-gray-900/70 border border-gray-150 dark:border-gray-800 backdrop-blur-md rounded-3xl shadow-xl space-y-8 text-sm text-gray-650 dark:text-gray-300 font-medium leading-relaxed">
          <div className="border-b border-gray-100 dark:border-gray-850 pb-6 text-center md:text-left">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black text-gray-950 dark:text-white tracking-tight">
              Privacy Policy
            </h1>
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-1">
              Last Updated: September 22, 2026
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 justify-center md:justify-start">
              <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                DPDP Act 2023 Compliant
              </span>
              <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/30 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                IT Act 2000
              </span>
              <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                Consumer Protection Rules 2020
              </span>
            </div>
          </div>

          <div className="space-y-8">

            {/* Section 1: Data Fiduciary */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-500 shrink-0" />
                <h2 className="text-base font-extrabold text-gray-900 dark:text-white">1. Data Fiduciary Information</h2>
              </div>
              <p>
                In compliance with the <span className="font-extrabold text-gray-950 dark:text-white">Digital Personal Data Protection Act, 2023 (DPDP Act)</span>, the Data Fiduciary for this platform is:
              </p>
              <div className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700 text-xs space-y-1.5 font-semibold">
                <p><span className="text-gray-400 uppercase tracking-wider text-[10px]">Data Fiduciary:</span> <span className="text-gray-900 dark:text-white font-extrabold">FREE FIRE OFFICIAL DEALS</span></p>
                <p><span className="text-gray-400 uppercase tracking-wider text-[10px]">Platform URL:</span> <span className="text-indigo-600 dark:text-indigo-400">freefireofficial.in</span></p>
                <p><span className="text-gray-400 uppercase tracking-wider text-[10px]">Designated Grievance Officer:</span> Free Fire Official Deals — Compliance & Grievance Desk</p>
                <p><span className="text-gray-400 uppercase tracking-wider text-[10px]">Contact Email:</span> <span className="text-indigo-600 dark:text-indigo-400 font-bold">support@freefireofficial.in</span></p>
                <p><span className="text-gray-400 uppercase tracking-wider text-[10px]">Governing Law:</span> Laws of India — DPDP Act 2023, IT Act 2000, Consumer Protection Act 2019</p>
              </div>
            </section>

            {/* Section 2: Purpose & Lawful Basis */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                <h2 className="text-base font-extrabold text-gray-900 dark:text-white">2. Personal Data We Collect & Purpose</h2>
              </div>
              <p>
                Under <span className="font-bold text-gray-900 dark:text-white">DPDP Act 2023 — Section 4 (Lawful Purpose)</span> and <span className="font-bold text-gray-900 dark:text-white">Section 5 (Notice)</span>, we collect the following personal data only for specified, clear, and lawful purposes:
              </p>

              {/* Data Collection Table */}
              <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-indigo-50 dark:bg-indigo-950/40 text-left">
                      <th className="px-4 py-3 font-black text-gray-900 dark:text-white uppercase tracking-wider text-[10px]">Data Category</th>
                      <th className="px-4 py-3 font-black text-gray-900 dark:text-white uppercase tracking-wider text-[10px]">Specific Data</th>
                      <th className="px-4 py-3 font-black text-gray-900 dark:text-white uppercase tracking-wider text-[10px]">Purpose</th>
                      <th className="px-4 py-3 font-black text-gray-900 dark:text-white uppercase tracking-wider text-[10px]">Legal Basis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    <tr className="bg-white dark:bg-gray-900/50">
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">Identity Data</td>
                      <td className="px-4 py-3">Full name, email address, mobile number</td>
                      <td className="px-4 py-3">Account creation, authentication, support communication</td>
                      <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400 font-bold">Consent (DPDP S.6)</td>
                    </tr>
                    <tr className="bg-gray-50 dark:bg-gray-800/30">
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">Authentication Tokens</td>
                      <td className="px-4 py-3">Firebase Auth session, Google OAuth tokens</td>
                      <td className="px-4 py-3">Secure login, session management</td>
                      <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400 font-bold">Legitimate Use (DPDP S.7)</td>
                    </tr>
                    <tr className="bg-white dark:bg-gray-900/50">
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">Social Media</td>
                      <td className="px-4 py-3">Instagram username/link (optional)</td>
                      <td className="px-4 py-3">Account handover communication</td>
                      <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400 font-bold">Consent (DPDP S.6)</td>
                    </tr>
                    <tr className="bg-gray-50 dark:bg-gray-800/30">
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">Device & Network</td>
                      <td className="px-4 py-3">IP address, browser user agent, screen resolution, connection type, platform</td>
                      <td className="px-4 py-3">Security audit, fraud detection, multi-IP ban enforcement</td>
                      <td className="px-4 py-3 text-amber-600 dark:text-amber-400 font-bold">Consent (DPDP S.6)*</td>
                    </tr>
                    <tr className="bg-white dark:bg-gray-900/50">
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">Location Data</td>
                      <td className="px-4 py-3">Approximate GPS coordinates (latitude/longitude), country</td>
                      <td className="px-4 py-3">Geofencing, regional compliance, credential sharing detection</td>
                      <td className="px-4 py-3 text-amber-600 dark:text-amber-400 font-bold">Consent (DPDP S.6)*</td>
                    </tr>
                    <tr className="bg-gray-50 dark:bg-gray-800/30">
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">Billing Data</td>
                      <td className="px-4 py-3">Payment transaction records, Razorpay payment IDs</td>
                      <td className="px-4 py-3">Payment verification, subscription management</td>
                      <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400 font-bold">Contractual (DPDP S.7)</td>
                    </tr>
                    <tr className="bg-white dark:bg-gray-900/50">
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">Preference Data</td>
                      <td className="px-4 py-3">Theme (dark/light), cookie consent choice</td>
                      <td className="px-4 py-3">User experience personalization</td>
                      <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400 font-bold">Consent (DPDP S.6)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold italic">
                * Device & Network and Location Data are collected ONLY after explicit consent via our Cookie Consent Banner. Without consent, these fields are not recorded.
              </p>
            </section>

            {/* Section 3: Consent */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-500 shrink-0" />
                <h2 className="text-base font-extrabold text-gray-900 dark:text-white">3. Consent & How We Obtain It</h2>
              </div>
              <p>
                Under <span className="font-bold text-gray-900 dark:text-white">DPDP Act 2023 — Section 6</span>, we obtain your free, specific, informed, and unconditional consent through the following mechanisms:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 pt-1.5">
                <li><span className="font-bold text-gray-900 dark:text-white">Registration Consent:</span> At signup, you must check a mandatory consent checkbox confirming age (18+) and data processing agreement before your account is created.</li>
                <li><span className="font-bold text-gray-900 dark:text-white">Cookie & Tracking Consent:</span> A persistent Cookie Consent Banner appears on first visit, requiring explicit "Accept All" or "Essential Only" choice before any telemetry data (IP, geolocation, device info) is collected.</li>
                <li><span className="font-bold text-gray-900 dark:text-white">Geolocation Consent:</span> Browser-level permission prompt before any GPS coordinates are accessed, in addition to our Cookie Consent.</li>
              </ul>
              <p className="font-semibold">
                Your consent is recorded with the following details in our database: consent flag, ISO 8601 timestamp, consent version identifier, method of consent, and your user agent at the time of consent.
              </p>
            </section>

            {/* Section 4: Right to Withdraw Consent */}
            <section className="space-y-2">
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white">4. Right to Withdraw Consent</h2>
              <p>
                Under <span className="font-bold text-gray-900 dark:text-white">DPDP Act 2023 — Section 6(6)</span>, you have the right to withdraw your consent at any time. You can do this through:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 pt-1.5">
                <li>Clicking "Essential Only" on the Cookie Consent Banner to stop telemetry collection.</li>
                <li>Visiting your <span className="font-bold text-gray-900 dark:text-white">Profile page</span> and using the "Withdraw Data Consent" option.</li>
                <li>Sending an email to our Grievance Officer requesting consent withdrawal.</li>
              </ul>
              <p className="text-xs text-amber-700 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                Note: Withdrawing consent may limit certain platform features (e.g., security monitoring, credential sharing detection). Withdrawal does not affect the lawfulness of processing based on consent before its withdrawal.
              </p>
            </section>

            {/* Section 5: Data Principal Rights */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-500 shrink-0" />
                <h2 className="text-base font-extrabold text-gray-900 dark:text-white">5. Your Rights as a Data Principal</h2>
              </div>
              <p>
                Under <span className="font-bold text-gray-900 dark:text-white">DPDP Act 2023 — Section 11, 12, 13, and 14</span>, as a Data Principal you have the following rights:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-1">
                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Right to Access (S.11)</span>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Request a summary of your personal data being processed and the processing activities.</p>
                </div>
                <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-1">
                  <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">Right to Correction (S.12)</span>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Request correction or update of inaccurate or incomplete personal data.</p>
                </div>
                <div className="p-3.5 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-800 space-y-1">
                  <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider block">Right to Erasure (S.12)</span>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Request deletion of your personal data when it is no longer necessary. Use the "Request Data Deletion" button in your Profile.</p>
                </div>
                <div className="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800 space-y-1">
                  <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Right to Grievance (S.13)</span>
                  <p className="text-xs text-gray-600 dark:text-gray-400">File a grievance with our Grievance Officer. If unresolved, escalate to the Data Protection Board of India.</p>
                </div>
              </div>
              <p className="text-xs font-semibold pt-1">
                To exercise any of these rights, email <span className="text-indigo-600 dark:text-indigo-400 font-bold">support@freefireofficial.in</span> from your registered email address, or use the in-app mechanisms provided in your Profile page.
              </p>
            </section>

            {/* Section 6: Data Retention */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
                <h2 className="text-base font-extrabold text-gray-900 dark:text-white">6. Data Retention Policy</h2>
              </div>
              <p>
                Under <span className="font-bold text-gray-900 dark:text-white">DPDP Act 2023 — Section 8(7)</span>, we retain personal data only for as long as necessary to fulfill the purpose for which it was collected:
              </p>
              <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-indigo-50 dark:bg-indigo-950/40 text-left">
                      <th className="px-4 py-3 font-black text-gray-900 dark:text-white uppercase tracking-wider text-[10px]">Data Type</th>
                      <th className="px-4 py-3 font-black text-gray-900 dark:text-white uppercase tracking-wider text-[10px]">Retention Period</th>
                      <th className="px-4 py-3 font-black text-gray-900 dark:text-white uppercase tracking-wider text-[10px]">After Expiry</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    <tr className="bg-white dark:bg-gray-900/50">
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">User Profile Data</td>
                      <td className="px-4 py-3">Until account deletion or 3 years from last activity</td>
                      <td className="px-4 py-3">Permanently deleted</td>
                    </tr>
                    <tr className="bg-gray-50 dark:bg-gray-800/30">
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">Session/Telemetry Logs</td>
                      <td className="px-4 py-3">90 days from creation</td>
                      <td className="px-4 py-3">Auto-purged</td>
                    </tr>
                    <tr className="bg-white dark:bg-gray-900/50">
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">Payment/Transaction Records</td>
                      <td className="px-4 py-3">7 years (as required by Indian tax/financial regulations)</td>
                      <td className="px-4 py-3">Anonymized or deleted</td>
                    </tr>
                    <tr className="bg-gray-50 dark:bg-gray-800/30">
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">Audit Logs</td>
                      <td className="px-4 py-3">1 year from creation</td>
                      <td className="px-4 py-3">Auto-purged</td>
                    </tr>
                    <tr className="bg-white dark:bg-gray-900/50">
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">Consent Records</td>
                      <td className="px-4 py-3">Until account deletion + 1 year (legal compliance)</td>
                      <td className="px-4 py-3">Permanently deleted</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section 7: Data Security */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-500 shrink-0" />
                <h2 className="text-base font-extrabold text-gray-900 dark:text-white">7. Data Security Measures</h2>
              </div>
              <p>
                Under <span className="font-bold text-gray-900 dark:text-white">DPDP Act 2023 — Section 8(4)</span> and <span className="font-bold text-gray-900 dark:text-white">IT Act 2000 — Section 43A</span>, we implement reasonable security safeguards:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 pt-1.5">
                <li><span className="font-bold text-gray-900 dark:text-white">Encryption:</span> All data in transit is encrypted via HTTPS/TLS. Firebase Firestore provides encryption at rest.</li>
                <li><span className="font-bold text-gray-900 dark:text-white">Authentication:</span> Firebase Auth with multi-factor options, password hashing, and session token management.</li>
                <li><span className="font-bold text-gray-900 dark:text-white">Access Control:</span> Role-based access control (Admin, Staff, Client, User) with route guards and server-side Firestore security rules.</li>
                <li><span className="font-bold text-gray-900 dark:text-white">Audit Trail:</span> All administrative actions are logged with timestamps, actor identity, and change details.</li>
                <li><span className="font-bold text-gray-900 dark:text-white">Auto-Lockout:</span> Suspicious activity detection with automatic account suspension.</li>
              </ul>
            </section>

            {/* Section 8: Cross-Border Data Transfer */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-500 shrink-0" />
                <h2 className="text-base font-extrabold text-gray-900 dark:text-white">8. Cross-Border Data Transfer</h2>
              </div>
              <p>
                Under <span className="font-bold text-gray-900 dark:text-white">DPDP Act 2023 — Section 16</span>, we disclose that your personal data may be processed by the following service providers outside India:
              </p>
              <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-indigo-50 dark:bg-indigo-950/40 text-left">
                      <th className="px-4 py-3 font-black text-gray-900 dark:text-white uppercase tracking-wider text-[10px]">Service Provider</th>
                      <th className="px-4 py-3 font-black text-gray-900 dark:text-white uppercase tracking-wider text-[10px]">Country</th>
                      <th className="px-4 py-3 font-black text-gray-900 dark:text-white uppercase tracking-wider text-[10px]">Purpose</th>
                      <th className="px-4 py-3 font-black text-gray-900 dark:text-white uppercase tracking-wider text-[10px]">Data Shared</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    <tr className="bg-white dark:bg-gray-900/50">
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">Google Firebase</td>
                      <td className="px-4 py-3">USA</td>
                      <td className="px-4 py-3">Authentication, database (Firestore), hosting</td>
                      <td className="px-4 py-3">User profiles, session data, all stored records</td>
                    </tr>
                    <tr className="bg-gray-50 dark:bg-gray-800/30">
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">ipapi.co</td>
                      <td className="px-4 py-3">EU/USA</td>
                      <td className="px-4 py-3">IP geolocation lookup (only with consent)</td>
                      <td className="px-4 py-3">IP address</td>
                    </tr>
                    <tr className="bg-white dark:bg-gray-900/50">
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">Razorpay</td>
                      <td className="px-4 py-3">India</td>
                      <td className="px-4 py-3">Payment processing</td>
                      <td className="px-4 py-3">Name, email, payment amount, transaction ID</td>
                    </tr>
                    <tr className="bg-gray-50 dark:bg-gray-800/30">
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">Google OAuth</td>
                      <td className="px-4 py-3">USA</td>
                      <td className="px-4 py-3">Google Sign-In authentication</td>
                      <td className="px-4 py-3">Email, name, profile photo</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs font-semibold">
                Data is only transferred to countries not restricted by the Central Government under Section 16(1) of the DPDP Act. We do not store any credit card or bank login details on our own servers.
              </p>
            </section>

            {/* Section 9: Cookies & Tracking */}
            <section className="space-y-2">
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white">9. Cookies & Tracking Technologies</h2>
              <p>
                Our application uses the following storage and tracking mechanisms:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 pt-1.5">
                <li><span className="font-bold text-gray-900 dark:text-white">Essential (Always Active):</span> Firebase Auth session tokens (localStorage), theme preference (light/dark mode), DPDP consent choice.</li>
                <li><span className="font-bold text-gray-900 dark:text-white">Analytics & Security (Consent Required):</span> IP address, browser user agent, screen resolution, connection type, geolocation coordinates — collected only after explicit Cookie Consent Banner acceptance.</li>
              </ul>
              <p>
                You can manage your consent at any time. Choosing "Essential Only" will prevent all telemetry data collection while maintaining core login functionality.
              </p>
            </section>

            {/* Section 10: Sharing of Data */}
            <section className="space-y-2">
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white">10. Sharing of Personal Data</h2>
              <p>
                Under <span className="font-bold text-gray-900 dark:text-white">DPDP Act 2023 — Section 8(8)</span>, we will not sell, distribute, or lease your personal information to third parties unless:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 pt-1.5">
                <li>You have given explicit consent.</li>
                <li>We are required by law, court order, or regulatory authority (including the Data Protection Board of India).</li>
                <li>It is necessary for payment processing (Razorpay) to verify completed transactions.</li>
                <li>It is required for fraud prevention or cybercrime investigation under the IT Act 2000.</li>
              </ul>
            </section>

            {/* Section 11: Children's Data */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <h2 className="text-base font-extrabold text-gray-900 dark:text-white">11. Children's Data Protection</h2>
              </div>
              <p>
                Under <span className="font-bold text-gray-900 dark:text-white">DPDP Act 2023 — Section 9</span>, we do not knowingly collect personal data from individuals below 18 years of age. Our registration process requires an explicit age declaration (18+). If we discover that a minor's data has been collected without verifiable parental consent, we will take immediate steps to delete such data.
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                Parents or guardians who believe their child's data has been collected may contact our Grievance Officer for immediate data erasure.
              </p>
            </section>

            {/* Section 12: Data Breach Notification */}
            <section className="space-y-2">
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white">12. Data Breach Notification</h2>
              <p>
                Under <span className="font-bold text-gray-900 dark:text-white">DPDP Act 2023 — Section 8(6)</span>, in the event of a personal data breach, we shall:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 pt-1.5">
                <li>Notify the <span className="font-bold text-gray-900 dark:text-white">Data Protection Board of India</span> without unreasonable delay.</li>
                <li>Notify affected Data Principals (users) about the breach, its impact, and remedial actions taken.</li>
                <li>Implement corrective measures to prevent recurrence.</li>
              </ul>
            </section>

            {/* Section 13: Grievance Redressal */}
            <section className="space-y-2 border-t border-gray-150 dark:border-gray-800 pt-4">
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white">13. Grievance Redressal Mechanism</h2>
              <p>
                In compliance with <span className="font-bold text-gray-900 dark:text-white">DPDP Act 2023 — Section 13</span>, <span className="font-bold text-gray-900 dark:text-white">IT (Intermediary Guidelines) Rules, 2021 — Rule 3(2)</span>, and <span className="font-bold text-gray-900 dark:text-white">Consumer Protection (E-Commerce) Rules, 2020</span>:
              </p>
              <div className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700 text-xs space-y-1.5 font-semibold">
                <p><span className="text-gray-400 uppercase tracking-wider text-[10px]">Grievance Officer:</span> Free Fire Official Deals — Compliance & Grievance Desk</p>
                <p><span className="text-gray-400 uppercase tracking-wider text-[10px]">Official Email:</span> <span className="text-indigo-600 dark:text-indigo-400 font-bold">support@freefireofficial.in</span></p>
                <p><span className="text-gray-400 uppercase tracking-wider text-[10px]">Acknowledgment:</span> Within 24 hours of receiving the grievance.</p>
                <p><span className="text-gray-400 uppercase tracking-wider text-[10px]">Resolution Timeline:</span> Within 72 business hours. Data deletion requests processed within 7-14 business days.</p>
                <p><span className="text-gray-400 uppercase tracking-wider text-[10px]">Escalation:</span> If unsatisfied, you may approach the <span className="text-gray-900 dark:text-white font-bold">Data Protection Board of India</span> under DPDP Act 2023 — Section 27.</p>
              </div>
            </section>

            {/* Section 14: Policy Updates */}
            <section className="space-y-2">
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white">14. Changes to This Privacy Policy</h2>
              <p>
                We may update this Privacy Policy to reflect changes in our practices, legal requirements, or regulatory guidance. Any material changes will be communicated through a notice on our platform. Continued use of the platform after changes constitutes acceptance of the updated policy, subject to your right to withdraw consent under Section 6(6) of the DPDP Act.
              </p>
            </section>

            {/* Governing Law Badge */}
            <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-200 dark:border-indigo-800 text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-indigo-700 dark:text-indigo-300 font-black text-xs uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Regulatory Compliance Declaration</span>
              </div>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                This Privacy Policy is compliant with the Digital Personal Data Protection Act, 2023 (DPDP Act) • Information Technology Act, 2000 • Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011 • Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 • Consumer Protection (E-Commerce) Rules, 2020 • Consumer Protection Act, 2019
              </p>
            </div>

          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
