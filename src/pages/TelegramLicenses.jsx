import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useIdleTimer } from '../hooks/useIdleTimer';
import { doc, getDoc, setDoc, query, where, getDocs, collection } from 'firebase/firestore';
import { db } from '../firebase/config';
import { 
  generateTelegramLicenseKeys,
  subscribeToTelegramLicenseKeys,
  deleteTelegramLicenseKey,
  subscribeToTelegramUserSessions,
  deleteTelegramUserSession,
  extendTelegramUserSession,
  subscribeToTelegramBotSettings,
  updateTelegramBotSettings
} from '../firebase/firestore';
import { 
  Send, 
  Plus, 
  Trash2, 
  Clock, 
  User, 
  KeyRound, 
  ShieldCheck, 
  Loader,
  Copy,
  Check,
  Calendar,
  DollarSign,
  ChevronDown,
  Search,
  Power,
  AlertTriangle,
  MessageSquare
} from 'lucide-react';

export default function TelegramLicenses() {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  // 15-minute inactivity session check
  useIdleTimer(900000);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // States
  const [keysList, setKeysList] = useState([]);
  const [sessionsList, setSessionsList] = useState([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Telegram Bot Operations State
  const [botSettings, setBotSettings] = useState({ is_enabled: true, maintenance_message: '' });
  const [savingBotSettings, setSavingBotSettings] = useState(false);
  const [customNotice, setCustomNotice] = useState('');
  const [isEditingNotice, setIsEditingNotice] = useState(false);

  const userDoc = useAuth().userDoc;
  const isSuperAdmin = userDoc?.role === 'superadmin';

  // Form states
  const [keyCount, setKeyCount] = useState(5);
  const [validityDays, setValidityDays] = useState(2);
  const [priceInr, setPriceInr] = useState(300);
  const [generating, setGenerating] = useState(false);

  // Mailbox states
  const [mailboxes, setMailboxes] = useState([]);
  const [selectedMailboxId, setSelectedMailboxId] = useState('auto');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [dropdownPriceFilter, setDropdownPriceFilter] = useState('all');

  // Load verified mailboxes based on Administrator Permissions
  const loadVerifiedMailboxes = async () => {
    try {
      const allVerifiedList = [];
      const assignedList = [];

      const currentUid = currentUser?.uid;
      const userGmails = userDoc?.selectedGmails || [];
      const userZohos = userDoc?.selectedZohos || [];
      const userImaps = userDoc?.selectedImaps || [];

      // Query Gmail
      const qGmail = query(collection(db, 'gmail_credentials'), where('gmail_verified_by_admin', '==', true));
      const snapGmail = await getDocs(qGmail);
      snapGmail.forEach((docSnap) => {
        const data = docSnap.data();
        const mailboxItem = {
          id: docSnap.id,
          email: data.gmail_email,
          type: 'gmail',
          label: `${data.gmail_email} (Gmail)`,
          game_id_name: data.game_id_name || null,
          price_inr: data.price_inr !== undefined ? data.price_inr : null
        };
        allVerifiedList.push(mailboxItem);

        const isAssigned = isSuperAdmin ||
          data.assignedAdminId === currentUid ||
          userGmails.includes(data.gmail_email) ||
          userGmails.includes(docSnap.id);

        if (isAssigned) {
          assignedList.push(mailboxItem);
        }
      });

      // Query Zoho
      const qZoho = query(collection(db, 'zoho_credentials'), where('zoho_verified_by_admin', '==', true));
      const snapZoho = await getDocs(qZoho);
      snapZoho.forEach((docSnap) => {
        const data = docSnap.data();
        const mailboxItem = {
          id: docSnap.id,
          email: data.zoho_email,
          type: 'zoho',
          label: `${data.zoho_email} (Zoho)`,
          game_id_name: data.game_id_name || null,
          price_inr: data.price_inr !== undefined ? data.price_inr : null
        };
        allVerifiedList.push(mailboxItem);

        const isAssigned = isSuperAdmin ||
          data.assignedAdminId === currentUid ||
          userZohos.includes(data.zoho_email) ||
          userZohos.includes(docSnap.id);

        if (isAssigned) {
          assignedList.push(mailboxItem);
        }
      });

      // Query IMAP
      const qImap = query(collection(db, 'imap_credentials'), where('imap_verified_by_admin', '==', true));
      const snapImap = await getDocs(qImap);
      snapImap.forEach((docSnap) => {
        const data = docSnap.data();
        const mailboxItem = {
          id: docSnap.id,
          email: data.imap_email,
          type: 'imap',
          label: `${data.imap_email} (Custom IMAP)`,
          game_id_name: data.game_id_name || null,
          price_inr: data.price_inr !== undefined ? data.price_inr : null
        };
        allVerifiedList.push(mailboxItem);

        const isAssigned = isSuperAdmin ||
          data.assignedAdminId === currentUid ||
          userImaps.includes(data.imap_email) ||
          userImaps.includes(docSnap.id);

        if (isAssigned) {
          assignedList.push(mailboxItem);
        }
      });

      // If user is superadmin or has specific mailboxes assigned, use assignedList.
      // If user has allowLicenseKeys but no specific mailboxes assigned, fallback to allVerifiedList so they aren't blocked!
      const finalList = assignedList.length > 0 ? assignedList : (userDoc?.allowLicenseKeys ? allVerifiedList : []);

      setMailboxes(finalList);
    } catch (err) {
      console.error("Error loading verified mailboxes:", err);
      showToast("Failed to fetch Garena mailboxes.", "error");
    }
  };

  useEffect(() => {
    if (currentUser && userDoc) {
      loadVerifiedMailboxes();
    }
  }, [currentUser, userDoc]);

  useEffect(() => {
    if (selectedMailboxId !== 'auto') {
      const match = mailboxes.find(m => m.id === selectedMailboxId);
      if (match) {
        if (match.price_inr !== null) {
          setPriceInr(match.price_inr);
        }
        setKeyCount(1); // Force key count to 1 for specific mailbox
      }
    }
  }, [selectedMailboxId, mailboxes]);

  // Filter states
  const [keyStatusFilter, setKeyStatusFilter] = useState('All');
  const [copiedKey, setCopiedKey] = useState('');

  // Session extension state
  const [extensionDays, setExtensionDays] = useState({});

  // Telegram bot config states
  const [botTokenInput, setBotTokenInput] = useState('');
  const [savingToken, setSavingToken] = useState(false);

  // Fetch token on load
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const docRef = doc(db, 'system_settings', 'telegram');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setBotTokenInput(docSnap.data().botToken || '');
        }
      } catch (err) {
        console.error("Failed to load Telegram Bot Token:", err);
      }
    };
    fetchToken();
  }, []);

  const handleSaveToken = async (e) => {
    e.preventDefault();
    if (!botTokenInput.trim()) return;
    try {
      setSavingToken(true);
      await setDoc(doc(db, 'system_settings', 'telegram'), {
        botToken: botTokenInput.trim(),
        updatedAt: Date.now()
      }, { merge: true });
      showToast("Telegram Bot Token successfully saved to database!", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to save Telegram Bot Token.", "error");
    } finally {
      setSavingToken(false);
    }
  };

  // Real-time listener: Keys
  useEffect(() => {
    if (!currentUser || !userDoc) return;
    const unsub = subscribeToTelegramLicenseKeys((data) => {
      // Superadmin sees all keys; Admin sees ONLY keys generated by them (or matching their UID/email)
      const filtered = isSuperAdmin
        ? data
        : data.filter(k => k.createdByUid === currentUser.uid || k.createdByEmail === currentUser.email);
      setKeysList(filtered);
      setLoadingKeys(false);
    });
    return () => unsub();
  }, [currentUser, userDoc, isSuperAdmin]);

  // Real-time listener: Sessions
  useEffect(() => {
    const unsub = subscribeToTelegramUserSessions((data) => {
      setSessionsList(data);
      setLoadingSessions(false);
    });
    return () => unsub();
  }, []);

  // Real-time listener: Telegram Bot Global Status (Enable/Disable)
  useEffect(() => {
    const unsub = subscribeToTelegramBotSettings((settings) => {
      setBotSettings(settings);
      setCustomNotice(settings.maintenance_message || '');
    });
    return () => unsub();
  }, []);

  // Expiration countdown ticker
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Actions
  const handleGenerateKeys = async (e) => {
    e.preventDefault();
    let mailboxEmail = '';
    let mailboxType = '';
    
    if (selectedMailboxId !== 'auto') {
      const match = mailboxes.find(m => m.id === selectedMailboxId);
      if (match) {
        mailboxEmail = match.email;
        mailboxType = match.type;
      }
    }

    try {
      setGenerating(true);
      await generateTelegramLicenseKeys(
        keyCount, 
        validityDays, 
        priceInr, 
        mailboxEmail, 
        mailboxType, 
        {
          uid: currentUser.uid,
          email: currentUser.email,
          role: userDoc?.role || 'admin',
          name: userDoc?.name || ''
        }
      );
      showToast(`Successfully generated ${keyCount} Telegram license keys!`, "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to generate license keys.", "error");
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteKey = async (keyDoc) => {
    const keyId = typeof keyDoc === 'string' ? keyDoc : keyDoc?.keyId;
    const docObj = typeof keyDoc === 'object' ? keyDoc : keysList.find(k => k.keyId === keyId);

    const isOwner = docObj?.createdByUid === currentUser?.uid || docObj?.createdByEmail === currentUser?.email;
    if (!isSuperAdmin && !isOwner) {
      showToast("Access Denied: You can only delete keys that you generated.", "error");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete Telegram license key: ${keyId}?`)) return;

    try {
      await deleteTelegramLicenseKey(keyId, currentUser);
      showToast("License key successfully deleted.", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to delete license key.", "error");
    }
  };

  const handleKickSession = async (chatId) => {
    if (!window.confirm(`Are you sure you want to terminate Telegram session for user: ${chatId}?`)) return;

    try {
      await deleteTelegramUserSession(chatId, currentUser);
      showToast("User session successfully terminated.", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to terminate user session.", "error");
    }
  };

  const handleExtendSession = async (chatId) => {
    const days = extensionDays[chatId] || 1;
    if (days < 1) {
      showToast("Please enter a valid number of days.", "warning");
      return;
    }

    try {
      await extendTelegramUserSession(chatId, days, currentUser);
      showToast(`User session extended by ${days} day(s).`, "success");
      setExtensionDays(prev => ({ ...prev, [chatId]: '' }));
    } catch (err) {
      console.error(err);
      showToast("Failed to extend user session.", "error");
    }
  };

  const handleToggleBotStatus = async () => {
    const newStatus = !botSettings.is_enabled;
    const confirmMsg = newStatus 
      ? "Enable Telegram Bot? The bot will resume accepting commands, user activations, and OTP requests."
      : "Disable Telegram Bot? All incoming user messages will receive a maintenance notice and will not be able to activate keys or receive OTPs.";
    
    if (!window.confirm(confirmMsg)) return;

    setSavingBotSettings(true);
    try {
      await updateTelegramBotSettings({
        is_enabled: newStatus,
        maintenance_message: customNotice.trim()
      }, currentUser);
      showToast(newStatus ? "Telegram Bot is now LIVE & ENABLED!" : "Telegram Bot has been DISABLED (Maintenance Mode).", "success");
    } catch (err) {
      console.error("Error updating bot status:", err);
      showToast("Failed to update Telegram Bot status: " + err.message, "error");
    } finally {
      setSavingBotSettings(false);
    }
  };

  const handleSaveNotice = async () => {
    setSavingBotSettings(true);
    try {
      await updateTelegramBotSettings({
        is_enabled: botSettings.is_enabled,
        maintenance_message: customNotice.trim()
      }, currentUser);
      showToast("Maintenance notice saved successfully.", "success");
      setIsEditingNotice(false);
    } catch (err) {
      console.error("Error saving notice:", err);
      showToast("Failed to save notice: " + err.message, "error");
    } finally {
      setSavingBotSettings(false);
    }
  };

  const handleCopyKey = (keyId) => {
    navigator.clipboard.writeText(keyId);
    setCopiedKey(keyId);
    showToast("License key copied to clipboard!", "success");
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const getCountdownText = (expiryTimestamp) => {
    const diff = expiryTimestamp - now;
    if (diff <= 0) return <span className="text-rose-600 dark:text-rose-400 font-bold uppercase tracking-wider">Expired</span>;

    const totalSecs = Math.floor(diff / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    return (
      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
        {hours}h {mins}m {secs}s
      </span>
    );
  };

  const filteredKeys = keysList.filter(k => {
    if (keyStatusFilter === 'All') return true;
    if (keyStatusFilter === 'Active') return k.status === 'active';
    if (keyStatusFilter === 'Redeemed') return k.status === 'redeemed';
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-955 flex font-sans select-none">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      <div className="flex-1 lg:pl-72 flex flex-col min-w-0 h-screen overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-650 dark:text-indigo-400 shadow-sm shrink-0">
                  <Send className="w-5.5 h-5.5" />
                </div>
                <span>Telegram License Manager</span>
              </h2>
              <p className="text-xs text-gray-455 dark:text-gray-500 font-semibold mt-1">
                Generate keys, manage bot status (Enable/Disable), and administer sessions for your Garena OTP Telegram Bot.
              </p>
            </div>
          </div>

          {/* Telegram Bot Operations Banner */}
          <div className={`border rounded-3xl p-5 sm:p-6 shadow-sm transition-all duration-300 ${
            botSettings.is_enabled 
              ? 'bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border-emerald-500/30 dark:border-emerald-500/20' 
              : 'bg-gradient-to-r from-rose-500/15 via-amber-500/5 to-transparent border-rose-500/40 dark:border-rose-500/30'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-colors ${
                  botSettings.is_enabled 
                    ? 'bg-emerald-500 text-white shadow-emerald-500/25' 
                    : 'bg-rose-500 text-white shadow-rose-500/25'
                }`}>
                  <Power className="w-6 h-6" />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-base font-black text-gray-900 dark:text-white tracking-tight">
                      Telegram Bot System
                    </h3>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                      botSettings.is_enabled 
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60' 
                        : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 animate-pulse'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${botSettings.is_enabled ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                      {botSettings.is_enabled ? 'Online & Active' : 'Disabled / Maintenance'}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                    {botSettings.is_enabled 
                      ? 'Bot is actively accepting license activations, retrieving Garena OTPs, and responding to users in Telegram.' 
                      : 'Bot is currently disabled. All incoming user messages receive a scheduled maintenance alert.'}
                  </p>

                  {botSettings.updated_at && (
                    <p className="text-[10px] text-gray-400 font-medium">
                      Last status change: {new Date(botSettings.updated_at).toLocaleString()} {botSettings.updated_by ? `by ${botSettings.updated_by}` : ''}
                    </p>
                  )}
                </div>
              </div>

              {/* Bot Control Actions */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsEditingNotice(!isEditingNotice)}
                  className="px-3.5 py-2 text-xs font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{isEditingNotice ? 'Close Notice' : 'Maintenance Notice'}</span>
                </button>

                <button
                  type="button"
                  disabled={savingBotSettings}
                  onClick={handleToggleBotStatus}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                    botSettings.is_enabled 
                      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20 active:scale-95' 
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 active:scale-95'
                  }`}
                >
                  <Power className={`w-4 h-4 ${savingBotSettings ? 'animate-spin' : ''}`} />
                  <span>{savingBotSettings ? 'Updating...' : botSettings.is_enabled ? 'Disable Bot' : 'Enable Bot'}</span>
                </button>
              </div>
            </div>

            {/* Custom Maintenance Message Editor */}
            {isEditingNotice && (
              <div className="mt-4 pt-4 border-t border-gray-200/70 dark:border-gray-850 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>Custom Maintenance Notice (Sent to users on Telegram when bot is disabled)</span>
                  </label>
                  <span className="text-[10px] text-gray-400 font-mono">HTML tags supported (b, i, code)</span>
                </div>

                <textarea
                  rows={2}
                  value={customNotice}
                  onChange={(e) => setCustomNotice(e.target.value)}
                  placeholder="⚠️ Telegram Bot is currently disabled for scheduled maintenance. Please contact @alexccseller for assistance."
                  className="w-full px-3.5 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingNotice(false)}
                    className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingBotSettings}
                    onClick={handleSaveNotice}
                    className="px-4 py-1.5 bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-black rounded-lg shadow-sm cursor-pointer"
                  >
                    {savingBotSettings ? 'Saving...' : 'Save Notice'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            
            {/* Left Column: Generate License Keys */}
            <div className="xl:col-span-1 space-y-6">
              <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Plus className="w-4 h-4 text-indigo-500" />
                  <span>Generate Telegram Keys</span>
                </h3>

                <form onSubmit={handleGenerateKeys} className="space-y-4">
                  {/* Select Mailbox */}
                  <div className="relative z-30">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                      Select Garena Mailbox
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-extrabold flex items-center justify-between cursor-pointer focus:outline-none"
                    >
                      <span className="truncate">
                        {selectedMailboxId === 'auto' ? (
                          <span className="text-indigo-600 dark:text-indigo-400 font-black">Auto-Allocate Mailbox (Default)</span>
                        ) : (
                          mailboxes.find(m => m.id === selectedMailboxId)?.label || 'Select Mailbox...'
                        )}
                      </span>
                      <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    </button>

                    {isDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                        <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl z-50 p-2.5 space-y-2 max-h-60 overflow-y-auto">
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                              <input
                                type="text"
                                placeholder="Search Garena mailboxes..."
                                value={dropdownSearch}
                                onChange={(e) => setDropdownSearch(e.target.value)}
                                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white font-bold"
                              />
                            </div>
                            <select
                              value={dropdownPriceFilter}
                              onChange={(e) => setDropdownPriceFilter(e.target.value)}
                              className="px-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold text-gray-900 dark:text-white focus:outline-none cursor-pointer"
                            >
                              <option value="all" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">All Prices</option>
                              <option value="300" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">₹300</option>
                              <option value="500" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">₹500</option>
                              <option value="1000" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">₹1000</option>
                            </select>
                          </div>

                          <div className="space-y-1 pt-1">
                            {/* Auto Allocate Option */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedMailboxId('auto');
                                setIsDropdownOpen(false);
                              }}
                              className={`w-full px-3 py-2 text-left text-xs rounded-xl font-black ${
                                selectedMailboxId === 'auto'
                                  ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                              }`}
                            >
                              ⚙️ Auto-Allocate Mailbox (Default)
                            </button>

                            {/* Mailboxes List */}
                            {mailboxes
                              .filter(m => {
                                if (dropdownPriceFilter !== 'all') {
                                  if (Number(m.price_inr) !== Number(dropdownPriceFilter)) return false;
                                }
                                const query = dropdownSearch.toLowerCase();
                                return m.label.toLowerCase().includes(query) || (m.game_id_name || '').toLowerCase().includes(query);
                              })
                              .map(m => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedMailboxId(m.id);
                                    setIsDropdownOpen(false);
                                  }}
                                  className={`w-full px-3 py-2 text-left text-xs rounded-xl font-bold flex items-center justify-between ${
                                    selectedMailboxId === m.id
                                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400'
                                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                                  }`}
                                >
                                  <span className="truncate mr-2">{m.label}</span>
                                  {m.price_inr !== null && (
                                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded-md border border-emerald-200/20 shrink-0">
                                      ₹{m.price_inr}
                                    </span>
                                  )}
                                </button>
                              ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Key Count */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                      Number of Keys
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={keyCount}
                      onChange={(e) => setKeyCount(Number(e.target.value))}
                      disabled={selectedMailboxId !== 'auto'}
                      className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                      required
                    />
                    {selectedMailboxId !== 'auto' && (
                      <p className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold mt-1">
                        Locked to 1 key because a specific mailbox is selected.
                      </p>
                    )}
                  </div>

                  {/* Validity Days */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                      Key Validity (Days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={validityDays}
                      onChange={(e) => setValidityDays(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      required
                    />
                  </div>

                  {/* Price in INR */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                      Price (INR)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={priceInr}
                      onChange={(e) => setPriceInr(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={generating}
                    className="w-full py-3 bg-indigo-650 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md transition-all uppercase tracking-wider cursor-pointer"
                  >
                    {generating ? 'Generating...' : 'Generate Keys'}
                  </button>
                </form>
              </div>

              {/* Telegram Bot Token Config Card */}
              <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Send className="w-4 h-4 text-indigo-500" />
                    <span>Telegram Bot Config</span>
                  </h3>
                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    botSettings.is_enabled
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                  }`}>
                    {botSettings.is_enabled ? '● Online' : '● Disabled'}
                  </span>
                </div>

                <p className="text-xs font-semibold text-gray-555 dark:text-gray-405 leading-normal">
                  Configure the HTTP API Bot Token generated by @BotFather to activate the Telegram bot server.
                </p>

                <form onSubmit={handleSaveToken} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                      Bot Token
                    </label>
                    <input
                      type="text"
                      placeholder="Enter Bot Token (e.g. 123456:ABC-DEF)..."
                      value={botTokenInput}
                      onChange={(e) => setBotTokenInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingToken}
                    className="w-full py-3 bg-indigo-650 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md transition-all uppercase tracking-wider cursor-pointer"
                  >
                    {savingToken ? 'Saving Token...' : 'Save Bot Token'}
                  </button>
                </form>
              </div>
            </div>

            {/* Right Columns: Table and Active Sessions */}
            <div className="xl:col-span-2 space-y-6">
              
              {/* Active Users Table */}
              <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-500" />
                  <span>Active Telegram Sessions</span>
                </h3>

                {loadingSessions ? (
                  <div className="py-8 text-center text-gray-400 flex flex-col items-center gap-2">
                    <Loader className="w-6 h-6 animate-spin text-indigo-500" />
                    <span className="text-[10px] font-bold uppercase">Loading Sessions...</span>
                  </div>
                ) : sessionsList.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-6 font-semibold">No active Telegram bot sessions found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                          <th className="p-3 pl-4">Chat ID</th>
                          <th className="p-3">Assigned Mailbox</th>
                          <th className="p-3">Time Remaining</th>
                          <th className="p-3 text-right pr-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-xs text-gray-700 dark:text-gray-300">
                        {sessionsList.map(session => (
                          <tr key={session.chatId} className="hover:bg-gray-50/30">
                            <td className="p-3 pl-4 font-mono font-bold text-gray-900 dark:text-white">{session.chatId}</td>
                            <td className="p-3 font-semibold truncate max-w-[150px]" title={session.assignedMailboxEmail}>
                              {session.assignedMailboxEmail || 'Unassigned'}
                            </td>
                            <td className="p-3">{getCountdownText(session.licenseExpiry)}</td>
                            <td className="p-3 text-right pr-4">
                              <div className="flex items-center justify-end gap-2">
                                {/* Extend session days form */}
                                <input
                                  type="number"
                                  placeholder="Days"
                                  min="1"
                                  value={extensionDays[session.chatId] || ''}
                                  onChange={(e) => setExtensionDays({ ...extensionDays, [session.chatId]: e.target.value })}
                                  className="w-14 px-2 py-1 text-[10px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white font-bold text-center"
                                />
                                <button
                                  onClick={() => handleExtendSession(session.chatId)}
                                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 text-[10px] font-bold rounded-lg border border-indigo-200/50 dark:border-indigo-900/40"
                                >
                                  Extend
                                </button>
                                <button
                                  onClick={() => handleKickSession(session.chatId)}
                                  className="p-1 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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

              {/* License Keys Ledger */}
              <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-indigo-500" />
                    <span>Telegram License Keys</span>
                  </h3>

                  {/* Filter tabs */}
                  <div className="flex gap-1">
                    {['All', 'Active', 'Redeemed'].map(statusOpt => (
                      <button
                        key={statusOpt}
                        onClick={() => setKeyStatusFilter(statusOpt)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                          keyStatusFilter === statusOpt
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100'
                        }`}
                      >
                        {statusOpt}
                      </button>
                    ))}
                  </div>
                </div>

                {loadingKeys ? (
                  <div className="py-8 text-center text-gray-400 flex flex-col items-center gap-2">
                    <Loader className="w-6 h-6 animate-spin text-indigo-500" />
                    <span className="text-[10px] font-bold uppercase">Loading Keys...</span>
                  </div>
                ) : filteredKeys.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-6 font-semibold">No license keys found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                          <th className="p-3 pl-4">Key ID</th>
                          <th className="p-3">Validity</th>
                          <th className="p-3">Price</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Redemption Account</th>
                          <th className="p-3">Created By</th>
                          <th className="p-3 text-right pr-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-xs text-gray-700 dark:text-gray-300">
                        {filteredKeys.map(keyDoc => (
                          <tr key={keyDoc.keyId} className="hover:bg-gray-50/30">
                            <td className="p-3 pl-4 font-mono font-black text-gray-900 dark:text-white flex items-center gap-2">
                              <span className="bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded border border-gray-200/50 dark:border-gray-700/50">
                                {keyDoc.keyId}
                              </span>
                              <button
                                onClick={() => handleCopyKey(keyDoc.keyId)}
                                className="p-1 text-gray-400 hover:text-indigo-650 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                              >
                                {copiedKey === keyDoc.keyId ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </td>
                            <td className="p-3 font-bold">{keyDoc.validityDays} Days</td>
                            <td className="p-3 font-extrabold text-emerald-650 dark:text-emerald-400">₹{keyDoc.price}</td>
                            <td className="p-3">
                              <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                keyDoc.status === 'redeemed'
                                  ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-200/20'
                                  : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200/20'
                              }`}>
                                {keyDoc.status}
                              </span>
                            </td>
                            <td className="p-3 font-semibold">
                              {keyDoc.status === 'redeemed' ? (
                                <div className="space-y-0.5">
                                  <p className="font-mono text-[10px] text-gray-400 leading-none">Chat: {keyDoc.redeemedByChatId}</p>
                                  <p className="text-[10px] text-indigo-650 dark:text-indigo-400 truncate max-w-[120px]" title={keyDoc.assignedMailboxEmail || keyDoc.assignedMailbox}>
                                    {keyDoc.assignedMailboxEmail || keyDoc.assignedMailbox}
                                  </p>
                                </div>
                              ) : keyDoc.assignedMailbox ? (
                                <div className="space-y-0.5">
                                  <span className="text-gray-400 italic text-[10px] leading-none block mb-0.5">Pre-Assigned Mailbox:</span>
                                  <p className="text-[10px] text-indigo-650 dark:text-indigo-400 truncate max-w-[120px] leading-none font-bold" title={keyDoc.assignedMailbox}>
                                    {keyDoc.assignedMailbox}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-gray-400 italic text-[10px]">Auto-Allocate on signup</span>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {keyDoc.createdByUid === currentUser?.uid ? "You" : keyDoc.createdByEmail || keyDoc.createdByName || "System"}
                              </span>
                              {keyDoc.createdAt && (
                                <span className="block text-[9px] text-gray-400 font-bold mt-0.5">
                                  {new Date(keyDoc.createdAt).toLocaleString()}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right pr-4">
                              <button
                                onClick={() => handleDeleteKey(keyDoc)}
                                className="p-1 text-gray-400 hover:text-rose-600 rounded hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
