import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import { collection, onSnapshot, query, where, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '../context/ToastContext';
import { 
  Users, 
  Search, 
  Phone, 
  ShieldCheck, 
  Copy, 
  Check, 
  ExternalLink, 
  Calendar, 
  Clock, 
  Sparkles,
  ArrowUpRight,
  UserCheck
} from 'lucide-react';
import { getInstagramDetails } from '../utils/instagramHelper';

const InstagramIcon = ({ className = "w-3 h-3" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
  </svg>
);

export default function UserManagementTable() {
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedNumbers, setCopiedNumbers] = useState(false);

  // Convert Modal State
  const [selectedUser, setSelectedUser] = useState(null);
  const [trialDays, setTrialDays] = useState(2);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    // Real-time listener for users with role 'user'
    const q = query(collection(db, 'users'), where('role', '==', 'user'));
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      list.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA;
      });
      setUsers(list);
      setLoading(false);
    }, (err) => {
      console.error("Users list listener error:", err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(u => 
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q) ||
      (u.instagram || '').toLowerCase().includes(q)
    );
  }, [users, search]);

  const handleCopyAllPhones = () => {
    const validPhones = users
      .map(u => (u.phone || '').trim().replace(/[^0-9]/g, ''))
      .filter(p => p.length >= 10);
    
    if (validPhones.length === 0) {
      showToast("No valid phone numbers found to copy.", "info");
      return;
    }

    const text = validPhones.join('\n');
    navigator.clipboard.writeText(text);
    setCopiedNumbers(true);
    showToast(`Copied ${validPhones.length} WhatsApp numbers to clipboard!`, "success");
    setTimeout(() => setCopiedNumbers(false), 2500);
  };

  const handleConvertToClient = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    setConverting(true);
    try {
      const now = new Date();
      const durationHours = (Number(trialDays) || 2) * 24;
      const expiry = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

      // 1. Update user document
      await updateDoc(doc(db, 'users', selectedUser.id), {
        role: 'client',
        planExpiresAt: expiry.toISOString(),
        isBlocked: false,
        status: 'Active',
        convertedByAdminAt: now.toISOString(),
        updatedAt: serverTimestamp()
      });

      // 2. Create/Update subscription document so they immediately appear in Admin Dashboard & Premium Dashboard
      await setDoc(doc(db, 'subscriptions', selectedUser.id), {
        uid: selectedUser.id,
        productName: `Trial Access (${trialDays} Days)`,
        purchaseDate: now,
        expiryDate: expiry,
        validityDays: Number(trialDays) || 2,
        amountPaid: 0,
        remainingBalance: 0,
        commission: 0,
        commissionPaid: 0,
        status: 'Active',
        notes: `Converted from User Directory with ${trialDays} days trial access`,
        updatedAt: serverTimestamp()
      }, { merge: true });

      showToast(`User ${selectedUser.name || selectedUser.email} successfully upgraded to Client (${trialDays} days trial)!`, "success");
      setSelectedUser(null);
    } catch (err) {
      console.error(err);
      showToast("Failed to promote user to client: " + err.message, "error");
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-500" />
            <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">
              Registered Users Directory ({users.length})
            </h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
            Google authenticated buyers &amp; store visitors. You can promote any user to Client with 1-click.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={handleCopyAllPhones}
            className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-955/40 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            {copiedNumbers ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedNumbers ? 'Copied!' : 'Copy WhatsApp Numbers'}</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, email, WhatsApp, or Instagram handle..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl text-xs font-semibold text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-medium">
            <thead>
              <tr className="bg-gray-50/80 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 text-[10.5px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="p-4">User</th>
                <th className="p-4">WhatsApp / Phone</th>
                <th className="p-4">Instagram</th>
                <th className="p-4">Registered On</th>
                <th className="p-4 text-right">Promote Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-10 text-center text-gray-400">
                    Loading users list...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-10 text-center text-gray-400">
                    No registered users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const cleanPhone = (u.phone || '').trim().replace(/[^0-9]/g, '');
                  const insta = getInstagramDetails(u.instagram);
                  const regDate = u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString('en-IN') : 'Recent';

                  return (
                    <tr key={u.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-black text-xs uppercase">
                            {u.name ? u.name.charAt(0) : 'U'}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white">{u.name || 'Gamer'}</p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        {cleanPhone ? (
                          <a
                            href={`https://wa.me/${cleanPhone}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-955/30 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 font-bold hover:bg-emerald-100 transition-colors"
                          >
                            <Phone className="w-3 h-3" />
                            <span>+{cleanPhone}</span>
                          </a>
                        ) : (
                          <span className="text-gray-400 text-[11px] italic">Not provided</span>
                        )}
                      </td>

                      <td className="p-4">
                        {insta ? (
                          <a
                            href={insta.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-50 dark:bg-pink-955/30 border border-pink-200 dark:border-pink-800/60 text-pink-700 dark:text-pink-300 font-bold hover:bg-pink-100 transition-colors"
                          >
                            <InstagramIcon className="w-3 h-3" />
                            <span>{insta.username}</span>
                          </a>
                        ) : (
                          <span className="text-gray-400 text-[11px] italic">Not provided</span>
                        )}
                      </td>

                      <td className="p-4 text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span>{regDate}</span>
                        </div>
                      </td>

                      <td className="p-4 text-right">
                        <button
                          onClick={() => setSelectedUser(u)}
                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 ml-auto shadow-xs cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Make Client</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Convert To Client Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 shadow-2xl space-y-5">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-800 mb-2">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">
                Promote to Client Access
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Grant <strong>{selectedUser.name || selectedUser.email}</strong> automated OTP &amp; Mailbox monitor access.
              </p>
            </div>

            <form onSubmit={handleConvertToClient} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1.5">
                  Trial Validity (Days)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 7, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setTrialDays(d)}
                      className={`py-2 rounded-xl text-xs font-black uppercase transition-all cursor-pointer ${
                        trialDays === d
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {d} {d === 1 ? 'Day' : 'Days'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={converting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-600/25"
                >
                  {converting ? 'Promoting...' : 'Confirm Upgrade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
