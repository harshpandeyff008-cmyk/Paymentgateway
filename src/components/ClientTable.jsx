import React, { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, Edit2, Trash2, ArrowUpDown, ShieldAlert, Unlock, Lock, FileDown, Pin, X, Check, Loader, AlertTriangle, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getInstagramDetails } from '../utils/instagramHelper';

/**
 * Highly interactive, paginated, and responsive table for listing clients.
 * Shifts to cards automatically on mobile screens.
 */
export default function ClientTable({ clients, admins = [], currentUserRole, onAssignAdmin, onEdit, onDelete, onAudit, onUnsuspend }) {
  const navigate = useNavigate();
  const { impersonateClient, userDoc } = useAuth();
  const isSuperAdmin = userDoc?.role === 'superadmin' || currentUserRole === 'superadmin';
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Pin Report / Incident Modal State
  const [pinModalClient, setPinModalClient] = useState(null);
  const [reporterName, setReporterName] = useState('');
  const [reporterContact, setReporterContact] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [disputeAmount, setDisputeAmount] = useState('');
  const [autoLockScreen, setAutoLockScreen] = useState(true);
  const [savingPin, setSavingPin] = useState(false);

  const getBindingDaysLeft = (startDate) => {
    if (!startDate) return 15;
    const start = new Date(startDate);
    const end = new Date(start.getTime() + 15 * 24 * 60 * 60 * 1000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const diff = end.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const renderBindingStatus = (client) => {
    if (!client.bindingStatus || client.bindingStatus === 'none') return null;

    if (client.bindingStatus === 'pending') {
      const daysLeft = getBindingDaysLeft(client.bindingStartDate);
      return (
        <div className="mt-1.5 animate-fade-in space-y-0.5">
          <div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-955/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
              🔗 Binding: {daysLeft}d left
            </span>
          </div>
          {client.bindingEmail && (
            <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 truncate max-w-[150px]" title={client.bindingEmail}>
              📧 {client.bindingEmail}
            </div>
          )}
        </div>
      );
    }

    if (client.bindingStatus === 'completed') {
      return (
        <div className="mt-1.5 animate-fade-in space-y-0.5">
          <div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-955/20 text-emerald-700 dark:text-emerald-450 border border-emerald-200 dark:border-emerald-900/50">
              🔗 Bound
            </span>
          </div>
          {client.bindingEmail && (
            <div className="text-[10px] font-bold text-gray-400 dark:text-gray-550 truncate max-w-[150px]" title={client.bindingEmail}>
              📧 {client.bindingEmail}
            </div>
          )}
        </div>
      );
    }

    return null;
  };
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Filter clients by search query & status
  const filteredClients = clients.filter(client => {
    const nameStr = client.name || '';
    const emailStr = client.email || '';
    const matchesSearch = 
      nameStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emailStr.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || client.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Sorting columns handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Sort array
  const sortedClients = [...filteredClients].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    if (sortField === 'expiryDate' || sortField === 'createdAt') {
      const aDate = aVal?.toDate?.() ? aVal.toDate() : (aVal ? new Date(aVal) : null);
      const bDate = bVal?.toDate?.() ? bVal.toDate() : (bVal ? new Date(bVal) : null);
      aVal = aDate ? aDate.getTime() : 0;
      bVal = bDate ? bDate.getTime() : 0;
    }

    if (typeof aVal === 'string') {
      return sortOrder === 'asc' 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    } else {
      return sortOrder === 'asc' 
        ? (aVal || 0) - (bVal || 0)
        : (bVal || 0) - (aVal || 0);
    }
  });

  // Pagination bounds
  const totalItems = sortedClients.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedClients = sortedClients.slice(startIndex, startIndex + itemsPerPage);

  const goToNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const goToPrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleOpenPinModal = (client) => {
    setPinModalClient(client);
    setReporterName(client.disputeInfo?.reporterName || '');
    setReporterContact(client.disputeInfo?.reporterContact || '');
    setReportReason(client.disputeInfo?.reportReason || '');
    setDisputeAmount(client.disputeInfo?.disputeAmount || '');
    setAutoLockScreen(client.status === 'ContactSeller' || !client.disputeInfo?.isPinned);
  };

  const handleSavePin = async (e) => {
    if (e) e.preventDefault();
    if (!pinModalClient) return;

    setSavingPin(true);
    try {
      const clientRef = doc(db, 'users', pinModalClient.uid);
      const newStatus = autoLockScreen ? 'ContactSeller' : pinModalClient.status;
      const disputePayload = {
        reporterName: reporterName.trim(),
        reporterContact: reporterContact.trim(),
        reportReason: reportReason.trim(),
        disputeAmount: disputeAmount.trim(),
        reportedAt: pinModalClient.disputeInfo?.reportedAt || new Date().toISOString(),
        pinnedBy: currentUserRole || 'admin',
        isPinned: true
      };

      await updateDoc(clientRef, {
        disputeInfo: disputePayload,
        status: newStatus,
        securityLocked: autoLockScreen,
        securityLockReason: reportReason.trim() || 'Cyber Dispute / Contact Seller Required',
        lockedAt: autoLockScreen ? serverTimestamp() : null,
        updatedAt: new Date().toISOString()
      });

      try {
        const subRef = doc(db, 'subscriptions', pinModalClient.uid);
        await updateDoc(subRef, { status: newStatus, disputeInfo: disputePayload, updatedAt: new Date().toISOString() });
      } catch (subErr) {}

      setPinModalClient(null);
    } catch (err) {
      console.error("Failed to save pinned dispute:", err);
    } finally {
      setSavingPin(false);
    }
  };

  const handleClearPin = async () => {
    if (!pinModalClient) return;
    setSavingPin(true);
    try {
      const clientRef = doc(db, 'users', pinModalClient.uid);
      await updateDoc(clientRef, {
        'disputeInfo.isPinned': false,
        status: 'Active',
        securityLocked: false,
        securityLockReason: '',
        lockedAt: null,
        updatedAt: new Date().toISOString()
      });
      try {
        const subRef = doc(db, 'subscriptions', pinModalClient.uid);
        await updateDoc(subRef, { 'disputeInfo.isPinned': false, status: 'Active', updatedAt: new Date().toISOString() });
      } catch (subErr) {}
      setPinModalClient(null);
    } catch (err) {
      console.error("Failed to clear pin:", err);
    } finally {
      setSavingPin(false);
    }
  };

  const handleToggleContactSeller = async (client) => {
    try {
      const isLocked = client.status === 'ContactSeller';
      const newStatus = isLocked ? 'Active' : 'ContactSeller';
      const clientRef = doc(db, 'users', client.uid);
      await updateDoc(clientRef, {
        status: newStatus,
        securityLocked: !isLocked,
        securityLockReason: isLocked ? '' : 'Cyber Dispute / Contact Seller Required',
        lockedAt: isLocked ? null : serverTimestamp(),
        updatedAt: new Date().toISOString()
      });
      try {
        const subRef = doc(db, 'subscriptions', client.uid);
        await updateDoc(subRef, { status: newStatus, updatedAt: new Date().toISOString() });
      } catch (subErr) {}
    } catch (err) {
      console.error("Error toggling Contact Seller status:", err);
    }
  };

  const handleExportCyberDossier = (client) => {
    const insta = getInstagramDetails(client);
    const dossierContent = `================================================================================
           OFFICIAL ESCROW & CYBER INCIDENT EVIDENCE DOSSIER
================================================================================
Generated On: ${new Date().toLocaleString()}
Reference ID: CASE-${(client.uid || '8921').substring(0, 8).toUpperCase()}-CYBER-SEC
Platform: Free Fire Escrow Security & Mailbox Verification Portal

[ 1. TARGET ACCOUNT IDENTITY ]
- Client UID          : ${client.uid}
- Full Name           : ${client.name || 'Not Provided'}
- Registered Email    : ${client.email || 'Not Provided'}
- Mobile Number       : ${client.mobile || 'Not Provided'}
- Instagram ID        : ${insta.username ? '@' + insta.username : 'Not Linked'}
- Instagram Profile   : ${insta.link || 'N/A'}
- License Key Used    : ${client.usedLicenseKey || 'Direct Portal Creation'}
- Account Role        : ${client.role || 'client'}
- Current Status      : ${client.status || 'Active'}
- Registration Date   : ${client.createdAt ? new Date(client.createdAt).toLocaleString() : 'N/A'}
- Expiry Date         : ${client.expiryDate ? new Date(client.expiryDate).toLocaleString() : 'N/A'}

[ 2. TRANSACTION & SERVICE DETAILS ]
- Assigned Mailbox    : ${client.linkedGmail || client.linkedZoho || client.linkedImap || 'None'}
- Product Leased      : ${client.productName || 'FF Account Verification Sandbox'}
- Amount Paid         : INR ${client.amountPaid || 0}
- Remaining Balance   : INR ${client.remainingBalance || 0}
- OTP Scan Count      : ${client.otpScanCount || 0}
- Last OTP Scan Time  : ${client.lastOtpScannedAt ? new Date(client.lastOtpScannedAt).toLocaleString() : 'N/A'}
- Binding Status      : ${client.bindingStatus || 'none'}
- Binding Email       : ${client.bindingEmail || 'N/A'}

[ 3. PINNED COMPLAINT / INCIDENT REPORT ]
- Pinned Dispute Flag : ${client.disputeInfo?.isPinned ? 'YES - ACTIVE DISPUTE PINNED' : 'No Active Pin'}
- Complainant / Buyer : ${client.disputeInfo?.reporterName || 'N/A'}
- Complainant Contact : ${client.disputeInfo?.reporterContact || 'N/A'}
- Disputed Claim (₹)  : ${client.disputeInfo?.disputeAmount || 'N/A'}
- Report Reason/Notes : ${client.disputeInfo?.reportReason || 'N/A'}
- Report Logged Date  : ${client.disputeInfo?.reportedAt ? new Date(client.disputeInfo.reportedAt).toLocaleString() : 'N/A'}

[ 4. LEGAL DISCLAIMER & TERMS COMPLIANCE ]
- The user explicitly agreed to the Mandatory Escrow Terms & Conditions upon onboarding.
- Digital goods & credential rental terms specify that the user is solely liable for transactions.
- All actions on this platform are recorded with real-time audit logging and SHA-256 telemetry.

================================================================================
CONFIDENTIAL - FOR OFFICIAL SUBMISSION TO CYBER CRIME CELL / LEGAL COMPLIANCE
================================================================================`;

    const blob = new Blob([dossierContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CYBER_INCIDENT_DOSSIER_${(client.name || client.uid).replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Active':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </span>
        );
      case 'ContactSeller':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 shadow-sm animate-pulse">
            🚨 Contact to Seller
          </span>
        );
      case 'Suspended':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Suspended
          </span>
        );
      case 'Expired':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Expired
          </span>
        );
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-5">
      {/* Search and Filters Bar */}
      <div className="glass-panel flex flex-col sm:flex-row gap-3 items-center justify-between p-4 rounded-2xl">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search name or email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/80 rounded-xl focus-ring text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all font-medium"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-auto px-4 py-2.5 text-sm bg-gray-50/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/80 rounded-xl focus-ring text-gray-900 dark:text-white transition-all font-bold cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="ContactSeller">Contact to Seller Immediately</option>
            <option value="Expired">Expired</option>
            <option value="Suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Table grid */}
      {paginatedClients.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center p-14 rounded-2xl text-center">
          <Search className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3 animate-pulse" />
          <h3 className="font-extrabold text-gray-900 dark:text-white text-base">No Accounts Found</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 font-medium">Try adapting your search parameter or filters.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-hidden glass-card rounded-2xl border border-gray-200/80 dark:border-gray-800/80 shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-gray-200/80 dark:border-gray-800/80 bg-gray-100/80 dark:bg-gray-800/70 backdrop-blur-md text-[11px] font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                    <th className="p-4 pl-6 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" onClick={() => handleSort('name')}>
                      <div className="flex items-center gap-1.5">
                        Client Details <ArrowUpDown className="w-3.5 h-3.5 text-indigo-500" />
                      </div>
                    </th>
                    <th className="p-4">Mobile</th>
                    <th className="p-4 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" onClick={() => handleSort('productName')}>
                      <div className="flex items-center gap-1.5">
                        Product <ArrowUpDown className="w-3.5 h-3.5 text-indigo-500" />
                      </div>
                    </th>
                    <th className="p-4 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" onClick={() => handleSort('expiryDate')}>
                      <div className="flex items-center gap-1.5">
                        Expiry Date <ArrowUpDown className="w-3.5 h-3.5 text-indigo-500" />
                      </div>
                    </th>
                    <th className="p-4 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" onClick={() => handleSort('remainingBalance')}>
                      <div className="flex items-center gap-1.5">
                        Balance <ArrowUpDown className="w-3.5 h-3.5 text-indigo-500" />
                      </div>
                    </th>
                    <th className="p-4">Status</th>
                    <th className="p-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 dark:divide-gray-800 text-sm text-gray-600 dark:text-gray-350">
                  {paginatedClients.map(client => (
                    <tr key={client.uid} className="hover:bg-gray-50/30 dark:hover:bg-gray-800/10 transition-colors">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-650 dark:text-indigo-400 font-semibold shrink-0">
                            {client.name ? client.name.charAt(0).toUpperCase() : '?'}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white leading-none">{client.name}</p>
                            <span className="text-xs text-gray-400 dark:text-gray-505 mt-1 inline-block">{client.email}</span>
                            {client.usedLicenseKey && (
                              <div className="mt-1">
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-50/50 dark:bg-gray-800/40 text-[9px] font-black text-gray-500 dark:text-gray-400 border border-gray-200/50 dark:border-gray-700/60 font-mono">
                                  🔑 Key: {client.usedLicenseKey}
                                </span>
                              </div>
                            )}
                            {(() => {
                              const insta = getInstagramDetails(client);
                              if (!insta.username) return null;
                              return (
                                <div className="mt-1">
                                  <a
                                    href={insta.link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-pink-50 dark:bg-pink-955/30 text-[9px] font-black text-pink-600 dark:text-pink-400 border border-pink-200/50 dark:border-pink-800/40 hover:underline"
                                    title={`View @${insta.username} on Instagram`}
                                  >
                                    📸 @{insta.username}
                                  </a>
                                </div>
                              );
                            })()}

                            {/* Pinned Dispute Badge */}
                            {client.disputeInfo?.isPinned && (
                              <div className="mt-1.5 p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-[10px] font-bold space-y-0.5 animate-pulse">
                                <div className="flex items-center gap-1 font-black">
                                  <span>📌 Reported By:</span>
                                  <span className="text-gray-900 dark:text-white">{client.disputeInfo.reporterName || 'Anonymous'}</span>
                                  {client.disputeInfo.disputeAmount && (
                                    <span className="px-1 py-0.2 bg-rose-600 text-white rounded text-[9px] font-mono">₹{client.disputeInfo.disputeAmount}</span>
                                  )}
                                </div>
                                {client.disputeInfo.reporterContact && (
                                  <div className="text-[9px] text-gray-500 dark:text-gray-400">
                                    📞 {client.disputeInfo.reporterContact}
                                  </div>
                                )}
                                {client.disputeInfo.reportReason && (
                                  <div className="text-[9px] text-gray-700 dark:text-gray-300 italic truncate max-w-[200px]" title={client.disputeInfo.reportReason}>
                                    "{client.disputeInfo.reportReason}"
                                  </div>
                                )}
                              </div>
                            )}

                            {renderBindingStatus(client)}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-gray-550 dark:text-gray-400">{client.mobile || '-'}</td>
                      <td className="p-4 font-medium text-gray-700 dark:text-gray-300">{client.productName || '-'}</td>
                      <td className="p-4 font-medium text-gray-700 dark:text-gray-300">{formatDate(client.expiryDate)}</td>
                      <td className="p-4 font-semibold text-gray-900 dark:text-white">
                        ₹{Number(client.remainingBalance).toFixed(2)}
                      </td>
                      <td className="p-4">{getStatusBadge(client.status)}</td>
                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Pin Dispute / Report Info Button */}
                          <button
                            onClick={() => handleOpenPinModal(client)}
                            className={`p-1.5 rounded-lg border transition-all ${
                              client.disputeInfo?.isPinned
                                ? 'bg-amber-500 text-white border-amber-600 shadow-md shadow-amber-500/20 hover:bg-amber-600 animate-pulse'
                                : 'text-gray-455 dark:text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-955/20 border-transparent'
                            }`}
                            title={client.disputeInfo?.isPinned ? "📌 Edit Pinned Incident Report" : "📌 Pin Incident / Report Info"}
                          >
                            <Pin className="w-4 h-4" />
                          </button>

                          {/* 1-Click Toggle Contact Seller Lock */}
                          <button
                            onClick={() => handleToggleContactSeller(client)}
                            className={`p-1.5 rounded-lg border transition-all ${
                              client.status === 'ContactSeller'
                                ? 'bg-rose-500 text-white border-rose-600 shadow-md shadow-rose-500/20 hover:bg-rose-600'
                                : 'text-gray-455 dark:text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-955/20 border-transparent'
                            }`}
                            title={client.status === 'ContactSeller' ? "Unlock Account (Back to Active)" : "🚨 Lock: Contact to Seller Immediately"}
                          >
                            <Lock className="w-4 h-4" />
                          </button>

                          {/* Export Cyber Incident Evidence Dossier */}
                          <button
                            onClick={() => handleExportCyberDossier(client)}
                            className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all"
                            title="📄 Export Cyber Incident Evidence Dossier"
                          >
                            <FileDown className="w-4 h-4" />
                          </button>

                          {client.status === 'Suspended' && (
                            <button
                              onClick={() => onUnsuspend(client)}
                              className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all"
                              title="Unsuspend Account"
                            >
                              <Unlock className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => onAudit(client)}
                            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-650 dark:hover:text-indigo-400 transition-all"
                            title="Audit Session Logs"
                          >
                            <ShieldAlert className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onEdit(client)}
                            className="p-1.5 rounded-lg text-gray-555 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-650 dark:hover:text-indigo-400 transition-all"
                            title="Edit Account"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDelete(client)}
                            className="p-1.5 rounded-lg text-gray-555 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-rose-600 dark:hover:text-rose-400 transition-all"
                            title="Delete Account"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Grid */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {paginatedClients.map(client => (
              <div key={client.uid} className="glass-card p-5 rounded-2xl shadow-sm space-y-4 hover-lift">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/15 to-indigo-600/25 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-extrabold text-sm shrink-0 shadow-sm">
                      {client.name ? client.name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-base leading-none">{client.name}</h4>
                      <span className="text-xs text-gray-400 dark:text-gray-555 mt-1 inline-block">{client.email}</span>
                      {client.usedLicenseKey && (
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-50/50 dark:bg-gray-800/40 text-[9px] font-black text-gray-500 dark:text-gray-400 border border-gray-200/50 dark:border-gray-700/60 font-mono">
                            🔑 Key: {client.usedLicenseKey}
                          </span>
                        </div>
                      )}
                      {(() => {
                        const insta = getInstagramDetails(client);
                        if (!insta.username) return null;
                        return (
                          <div className="mt-1">
                            <a
                              href={insta.link}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-pink-50 dark:bg-pink-955/30 text-[9px] font-black text-pink-600 dark:text-pink-400 border border-pink-200/50 dark:border-pink-800/40 hover:underline"
                              title={`View @${insta.username} on Instagram`}
                            >
                              📸 @{insta.username}
                            </a>
                          </div>
                        );
                      })()}

                      {/* Mobile Pinned Dispute Badge */}
                      {client.disputeInfo?.isPinned && (
                        <div className="mt-1.5 p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-[10px] font-bold space-y-0.5 animate-pulse">
                          <div className="flex items-center gap-1 font-black">
                            <span>📌 Reported By:</span>
                            <span className="text-gray-900 dark:text-white">{client.disputeInfo.reporterName || 'Anonymous'}</span>
                            {client.disputeInfo.disputeAmount && (
                              <span className="px-1 py-0.2 bg-rose-600 text-white rounded text-[9px] font-mono">₹{client.disputeInfo.disputeAmount}</span>
                            )}
                          </div>
                          {client.disputeInfo.reportReason && (
                            <div className="text-[9px] text-gray-700 dark:text-gray-300 italic truncate" title={client.disputeInfo.reportReason}>
                              "{client.disputeInfo.reportReason}"
                            </div>
                          )}
                        </div>
                      )}

                      {renderBindingStatus(client)}
                    </div>
                  </div>
                  {getStatusBadge(client.status)}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100 dark:border-gray-850 text-xs">
                  <div>
                    <span className="text-gray-400 dark:text-gray-500 block mb-0.5 font-medium">Product</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{client.productName || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 dark:text-gray-500 block mb-0.5 font-medium">Mobile</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{client.mobile || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 dark:text-gray-500 block mb-0.5 font-medium">Expiry Date</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{formatDate(client.expiryDate)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 dark:text-gray-555 block mb-0.5 font-medium">Balance</span>
                    <span className="font-bold text-gray-900 dark:text-white">₹{Number(client.remainingBalance).toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={() => handleOpenPinModal(client)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-black transition-all ${
                      client.disputeInfo?.isPinned
                        ? 'bg-amber-500 text-white'
                        : 'bg-amber-50 dark:bg-amber-955/20 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    <Pin className="w-3.5 h-3.5" />
                    <span>{client.disputeInfo?.isPinned ? "Edit Pin" : "Pin Report"}</span>
                  </button>

                  <button
                    onClick={() => handleToggleContactSeller(client)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-black transition-all ${
                      client.status === 'ContactSeller'
                        ? 'bg-rose-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{client.status === 'ContactSeller' ? "Unlock" : "Lock"}</span>
                  </button>

                  <button
                    onClick={() => handleExportCyberDossier(client)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold transition-all"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Dossier</span>
                  </button>

                  {client.status === 'Suspended' && (
                    <button
                      onClick={() => onUnsuspend(client)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-lg text-sm text-emerald-600 dark:text-emerald-450 hover:text-emerald-700 dark:hover:text-emerald-350 font-medium transition-colors"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Unsuspend</span>
                    </button>
                  )}
                  {isSuperAdmin && (
                    <button
                      onClick={async () => {
                        const success = await impersonateClient(client.uid);
                        if (success) {
                          navigate('/client-dashboard');
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-lg text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-850 dark:hover:text-indigo-350 font-medium transition-colors cursor-pointer"
                      title="Login As Client (Impersonate)"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Login</span>
                    </button>
                  )}
                  <button
                    onClick={() => onAudit(client)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-lg text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-850 dark:hover:text-indigo-350 font-medium transition-colors"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Audit</span>
                  </button>
                  <button
                    onClick={() => onEdit(client)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg text-sm text-gray-655 dark:text-gray-350 hover:text-indigo-655 dark:hover:text-indigo-405 font-medium transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => onDelete(client)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-955/20 border border-rose-100 dark:border-rose-900/50 rounded-lg text-sm text-rose-600 dark:text-rose-455 font-medium transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="glass-panel flex items-center justify-between p-4 rounded-2xl shadow-sm">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                Showing <span className="text-gray-900 dark:text-white font-extrabold">{startIndex + 1}</span> to <span className="text-gray-900 dark:text-white font-extrabold">{Math.min(startIndex + itemsPerPage, totalItems)}</span> of <span className="text-gray-900 dark:text-white font-extrabold">{totalItems}</span> accounts
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={goToPrevPage}
                  disabled={currentPage === 1}
                  className="p-2 rounded-xl border border-gray-200/80 dark:border-gray-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 text-gray-600 dark:text-gray-300 transition-all btn-tactile focus-ring"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-black text-gray-700 dark:text-gray-300 px-2.5 py-1 rounded-lg bg-gray-100/80 dark:bg-gray-800/80 border border-gray-200/60 dark:border-gray-700/60">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-xl border border-gray-200/80 dark:border-gray-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 text-gray-600 dark:text-gray-300 transition-all btn-tactile focus-ring"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Pin Incident / Reporter Modal */}
      {pinModalClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in font-sans select-none">
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-gray-900 dark:text-white">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-955/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
                  <Pin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight">
                    Pin Incident / Dispute Report
                  </h3>
                  <p className="text-xs text-gray-500 font-semibold">
                    Target: {pinModalClient.name || 'Client'} ({pinModalClient.email})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPinModalClient(null)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePin} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase">
                    Complainant / Reporter Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma (Buyer)"
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase">
                    Reporter Contact (TG / Phone)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. @rahul_tg / +91 9999999999"
                    value={reporterContact}
                    onChange={(e) => setReporterContact(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-500 uppercase">
                  Dispute Claim Amount (₹) (Optional)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 2500"
                  value={disputeAmount}
                  onChange={(e) => setDisputeAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-bold font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-500 uppercase">
                  Report Reason / Incident Notes
                </label>
                <textarea
                  rows="3"
                  required
                  placeholder="Enter details of what was reported (e.g. Chargeback claim, Unauthorized password change attempt, Binding conflict)..."
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-medium leading-relaxed"
                />
              </div>

              <div className="p-3 bg-rose-50 dark:bg-rose-955/20 border border-rose-200 dark:border-rose-900/40 rounded-xl flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-rose-800 dark:text-rose-400 block">
                    Lock Account to "Contact to Seller Immediately" Screen
                  </span>
                  <span className="text-[10px] text-rose-600 dark:text-rose-500 font-semibold block">
                    Immediately locks the client dashboard until dispute is resolved.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={autoLockScreen}
                  onChange={(e) => setAutoLockScreen(e.target.checked)}
                  className="w-4 h-4 text-rose-600 rounded border-gray-300 focus:ring-rose-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                {pinModalClient.disputeInfo?.isPinned ? (
                  <button
                    type="button"
                    onClick={handleClearPin}
                    disabled={savingPin}
                    className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-rose-50 dark:hover:bg-rose-955/40 text-rose-600 font-bold text-xs rounded-xl transition-all"
                  >
                    Unpin / Resolve Dispute
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPinModalClient(null)}
                    className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPin || !reporterName.trim() || !reportReason.trim()}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5"
                  >
                    {savingPin ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Save & Pin Report</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
