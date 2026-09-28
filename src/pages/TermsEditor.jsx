import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { db } from '../firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { 
  FileText, 
  Save, 
  Loader, 
  ShieldCheck, 
  AlertTriangle, 
  Sparkles, 
  ExternalLink, 
  RefreshCw,
  Clock,
  CheckCircle2,
  Lock,
  Layers
} from 'lucide-react';

const DEFAULT_FUTURE_CLAUSE = `THE OPERATOR & ESCROW PLATFORM RESERVES THE UNFETTERED, ABSOLUTE, PERPETUAL, AND UNREVIEWABLE RIGHT TO AMEND, MODIFY, REVISE, INTERPOLATE, RESTRUCTURE, REDACT, OR SUPERSEDE THESE TERMS AND CONDITIONS, OPERATIONAL ESCROW PROTOCOLS, TARIFFS, AND JURISDICTIONAL MANDATES AT ANY EPOCH WITHOUT ANTECEDENT ANNOUNCEMENT OR RETROACTIVE COMPENSATORY REMEDY. BY DIRECTING TELEMETRY, BROWSING, TRANSACTING, OR MAINTAINING AN ACTIVE SESSION WITHIN THIS REPOSITORY, YOU VOLUNTARILY, EXPLICITLY, AND IRREVOCABLY BIND YOURSELF TO ALL EXTANT, CONTEMPORARY, AND FUTURE STATUTORY AMENDMENTS AUTOMATICALLY AND WITHOUT RIGHT OF RESCISSION.`;

