import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import StatCard from '../components/StatCard';
import ClientTable from '../components/ClientTable';
import ClientFormModal from '../components/ClientFormModal';
import AuditLogsModal from '../components/AuditLogsModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useIdleTimer } from '../hooks/useIdleTimer';
import { createSecondaryAuthUser } from '../firebase/auth';
import { 
  getAllClients, 
  createClientRecord, 
  updateClientRecord, 
  deleteClientRecord,
  createAdminRecord,
  updateAdminRecord,
  getAllAdmins,
  deleteAdminRecord,
  subscribeToActiveSupportRequests,
  unsuspendClientRecord,

  assignClientToAdmin,
  assignGmailToAdmin,
  assignZohoToAdmin,
  assignImapToAdmin
} from '../firebase/firestore';
import AdminChatDrawer from '../components/AdminChatDrawer';
import EveryUserSessionsModal from '../components/EveryUserSessionsModal';
import { 
  Users, 
  UserCheck, 
  UserMinus, 
  UserX, 
  Download, 
  Plus, 
  History, 
  Clock,
  Trash2,
  X,
  AlertTriangle,
  ShieldAlert,
  Loader,
  Headphones,
  Map,
  Shield,
  Edit2,
  Activity
} from 'lucide-react';

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", 
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", 
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", 
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", 
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry"
];

/**
 * Main Administrator Panel.
 * Includes metrics cards, client list, export features, logs viewer, and creation form.
 */
