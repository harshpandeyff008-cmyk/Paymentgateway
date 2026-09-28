import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useIdleTimer } from '../hooks/useIdleTimer';
import { db } from '../firebase/config';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  onSnapshot, 
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { getInstagramDetails } from '../utils/instagramHelper';
import { 
  ShieldAlert, 
  Search, 
  User, 
  Mail, 
  Phone, 
  Camera, 
  Lock, 
  Unlock, 
  FileDown, 
  Pin, 
  AlertTriangle, 
  Clock, 
  Activity, 
  Globe, 
  KeyRound, 
  Loader, 
  Check, 
  X, 
  Sparkles, 
  RefreshCw, 
  ExternalLink,
  ShieldBan,
  Database,
  Layers,
  Terminal,
  Zap
} from 'lucide-react';

export default function SuspiciousLogs() {
  useIdleTimer(900000); // 15 mins auto inactivity logout

  const { currentUser, userDoc } = useAuth();
  const { showToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchEmail, setSearchEmail] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  // Deep Forensics Info State
  const [forensicUser, setForensicUser] = useState(null);
  const [forensicSessions, setForensicSessions] = useState([]);
  const [loadingForensics, setLoadingForensics] = useState(false);

  // Flagging Form State
  const [flagCategory, setFlagCategory] = useState('Chargeback / Cyber Fraud');
  const [flagReason, setFlagReason] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterContact, setReporterContact] = useState('');
  const [disputeAmount, setDisputeAmount] = useState('');
  const [autoLock, setAutoLock] = useState(true);
  const [savingFlag, setSavingFlag] = useState(false);

  // Real-time listener on all users
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list = [];
      snapshot.forEach((d) => {
        list.push({ uid: d.id, ...d.data() });
      });
      setUsers(list);
      setLoadingUsers(false);
    }, (err) => {
      console.error("Error loading users for threat radar:", err);
      setLoadingUsers(false);
    });

    return () => unsub();
  }, []);

  // Filtered list of suspicious / flagged accounts ONLY explicitly flagged by Admin
  const suspiciousUsers = users.filter(u => 
    u.status === 'ContactSeller' || 
    u.securityLocked === true || 
    u.disputeInfo?.isPinned === true
  );

  // Search matches for live autocomplete
  const matchedUsers = searchEmail.trim() === '' 
    ? [] 
    : users.filter(u => 
        (u.email || '').toLowerCase().includes(searchEmail.toLowerCase()) ||
        (u.name || '').toLowerCase().includes(searchEmail.toLowerCase()) ||
        (u.mobile || '').includes(searchEmail) ||
        (u.uid || '').toLowerCase().includes(searchEmail.toLowerCase())
      ).slice(0, 8);

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setSearchEmail(user.email || '');
    if (user.disputeInfo) {
      setFlagCategory(user.disputeInfo.category || 'Chargeback / Cyber Fraud');
      setFlagReason(user.disputeInfo.reportReason || '');
      setReporterName(user.disputeInfo.reporterName || '');
      setReporterContact(user.disputeInfo.reporterContact || '');
      setDisputeAmount(user.disputeInfo.disputeAmount || '');
    } else {
      setFlagReason('');
      setReporterName('');
      setReporterContact('');
      setDisputeAmount('');
    }
    setAutoLock(user.status === 'ContactSeller' || user.status === 'Suspended' || true);
  };

  const handleMarkSuspicious = async (e) => {
    if (e) e.preventDefault();
    if (!selectedUser) {
      showToast("Please select a valid user account first.", "error");
      return;
    }
    if (!flagReason.trim()) {
      showToast("Please enter an incident reason or threat note.", "error");
      return;
    }

    setSavingFlag(true);
    try {
      const userRef = doc(db, 'users', selectedUser.uid);
      const newStatus = autoLock ? 'ContactSeller' : selectedUser.status;
      const disputePayload = {
        category: flagCategory,
        reporterName: reporterName.trim(),
        reporterContact: reporterContact.trim(),
        reportReason: flagReason.trim(),
        disputeAmount: disputeAmount.trim(),
        reportedAt: new Date().toISOString(),
        pinnedBy: userDoc?.email || currentUser?.email || 'admin',
        isPinned: true
      };

      await updateDoc(userRef, {
        disputeInfo: disputePayload,
        status: newStatus,
        securityLocked: autoLock,
        securityLockReason: `[${flagCategory}] ${flagReason.trim()}`,
        lockedAt: autoLock ? serverTimestamp() : null,
        updatedAt: new Date().toISOString()
      });

      try {
        const subRef = doc(db, 'subscriptions', selectedUser.uid);
        await updateDoc(subRef, { status: newStatus, disputeInfo: disputePayload, updatedAt: new Date().toISOString() });
      } catch (subErr) {}

      showToast(`User ${selectedUser.email} marked as SUSPICIOUS! 🚨`, "success");
      // Reset search
      setSelectedUser(null);
      setSearchEmail('');
    } catch (err) {
      console.error("Failed to mark user as suspicious:", err);
      showToast("Failed to flag user account.", "error");
    } finally {
      setSavingFlag(false);
    }
  };

  const handleClearSuspicion = async (client) => {
    try {
      const userRef = doc(db, 'users', client.uid);
      await updateDoc(userRef, {
        'disputeInfo.isPinned': false,
        status: 'Active',
        securityLocked: false,
        securityLockReason: '',
        lockedAt: null,
        updatedAt: new Date().toISOString()
      });
      try {
        const subRef = doc(db, 'subscriptions', client.uid);
        await updateDoc(subRef, { 'disputeInfo.isPinned': false, status: 'Active', updatedAt: new Date().toISOString() });
      } catch (subErr) {}
      showToast(`Suspicious flag cleared for ${client.email}. Account restored to Active.`, "success");
      if (forensicUser?.uid === client.uid) {
        setForensicUser(null);
      }
    } catch (err) {
      console.error("Error clearing suspicion:", err);
      showToast("Failed to clear suspicious flag.", "error");
    }
  };

  const handleFetchForensics = async (client) => {
    setForensicUser(client);
    setLoadingForensics(true);
    setForensicSessions([]);
    try {
      // Fetch telemetry sessions if collection exists
      const sessRef = collection(db, 'client_sessions', client.uid, 'logs');
      const sessSnap = await getDocs(sessRef);
      const sLogs = [];
      sessSnap.forEach(d => sLogs.push({ id: d.id, ...d.data() }));
      setForensicSessions(sLogs);
    } catch (err) {
      console.warn("Telemetry logs not found or empty:", err);
    } finally {
      setLoadingForensics(false);
    }
  };

  const handleExportFullForensicDossier = (client) => {
    const insta = getInstagramDetails(client);
    const dossierContent = `================================================================================
         OFFICIAL CYBER INTELLIGENCE & FORENSIC INCIDENT DOSSIER
================================================================================
Generated On: ${new Date().toLocaleString()}
Reference ID: CASE-${(client.uid || '8921').substring(0, 8).toUpperCase()}-CYBER-SEC
Platform: Free Fire Official Deals - Escrow Security & Mailbox Verification Portal

[ 1. TARGET ACCOUNT IDENTITY & PROFILE ]
- Client UID            : ${client.uid}
- Full Name             : ${client.name || 'Not Provided'}
- Login Email           : ${client.email || 'Not Provided'}
- Mobile Number         : ${client.mobile || 'Not Provided'}
- Instagram Handle      : ${insta.username ? '@' + insta.username : 'Not Linked'}
- Instagram Profile Link: ${insta.link || 'N/A'}
- Registration Key Used : ${client.usedLicenseKey || 'Direct Portal Creation'}
- User Role             : ${client.role || 'client'}
- Current Account Status: ${client.status || 'Active'}
- Created Timestamp     : ${client.createdAt ? new Date(client.createdAt).toLocaleString() : 'N/A'}
- Stored Initial Pwd    : ${client.initialPassword || client.password || '******'}

[ 2. THREAT & SUSPICIOUS INCIDENT LOG ]
- Incident Category     : ${client.disputeInfo?.category || 'Cyber Fraud / Dispute Hold'}
- Flagged By Admin      : ${client.disputeInfo?.pinnedBy || 'System Security'}
- Complainant / Buyer   : ${client.disputeInfo?.reporterName || 'N/A'}
- Complainant Contact   : ${client.disputeInfo?.reporterContact || 'N/A'}
- Disputed Claim Amount : INR ${client.disputeInfo?.disputeAmount || 0}
- Detailed Reason / Note: ${client.disputeInfo?.reportReason || client.securityLockReason || 'N/A'}
- Incident Logged Time  : ${client.disputeInfo?.reportedAt ? new Date(client.disputeInfo.reportedAt).toLocaleString() : 'N/A'}

[ 3. MAILBOX & OTP SCAN AUDIT ]
- Assigned Mailbox      : ${client.linkedGmail || client.linkedZoho || client.linkedImap || 'None Assigned'}
- Total OTP Scan Count  : ${client.otpScanCount || 0}
- Last OTP Scanned Time : ${client.lastOtpScannedAt ? new Date(client.lastOtpScannedAt).toLocaleString() : 'N/A'}
- Last OTP Viewed Date  : ${client.lastOtpViewedAt ? new Date(client.lastOtpViewedAt).toLocaleString() : 'N/A'}
- Binding Status        : ${client.bindingStatus || 'none'}
- Binding Target Email  : ${client.bindingEmail || 'N/A'}

[ 4. LEGAL DISCLAIMER & TERMS COMPLIANCE ]
- The user explicitly agreed to the Mandatory Escrow Terms upon initial login/registration.
- User is solely liable for digital account modifications and transactions.
- All actions on this platform are monitored with 256-bit SHA telemetry logging.

================================================================================
CONFIDENTIAL - CERTIFIED FORENSIC EVIDENCE FOR POLICE & CYBER CRIME CELL
================================================================================`;

    const blob = new Blob([dossierContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FORENSIC_DOSSIER_${(client.email || client.uid).replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex font-sans text-gray-900 dark:text-gray-100">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-72 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} title="Suspicious Logs & Threat Radar" />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-8 overflow-y-auto">
          
          {/* Header & Threat Stats */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight uppercase">
                    Suspicious Logs & Threat Radar
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-semibold">
                    Investigate login emails, flag suspicious fraudsters, and aggregate instant forensic telemetry dossiers.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh Radar</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Flagged Accounts</span>
              </span>
              <p className="text-2xl sm:text-3xl font-black text-rose-700 dark:text-rose-300">
                {suspiciousUsers.length}
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-purple-500/10 border border-purple-500/30 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>Contact to Seller Immediately Locks</span>
              </span>
              <p className="text-2xl sm:text-3xl font-black text-purple-700 dark:text-purple-300">
                {users.filter(u => u.status === 'ContactSeller').length}
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Pin className="w-3.5 h-3.5" />
                <span>Pinned Disputes</span>
              </span>
              <p className="text-2xl sm:text-3xl font-black text-amber-700 dark:text-amber-300">
                {users.filter(u => u.disputeInfo?.isPinned).length}
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                <span>Total Indexed Users</span>
              </span>
              <p className="text-2xl sm:text-3xl font-black text-indigo-700 dark:text-indigo-300">
                {users.length}
              </p>
            </div>
          </div>

          {/* Section: Email Search & Suspicious Flagging Tool */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 pb-4">
              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-955/30 text-rose-600 dark:text-rose-400">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight text-gray-900 dark:text-white">
                  Investigate & Mark User by Login Email
                </h3>
                <p className="text-xs text-gray-500 font-semibold">
                  Type any user's login email to instantly load their complete dossier and flag them for fraud.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Search Bar with Live Autocomplete */}
              <div className="relative">
                <label className="block text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                  Search User by Login Email / Name / Phone / UID
                </label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Type client login email (e.g. client@gmail.com)..."
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                  {searchEmail && (
                    <button
                      onClick={() => {
                        setSearchEmail('');
                        setSelectedUser(null);
                      }}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Autocomplete Dropdown */}
                {matchedUsers.length > 0 && !selectedUser && (
                  <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl max-h-60 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                    {matchedUsers.map(u => (
                      <div
                        key={u.uid}
                        onClick={() => handleSelectUser(u)}
                        className="p-3.5 hover:bg-rose-50/50 dark:hover:bg-rose-955/20 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-955/40 flex items-center justify-center font-bold text-rose-600 dark:text-rose-400 text-xs">
                            {u.name ? u.name.charAt(0).toUpperCase() : '?'}
                          </div>
                          <div>
                            <p className="text-xs font-black text-gray-900 dark:text-white">{u.name || 'Client'}</p>
                            <span className="text-[11px] text-gray-500 font-mono">{u.email}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            u.status === 'Active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                          }`}>
                            {u.status || 'Active'}
                          </span>
                          {(() => {
                            const insta = getInstagramDetails(u);
                            return insta.username ? (
                              <span className="block text-[9px] text-pink-500 font-black">@{insta.username}</span>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected User Details Card & Action Form */}
              {selectedUser && (
                <div className="p-5 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 space-y-5 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white font-black text-lg shadow-md">
                        {selectedUser.name ? selectedUser.name.charAt(0).toUpperCase() : '?'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-gray-900 dark:text-white">{selectedUser.name}</h4>
                          <span className="text-[10px] font-mono bg-gray-200 dark:bg-gray-700 px-1.5 py-0.2 rounded text-gray-600 dark:text-gray-300">
                            UID: {selectedUser.uid}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 pt-0.5">
                          <span>📧 {selectedUser.email}</span>
                          <span>📞 {selectedUser.mobile || 'No Mobile'}</span>
                          {(() => {
                            const insta = getInstagramDetails(selectedUser);
                            return insta.username ? (
                              <a 
                                href={insta.link} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-pink-500 font-bold hover:underline"
                                title={`View @${insta.username} on Instagram`}
                              >
                                📸 @{insta.username}
                              </a>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleFetchForensics(selectedUser)}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow transition-all flex items-center gap-1.5"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      <span>Collect Full Forensics</span>
                    </button>
                  </div>

                  {/* Threat Mark Form */}
                  <form onSubmit={handleMarkSuspicious} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-black uppercase text-gray-500">
                          Threat Category
                        </label>
                        <select
                          value={flagCategory}
                          onChange={(e) => setFlagCategory(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-gray-900 dark:text-white"
                        >
                          <option value="Chargeback / Cyber Fraud">Chargeback / Cyber Fraud</option>
                          <option value="Unauthorized OTP / Credential Theft">Unauthorized OTP / Credential Theft</option>
                          <option value="Fake Payment Proof / Screenshot">Fake Payment Proof / Screenshot</option>
                          <option value="Multiple IP Hopping / VPN">Multiple IP Hopping / VPN</option>
                          <option value="Binding Rule Violation">Binding Rule Violation</option>
                          <option value="Abusive / Blackmail Behavior">Abusive / Blackmail Behavior</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-black uppercase text-gray-500">
                          Complainant / Reporter Name (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Rahul Sharma (Buyer)"
                          value={reporterName}
                          onChange={(e) => setReporterName(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-gray-900 dark:text-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-black uppercase text-gray-500">
                          Disputed Claim (₹) (Optional)
                        </label>
                        <input
                          type="number"
                          placeholder="e.g. 2500"
                          value={disputeAmount}
                          onChange={(e) => setDisputeAmount(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-gray-900 dark:text-white font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-black uppercase text-gray-500">
                        Incident Reason / Forensic Notes
                      </label>
                      <textarea
                        rows="2"
                        required
                        placeholder="Detail the cyber complaint, transaction dispute, or fraud rationale..."
                        value={flagReason}
                        onChange={(e) => setFlagReason(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl font-medium text-gray-900 dark:text-white"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={autoLock}
                          onChange={(e) => setAutoLock(e.target.checked)}
                          className="w-4 h-4 text-rose-600 rounded border-gray-300 focus:ring-rose-500"
                        />
                        <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                          Lock User Screen to "Contact to Seller Immediately"
                        </span>
                      </label>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedUser(null)}
                          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold text-xs rounded-xl"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingFlag || !flagReason.trim()}
                          className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-rose-600/20 flex items-center gap-1.5"
                        >
                          {savingFlag ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <ShieldBan className="w-3.5 h-3.5" />}
                          <span>Mark Suspicious & Flag</span>
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>

          {/* Section: Live Forensic Deep-Dive Viewer Modal */}
          {forensicUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-sans select-none">
              <div className="relative w-full max-w-3xl bg-gray-900 border-2 border-indigo-500/40 rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(99,102,241,0.25)] space-y-6 text-white max-h-[90vh] overflow-y-auto">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-inner">
                      <Terminal className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 block">
                        CYBER FORENSIC & IDENTITY INTELLIGENCE
                      </span>
                      <h3 className="text-xl font-black uppercase text-white">
                        {forensicUser.name || 'Anonymous Client'}
                      </h3>
                      <p className="text-xs text-gray-400 font-mono">
                        {forensicUser.email} • UID: {forensicUser.uid}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setForensicUser(null)}
                    className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* 4 Multi-Dimensional Forensic Data Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 1: Identity & Credentials */}
                  <div className="p-4 rounded-2xl bg-gray-950 border border-gray-800 space-y-2 text-xs">
                    <span className="text-[10px] font-black uppercase text-gray-400 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Account Identity</span>
                    </span>
                    <div className="space-y-1 font-mono text-[11px]">
                      <p><span className="text-gray-500">Full Name:</span> <span className="text-white font-bold">{forensicUser.name}</span></p>
                      <p><span className="text-gray-500">Mobile:</span> <span className="text-white font-bold">{forensicUser.mobile || '-'}</span></p>
                      {(() => {
                        const insta = getInstagramDetails(forensicUser);
                        return (
                          <p>
                            <span className="text-gray-500">Instagram:</span>{' '}
                            {insta.username ? (
                              <a
                                href={insta.link}
                                target="_blank"
                                rel="noreferrer"
                                className="text-pink-400 font-bold hover:underline"
                              >
                                @{insta.username}
                              </a>
                            ) : (
                              <span className="text-pink-400 font-bold">Not Linked</span>
                            )}
                          </p>
                        );
                      })()}
                      <p><span className="text-gray-500">License Key:</span> <span className="text-amber-400 font-bold">{forensicUser.usedLicenseKey || 'Direct'}</span></p>
                      <p><span className="text-gray-500">Password:</span> <span className="text-rose-400 font-bold">{forensicUser.initialPassword || forensicUser.password || '******'}</span></p>
                      <p><span className="text-gray-500">Registered:</span> <span className="text-gray-300">{forensicUser.createdAt ? new Date(forensicUser.createdAt).toLocaleString() : '-'}</span></p>
                    </div>
                  </div>

                  {/* Card 2: Threat & Dispute Info */}
                  <div className="p-4 rounded-2xl bg-gray-950 border border-gray-800 space-y-2 text-xs">
                    <span className="text-[10px] font-black uppercase text-gray-400 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                      <span>Dispute & Lock State</span>
                    </span>
                    <div className="space-y-1 font-mono text-[11px]">
                      <p><span className="text-gray-500">Status:</span> <span className="text-rose-400 font-black">{forensicUser.status}</span></p>
                      <p><span className="text-gray-500">Category:</span> <span className="text-amber-400 font-bold">{forensicUser.disputeInfo?.category || 'General Flag'}</span></p>
                      <p><span className="text-gray-500">Complainant:</span> <span className="text-white font-bold">{forensicUser.disputeInfo?.reporterName || '-'}</span></p>
                      <p><span className="text-gray-500">Claim (₹):</span> <span className="text-rose-400 font-black">{forensicUser.disputeInfo?.disputeAmount ? `₹${forensicUser.disputeInfo.disputeAmount}` : '-'}</span></p>
                      <p><span className="text-gray-500">Report Note:</span> <span className="text-gray-300 italic">"{forensicUser.disputeInfo?.reportReason || forensicUser.securityLockReason || 'N/A'}"</span></p>
                    </div>
                  </div>

                  {/* Card 3: Mailbox & OTP Audit */}
                  <div className="p-4 rounded-2xl bg-gray-950 border border-gray-800 space-y-2 text-xs">
                    <span className="text-[10px] font-black uppercase text-gray-400 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                      <span>Mailbox & OTP Audit</span>
                    </span>
                    <div className="space-y-1 font-mono text-[11px]">
                      <p><span className="text-gray-500">Linked Mailbox:</span> <span className="text-white font-bold">{forensicUser.linkedGmail || forensicUser.linkedZoho || forensicUser.linkedImap || 'None'}</span></p>
                      <p><span className="text-gray-500">OTP Scanned:</span> <span className="text-emerald-400 font-black">{forensicUser.otpScanCount || 0} times</span></p>
                      <p><span className="text-gray-500">Last OTP Time:</span> <span className="text-gray-300">{forensicUser.lastOtpScannedAt ? new Date(forensicUser.lastOtpScannedAt).toLocaleString() : 'Never'}</span></p>
                      <p><span className="text-gray-500">Binding Status:</span> <span className="text-cyan-400 font-bold">{forensicUser.bindingStatus || 'none'}</span></p>
                      <p><span className="text-gray-500">Binding Email:</span> <span className="text-gray-300">{forensicUser.bindingEmail || '-'}</span></p>
                    </div>
                  </div>

                  {/* Card 4: Financial & Rental Balance */}
                  <div className="p-4 rounded-2xl bg-gray-950 border border-gray-800 space-y-2 text-xs">
                    <span className="text-[10px] font-black uppercase text-gray-400 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Lease & Financials</span>
                    </span>
                    <div className="space-y-1 font-mono text-[11px]">
                      <p><span className="text-gray-500">Product:</span> <span className="text-white font-bold">{forensicUser.productName || 'Verification Sandbox'}</span></p>
                      <p><span className="text-gray-500">Amount Paid:</span> <span className="text-emerald-400 font-bold">₹{forensicUser.amountPaid || 0}</span></p>
                      <p><span className="text-gray-500">Remaining Balance:</span> <span className="text-rose-400 font-bold">₹{forensicUser.remainingBalance || 0}</span></p>
                      <p><span className="text-gray-500">Expiry Date:</span> <span className="text-gray-300">{forensicUser.expiryDate ? new Date(forensicUser.expiryDate).toLocaleDateString() : '-'}</span></p>
                    </div>
                  </div>
                </div>

                {/* Forensic Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-800">
                  <div className="flex items-center gap-2">
                    {forensicUser.status === 'ContactSeller' || forensicUser.disputeInfo?.isPinned ? (
                      <button
                        onClick={() => handleClearSuspicion(forensicUser)}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-all"
                      >
                        🔓 Clear Threat & Restore Active
                      </button>
                    ) : null}
                  </div>

                  <button
                    onClick={() => handleExportFullForensicDossier(forensicUser)}
                    className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-700 hover:to-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg flex items-center justify-center gap-2"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>Download Full Cyber Dossier (.txt)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Section: Suspicious / Flagged Accounts Table */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-955/30 text-rose-600 dark:text-rose-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-gray-900 dark:text-white">
                    Flagged Accounts Threat Registry ({suspiciousUsers.length})
                  </h3>
                  <p className="text-xs text-gray-500 font-semibold">
                    Real-time list of all accounts under security hold, dispute investigation, or reported by buyers.
                  </p>
                </div>
              </div>
            </div>

            {loadingUsers ? (
              <div className="py-12 text-center text-gray-400 flex flex-col items-center gap-2">
                <Loader className="w-6 h-6 animate-spin text-rose-500" />
                <span className="text-xs font-bold">Scanning threat database...</span>
              </div>
            ) : suspiciousUsers.length === 0 ? (
              <div className="py-12 text-center text-gray-400 space-y-2">
                <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto" />
                <h4 className="text-sm font-black text-gray-800 dark:text-gray-200">No Suspicious Threats Active</h4>
                <p className="text-xs font-semibold text-gray-400">All registered users are currently in good standing.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-gray-150 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 text-xs font-black uppercase text-gray-400 dark:text-gray-500 tracking-wider">
                      <th className="p-4 pl-6">Target User Details</th>
                      <th className="p-4">Threat Category & Reason</th>
                      <th className="p-4">Reported By / Claim</th>
                      <th className="p-4">Lock Status</th>
                      <th className="p-4 pr-6 text-right">Forensic Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150 dark:divide-gray-800 text-xs font-semibold text-gray-600 dark:text-gray-300">
                    {suspiciousUsers.map(client => (
                      <tr key={client.uid} className="hover:bg-rose-50/20 dark:hover:bg-rose-955/10 transition-colors">
                        <td className="p-4 pl-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-955/40 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-xs shrink-0">
                              {client.name ? client.name.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div>
                              <p className="font-black text-gray-900 dark:text-white leading-none">{client.name || 'Client'}</p>
                              <span className="text-[11px] text-gray-500 font-mono block mt-0.5">{client.email}</span>
                              <div className="flex items-center gap-2 mt-1">
                                {client.mobile && <span className="text-[10px] text-gray-400">📞 {client.mobile}</span>}
                                {(() => {
                                  const insta = getInstagramDetails(client);
                                  return insta.username ? (
                                    <a
                                      href={insta.link}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[10px] font-bold text-pink-500 hover:underline"
                                      title={`View @${insta.username} on Instagram`}
                                    >
                                      📸 @{insta.username}
                                    </a>
                                  ) : null;
                                })()}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="p-4 max-w-xs">
                          <span className="inline-block px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-955/40 text-rose-700 dark:text-rose-300 text-[10px] font-black uppercase mb-1">
                            {client.disputeInfo?.category || 'Dispute Hold'}
                          </span>
                          <p className="text-[11px] text-gray-700 dark:text-gray-300 italic line-clamp-2 leading-relaxed">
                            "{client.disputeInfo?.reportReason || client.securityLockReason || 'Suspicious activity flag.'}"
                          </p>
                        </td>

                        <td className="p-4">
                          <p className="text-gray-900 dark:text-white font-bold">{client.disputeInfo?.reporterName || 'System Detection'}</p>
                          {client.disputeInfo?.disputeAmount && (
                            <span className="inline-block px-1.5 py-0.2 rounded bg-rose-600 text-white text-[10px] font-mono font-black mt-0.5">
                              Claim: ₹{client.disputeInfo.disputeAmount}
                            </span>
                          )}
                          {client.disputeInfo?.reporterContact && (
                            <span className="block text-[10px] text-gray-400 font-mono mt-0.5">
                              {client.disputeInfo.reporterContact}
                            </span>
                          )}
                        </td>

                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                            client.status === 'ContactSeller'
                              ? 'bg-rose-50 dark:bg-rose-955/40 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800/60 animate-pulse'
                              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50'
                          }`}>
                            {client.status === 'ContactSeller' ? '🚨 Contact to Seller Immediately' : client.status}
                          </span>
                        </td>

                        <td className="p-4 pr-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleFetchForensics(client)}
                              className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-all"
                              title="🔍 Inspect Forensics"
                            >
                              <Terminal className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleExportFullForensicDossier(client)}
                              className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-955/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-all"
                              title="📄 Export Dossier"
                            >
                              <FileDown className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleClearSuspicion(client)}
                              className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-all"
                              title="🔓 Restore Account"
                            >
                              <Unlock className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </main>
      </div>
    </div>
  );
}