const DEFAULT_TERMS_TEXT = `MASTER INTERMEDIARY SERVICE COVENANT, EPHEMERAL USUFRUCTUARY ADHESION ACCORD, CRYPTOGRAPHIC AUTHENTICATION PROTOCOLS, AND COMPREHENSIVE EXCULPATORY INDEMNIFICATION DECLARATION

PREAMBLE & FORMAL JURISDICTIONAL RECITALS:
HERETOFORTH AND WHEREAS, by initiating electronic transmission, directing network telemetry towards this portal, executing payment transactions, authenticating via OAuth/IMAP/OTP relays, or requesting temporary session credentials, the accessing party (hereinafter denominated interchangeably as "The User", "The Transactor", "The Lessee", or "The Covenantor") enters into a legally irrevocable, non-rescindable, and statutorily enforceable covenant with the Operator and Escrow Platform (hereinafter denominated as "The System", "The Escrow Intermediary", or "The Licensor"), established and regulated under the Information Technology Act, 2000, the Consumer Protection (E-Commerce) Rules, 2020, and the Indian Contract Act, 1872. 

WHEREFORE, failure to peruse, comprehend, or master the syntactic intricacies or semantic definitions herein contained shall in no circumstance constitute an actionable defense, exculpation, or ground for equitable restitution under the doctrine of Ignorantia Juris Non Excusat.

SECTION 1. DEFINITIONS & INTERPRETATIVE JURISPRUDENTIAL FRAMEWORK:
1.1 "Ephemeral Usufructuary License" denotes a strictly circumscribed, transient, non-possessory, revocable, and non-assignable right of momentary digital access accorded to the User for a pre-determined temporal interval (nominally not exceeding 48 contiguous astronomical hours), devoid of any underlying proprietary title, legal alienation, or perpetual copyright conveyance.
1.2 "Cryptographically Tokenized Authentication Credentials" encompasses, without limitation, alphanumeric strings, temporary recovery mailbox routing tokens, multi-factor authentication (MFA) stream vectors, and One-Time Passwords (OTP) emitted via SMTP, POP3, IMAP, or dedicated RESTful Webhook architectures.
1.3 "Third-Party Publisher Domain" references external multi-jurisdictional intellectual property proprietors, including but not limited to Garena Online Pte. Ltd., Sea Limited, and associated auxiliary identity federations (Google LLC, Meta Platforms, VKontakte LLC, Apple Inc.).
1.4 "Force Majeure Infrastructure Infraction" denotes any algorithmic severability, publisher-mandated session termination, server revocation, latency anomaly, or automated network firewall throttling outside the direct mathematical control of the Platform.

SECTION 2. UNILATERAL, PERPETUAL & UNRESTRICTED RIGHT OF REVISION (MANDATORY FUTURE COVENANTS):
2.1 The System reserves the absolute, unfettered, and unreviewable prerogative to unilaterally modify, interpolate, supersede, truncate, or reconstitute any clause, tariff schedule, operational protocol, or disclaimer herein, at any epoch, without antecedent notification or retroactive justification.
2.2 The User’s continuous presence, repeated portal navigation, or failure to immediately purge session cookies constitutes an affirmative, conclusive, and irrebuttable presumption of assent to any and all subsequent iterations, modifications, and statutory amendments promulgated heretofore or hereafter.

SECTION 3. EXCLUSION OF PERMANENT PROPRIETARY RIGHTS & RETENTION OF ESCROW TITLE:
3.1 All virtual accounts, Free Fire game assets, level identifiers, character skins, and tokenized credentials cataloged within the Inventory or Store are properties of their respective publishers and are provided solely on an ephemeral sub-lease basis.
3.2 The User explicitly warrants that they shall not interpret credential delivery as an alienation of equitable ownership. At the conclusion of the designated operational period (nominally 48 hours), all session usufructuary rights terminate ipso facto, and the digital asset re-enters the unencumbered escrow pool of the System.
3.3 Any unauthorized retention, extraction of recovery codes, or clandestine alteration of password databases constitutes a material breach of this covenant, subjecting the violator to immediate cryptographic termination, blacklisting, and civil statutory damages.

SECTION 4. PUBLISHER COMPLIANCE, PROHIBITION OF CREDENTIAL ALTERATION & STRICT MULTI-IP BANS:
4.1 The Transactor covenants under strict penalty of summary account forfeiture to strictly adhere to the End User License Agreement (EULA) and terms dictated by Garena Online Pte. Ltd.
4.2 Concurrent logins from disparate geographical regions, utilizing commercial proxies, dynamic VPN tunneling, or unauthorized IP addresses during an active session is strictly forbidden. The System disclaims any responsibility for publisher-initiated device bans, hardware identity hash blocks, or automated anti-cheat suspensions precipitated by User negligence.
4.3 The User shall not modify linked recovery credentials, initiate password resets through unauthorized gateways, or tamper with third-party social bindings (VKontakte, Google, Apple ID). Any such perturbation instantly voids all escrow protections and triggers automated session severance.

SECTION 5. MANDATORY FIFTEEN-DAY (15-DAY) RECOVERY BINDING RESTRICTION:
5.1 The Transactor expressly acknowledges that official publisher account binding protocols impose an immutable 15-day verification gestation period during which recovery email bindings cannot be severed, accelerated, or displaced.
5.2 Any attempt by the User to circumvent this statutory period through customer support falsification, concurrent OTP bombardment, or bad-faith escrow dispute filings shall be treated as an anticipatory breach of contract, resulting in immediate confiscation of all deposited sums without right of reimbursement.

SECTION 6. CRYPTOGRAPHIC DELIVERY CONSUMMATION & IMMEDIATE TRANSFER OF CAUSAL RISK:
6.1 Performance of service by the System is legally consummated at the exact millisecond wherein the cryptographic verification code (OTP), login credentials, or stream telemetry is visually rendered within the Client Dashboard or emitted to the User’s designated endpoint.
6.2 All risks pertaining to credential capture, keylogger compromise, session hijack, unauthorized secondary distribution, or device loss transfer instantaneously, irrevocably, and exclusively to the User upon said visual rendering or transmission.

SECTION 7. ABSOLUTE FINALITY OF CONSIDERATION, COMPLETE WAIVER OF REFUND & NON-RESCISSION:
7.1 By reason of the instantaneous, indivisible, and digitally volatile nature of cryptographic credential provisioning, all payments, processing tariffs, commissions, and deposits rendered through the System are non-refundable, absolute, and unrescindable.
7.2 Pursuant to applicable e-commerce provisions governing the immediate performance of customized digital services, the Transactor knowingly, voluntarily, and expressly waives any statutory "cooling-off" period, right of withdrawal, restitutionary claim, or equitable rescission under contract law.
7.3 Initiating a fraudulent chargeback, payment dispute, or payment reversal through banking institutions or payment intermediaries constitutes tortious interference and a criminal infraction under the Information Technology Act, 2000, triggering immediate civil recovery litigation and punitive damages.

SECTION 8. INTEGRATED PLATFORM ESCROW COMMISSION & TELEMETRY SURCHARGES:
8.1 Every financial transaction processed incorporates an automated platform escrow commission and operational maintenance tariff varying between ₹500 and ₹2,000 INR, determined dynamically in accordance with account tier, mailbox stream complexity, and cryptographic throughput.
8.2 This consideration covers the non-severable costs of continuous IMAP mailbox stream monitoring, server uptime preservation, cryptographic token generation, and real-time database ledger updates, and is non-severable and non-refundable under all circumstances.

SECTION 9. EXCULPATORY PROVISION & ABSOLUTE DISCLAIMER OF WARRANTIES:
9.1 THE PLATFORM, SERVICES, CREDENTIALS, AND ALL ASSOCIATED TELEMETRY ARE DELIVERED STRICTLY ON AN "AS IS", "AS AVAILABLE", AND "WITH ALL FAULTS" BASIS. 
9.2 TO THE MAXIMUM DEGREE PERMISSIBLE UNDER STATUTORY JURISPRUDENCE, THE OPERATOR EXPRESSLY DISCLAIMS ALL WARRANTIES OF ANY CATEGORY, WHETHER EXPRESS, IMPLIED, STATUTORY, OR COLLATERAL, INCLUDING BUT NOT LIMITED TO THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR GAMING OR COMPETITIVE PURPOSE, SYSTEM STABILITY, AND NON-INFRINGEMENT.
9.3 THE SYSTEM DOES NOT WARRANT THAT GARENA SERVERS WILL MAINTAIN PERPETUAL CONNECTIVITY, THAT ACCOUNT CREDENTIALS WILL ESCAPE AUTOMATED THIRD-PARTY BAN WAVES, OR THAT OTP RECEPTACLES WILL SUFFER ZERO TELECOMMUNICATION LATENCY.

SECTION 10. COMPREHENSIVE LIMITATION OF PECUNIARY LIABILITY:
10.1 IN NO EVENT SHALL THE OPERATOR, ITS PRINCIPALS, SYSTEM ARCHITECTS, SUBSIDIARIES, AGENTS, OR AFFILIATES BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, CONSEQUENTIAL, PUNITIVE, SPECIAL, OR EXEMPLARY DAMAGES, INCLUDING LOSS OF PROFITS, LOSS OF VIRTUAL ASSETS, REPUTATIONAL INJURY, IN-GAME TOURNAMENT DISQUALIFICATION, OR HARDWARE FAILURE ARISING FROM THE USE OR INABILITY TO USE THE SERVICE.
10.2 NOTWITHSTANDING ANYTHING CONTAINED HEREIN TO THE CONTRARY, THE MAXIMUM AGGREGATE MONETARY LIABILITY OF THE SYSTEM FOR ANY AND ALL CLAIMS UNDER CONTRACT, TORT, OR EQUITY SHALL BE STRICTLY CAPPED AT THE NOMINAL SUM OF ₹100 INR (ONE HUNDRED INDIAN RUPEES ONLY).

SECTION 11. INDEMNIFICATION, DEFENSE MANDATE & HOLD-HARMLESS COVENANT:
11.1 The User covenants to irrevocably defend, indemnify, and hold completely harmless the Platform, its administrators, infrastructure providers, and legal counsel from and against any claims, causes of action, regulatory investigations, fines, liabilities, losses, costs, or expenditures (including reasonable legal and forensic accounting fees) arising out of or directly related to:
(a) User's violation of publisher guidelines or game EULA;
(b) Transactor's concurrent IP routing causing account locking;
(c) Malicious, abusive, or threatening interactions with customer service conduits;
(d) Any third-party intellectual property claim originating from the User’s conduct.

SECTION 12. MANDATORY BINDING INDIVIDUAL ARBITRATION & FORUM NON CONVENIENS:
12.1 Any dispute, controversy, claim, or discordance arising out of, relating to, or concerning this agreement, its formation, validity, breach, or termination, shall be referred to and definitively resolved by final and binding individual arbitration administered under the Arbitration and Conciliation Act, 1996.
12.2 The sole arbitrator shall be appointed exclusively by the Operator. The seat and venue of arbitration shall be New Delhi, India. The proceedings shall be conducted strictly in the English language and via confidential electronic medium.
12.3 The Transactor explicitly waives any right to initiate, join, consolidate, or prosecute any class action, collective arbitration, representative proceeding, or private attorney general claim against the System.

SECTION 13. SEVERABILITY, NON-WAIVER & INTEGRATION (PAROL EVIDENCE):
13.1 If any judicial, arbitral, or regulatory authority finds any clause, sub-clause, word, or phrase of this Covenant to be invalid, illegal, or unenforceable, such determination shall not infect or impair the validity of the remaining provisions, which shall remain in full statutory vigor and effect.
13.2 The failure of the System to enforce at any time any provision hereof shall in no manner be construed as a waiver of such provision, nor shall it diminish the right of the System to demand strict compliance thereafter.
13.3 This instrument embodies the entire, integrated, and exclusive accord between the parties, completely extinguishing and superseding all prior oral assurances, chat transcripts, marketing representations, or informal correspondence.

SECTION 14. STATUTORY GRIEVANCE REDRESSAL DISCLOSURE & INTERMEDIARY SAFE HARBOR:
14.1 In strict compliance with Rule 3(2) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, and the Consumer Protection (E-Commerce) Rules, 2020, the designated Grievance Redressal mechanism is cataloged as follows:
• Designated Compliance Officer: Chief Escrow & Digital Grievance Administrator
• Official Redressal Conduit: support@dealsbyshiv.web.app (Escrow Desk)
• Procedural Protocols: All grievances must include cryptographic transaction hashes, account UID identifiers, and a sworn declaration under penalty of perjury.
• Statutory Response Latency: Formal acknowledgment within twenty-four (24) chronological hours; administrative determination rendered within seventy-two (72) standard business hours.`;