export default function AdminDashboard() {
  const { currentUser, userDoc } = useAuth();
  const { showToast } = useToast();
  
  // Register inactivity logout timer (15 minutes)
  useIdleTimer(900000);

  // Layout States
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [clients, setClients] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [activeTab, setActiveTab] = useState('clients');
  const [loading, setLoading] = useState(true);

  // Modals States
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientToRemove, setClientToRemove] = useState(null);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [requestingCount, setRequestingCount] = useState(0);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [selectedClientForAudit, setSelectedClientForAudit] = useState(null);
  const [sessionsModalOpen, setSessionsModalOpen] = useState(false);



  useEffect(() => {
    if (userDoc) {
      loadClients();
    }
  }, [userDoc]);

  useEffect(() => {
    if (!userDoc) return;
    // Listen to incoming active support requests for notifications & badges
    const unsubRequests = subscribeToActiveSupportRequests((data) => {
      const requesting = data.filter(c => c.status === 'requesting');
      setRequestingCount(requesting.length);
      
      requesting.forEach(req => {
        const key = `seen_req_${req.clientUid}_${req.updatedAt}`;
        if (!sessionStorage.getItem(key)) {
          showToast(`Client ${req.clientName} is requesting support!`, "warning");
          sessionStorage.setItem(key, 'true');
        }
      });
    });
    return () => unsubRequests();
  }, [showToast, userDoc]);

  const loadAdmins = async () => {
    try {
      const data = await getAllAdmins();
      setAdmins(data);
    } catch (error) {
      console.error("Error loading admin profiles:", error);
    }
  };

  const loadClients = async () => {
    setLoading(true);
    try {
      const data = await getAllClients(userDoc?.role, currentUser?.uid);
      setClients(data);
      await loadAdmins();
    } catch (error) {
      console.error("Error loading client profiles:", error);
      showToast("Failed to fetch client records.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAssignAdmin = async (clientUid, adminUid) => {
    try {
      showToast("Updating operator assignment...", "info");
      await assignClientToAdmin(clientUid, adminUid, {
        uid: currentUser.uid,
        email: currentUser.email
      });
      showToast("Operator assignment updated successfully!", "success");
      await loadClients();
    } catch (err) {
      console.error("Failed to assign operator:", err);
      showToast("Failed to assign operator.", "error");
    }
  };

  // KPI calculations
  const totalClients = clients.length;
  const activeClients = clients.filter(c => c.status === 'Active').length;
  const expiredClients = clients.filter(c => c.status === 'Expired').length;
  const suspendedClients = clients.filter(c => c.status === 'Suspended').length;

  // Recently Created Accounts (Top 4 ordered by createdAt)
  const recentlyCreated = [...clients]
    .filter(c => c.createdAt)
    .sort((a, b) => {
      const aTime = a.createdAt?.toDate?.()?.getTime() || new Date(a.createdAt).getTime();
      const bTime = b.createdAt?.toDate?.()?.getTime() || new Date(b.createdAt).getTime();
      return bTime - aTime;
    })
    .slice(0, 4);

  // CSV Exporter
  const handleExportCSV = () => {
    if (clients.length === 0) {
      showToast("No clients to export", "warning");
      return;
    }

    const headers = [
      'Name', 'Email', 'Mobile', 'Product', 'Purchase Date', 
      'Expiry Date', 'Validity (Days)', 'Amount Paid', 'Remaining Balance', 
      'Commission', 'Status', 'Notes'
    ];
    
    const rows = clients.map(c => [
      `"${c.name || ''}"`,
      `"${c.email || ''}"`,
      `"${c.mobile || ''}"`,
      `"${c.productName || ''}"`,
      `"${c.purchaseDate ? new Date(c.purchaseDate).toISOString().split('T')[0] : ''}"`,
      `"${c.expiryDate ? new Date(c.expiryDate).toISOString().split('T')[0] : ''}"`,
      c.validityDays || 0,
      c.amountPaid || 0,
      c.remainingBalance || 0,
      c.commission || 0,
      `"${c.status || ''}"`,
      `"${(c.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `client_list_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV exported successfully!", "success");
  };

  const handleOpenCreateModal = () => {
    setSelectedClient(null);
    setFormModalOpen(true);
  };

  const handleOpenEditModal = (client) => {
    if (userDoc?.role !== 'superadmin' && (client.role === 'admin' || client.role === 'superadmin')) {
      showToast("Access Denied: Only Super Administrators can edit administrator accounts.", "error");
      return;
    }
    setSelectedClient(client);
    setFormModalOpen(true);
  };

  const handleFormSubmit = async (formData) => {
    const adminInfo = { uid: currentUser.uid, email: currentUser.email, role: userDoc?.role };

    if (selectedClient) {
      if (selectedClient.role === 'admin' || selectedClient.role === 'superadmin') {
        // Perform admin update
        await updateAdminRecord(selectedClient.uid, formData, selectedClient, adminInfo);
        showToast("Administrator account updated successfully.", "success");
      } else {
        // Perform client update
        await updateClientRecord(selectedClient.uid, formData, selectedClient, adminInfo);
        showToast("Client account updated successfully.", "success");
      }
    } else {
      // 1. Create client authentication user via secondary app instance
      const newAuthUser = await createSecondaryAuthUser(formData.email, formData.password);
      
      if (formData.role === 'admin' || formData.role === 'superadmin' || formData.role === 'employee') {
        // 2. Create Admin / Employee profile document in Firestore
        await createAdminRecord({
          uid: newAuthUser.uid,
          name: formData.name,
          email: formData.email,
          mobile: formData.mobile,
          role: formData.role,
          initialPassword: formData.password,
          password: formData.password,
          allowLicenseKeys: !!formData.allowLicenseKeys,
          selectedGmails: formData.selectedGmails || [],
          selectedZohos: formData.selectedZohos || [],
          selectedImaps: formData.selectedImaps || []
        }, adminInfo);

        // 3. Update assigned Gmail monitor accounts if any
        if (formData.selectedGmails && formData.selectedGmails.length > 0) {
          for (const gmailId of formData.selectedGmails) {
            await assignGmailToAdmin(gmailId, newAuthUser.uid);
          }
        }

        // 4. Update assigned Zoho monitor accounts if any
        if (formData.selectedZohos && formData.selectedZohos.length > 0) {
          for (const zohoId of formData.selectedZohos) {
            await assignZohoToAdmin(zohoId, newAuthUser.uid);
          }
        }

        // 5. Update assigned IMAP monitor accounts if any
        if (formData.selectedImaps && formData.selectedImaps.length > 0) {
          for (const imapId of formData.selectedImaps) {
            await assignImapToAdmin(imapId, newAuthUser.uid);
          }
        }

        showToast(formData.role === 'superadmin' ? "Super Administrator registered successfully." : "Administrator registered successfully.", "success");
      } else {
        // 2. Create matching profile + subscription records in Firestore
        await createClientRecord({
          uid: newAuthUser.uid,
          ...formData
        }, adminInfo);

        showToast("Client account registered successfully.", "success");
      }
    }
    loadClients(); // Refresh tables
  };

  const [deletingAdminUid, setDeletingAdminUid] = useState(null);

  const handleDeleteClient = (clientToDelete) => {
    setClientToRemove(clientToDelete);
    setRemoveModalOpen(true);
  };

  const handleUnsuspendClient = async (client) => {
    if (window.confirm(`Are you sure you want to unsuspend "${client.name}"? This will restore their active panel access.`)) {
      try {
        const adminInfo = { uid: currentUser.uid, email: currentUser.email };
        await unsuspendClientRecord(client.uid, client.name, adminInfo);
        showToast(`Account "${client.name}" unsuspended successfully.`, "success");
        loadClients();
      } catch (err) {
        console.error(err);
        showToast("Failed to unsuspend client account.", "error");
      }
    }
  };

  const handleDeleteAdmin = async (adminToDelete) => {
    if (userDoc?.role !== 'superadmin') {
      showToast("Access Denied: Only Super Administrators can delete administrator accounts.", "error");
      return;
    }
    if (window.confirm(`Are you sure you want to delete administrator "${adminToDelete.name}"? This will permanently remove their Firestore access profile.`)) {
      try {
        const adminInfo = { uid: currentUser.uid, email: currentUser.email };
        await deleteAdminRecord(adminToDelete.uid, adminToDelete.name, adminInfo);
        showToast("Administrator profile deleted successfully.", "success");
        loadClients();
      } catch (err) {
        console.error(err);
        showToast("Failed to delete administrator profile.", "error");
      }
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getDiffDays = (date) => {
    if (!date) return 0;
    const createdDate = new Date(date);
    const now = new Date();
    const diffTime = Math.abs(now - createdDate);
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const redAlertClients = clients.filter(c => {
    const isClient = c.role === 'client';
    const notDismissed = !c.warningDismissed;
    const createdDate = c.createdAt?.toDate?.() || c.createdAt;
    const isOldEnough = createdDate && getDiffDays(createdDate) >= 3;
    return isClient && notDismissed && isOldEnough;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
      {/* Sidebar Navigation */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Main Application Container */}
      <div className="flex-1 lg:pl-72 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} title="Client Overview" />

        {/* Dashboard Content */}
        <main className="flex-1 p-6 lg:p-8 space-y-8 overflow-y-auto">
          {/* Action Header bar */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">System Status</h3>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Synchronized
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">Manage and audit active subscription licenses & security telemetry.</p>
            </div>
            
            <div className="flex flex-wrap gap-2.5 w-full sm:w-auto">
              <button
                onClick={() => setChatDrawerOpen(true)}
                className="relative glass-card btn-tactile hover-lift flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl focus-ring"
              >
                <Headphones className="w-4 h-4 text-indigo-500" />
                <span>Support Chat</span>
                {requestingCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 text-[9px] font-bold items-center justify-center text-white select-none shadow-sm">
                      {requestingCount}
                    </span>
                  </span>
                )}
              </button>

              <Link
                to="/admin/analytics"
                className="glass-card btn-tactile hover-lift flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl focus-ring"
              >
                <Activity className="w-4 h-4 text-emerald-500" />
                <span>Website Analytics</span>
              </Link>

              <button
                onClick={() => setLogsModalOpen(true)}
                className="glass-card btn-tactile hover-lift flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl focus-ring"
              >
                <History className="w-4 h-4 text-gray-400" />
                <span>Audit Logs</span>
              </button>

              <button
                onClick={() => setSessionsModalOpen(true)}
                className="glass-card btn-tactile hover-lift flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl focus-ring"
              >
                <Shield className="w-4 h-4 text-gray-400" />
                <span>Session Logs</span>
              </button>

              <button
                onClick={handleExportCSV}
                className="glass-card btn-tactile hover-lift flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl focus-ring"
              >
                <Download className="w-4 h-4 text-gray-400" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={handleOpenCreateModal}
                className="btn-tactile hover-lift flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-650 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-sm font-bold text-white rounded-xl shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 transition-all w-full sm:w-auto justify-center focus-ring"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Register User</span>
              </button>
            </div>
          </div>

          {/* Red Alerts Section */}
          {redAlertClients.length > 0 && (
            <div className="animate-fade-in space-y-4">
              <div className="bg-rose-50 dark:bg-rose-950/20 border-2 border-rose-500/80 dark:border-rose-900 rounded-3xl p-5 md:p-6 shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-5 pointer-events-none">
                  <ShieldAlert className="w-48 h-48 text-rose-500" />
                </div>
                
                <div className="flex items-center gap-3 border-b border-rose-200/60 dark:border-rose-900/60 pb-3 mb-4">
                  <ShieldAlert className="w-6 h-6 text-rose-600 dark:text-rose-400 animate-pulse shrink-0" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-rose-800 dark:text-rose-400">
                    CRITICAL WARNING: Credentials Exposure (3+ Days Active)
                  </h3>
                </div>

                <p className="text-xs text-rose-700 dark:text-rose-300 font-bold mb-4 leading-normal">
                  ⚠️ The following client accounts were registered 3 or more days ago. To prevent account compromises or unauthorized access, please verify their active binding state or suspend their access immediately.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {redAlertClients.map(client => {
                    const daysOld = getDiffDays(client.createdAt?.toDate?.() || client.createdAt);
                    return (
                      <div key={client.uid} className="bg-white dark:bg-gray-900 border border-rose-200/50 dark:border-rose-900/40 p-4 rounded-2xl shadow-inner relative space-y-3.5">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-black text-rose-600 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 px-2 py-0.5 rounded uppercase tracking-wide">
                                {daysOld} Days Active
                              </span>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wide border ${
                                client.status === 'Active'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border-emerald-100 dark:border-emerald-900/50'
                                  : client.status === 'Suspended'
                                  ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 border-rose-100 dark:border-rose-900/50'
                                  : 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 border-amber-100 dark:border-amber-900/50'
                              }`}>
                                {client.status || 'Active'}
                              </span>
                              {client.mailboxDisabled && (
                                <span className="text-[10px] font-black text-rose-600 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 px-2 py-0.5 rounded uppercase tracking-wide">
                                  Mailbox Disabled
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-black text-gray-900 dark:text-white mt-1.5">{client.name}</h4>
                          </div>
                          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500">
                            UID: {client.uid.substring(0, 8)}...
                          </span>
                        </div>

                        {userDoc?.role === 'superadmin' && (
                          <div className="bg-gray-50 dark:bg-gray-950 p-3 rounded-xl border border-gray-200 dark:border-gray-800 space-y-1.5 font-mono text-[11px] leading-normal">
                            <p className="text-gray-500 dark:text-gray-450 font-bold text-[9px] uppercase tracking-wider mb-0.5">Assigned Login Credentials</p>
                            <p className="truncate">📧 Email: <span className="text-gray-900 dark:text-white font-extrabold">{client.email}</span></p>
                            <p className="truncate">🔑 Pass: <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{client.initialPassword || 'No Plaintext Record'}</span></p>
                            <p className="truncate">🎮 Product: <span className="text-gray-900 dark:text-white font-bold">{client.productName || 'None'}</span></p>
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          {client.status === 'Suspended' ? (
                            <button
                              onClick={async () => {
                                if (window.confirm(`Are you sure you want to UNSUSPEND access for client ${client.name}?`)) {
                                  try {
                                    const adminInfo = { uid: currentUser.uid, email: currentUser.email };
                                    await unsuspendClientRecord(client.uid, client.name, adminInfo);
                                    showToast(`Account unsuspended for ${client.name}.`, 'success');
                                    loadClients();
                                  } catch (e) {
                                    console.error(e);
                                    showToast('Failed to unsuspend account.', 'error');
                                  }
                                }
                              }}
                              className="flex-1 py-1.5 bg-emerald-650 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg uppercase tracking-wide transition-all shadow-md"
                            >
                              Unsuspend Client
                            </button>
                          ) : (
                            <button
                              onClick={async () => {
                                if (window.confirm(`Are you sure you want to SUSPEND access for client ${client.name}?`)) {
                                  try {
                                    const adminInfo = { uid: currentUser.uid, email: currentUser.email };
                                    await updateClientRecord(client.uid, { status: 'Suspended' }, {}, adminInfo);
                                    showToast(`Account suspended for ${client.name}.`, 'success');
                                    loadClients();
                                  } catch (e) {
                                    console.error(e);
                                    showToast('Failed to suspend account.', 'error');
                                  }
                                }
                              }}
                              className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded-lg uppercase tracking-wide transition-all shadow-md"
                            >
                              Suspend Client
                            </button>
                          )}
                          
                          {client.mailboxDisabled ? (
                            <button
                              onClick={async () => {
                                if (window.confirm(`Are you sure you want to restore Garena OTP access for ${client.name}?`)) {
                                  try {
                                    const adminInfo = { uid: currentUser.uid, email: currentUser.email };
                                    await updateClientRecord(client.uid, { 
                                      mailboxDisabled: false, 
                                      mailboxDisabledReason: '' 
                                    }, {}, adminInfo);
                                    showToast(`OTP Mailbox restored for ${client.name}.`, 'success');
                                    loadClients();
                                  } catch (e) {
                                    console.error(e);
                                    showToast('Failed to restore OTP mailbox.', 'error');
                                  }
                                }
                              }}
                              className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg uppercase tracking-wide transition-all shadow-md"
                            >
                              Restore Mailbox
                            </button>
                          ) : (
                            <button
                              onClick={async () => {
                                if (window.confirm(`Are you sure you want to disable Garena OTP access for ${client.name}?`)) {
                                  try {
                                    const adminInfo = { uid: currentUser.uid, email: currentUser.email };
                                    await updateClientRecord(client.uid, { 
                                      mailboxDisabled: true, 
                                      mailboxDisabledReason: 'System suspended: 3-day credentials exposure limit reached.' 
                                    }, {}, adminInfo);
                                    showToast(`OTP Mailbox revoked for ${client.name}.`, 'success');
                                    loadClients();
                                  } catch (e) {
                                    console.error(e);
                                    showToast('Failed to revoke OTP mailbox.', 'error');
                                  }
                                }
                              }}
                              className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] rounded-lg uppercase tracking-wide transition-all shadow-md"
                            >
                              Revoke Mailbox
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              try {
                                const adminInfo = { uid: currentUser.uid, email: currentUser.email };
                                  await updateClientRecord(client.uid, { warningDismissed: true }, {}, adminInfo);
                                  showToast('Warning dismissed.', 'success');
                                  loadClients();
                                } catch (e) {
                                  console.error(e);
                                  showToast('Failed to dismiss warning.', 'error');
                                }
                            }}
                            className="py-1.5 px-2.5 bg-gray-100 hover:bg-gray-250 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-[10px] rounded-lg uppercase tracking-wide transition-all border border-gray-200 dark:border-gray-750"
                            title="Dismiss Warning"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Metric Dashboard Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard title="Total Clients" value={totalClients} icon={Users} color="indigo" description="Total client accounts" />
            <StatCard title="Active Accounts" value={activeClients} icon={UserCheck} color="emerald" description="Currently valid licenses" />
            <StatCard title="Expired Subscriptions" value={expiredClients} icon={UserMinus} color="amber" description="Licenses requiring renewals" />
            <StatCard title="Suspended Users" value={suspendedClients} icon={UserX} color="rose" description="Accounts with blocked access" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
            {/* Left Column: Client or Admin Database Table */}
            <div className="xl:col-span-2 space-y-6">
              <div className="flex bg-gray-200/70 dark:bg-gray-800/70 p-1.5 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 backdrop-blur-md">
                <button
                  onClick={() => setActiveTab('clients')}
                  className={`flex-1 py-2.5 text-sm font-extrabold rounded-xl transition-all duration-200 btn-tactile focus-ring ${
                    activeTab === 'clients'
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/30'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Clients ({clients.length})
                </button>
                {userDoc?.role === 'superadmin' && (
                  <button
                    onClick={() => setActiveTab('admins')}
                    className={`flex-1 py-2.5 text-sm font-extrabold rounded-xl transition-all duration-200 btn-tactile focus-ring ${
                      activeTab === 'admins'
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/30'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Administrators ({admins.length})
                  </button>
                )}
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-650 mb-2"></div>
                  <span className="text-sm text-gray-400">Loading data...</span>
                </div>
              ) : activeTab === 'clients' ? (
                <ClientTable 
                  clients={clients} 
                  admins={admins}
                  currentUserRole={userDoc?.role}
                  onAssignAdmin={handleAssignAdmin}
                  onEdit={handleOpenEditModal} 
                  onDelete={handleDeleteClient} 
                  onAudit={(client) => {
                    setSelectedClientForAudit(client);
                    setAuditModalOpen(true);
                  }}
                  onUnsuspend={handleUnsuspendClient}
                />
              ) : (
                /* Administrators List */
                <div className="overflow-hidden bg-white dark:bg-gray-900 rounded-2xl border border-gray-150 dark:border-gray-800 shadow-sm animate-fade-in">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b border-gray-150 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 text-xs font-semibold uppercase text-gray-400 dark:text-gray-500 tracking-wider">
                          <th className="p-4 pl-6">Admin Name</th>
                          <th className="p-4">Email</th>
                          <th className="p-4">Mobile</th>
                          <th className="p-4">Date Registered</th>
                          <th className="p-4 pr-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-150 dark:divide-gray-800 text-sm text-gray-600 dark:text-gray-350">
                        {admins.map(admin => (
                          <tr key={admin.uid} className="hover:bg-gray-50/30 dark:hover:bg-gray-800/10 transition-colors">
                            <td className="p-4 pl-6">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-650 dark:text-indigo-400 font-semibold shrink-0">
                                  {admin.name ? admin.name.charAt(0).toUpperCase() : '?'}
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900 dark:text-white leading-none">{admin.name}</p>
                                  {admin.uid === currentUser.uid && (
                                    <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950 text-indigo-650 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900 px-1.5 py-0.5 rounded-md font-bold mt-1.5 inline-block">
                                      You
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-gray-500 dark:text-gray-455">{admin.email}</td>
                            <td className="p-4 text-gray-550 dark:text-gray-400">{admin.mobile || '-'}</td>
                            <td className="p-4 text-gray-550 dark:text-gray-400">{formatDate(admin.createdAt)}</td>
                            <td className="p-4 pr-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleOpenEditModal(admin)}
                                  className="p-1.5 rounded-lg text-gray-555 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-650 dark:hover:text-indigo-400 transition-all"
                                  title="Edit Account"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                {admin.uid !== currentUser.uid ? (
                                  <button
                                    onClick={() => handleDeleteAdmin(admin)}
                                    className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-rose-600 dark:hover:text-rose-400 transition-all"
                                    title="Delete Account"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-gray-400 dark:text-gray-505 italic font-bold">Self</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Recently Created Widget */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  Recent Activations
                </h4>
                <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Live Feed</span>
              </div>
              <div className="glass-card rounded-2xl p-5 shadow-sm space-y-4">
                {recentlyCreated.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500 font-semibold">
                    No recent accounts created.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentlyCreated.map(client => (
                      <div key={client.uid} className="flex items-center gap-3.5 p-2 rounded-xl border-b border-gray-100 dark:border-gray-800/60 last:border-0 hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors group">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/15 to-indigo-600/25 border border-indigo-500/20 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-extrabold text-sm shrink-0 shadow-sm">
                          {client.name ? client.name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-gray-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{client.name}</p>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="text-xs text-gray-500 dark:text-gray-400 truncate font-medium">{client.productName || 'Standard Access'}</span>
                            {client.usedLicenseKey && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-500/10 text-[10px] font-black text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-mono">
                                {client.usedLicenseKey}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500 font-bold">
                            <Clock className="w-3 h-3" />
                            {formatDate(client.createdAt?.toDate?.() || client.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Modals Containers */}
      <ClientFormModal 
        isOpen={formModalOpen} 
        onClose={() => setFormModalOpen(false)} 
        client={selectedClient}
        onSubmit={handleFormSubmit}
        currentUserRole={userDoc?.role}
        currentUserId={currentUser?.uid}
      />

      <AuditLogsModal 
        isOpen={logsModalOpen} 
        onClose={() => setLogsModalOpen(false)} 
      />

      <EveryUserSessionsModal 
        isOpen={sessionsModalOpen} 
        onClose={() => setSessionsModalOpen(false)} 
      />

      {auditModalOpen && selectedClientForAudit && (
        <ClientAuditModal 
          isOpen={auditModalOpen}
          onClose={() => {
            setAuditModalOpen(false);
            setSelectedClientForAudit(null);
          }}
          client={selectedClientForAudit}
        />
      )}

      {removeModalOpen && clientToRemove && (
        <RemoveClientModal 
          isOpen={removeModalOpen}
          onClose={() => {
            setRemoveModalOpen(false);
            setClientToRemove(null);
          }}
          client={clientToRemove}
          onConfirm={async (options) => {
            try {
              const adminInfo = { uid: currentUser.uid, email: currentUser.email };
              await deleteClientRecord(clientToRemove.uid, clientToRemove.name, adminInfo, options);
              showToast("Client removed successfully.", "success");
              loadClients();
            } catch (err) {
              console.error(err);
              showToast("Failed to remove client account.", "error");
            } finally {
              setRemoveModalOpen(false);
              setClientToRemove(null);
            }
          }}
        />
      )}

      <AdminChatDrawer 
        isOpen={chatDrawerOpen} 
        onClose={() => setChatDrawerOpen(false)} 
      />
    </div>
  );
}

/**
 * Premium Modal to select soft/hard delete and provide customized removal reason.
 */
function RemoveClientModal({ isOpen, onClose, client, onConfirm }) {
  const [notifyClient, setNotifyClient] = useState(true);
  const [reasonType, setReasonType] = useState('suspicious');
  const [customReason, setCustomReason] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const templates = {
    suspicious: {
      reason: "Suspicious activity detected (multiple concurrent logins / suspicious requests).",
      message: "Our automated system has detected suspicious login patterns or concurrent connections from multiple locations on your client profile. Access has been restricted for security reasons."
    },
    violation: {
      reason: "Violation of terms of service.",
      message: "Access to your client panel has been revoked due to a violation of our service guidelines. Please contact support if you require clarification."
    },
    expired: {
      reason: "License expired or unpaid balance.",
      message: "Your subscription access has expired or has a remaining balance unpaid. Please reach out to the admin panel to settle your account and restore service."
    },
    requested: {
      reason: "Requested by client.",
      message: "Your account credentials and dashboard subscription have been removed as requested."
    },
    custom: {
      reason: "",
      message: ""
    }
  };

  // Pre-fill default message when reasonType changes
  useEffect(() => {
    if (reasonType !== 'custom') {
      setCustomMessage(templates[reasonType].message);
    } else {
      setCustomMessage('');
    }
  }, [reasonType]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const selectedReason = reasonType === 'custom' ? customReason : templates[reasonType].reason;
    await onConfirm({
      reason: selectedReason || "Access revoked by administrator",
      message: customMessage,
      notifyClient
    });
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop blur overlay */}
      <div className="absolute inset-0 bg-gray-900/60 dark:bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl shadow-2xl overflow-hidden animate-scale-up z-10">
        {/* Header bar */}
        <div className="p-6 pb-4 border-b border-gray-100 dark:border-gray-850 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <h3 className="text-lg font-black tracking-tight">Remove Client Account</h3>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-650 dark:hover:text-gray-200 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Target User Info card */}
          <div className="p-4 bg-rose-50/30 dark:bg-rose-955/10 border border-rose-100 dark:border-rose-900/20 rounded-2xl text-sm space-y-1">
            <span className="text-xs text-rose-600/80 dark:text-rose-400/85 font-bold uppercase tracking-wider block">Target Account</span>
            <p className="font-extrabold text-gray-900 dark:text-white text-base">{client.name}</p>
            <p className="text-gray-500 dark:text-gray-400 font-medium">{client.email}</p>
          </div>

          {/* Deletion Mode */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-550 dark:text-gray-450 uppercase">Removal Method</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className={`flex flex-col p-3.5 border rounded-2xl cursor-pointer transition-all ${
                notifyClient 
                  ? 'border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/20 text-indigo-900 dark:text-indigo-400' 
                  : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40 text-gray-550 dark:text-gray-400'
              }`}>
                <div className="flex items-center gap-2">
                  <input 
                    type="radio" 
                    name="notifyClient" 
                    checked={notifyClient === true} 
                    onChange={() => setNotifyClient(true)}
                    className="text-indigo-600 focus:ring-indigo-500 w-4 h-4" 
                  />
                  <span className="text-sm font-bold">Soft Delete (Block & Warn)</span>
                </div>
                <span className="text-[10px] text-gray-450 dark:text-gray-500 mt-1 leading-normal font-semibold">Keep profile details so the client sees the exact blocking reason when signing in.</span>
              </label>

              <label className={`flex flex-col p-3.5 border rounded-2xl cursor-pointer transition-all ${
                !notifyClient 
                  ? 'border-rose-600 bg-rose-50/20 dark:bg-rose-950/20 text-rose-900 dark:text-rose-455' 
                  : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40 text-gray-550 dark:text-gray-400'
              }`}>
                <div className="flex items-center gap-2">
                  <input 
                    type="radio" 
                    name="notifyClient" 
                    checked={notifyClient === false} 
                    onChange={() => setNotifyClient(false)}
                    className="text-rose-600 focus:ring-rose-500 w-4 h-4" 
                  />
                  <span className="text-sm font-bold">Hard Delete (Wipe Clean)</span>
                </div>
                <span className="text-[10px] text-gray-450 dark:text-gray-500 mt-1 leading-normal font-semibold">Erase both profile and subscription records completely. Client sees generic access denied.</span>
              </label>
            </div>
          </div>

          {/* Conditional Options: Soft delete reasons */}
          {notifyClient && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-550 dark:text-gray-450 uppercase">Primary Reason</label>
                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
                  {[
                    { key: 'suspicious', label: 'Suspicious Behavior (Auto-Expire simulation)' },
                    { key: 'violation', label: 'Violation of Terms of Service' },
                    { key: 'expired', label: 'Subscription Expired / Balance Unpaid' },
                    { key: 'requested', label: 'Termination Requested by Client' },
                    { key: 'custom', label: 'Custom Removal Reason' },
                  ].map(opt => (
                    <label key={opt.key} className="flex items-center gap-2.5 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-850 cursor-pointer text-xs text-gray-700 dark:text-gray-300 font-semibold transition-colors border border-gray-150 dark:border-gray-800">
                      <input 
                        type="radio" 
                        name="reasonType" 
                        value={opt.key}
                        checked={reasonType === opt.key}
                        onChange={() => setReasonType(opt.key)}
                        className="text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {reasonType === 'custom' && (
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-550 dark:text-gray-405">Custom Reason Description</label>
                  <input 
                    type="text" 
                    required={reasonType === 'custom'}
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="e.g. Account abuse or inactive client..."
                    className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-gray-900 dark:text-white font-medium"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-550 dark:text-gray-450 uppercase">Detailed Message to Display to Client</label>
                <textarea 
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Explain why their access has been revoked..."
                  rows="3"
                  className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-gray-900 dark:text-white leading-normal font-medium resize-none"
                />
              </div>
            </div>
          )}

          {/* Confirm block */}
          <div className="flex gap-3 justify-end pt-3 border-t border-gray-100 dark:border-gray-850">
            <button 
              type="button" 
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-200 dark:border-gray-800 text-sm font-bold text-gray-750 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className={`px-5 py-2 text-sm font-bold text-white rounded-xl shadow-lg transition-all flex items-center gap-2 ${
                notifyClient 
                  ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20' 
                  : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
              }`}
            >
              {loading && <Loader className="w-4 h-4 animate-spin" />}
              <span>{notifyClient ? 'Notify & Remove' : 'Erase Permanently'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Premium Modal to Audit Client Session History & Geolocations.
 */
function ClientAuditModal({ isOpen, onClose, client }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!client || !isOpen) return;
    const fetchSessions = async () => {
      setLoading(true);
      try {
        const data = await getClientSessions(client.uid);
        setSessions(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, [client, isOpen]);

  if (!isOpen || !client) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop blur overlay */}
      <div className="absolute inset-0 bg-gray-900/60 dark:bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal Card */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl shadow-2xl overflow-hidden animate-scale-up z-10 flex flex-col max-h-[85vh]">
        {/* Header bar */}
        <div className="p-6 pb-4 border-b border-gray-100 dark:border-gray-850 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <Shield className="w-5 h-5 shrink-0" />
            <h3 className="text-lg font-black tracking-tight">Security Telemetry Audit</h3>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-250 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Client details card */}
        <div className="p-6 pb-2 shrink-0">
          <div className="p-4 bg-indigo-50/30 dark:bg-indigo-950/10 border border-indigo-100/30 dark:border-indigo-900/30 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold uppercase tracking-wider block">Auditing Client</span>
              <p className="font-extrabold text-gray-900 dark:text-white text-base leading-snug">{client.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">{client.email}</p>
            </div>
            <div className="text-right text-xs text-gray-500 dark:text-gray-400 font-semibold">
              <p>Product: <span className="text-gray-800 dark:text-gray-205 font-bold">{client.productName || '-'}</span></p>
              <p className="mt-0.5">Status: <span className="text-gray-800 dark:text-gray-205 font-bold">{client.status || '-'}</span></p>
            </div>
          </div>
        </div>

        {/* Timeline Log Content list */}
        <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-4">
          <h4 className="text-xs font-black text-gray-550 dark:text-gray-450 uppercase tracking-wider block">Access Session History</h4>
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12">
              <Loader className="w-8 h-8 animate-spin text-indigo-650 mb-2" />
              <span className="text-xs text-gray-450">Retrieving security records...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-gray-200 dark:border-gray-850 rounded-2xl">
              <ShieldAlert className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2.5" />
              <p className="text-xs text-gray-450 dark:text-gray-500 font-semibold leading-normal max-w-[240px] mx-auto">
                No session telemetry logs exist for this client. Logs are written upon portal authentication.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((sess, idx) => (
                <div key={sess.id} className="p-4 bg-gray-50/50 dark:bg-gray-850/50 border border-gray-150 dark:border-gray-800 rounded-2xl space-y-3 relative hover:border-indigo-200 dark:hover:border-indigo-900/60 transition-all">
                  
                  {/* Timestamp header */}
                  <div className="flex justify-between items-center text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wide">
                    <span>
                      {sess.eventType === 'Terms Acceptance' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-250 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 font-extrabold uppercase text-[9px] tracking-wide animate-pulse">
                          Terms & Conditions Accepted
                        </span>
                      ) : (
                        <span>Session #{sessions.length - idx}</span>
                      )}
                    </span>
                    <span>{new Date(sess.timestamp?.toDate?.() || sess.timestamp).toLocaleString()}</span>
                  </div>

                  {/* Visual telemetry grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-700 dark:text-gray-300 font-semibold leading-relaxed">
                    <div className="space-y-1">
                      <p className="truncate"><span className="text-gray-400 dark:text-gray-550 font-extrabold uppercase text-[9px] block">IP Address</span> {sess.ip}</p>
                      <p><span className="text-gray-400 dark:text-gray-555 font-extrabold uppercase text-[9px] block">Country Location</span> {sess.country}</p>
                      {sess.latitude && sess.longitude ? (
                        <p>
                          <span className="text-gray-400 dark:text-gray-550 font-extrabold uppercase text-[9px] block">GPS Coordinates</span>
                          <a 
                            href={`https://www.google.com/maps?q=${sess.latitude},${sess.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-650 hover:underline inline-flex items-center gap-1 font-bold"
                          >
                            <span>{sess.latitude.toFixed(5)}, {sess.longitude.toFixed(5)}</span>
                            <Map className="w-3.5 h-3.5 inline text-indigo-500" />
                          </a>
                        </p>
                      ) : (
                        <p><span className="text-gray-400 dark:text-gray-550 font-extrabold uppercase text-[9px] block">Location Status</span> Geolocation Denied</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <p className="truncate"><span className="text-gray-400 dark:text-gray-550 font-extrabold uppercase text-[9px] block">Browser Platform</span> {sess.userAgent.split(') ')[0]})</p>
                      <p><span className="text-gray-400 dark:text-gray-555 font-extrabold uppercase text-[9px] block">Resolution & Speed</span> {sess.screenResolution} ({sess.connectionType})</p>
                      {sess.details ? (
                        <p className="truncate"><span className="text-emerald-600 dark:text-emerald-400 font-extrabold uppercase text-[9px] block">Log Note</span> <span className="text-emerald-700 dark:text-emerald-450 font-bold">{sess.details}</span></p>
                      ) : (
                        <p><span className="text-gray-400 dark:text-gray-550 font-extrabold uppercase text-[9px] block">System OS & Language</span> {sess.platform} ({sess.language})</p>
                      )}
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-850 flex justify-end shrink-0">
          <button 
            type="button" 
            onClick={onClose}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/10 text-xs font-bold transition-all"
          >
            Done Auditing
          </button>
        </div>
      </div>
    </div>
  );
}
