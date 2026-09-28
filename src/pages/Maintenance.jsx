import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useIdleTimer } from '../hooks/useIdleTimer';
import { 
  subscribeToBlockedRegions,
  updateBlockedRegions,
  subscribeToBlockedIps,
  updateBlockedIps,
  subscribeToMaintenanceMode,
  updateMaintenanceMode
} from '../firebase/firestore';
import { 
  ShieldAlert, 
  Clock, 
  Trash2, 
  Shield, 
  Wrench,
  Globe,
  MapPin,
  Lock,
  CheckCircle2,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", 
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", 
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", 
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", 
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry"
];

export default function Maintenance() {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  // Register inactivity logout timer (15 minutes)
  useIdleTimer(900000);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [activeTab, setActiveTab] = useState('ip-block'); // 'ip-block' | 'region-block'

  // Geofencing states
  const [blockedStates, setBlockedStates] = useState([]);
  const [geofencingLoading, setGeofencingLoading] = useState(false);

  // IP Ban states
  const [blockedIps, setBlockedIps] = useState([]);
  const [ipInput, setIpInput] = useState('');
  const [ipBanLoading, setIpBanLoading] = useState(false);

  // Maintenance states
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [allowAdminLogin, setAllowAdminLogin] = useState(true);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  useEffect(() => {
    const unsub = subscribeToBlockedRegions((states) => {
      setBlockedStates(states);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeToBlockedIps((ips) => {
      setBlockedIps(ips);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeToMaintenanceMode((data) => {
      setMaintenanceMode(data.maintenanceMode || false);
      setMaintenanceMessage(data.maintenanceMessage || '');
      setAllowAdminLogin(data.allowAdminLogin !== false);
    });
    return () => unsub();
  }, []);

  const handleAddIpBan = async (e) => {
    e.preventDefault();
    if (!ipInput.trim()) return;

    const ipv4Regex = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/;
    if (!ipv4Regex.test(ipInput.trim())) {
      showToast("Please enter a valid IPv4 address.", "error");
      return;
    }

    if (blockedIps.includes(ipInput.trim())) {
      showToast("This IP is already banned.", "warning");
      return;
    }

    const updatedIps = [...blockedIps, ipInput.trim()];
    try {
      setIpBanLoading(true);
      await updateBlockedIps(updatedIps, currentUser);
      showToast(`IP ${ipInput.trim()} successfully banned!`, "success");
      setIpInput('');
    } catch (err) {
      console.error(err);
      showToast("Failed to ban IP address.", "error");
    } finally {
      setIpBanLoading(false);
    }
  };

  const handleRemoveIpBan = async (ipToRemove) => {
    if (!window.confirm(`Are you sure you want to unban IP: ${ipToRemove}?`)) return;

    const updatedIps = blockedIps.filter(ip => ip !== ipToRemove);
    try {
      setIpBanLoading(true);
      await updateBlockedIps(updatedIps, currentUser);
      showToast(`IP ${ipToRemove} successfully unbanned.`, "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to unban IP address.", "error");
    } finally {
      setIpBanLoading(false);
    }
  };

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
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-955/40 border border-indigo-105 dark:border-indigo-900/50 flex items-center justify-center text-indigo-650 dark:text-indigo-400 shadow-sm shrink-0">
                  <Wrench className="w-5.5 h-5.5" />
                </div>
                <span>Portal Maintenance & Security</span>
              </h2>
              <p className="text-xs text-gray-455 dark:text-gray-500 font-semibold mt-1">
                Configure regional blocks, IP bans, and maintenance mode systems.
              </p>
            </div>
          </div>

          {/* Grid Layout for Settings Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left Column: Geofencing Block */}
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-900/40 shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                      Geofencing Controls (India)
                    </h3>
                    <p className="text-[10px] text-gray-400 font-bold">
                      Block access to clients from specific Indian states
                    </p>
                  </div>
                </div>

                <p className="text-xs font-semibold text-gray-555 dark:text-gray-400 leading-normal">
                  Select the Indian states where you want to **block/stop** website access for clients.
                </p>

                <div className="grid grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1 border border-gray-100 dark:border-gray-855 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-855/20">
                  {INDIAN_STATES.map((state) => {
                    const isChecked = blockedStates.some(s => s.toLowerCase() === state.toLowerCase());
                    return (
                      <label 
                        key={state} 
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer select-none transition-all ${
                          isChecked 
                            ? 'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400' 
                            : 'bg-white dark:bg-gray-900 border-gray-150 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={async (e) => {
                            let newBlocked = [...blockedStates];
                            if (e.target.checked) {
                              newBlocked.push(state);
                            } else {
                              newBlocked = newBlocked.filter(s => s.toLowerCase() !== state.toLowerCase());
                            }
                            
                            try {
                              setGeofencingLoading(true);
                              await updateBlockedRegions(newBlocked, currentUser);
                              showToast(`Geofencing updated: ${state} has been ${e.target.checked ? 'blocked' : 'unblocked'}.`, 'success');
                            } catch (err) {
                              console.error(err);
                              showToast("Failed to save geofencing configurations.", "error");
                            } finally {
                              setGeofencingLoading(false);
                            }
                          }}
                          disabled={geofencingLoading}
                          className="w-3.5 h-3.5 text-rose-600 rounded border-gray-300 focus:ring-rose-500/20 cursor-pointer"
                        />
                        <span className="truncate">{state}</span>
                      </label>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-555 font-bold uppercase tracking-wider">
                  <span>Blocked: {blockedStates.length} States</span>
                  {blockedStates.length > 0 && (
                    <button
                      onClick={async () => {
                        if (window.confirm("Are you sure you want to clear all blocked states? This will restore service access in all regions of India.")) {
                          try {
                            setGeofencingLoading(true);
                            await updateBlockedRegions([], currentUser);
                            showToast("All regions successfully unblocked.", "success");
                          } catch (err) {
                            console.error(err);
                            showToast("Failed to clear geofencing rules.", "error");
                          } finally {
                            setGeofencingLoading(false);
                          }
                        }
                      }}
                      disabled={geofencingLoading}
                      className="text-indigo-650 dark:text-indigo-400 hover:underline"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: IP Ban & Maintenance Mode */}
            <div className="space-y-6">
              
              {/* IP Banning Card */}
              <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-900/40 shrink-0">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                      Particular IP Banning
                    </h3>
                    <p className="text-[10px] text-gray-400 font-bold">
                      Restrict specific client IP addresses from website access
                    </p>
                  </div>
                </div>

                <p className="text-xs font-semibold text-gray-555 dark:text-gray-400 leading-normal">
                  Ban specific client IP addresses from accessing the storefront.
                </p>

                <form onSubmit={handleAddIpBan} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter particular IP (e.g. 192.168.1.1)..."
                    value={ipInput}
                    onChange={(e) => setIpInput(e.target.value)}
                    disabled={ipBanLoading}
                    className="flex-1 px-3.5 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                  <button
                    type="submit"
                    disabled={ipBanLoading || !ipInput.trim()}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white font-bold text-xs rounded-xl shadow-md transition-all whitespace-nowrap cursor-pointer"
                  >
                    Ban IP
                  </button>
                </form>

                {/* Banned IPs list */}
                {blockedIps.length === 0 ? (
                  <p className="text-[10px] font-semibold text-gray-400 italic">No IP addresses are currently banned.</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {blockedIps.map((ip) => (
                      <div
                        key={ip}
                        className="flex items-center justify-between px-3 py-2 bg-rose-50 dark:bg-rose-900/30 border border-rose-100 dark:border-rose-900/40 rounded-xl"
                      >
                        <span className="font-mono text-xs font-extrabold text-rose-700 dark:text-rose-400">{ip}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveIpBan(ip)}
                          disabled={ipBanLoading}
                          className="text-[10px] font-black text-rose-600 hover:text-rose-700 dark:hover:text-rose-400 uppercase tracking-wider cursor-pointer"
                        >
                          Unban
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Maintenance Mode Card */}
              <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 shadow-sm space-y-5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-900/40 shrink-0">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                      System Status &amp; Maintenance Controls
                    </h3>
                    <p className="text-[10px] text-gray-400 font-bold">
                      Control live storefront maintenance and administrator dashboard access
                    </p>
                  </div>
                </div>

                {/* Status Summary Banner */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2.5 ${
                    maintenanceMode 
                      ? 'bg-rose-50 dark:bg-rose-955/20 border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300' 
                      : 'bg-emerald-50 dark:bg-emerald-955/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                  }`}>
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${maintenanceMode ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                    <div>
                      <span className="block text-[9.5px] uppercase tracking-wider opacity-80">Public Storefront</span>
                      <span>{maintenanceMode ? 'In Maintenance (Blocked)' : 'Live & Operational'}</span>
                    </div>
                  </div>

                  <div className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2.5 ${
                    allowAdminLogin 
                      ? 'bg-emerald-50 dark:bg-emerald-955/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300' 
                      : 'bg-amber-50 dark:bg-amber-955/20 border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-300'
                  }`}>
                    <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-500" />
                    <div>
                      <span className="block text-[9.5px] uppercase tracking-wider opacity-80">Admin &amp; Staff Portal</span>
                      <span>{allowAdminLogin ? 'Dashboard Accessible' : 'Restricted'}</span>
                    </div>
                  </div>
                </div>

                {/* Option 1: Global Storefront Maintenance Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-850/20 border border-gray-100 dark:border-gray-800 rounded-2xl">
                  <div>
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block uppercase">Global Storefront Maintenance</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-550 block font-medium leading-normal mt-0.5 max-w-[220px]">
                      Shows system maintenance notice to visitors &amp; buyers across all public pages.
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={maintenanceMode}
                      disabled={maintenanceLoading}
                      onChange={async (e) => {
                        const nextVal = e.target.checked;
                        try {
                          setMaintenanceLoading(true);
                          await updateMaintenanceMode(nextVal, maintenanceMessage, currentUser, allowAdminLogin);
                          showToast(`Maintenance mode successfully ${nextVal ? 'enabled' : 'disabled'}.`, 'success');
                        } catch (err) {
                          console.error(err);
                          showToast("Failed to toggle maintenance mode.", "error");
                        } finally {
                          setMaintenanceLoading(false);
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 dark:bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-650"></div>
                  </label>
                </div>

                {/* Option 2: Allow Admin Dashboard Login (New Option Requested) */}
                <div className="flex items-center justify-between p-4 bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 uppercase">Admin Dashboard Login Access</span>
                      <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/50 text-[9px] font-black text-indigo-700 dark:text-indigo-300 uppercase">New Option</span>
                    </div>
                    <span className="text-[10px] text-indigo-700/80 dark:text-indigo-300/70 block font-medium leading-normal mt-0.5 max-w-[240px]">
                      When ON, Admins &amp; Staff can freely sign in at <code className="font-mono bg-indigo-100/70 dark:bg-indigo-900/60 px-1 rounded text-[9.5px]">/login</code> and manage the dashboard while users see maintenance.
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={allowAdminLogin}
                      disabled={maintenanceLoading}
                      onChange={async (e) => {
                        const nextVal = e.target.checked;
                        try {
                          setMaintenanceLoading(true);
                          setAllowAdminLogin(nextVal);
                          await updateMaintenanceMode(maintenanceMode, maintenanceMessage, currentUser, nextVal);
                          showToast(`Admin dashboard access during maintenance ${nextVal ? 'enabled' : 'disabled'}.`, 'success');
                        } catch (err) {
                          console.error(err);
                          showToast("Failed to update admin access setting.", "error");
                        } finally {
                          setMaintenanceLoading(false);
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 dark:bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-650"></div>
                  </label>
                </div>

                {/* Direct Admin Login Quick Link */}
                <div className="p-3 bg-gray-50 dark:bg-gray-800/40 border border-gray-150 dark:border-gray-800 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="font-bold text-gray-700 dark:text-gray-300 text-[11px]">Staff Login Portal:</span>
                    <code className="text-gray-500 font-mono text-[10px]">/login</code>
                  </div>
                  <a
                    href="/login"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <span>Open Login</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Maintenance Message */}
                {maintenanceMode && (
                  <div className="space-y-2.5 animate-fade-in pt-1 border-t border-gray-100 dark:border-gray-800">
                    <div>
                      <label className="block text-xs font-bold text-gray-555 dark:text-gray-455 mb-1.5 uppercase">
                        Maintenance Notice Message (Shown to Users)
                      </label>
                      <textarea
                        value={maintenanceMessage}
                        onChange={(e) => setMaintenanceMessage(e.target.value)}
                        placeholder="e.g. System is upgrading databases, we will be back online shortly."
                        rows="2"
                        className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-750 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-black dark:text-white font-bold transition-all border-indigo-250 dark:border-indigo-900/60"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          setMaintenanceLoading(true);
                          await updateMaintenanceMode(true, maintenanceMessage, currentUser, allowAdminLogin);
                          showToast("Maintenance notice successfully updated.", "success");
                        } catch (err) {
                          console.error(err);
                          showToast("Failed to save notice.", "error");
                        } finally {
                          setMaintenanceLoading(false);
                        }
                      }}
                      disabled={maintenanceLoading}
                      className="w-full py-2 bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-all uppercase tracking-wider cursor-pointer"
                    >
                      Update Message
                    </button>
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
