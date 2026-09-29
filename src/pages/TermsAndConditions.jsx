import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, AlertTriangle, FileText, Lock } from 'lucide-react';
import { db } from '../firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';
import Footer from '../components/Footer';

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
• Official Redressal Conduit: support@freefireofficial.in (Escrow Desk)
• Procedural Protocols: All grievances must include cryptographic transaction hashes, account UID identifiers, and a sworn declaration under penalty of perjury.
• Statutory Response Latency: Formal acknowledgment within twenty-four (24) chronological hours; administrative determination rendered within seventy-two (72) standard business hours.`;

export default function TermsAndConditions() {
  const [headingTitle, setHeadingTitle] = useState('MASTER COVENANT OF EPHEMERAL USUFRUCT, LEASE MANDATES, AND COMPREHENSIVE INDEMNIFICATION PROTOCOLS');
  const [futureClause, setFutureClause] = useState(DEFAULT_FUTURE_CLAUSE);
  const [termsText, setTermsText] = useState(DEFAULT_TERMS_TEXT);

  // Real-time synchronization with Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system_settings', 'terms_conditions'), (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        if (d.headingTitle) setHeadingTitle(d.headingTitle);
        if (d.futureClause) setFutureClause(d.futureClause);
        if (d.termsText) setTermsText(d.termsText);
      }
    }, (err) => {
      console.warn("Terms sync notice:", err);
    });

    return () => unsub();
  }, []);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-100 dark:bg-slate-950 px-4 font-sans select-none text-slate-900 dark:text-slate-100">
      <div className="max-w-5xl mx-auto w-full pt-8 pb-12 relative z-10 flex-1 flex flex-col justify-center">
        
        {/* Navigation header */}
        <div className="flex items-center justify-between mb-4">
          <Link 
            to="/" 
            className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Store</span>
          </Link>
          <span className="text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-300 tracking-wider bg-indigo-50 dark:bg-indigo-950/70 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 shadow-sm">
            OFFICIAL LEGAL & ESCROW AUDIT PORTAL
          </span>
        </div>

        {/* Legal Document Container */}
        <div className="p-6 sm:p-8 md:p-10 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-3xl shadow-2xl space-y-6">
          
          <div className="text-center border-b border-slate-200 dark:border-slate-800 pb-5 space-y-1.5">
            <span className="text-[10px] font-black tracking-widest uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
              STATUTORY REGISTRATION & ESCROW JURISPRUDENCE
            </span>
            <h1 className="text-sm sm:text-base md:text-lg font-black text-slate-900 dark:text-white tracking-wide uppercase mt-2">
              {headingTitle}
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">
              OFFICIAL ESCROW COVENANT — LAST AMENDED & EFFECTIVE IN PERPETUITY
            </p>
          </div>

          {/* Prominent Mandatory Future Amendments Clause Box - ULTRA HIGH CONTRAST */}
          <div className="p-5 sm:p-6 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-500/70 dark:border-amber-500/60 rounded-2xl space-y-2.5 shadow-sm">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-xs font-black uppercase tracking-wider">
                MANDATORY BINDING PROVISION REGARDING UNILATERAL FUTURE AMENDMENTS
              </span>
            </div>
            <p className="text-xs sm:text-[13px] font-sans font-bold text-amber-950 dark:text-amber-100 leading-relaxed tracking-wide">
              {futureClause}
            </p>
          </div>

          {/* Full Legal Text Container - MAXIMUM CONTRAST & CRISP READABILITY */}
          <div className="p-6 sm:p-8 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-2xl space-y-5 font-mono sm:font-sans text-xs sm:text-[13px] leading-relaxed text-slate-900 dark:text-slate-100 font-medium whitespace-pre-line shadow-inner selection:bg-indigo-600 selection:text-white max-h-[650px] overflow-y-auto">
            {termsText}
          </div>

          {/* Bottom Confirmation Banner */}
          <div className="p-4 bg-slate-950 dark:bg-black text-white text-center rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2.5 border border-slate-800 shadow-lg">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="tracking-wide">BY ACCESSING, VIEWING, OR MAKING ANY PAYMENT, YOU CONFIRM ACCEPTANCE OF ALL CURRENT & FUTURE TERMS.</span>
          </div>

        </div>
      </div>

      <Footer />
    </div>
  );
}
