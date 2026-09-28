import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import ClientFormModal from '../components/ClientFormModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useIdleTimer } from '../hooks/useIdleTimer';
import { db } from '../firebase/config';
import { doc, updateDoc, getDocs, collection, onSnapshot } from 'firebase/firestore';
import { 
  getAllClients, 
  updateClientRecord, 
  toggleClientSuspension 
} from '../firebase/firestore';
import { 
  Crown, 
  Search, 
  Edit, 
  ShieldAlert, 
  ShieldCheck, 
  Calendar, 
  Clock, 
  Mail, 
  Server, 
  Loader, 
  CheckCircle, 
  AlertTriangle,
  Zap,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  Lock,
  LogIn
} from 'lucide-react';

export default function PremiumDashboard() {
  useIdleTimer(900000); // 15 mins inactivity auto logout

  const navigate = useNavigate();
  const { currentUser, userDoc, impersonateClient } = useAuth();
  const { showToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Password visibility & copy feedback state
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [copiedField, setCopiedField] = useState(null);
  const [mailboxMap, setMailboxMap] = useState({});

  const togglePasswordReveal = (uid) => {
    setRevealedPasswords(prev => ({ ...prev, [uid]: !prev[uid] }));
  };

  const handleCopyText = (text, fieldKey, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    showToast(`${label} copied to clipboard!`, 'success');
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Edit Modal states
  const [selectedClient, setSelectedClient] = useState(null);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedClientIds, setSelectedClientIds] = useState([]);

  // Bulk Disable/Enable Mailboxes
  const handleBulkDisableMailboxes = async (disable) => {
    if (selectedClientIds.length === 0) return;
    const actionText = disable ? 'disable' : 'enable';
    if (!window.confirm(`Are you sure you want to ${actionText} mailboxes for all ${selectedClientIds.length} selected clients?`)) return;

    setActionLoading(true);
    try {
      showToast(`Processing bulk mailbox ${actionText}...`, "info");
      
      const promises = selectedClientIds.map(async (uid) => {
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, {
          mailboxDisabled: disable,
          mailboxDisabledReason: disable ? 'Bulk disabled by Administrator' : ''
        });
      });
      
      await Promise.all(promises);
      showToast(`Successfully ${disable ? 'disabled' : 'enabled'} selected mailboxes!`, "success");
      setSelectedClientIds([]);
      await loadClients();
    } catch (err) {
      console.error("Bulk status change failed:", err);
      showToast("Failed to perform bulk updates: " + err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const loadClients = async () => {
    // Kept for manual refresh trigger or backward compatibility
    try {
      const data = await getAllClients(userDoc?.role, currentUser?.uid);
      setClients(data);
    } catch (error) {
      console.error("Error manual loading clients:", error);
    }
  };

  useEffect(() => {
    if (!userDoc) return;

    setLoading(true);

    // Load mailbox map for Free Fire UID lookup
    const loadMailboxMaps = async () => {
      try {
        const map = {};
        const [snapG, snapZ, snapI] = await Promise.all([
          getDocs(collection(db, 'gmail_credentials')),
          getDocs(collection(db, 'zoho_credentials')),
          getDocs(collection(db, 'imap_credentials'))
        ]);
        snapG.forEach(d => {
          const dt = d.data();
          if (dt.gmail_email) map[dt.gmail_email] = { game_uid: dt.game_uid || dt.ff_uid || null, game_id_name: dt.game_id_name || null };
        });
        snapZ.forEach(d => {
          const dt = d.data();
          if (dt.zoho_email) map[dt.zoho_email] = { game_uid: dt.game_uid || dt.ff_uid || null, game_id_name: dt.game_id_name || null };
        });
        snapI.forEach(d => {
          const dt = d.data();
          if (dt.imap_email) map[dt.imap_email] = { game_uid: dt.game_uid || dt.ff_uid || null, game_id_name: dt.game_id_name || null };
        });
        setMailboxMap(map);
      } catch (mapErr) {
        console.warn("Could not load mailbox UID map:", mapErr);
      }
    };
    loadMailboxMaps();

    // Set up real-time listener for users and subscriptions combined
    let usersList = [];
    let subsList = [];

    const combineAndSet = () => {
      const subsMap = {};
      subsList.forEach(sub => {
        subsMap[sub.uid] = sub;
      });

      const combined = [];
      usersList.forEach(user => {
        if (user.role === 'client') {
          const sub = subsMap[user.uid] || {};
          combined.push({
            uid: user.uid,
            id: user.uid,
            name: user.name || user.email || 'Client',
            email: user.email || '',
            mobile: user.mobile || user.phone || '',
            productName: sub.productName || 'Trial Access',
            amountPaid: sub.amountPaid || 0,
            remainingBalance: sub.remainingBalance || 0,
            commission: sub.commission || 0,
            commissionPaid: sub.commissionPaid || 0,
            validityDays: sub.validityDays || 0,
            ...sub,
            ...user,
            status: user.status === 'Suspended' || user.status === 'Removed' ? user.status : (sub.status || user.status || 'Active'),
            purchaseDate: sub.purchaseDate?.toDate?.() || sub.purchaseDate || (user.createdAt?.toDate?.() || new Date()),
            expiryDate: sub.expiryDate?.toDate?.() || sub.expiryDate || (user.planExpiresAt ? new Date(user.planExpiresAt) : null),
            bindingStartDate: user.bindingStartDate?.toDate?.() || user.bindingStartDate || null,
            updatedAt: sub.updatedAt?.toDate?.() || sub.updatedAt || new Date()
          });
        }
      });
      setClients(combined);
      setLoading(false);
    };

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      usersList = [];
      snapshot.forEach(docSnap => {
        usersList.push({ uid: docSnap.id, ...docSnap.data() });
      });
      combineAndSet();
    }, (error) => {
      console.error("Real-time users fetch failed:", error);
      setLoading(false);
    });

    const unsubscribeSubs = onSnapshot(collection(db, 'subscriptions'), (snapshot) => {
      subsList = [];
      snapshot.forEach(docSnap => {
        subsList.push({ uid: docSnap.id, ...docSnap.data() });
      });
      combineAndSet();
    }, (error) => {
      console.error("Real-time subscriptions fetch failed:", error);
      setLoading(false);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeSubs();
    };
  }, [userDoc]);

  // One-click Toggle Suspend
  const handleToggleSuspend = async (client) => {
    setActionLoading(true);
    try {
      const adminInfo = { uid: currentUser.uid, email: currentUser.email, role: userDoc?.role };
      const currentStatus = client.status || 'Active';
      const actionName = currentStatus === 'Suspended' ? 'unsuspend' : 'suspend';
      
      showToast(`Performing one-click ${actionName}...`, "info");
      await toggleClientSuspension(client.uid, client.name, currentStatus, adminInfo);
      showToast(`Account successfully ${currentStatus === 'Suspended' ? 'activated' : 'suspended'}.`, "success");
      await loadClients();
    } catch (error) {
      console.error("Error toggling client suspension:", error);
      showToast("Operation failed: " + error.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Grant / Revoke Extra Scan
  const handleGrantExtraScan = async (client) => {
    setActionLoading(true);
    try {
      const userRef = doc(db, 'users', client.uid);
      const isCurrentlyGranted = client.extraScanGranted === true;
      await updateDoc(userRef, {
        extraScanGranted: !isCurrentlyGranted
      });
      showToast(
        isCurrentlyGranted 
          ? `Revoked extra scan for ${client.name}.` 
          : `Granted 1 extra scan to ${client.name}!`, 
        "success"
      );
      await loadClients();
    } catch (error) {
      console.error("Error toggling extra scan permission:", error);
      showToast("Failed to update scan permission: " + error.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Submit edit form from modal
  const handleFormSubmit = async (formData) => {
    const adminInfo = { uid: currentUser.uid, email: currentUser.email, role: userDoc?.role };
    try {
      await updateClientRecord(selectedClient.uid, formData, selectedClient, adminInfo);
      showToast("Client account updated successfully.", "success");
      setFormModalOpen(false);
      await loadClients();
    } catch (err) {
      console.error(err);
      showToast("Failed to update client account: " + err.message, "error");
    }
  };

  // Calculate days active/purchased since purchase date
  const getDaysSincePurchase = (purchaseDateStr) => {
    if (!purchaseDateStr) return 0;
    const pDate = new Date(purchaseDateStr);
    const diffTime = Math.abs(Date.now() - pDate.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  // Calculate remaining validity days accurately based on exact current timestamp
  const getDaysRemaining = (expiryDateStr) => {
    if (!expiryDateStr) return 0;
    const expDate = new Date(expiryDateStr);
    const diff = expDate.getTime() - Date.now();
    if (diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // Filter clients list
  const filteredClients = clients.filter(c => {
    const matchesSearch = 
      (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.linkedGmail || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.linkedZoho || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.linkedImap || '').toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex font-sans">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      <div className="flex-1 lg:pl-72 flex flex-col min-w-0 h-screen overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(true)} title="Premium Accounts Dashboard" />

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header Description Card */}
          <div className="bg-gradient-to-r from-indigo-900 to-indigo-700 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 relative z-10 max-w-2xl">
              <h2 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2">
                <Crown className="w-6 h-6 text-amber-400 animate-pulse" />
                <span>PREMIUM SUBSCRIBER MANAGEMENT</span>
              </h2>
              <p className="text-xs md:text-sm text-indigo-150 leading-relaxed font-semibold">
                Monitor active console IDs, check subscription duration, edit client setups, and perform one-click suspensions in real-time.
              </p>
            </div>
            <div className="shrink-0 relative z-10">
              <button 
                onClick={loadClients}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/20 flex items-center gap-2"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Refresh Panel</span>
              </button>
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search Client ID or linked mail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white transition-all font-semibold"
              />
            </div>

            <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
              {['All', 'Active', 'Suspended', 'Expired'].map(statusOpt => (
                <button
                  key={statusOpt}
                  onClick={() => setStatusFilter(statusOpt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === statusOpt
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-650/15'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-750'
                  }`}
                >
                  {statusOpt}
                </button>
              ))}
            </div>
          </div>

          {/* Bulk Actions Control Bar */}
          {!loading && filteredClients.length > 0 && (
            <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between animate-fade-in">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="selectAllClients"
                  checked={filteredClients.length > 0 && selectedClientIds.length === filteredClients.length}
                  onChange={() => {
                    const allSelected = filteredClients.length > 0 && selectedClientIds.length === filteredClients.length;
                    if (allSelected) {
                      setSelectedClientIds([]);
                    } else {
                      setSelectedClientIds(filteredClients.map(c => c.uid));
                    }
                  }}
                  className="w-4.5 h-4.5 text-indigo-650 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="selectAllClients" className="text-xs font-bold text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                  Select All ({filteredClients.length} Clients)
                </label>
              </div>

              {selectedClientIds.length > 0 && (
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end animate-fade-in">
                  <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg border border-indigo-100 dark:border-indigo-900/40">
                    {selectedClientIds.length} Selected
                  </span>
                  
                  <button
                    onClick={() => handleBulkDisableMailboxes(true)}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-455 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-650/10 transition-all flex items-center gap-1.5"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Disable Mailboxes</span>
                  </button>

                  <button
                    onClick={() => handleBulkDisableMailboxes(false)}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-455 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-650/10 transition-all flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Enable Mailboxes</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Premium Subscription Lists */}
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 space-y-3 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl">
              <Loader className="w-8 h-8 animate-spin text-indigo-650" />
              <span className="text-sm text-gray-450 dark:text-gray-400 font-bold">Synchronizing Console Database...</span>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-12 text-center">
              <p className="text-sm text-gray-400 font-bold">No premium subscription accounts match your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {filteredClients.map((client) => {
                const daysActive = getDaysSincePurchase(client.purchaseDateStr || client.purchaseDate);
                const daysRemaining = getDaysRemaining(client.expiryDateStr || client.expiryDate);
                const isSubActive = client.status === 'Active';
                const isSuspended = client.status === 'Suspended';
                
                return (
                  <div 
                    key={client.uid} 
                    className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200"
                  >
                    {/* Header: Name, Status */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedClientIds.includes(client.uid)}
                          onChange={() => {
                            setSelectedClientIds(prev => 
                              prev.includes(client.uid) ? prev.filter(id => id !== client.uid) : [...prev, client.uid]
                            );
                          }}
                          className="w-4 h-4 mt-0.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900 dark:text-white text-base leading-none">
                              {client.name || 'Anonymous User'}
                            </h3>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide uppercase ${
                            isSubActive
                              ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-250 dark:border-emerald-900'
                              : isSuspended
                              ? 'bg-rose-50 dark:bg-rose-955/20 text-rose-600 dark:text-rose-400 border border-rose-250 dark:border-rose-900'
                              : 'bg-amber-50 dark:bg-amber-955/20 text-amber-600 dark:text-amber-400 border border-amber-250 dark:border-amber-900'
                          }`}>
                            {client.status || 'Inactive'}
                          </span>
                          {client.extraScanGranted === true && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-50 dark:bg-amber-955/20 text-amber-600 dark:text-amber-400 border border-amber-250 dark:border-amber-900 animate-pulse">
                              <Zap className="w-2.5 h-2.5 fill-current" />
                              <span>Extra Scan Active</span>
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-455 dark:text-gray-500 font-semibold flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span>{client.email}</span>
                          {client.usedLicenseKey && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-50 dark:bg-gray-800 text-[9px] font-black text-gray-500 dark:text-gray-400 border border-gray-200/60 dark:border-gray-700 font-mono">
                              <KeyRound className="w-2.5 h-2.5 shrink-0" />
                              <span>Key: {client.usedLicenseKey}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      </div>
                      
                      <Crown className={`w-5 h-5 ${isSubActive ? 'text-amber-500' : 'text-gray-300 dark:text-gray-750'}`} />
                    </div>

                    <div className="grid grid-cols-2 gap-4 py-2 border-y border-gray-100 dark:border-gray-800/80">
                      {/* Subscription Info */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Duration details</span>
                        <div className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 font-semibold">
                          <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>Active since: {daysActive} Days</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 font-semibold">
                          <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span className={daysRemaining <= 3 && isSubActive ? 'text-rose-600 font-black' : ''}>
                            {daysRemaining <= 0 ? 'Expired' : `${daysRemaining} Days left`}
                          </span>
                        </div>
                      </div>

                      {/* Linked Console IDs */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Linked Console IDs</span>
                        <div className="space-y-1">
                          {client.linkedGmail && (
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-750 dark:text-gray-350 font-bold">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Mail className="w-3 h-3 text-red-500 shrink-0" />
                                <span className="truncate max-w-[130px]" title={client.linkedGmail}>{client.linkedGmail}</span>
                              </div>
                              {mailboxMap[client.linkedGmail]?.game_uid && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-955/60 text-[9px] font-black text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-mono shadow-2xs">
                                  🎮 FF UID: {mailboxMap[client.linkedGmail].game_uid}
                                </span>
                              )}
                            </div>
                          )}
                          {client.linkedZoho && (
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-750 dark:text-gray-350 font-bold">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Mail className="w-3 h-3 text-blue-500 shrink-0" />
                                <span className="truncate max-w-[130px]" title={client.linkedZoho}>{client.linkedZoho}</span>
                              </div>
                              {mailboxMap[client.linkedZoho]?.game_uid && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-955/60 text-[9px] font-black text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-mono shadow-2xs">
                                  🎮 FF UID: {mailboxMap[client.linkedZoho].game_uid}
                                </span>
                              )}
                            </div>
                          )}
                          {client.linkedImap && (
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-750 dark:text-gray-350 font-bold">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Server className="w-3 h-3 text-teal-500 shrink-0" />
                                <span className="truncate max-w-[130px]" title={client.linkedImap}>{client.linkedImap}</span>
                              </div>
                              {mailboxMap[client.linkedImap]?.game_uid && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-955/60 text-[9px] font-black text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-mono shadow-2xs">
                                  🎮 FF UID: {mailboxMap[client.linkedImap].game_uid}
                                </span>
                              )}
                            </div>
                          )}
                          {!client.linkedGmail && !client.linkedZoho && !client.linkedImap && (
                            <div className="text-xs text-gray-400 italic">No Console Linked (Locked/Unlinked)</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Client Login Credentials Box (SuperAdmin Only) */}
                    {userDoc?.role === 'superadmin' && (() => {
                      const clientPassword = client.initialPassword || client.password || client.loginPassword || '';
                      const isPassRevealed = revealedPasswords[client.uid] === true;

                      return (
                        <div className="p-3 bg-indigo-50/50 dark:bg-indigo-955/15 border border-indigo-100/80 dark:border-indigo-900/40 rounded-xl space-y-2 font-sans">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                              <Lock className="w-3 h-3 text-indigo-500" />
                              <span>Client Login Credentials</span>
                            </span>
                            {clientPassword ? (
                              <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                Password Available
                              </span>
                            ) : (
                              <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                OAuth / Legacy
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                            {/* Login Email */}
                            <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-xs">
                              <div className="flex items-center gap-1.5 min-w-0 pr-1">
                                <Mail className="w-3 h-3 text-gray-400 shrink-0" />
                                <span className="text-[11px] text-gray-800 dark:text-gray-200 truncate font-bold" title={client.email}>
                                  {client.email}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopyText(client.email, `${client.uid}_email`, 'Email')}
                                className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors shrink-0 cursor-pointer"
                                title="Copy Login Email"
                              >
                                {copiedField === `${client.uid}_email` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>

                            {/* Login Password */}
                            <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-xs">
                              <div className="flex items-center gap-1.5 min-w-0 pr-1">
                                <Lock className="w-3 h-3 text-gray-400 shrink-0" />
                                <span className="text-[11px] text-gray-800 dark:text-gray-200 truncate font-bold">
                                  {clientPassword ? (
                                    isPassRevealed ? clientPassword : '••••••••••••'
                                  ) : (
                                    <span className="text-[10px] text-gray-400 italic font-sans font-normal">Not Set</span>
                                  )}
                                </span>
                              </div>

                              <div className="flex items-center gap-0.5 shrink-0">
                                {clientPassword ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => togglePasswordReveal(client.uid)}
                                      className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors cursor-pointer"
                                      title={isPassRevealed ? "Hide Password" : "Show Password"}
                                    >
                                      {isPassRevealed ? (
                                        <EyeOff className="w-3.5 h-3.5 text-indigo-500" />
                                      ) : (
                                        <Eye className="w-3.5 h-3.5" />
                                      )}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleCopyText(clientPassword, `${client.uid}_pass`, 'Password')}
                                      className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors cursor-pointer"
                                      title="Copy Password"
                                    >
                                      {copiedField === `${client.uid}_pass` ? (
                                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedClient(client);
                                      setFormModalOpen(true);
                                    }}
                                    className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-[9.5px] font-black text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors flex items-center gap-1 cursor-pointer"
                                    title="Click to set password for this client"
                                  >
                                    <Edit className="w-2.5 h-2.5" />
                                    <span>Set Password</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* OTP Scan Stats Badge Bar */}
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-150 dark:border-gray-800 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-gray-700 dark:text-gray-300">
                        <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>OTP Status:</span>
                        {(client.otpUsed || (client.otpScanCount || 0) > 0) ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                            <CheckCircle className="w-2.5 h-2.5" /> Used (1/1 Lock)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-955/30 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                            <Clock className="w-2.5 h-2.5" /> Not Scanned Yet
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-black text-gray-500 dark:text-gray-400">
                        Lifetime Scans: <span className="text-indigo-600 dark:text-indigo-400 font-mono text-xs">{client.otpScanCount || (client.otpUsed ? 1 : 0)}</span>
                      </div>
                    </div>

                    {/* Suspend Alert Status (Only shown if suspended) */}
                    {isSuspended && (
                      <div className="flex items-start gap-2 bg-rose-50/50 dark:bg-rose-955/10 border border-rose-100 dark:border-rose-950/20 p-3 rounded-xl text-xs text-rose-800 dark:text-rose-300 font-semibold leading-relaxed">
                        <AlertTriangle className="w-4 h-4 text-rose-550 dark:text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                        <div>
                          <p className="font-bold">Security Lock Active</p>
                          <p className="text-[10px] text-rose-700 dark:text-rose-400/80 mt-0.5">
                            {client.mailboxDisabledReason || "Suspended by Administrator portal."}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Actions Panel */}
                    <div className="flex items-center justify-between gap-3 pt-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedClient(client);
                            setFormModalOpen(true);
                          }}
                          className="px-4 py-2 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Edit Details</span>
                        </button>

                        <button
                          disabled={actionLoading}
                          onClick={() => handleGrantExtraScan(client)}
                          className={`px-4 py-2 border font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 ${
                            client.extraScanGranted === true
                              ? 'bg-amber-55/15 dark:bg-amber-955/20 border-amber-300 dark:border-amber-900 text-amber-700 dark:text-amber-400'
                              : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <Zap className={`w-3.5 h-3.5 ${client.extraScanGranted === true ? 'fill-current animate-pulse text-amber-500' : ''}`} />
                          <span>{client.extraScanGranted === true ? 'Scan Active' : 'Allow 1 Scan'}</span>
                        </button>

                        {userDoc?.role === 'superadmin' && (
                          <button
                            onClick={async () => {
                              const success = await impersonateClient(client.uid);
                              if (success) {
                                navigate('/client-dashboard');
                              }
                            }}
                            className="px-4 py-2 border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-955/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                            title="Login as this client"
                          >
                            <LogIn className="w-3.5 h-3.5" />
                            <span>Login As Client</span>
                          </button>
                        )}
                      </div>

                      <button
                        disabled={actionLoading}
                        onClick={() => handleToggleSuspend(client)}
                        className={`px-4 py-2 font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 ${
                          isSuspended
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-650/15'
                            : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-650/15'
                        }`}
                      >
                        {isSuspended ? (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>One-click Unsuspend</span>
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>One-click Suspend</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {formModalOpen && selectedClient && (
        <ClientFormModal
          isOpen={formModalOpen}
          onClose={() => setFormModalOpen(false)}
          client={selectedClient}
          onSubmit={handleFormSubmit}
          currentUserRole={userDoc?.role}
          currentUserId={currentUser?.uid}
        />
      )}
    </div>
  );
}