const DEFAULT_POPUP_POINTS = [
  {
    title: '1. 100% VERIFIED GAME ASSETS',
    desc: 'EVERY FREE FIRE ACCOUNT LISTED HAS BEEN MANUALLY RECORDED AND VERIFIED WITH VIDEO & PHOTO PROOFS.'
  },
  {
    title: '2. DIRECT ESCROW PROTOCOL',
    desc: 'NO AUTOMATED GATEWAY LEAKS. ALL PAYMENTS & CREDENTIAL TRANSFERS ARE SUPERVISED LIVE VIA OFFICIAL DESK.'
  },
  {
    title: '3. ZERO FRAUD & INSTANT REPLACEMENT',
    desc: 'COMPLETE HANDOVER RECORDING IS REQUIRED UPON PURCHASE. VALIDATED ISSUES RECEIVE 100% REPLACEMENT OR REFUND ASSISTANCE.'
  },
  {
    title: '4. FUTURE TERMS & POLICY AMENDMENTS',
    desc: 'TERMS & CONDITIONS MAY BE UPDATED AT ANY TIME. PROCEEDING BINDS YOU TO ALL PRESENT AND FUTURE MODIFICATIONS AUTOMATICALLY.'
  }
];

export default function TermsEditor() {
  const { currentUser, userDoc } = useAuth();
  const { showToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form States
  const [headingTitle, setHeadingTitle] = useState('COVENANT OF LEASE, DIGITAL ACQUISITION, LICENSE VERIFICATION AND INDEMNIFICATION PROTOCOLS');
  const [futureClause, setFutureClause] = useState(DEFAULT_FUTURE_CLAUSE);
  const [termsText, setTermsText] = useState(DEFAULT_TERMS_TEXT);
  const [popupPoints, setPopupPoints] = useState(DEFAULT_POPUP_POINTS);

  // Fetch current terms from Firestore
  useEffect(() => {
    async function loadTerms() {
      try {
        const docSnap = await getDoc(doc(db, 'system_settings', 'terms_conditions'));
        if (docSnap.exists()) {
          const d = docSnap.data();
          if (d.headingTitle) setHeadingTitle(d.headingTitle);
          if (d.futureClause) setFutureClause(d.futureClause);
          if (d.termsText) setTermsText(d.termsText);
          if (Array.isArray(d.popupPoints) && d.popupPoints.length > 0) setPopupPoints(d.popupPoints);
        }
      } catch (err) {
        console.error("Error loading terms settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadTerms();
  }, []);

  // Update specific popup point
  const handleUpdatePoint = (index, field, value) => {
    setPopupPoints(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value.toUpperCase() };
      return copy;
    });
  };

  // Save changes handler
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'system_settings', 'terms_conditions'), {
        headingTitle: headingTitle.trim().toUpperCase(),
        futureClause: futureClause.trim().toUpperCase(),
        termsText: termsText.trim().toUpperCase(),
        popupPoints: popupPoints.map(p => ({
          title: (p.title || '').trim().toUpperCase(),
          desc: (p.desc || '').trim().toUpperCase()
        })),
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.email
      });

      showToast("Terms & Conditions and Marketplace Popup updated live across the platform!", "success");
    } catch (err) {
      console.error("Error saving terms:", err);
      showToast("Failed to save Terms & Conditions.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Reset to default template
  const handleResetTemplate = () => {
    if (window.confirm("Reset all fields to the master legal & future clause template?")) {
      setFutureClause(DEFAULT_FUTURE_CLAUSE);
      setTermsText(DEFAULT_TERMS_TEXT);
      setPopupPoints(DEFAULT_POPUP_POINTS);
      showToast("Template reset to master legal standard.", "info");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex font-sans select-none">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      <div className="flex-1 lg:pl-72 flex flex-col min-w-0 h-screen overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                  Terms & Conditions Editor
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mt-0.5">
                  Update live legal terms, future amendment clauses, and marketplace cyber popup points.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <a
                href="/terms-and-conditions"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-indigo-500" />
                <span>View Live Terms ↗</span>
              </a>

              <button
                type="button"
                onClick={handleResetTemplate}
                className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Template</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-16 text-center space-y-3">
              <Loader className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
              <p className="text-xs font-bold text-gray-400">Loading terms settings...</p>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              
              {/* Mandatory Future Amendment Clause Banner */}
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-2 border-amber-500/40 rounded-3xl p-5 sm:p-6 space-y-3 relative overflow-hidden shadow-xs">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 animate-bounce" />
                  <span className="text-xs font-black uppercase tracking-wider">
                    ⚡ Mandatory Future Policy & Amendments Agreement Clause
                  </span>
                </div>
                <p className="text-[11px] text-gray-600 dark:text-gray-300 font-semibold leading-relaxed">
                  This clause legally binds all visitors to both current and any <strong>future changes</strong> made to the Terms & Conditions automatically.
                </p>
                <textarea
                  rows={4}
                  required
                  value={futureClause}
                  onChange={(e) => setFutureClause(e.target.value.toUpperCase())}
                  className="w-full p-4 text-xs font-black font-mono uppercase bg-white dark:bg-gray-900 border border-amber-300 dark:border-amber-700 rounded-2xl text-amber-950 dark:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 leading-relaxed tracking-wide shadow-inner"
                  placeholder="Enter future amendments agreement clause..."
                />
              </div>

              {/* Marketplace Cyber Popup 4 Points Editor */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <div>
                      <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                        Marketplace Cyber Popup Agreement Points (4 Highlights)
                      </h3>
                      <span className="text-[10px] text-gray-400 font-bold uppercase">
                        These points appear inside the neon popup modal when buyers open dealsbyshiv.web.app
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {popupPoints.map((pt, idx) => (
                    <div 
                      key={idx} 
                      className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-850/60 border border-gray-200/80 dark:border-gray-750 space-y-2.5 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-955/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          Highlight #{idx + 1}
                        </span>
                      </div>
                      
                      <div>
                        <label className="block text-[9.5px] font-black text-gray-400 uppercase mb-1">Point Title</label>
                        <input
                          type="text"
                          value={pt.title}
                          onChange={(e) => handleUpdatePoint(idx, 'title', e.target.value)}
                          className="w-full px-3 py-2 text-xs font-black uppercase bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>

                      <div>
                        <label className="block text-[9.5px] font-black text-gray-400 uppercase mb-1">Point Description</label>
                        <textarea
                          rows={2}
                          value={pt.desc}
                          onChange={(e) => handleUpdatePoint(idx, 'desc', e.target.value)}
                          className="w-full px-3 py-2 text-xs font-black uppercase bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 leading-relaxed"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Full Legal Document Text Editor */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
                <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                      Complete Public Legal Document Text (/terms-and-conditions)
                    </h3>
                    <span className="text-[10px] text-gray-400 font-bold uppercase">
                      This full legal text is rendered on the official terms & conditions page
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">
                    Document Main Heading / Header
                  </label>
                  <input
                    type="text"
                    required
                    value={headingTitle}
                    onChange={(e) => setHeadingTitle(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2.5 text-xs font-black uppercase bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">
                    Full Legal Sections & Legalese
                  </label>
                  <textarea
                    rows={12}
                    required
                    value={termsText}
                    onChange={(e) => setTermsText(e.target.value.toUpperCase())}
                    className="w-full p-4 text-xs font-mono font-bold uppercase bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 leading-relaxed shadow-inner"
                    placeholder="Enter complete legal terms and conditions..."
                  />
                </div>
              </div>

              {/* Save Bar */}
              <div className="sticky bottom-4 z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-4">
                <span className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 hidden sm:inline">
                  ⚡ Changes immediately update live across dealsbyshiv & terms pages
                </span>
                
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 hover:scale-102 transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Save All Changes Live</span>
                </button>
              </div>

            </form>
          )}

        </main>
      </div>
    </div>
  );
}
