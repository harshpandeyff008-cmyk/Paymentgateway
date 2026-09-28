import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { db } from '../firebase/config';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc
} from 'firebase/firestore';
import { 
  Key, 
  Loader, 
  Plus, 
  Trash2, 
  Copy, 
  Search, 
  Check, 
  Globe, 
  Terminal, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';

export default function ApiKeys() {
  const { currentUser, userDoc } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Enforce access control: Admin / SuperAdmin only
  useEffect(() => {
    if (userDoc) {
      const hasAccess = userDoc.role === 'superadmin' || userDoc.allowLicenseKeys === true;
      if (!hasAccess) {
        showToast("Access Denied: You do not have permission to manage API keys.", "error");
        navigate('/admin-dashboard');
      }
    }
  }, [userDoc, navigate]);

  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deletingKeyId, setDeletingKeyId] = useState(null);

  // Form State
  const [label, setLabel] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);

  const isSuperAdmin = userDoc?.role === 'superadmin';

  // Real-time listener for API Keys
  useEffect(() => {
    if (!currentUser) return;

    const q = query(collection(db, 'api_keys'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setApiKeys(list);
      setLoading(false);
    }, (error) => {
      console.error("Error subscribing to API keys:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Generate a cryptographically structured API key
  const handleGenerateKey = async (e) => {
    e.preventDefault();
    if (!label.trim()) {
      showToast("Please provide a label for this API Key.", "error");
      return;
    }

    setGenerating(true);
    try {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let randomPart = '';
      for (let i = 0; i < 32; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const generatedKey = `sb_api_${randomPart}`;

      // Save key in Firestore
      await setDoc(doc(db, 'api_keys', generatedKey), {
        keyId: generatedKey,
        label: label.trim(),
        webhookUrl: webhookUrl.trim() || null,
        status: 'active',
        createdAt: new Date().toISOString(),
        createdByUid: currentUser.uid,
        createdByEmail: currentUser.email,
        createdByRole: userDoc?.role || 'admin'
      });

      showToast(`Generated API Key: ${label}`, "success");
      setLabel('');
      setWebhookUrl('');
    } catch (error) {
      console.error("Error generating API Key:", error);
      showToast("Failed to generate API Key.", "error");
    } finally {
      setGenerating(false);
    }
  };

  // Revoke/Delete API Key
  const handleRevokeKey = async (keyDoc) => {
    const isOwner = keyDoc.createdByUid === currentUser.uid;
    if (!isSuperAdmin && !isOwner) {
      showToast("Access Denied: You can only delete API keys that you generated.", "error");
      return;
    }

    if (!window.confirm(`Are you sure you want to revoke the API key "${keyDoc.label}"? Any service using this key will immediately be blocked.`)) {
      return;
    }

    setDeletingKeyId(keyDoc.keyId);
    try {
      await deleteDoc(doc(db, 'api_keys', keyDoc.keyId));
      showToast("API Key revoked successfully.", "success");
    } catch (error) {
      console.error("Error deleting API key:", error);
      showToast("Failed to revoke API key.", "error");
    } finally {
      setDeletingKeyId(null);
    }
  };

  // Copy API Key to clipboard
  const handleCopyKey = (keyId) => {
    navigator.clipboard.writeText(keyId);
    setCopiedKey(keyId);
    showToast("API Key copied to clipboard!", "success");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Filtering
  const filteredKeys = apiKeys.filter(k => 
    k.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    k.keyId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (k.webhookUrl && k.webhookUrl.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex font-sans select-none">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      <div className="flex-1 lg:pl-72 flex flex-col min-w-0 h-screen overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-955/20 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-650 dark:text-indigo-400 shadow-sm shrink-0">
                  <Key className="w-5.5 h-5.5" />
                </div>
                <span>Developer API Keys</span>
              </h2>
              <p className="text-xs text-gray-455 dark:text-gray-500 font-semibold mt-1">
                Manage developer keys to allow third-party websites to automatically request and generate Garena verification license keys.
              </p>
            </div>
          </div>

          {/* Quick Notice Info */}
          <div className="bg-indigo-50/50 dark:bg-indigo-955/10 p-5 rounded-3xl border border-indigo-100 dark:border-indigo-900/30 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100/50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-indigo-955 dark:text-indigo-200 uppercase tracking-wide">Developer Integration</h4>
                <p className="text-[11px] text-indigo-900 dark:text-indigo-400 font-semibold mt-0.5 leading-relaxed">
                  Call the API via <code className="bg-indigo-100 dark:bg-indigo-950 px-1 py-0.5 rounded font-mono text-[10px] text-indigo-655 dark:text-indigo-300">POST /api/license/generate</code> using header <code className="bg-indigo-100 dark:bg-indigo-950 px-1 py-0.5 rounded font-mono text-[10px] text-indigo-655 dark:text-indigo-300">Authorization: Bearer [API_KEY]</code>
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 shadow-sm">
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider mb-4">
              Generate New API Key
            </h3>
            <form onSubmit={handleGenerateKey} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-xs font-bold text-gray-550 dark:text-gray-400 mb-1.5 uppercase font-black">
                  API Key Description / Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. Free Fire Official Store API"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full px-3.5 py-3 text-xs bg-gray-55 dark:bg-gray-800 border border-gray-205 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white font-extrabold shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-550 dark:text-gray-400 mb-1.5 uppercase font-black">
                  Webhook URL (Optional callback)
                </label>
                <input
                  type="url"
                  placeholder="https://my-store.com/webhooks/license"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full px-3.5 py-3 text-xs bg-gray-55 dark:bg-gray-800 border border-gray-205 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white font-extrabold shadow-sm"
                />
              </div>

              <div className="md:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={generating}
                  className="flex items-center justify-center gap-1.5 px-6 py-3 bg-indigo-650 hover:bg-indigo-705 disabled:bg-indigo-400 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-650/15 transition-all"
                >
                  {generating ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>Create API Key</span>
                </button>
              </div>
            </form>
          </div>

          {/* Table list */}
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl shadow-sm overflow-hidden space-y-4">
            {/* Filter */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-855 flex items-center justify-between">
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search API keys..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-gray-55 dark:bg-gray-800 border border-gray-205 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white transition-all font-semibold"
                />
              </div>
            </div>

            {/* List */}
            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center space-y-3">
                <Loader className="w-7 h-7 animate-spin text-indigo-655" />
                <span className="text-xs text-gray-455 font-bold">Synchronizing API credentials...</span>
              </div>
            ) : filteredKeys.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-xs text-gray-400 font-bold">No API keys registered yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 dark:bg-gray-855/20 border-b border-b-gray-100 dark:border-b-gray-855 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                      <th className="px-6 py-3.5">API Key Description</th>
                      <th className="px-6 py-3.5">Access API Token Key</th>
                      <th className="px-6 py-3.5">Webhook Callback URL</th>
                      <th className="px-6 py-3.5">Created Date</th>
                      <th className="px-6 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-855/60 text-xs text-gray-750 dark:text-gray-300">
                    {filteredKeys.map((keyDoc) => {
                      const isOwner = keyDoc.createdByUid === currentUser.uid;
                      const canDelete = isSuperAdmin || isOwner;

                      return (
                        <tr key={keyDoc.id} className="hover:bg-gray-50/30 dark:hover:bg-gray-805/10">
                          {/* Label */}
                          <td className="px-6 py-4">
                            <span className="font-extrabold text-gray-900 dark:text-white block">
                              {keyDoc.label}
                            </span>
                            <span className="text-[9px] text-indigo-550 dark:text-indigo-400 font-bold uppercase mt-0.5 block">
                              Created By: {isOwner ? "You" : keyDoc.createdByEmail}
                            </span>
                          </td>

                          {/* Secret API Key (Masked/Plain with copy button) */}
                          <td className="px-6 py-4 font-mono font-black text-gray-900 dark:text-white flex items-center gap-2">
                            <span className="bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded border border-gray-200/50 dark:border-gray-700/50 text-[11px]">
                              {keyDoc.keyId}
                            </span>
                            <button
                              onClick={() => handleCopyKey(keyDoc.keyId)}
                              className="p-1 text-gray-400 hover:text-indigo-650 dark:hover:text-indigo-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all shrink-0"
                              title="Copy API Key"
                            >
                              {copiedKey === keyDoc.keyId ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </td>

                          {/* Webhook Url */}
                          <td className="px-6 py-4">
                            {keyDoc.webhookUrl ? (
                              <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 font-medium">
                                <Globe className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                <span className="truncate max-w-[200px]" title={keyDoc.webhookUrl}>
                                  {keyDoc.webhookUrl}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-600 italic">None configured</span>
                            )}
                          </td>

                          {/* Date */}
                          <td className="px-6 py-4 font-semibold text-gray-550 dark:text-gray-400">
                            {new Date(keyDoc.createdAt).toLocaleString()}
                          </td>

                          {/* Action */}
                          <td className="px-6 py-4 text-right">
                            <button
                              disabled={deletingKeyId === keyDoc.keyId || !canDelete}
                              onClick={() => handleRevokeKey(keyDoc)}
                              className={`p-2 rounded-xl transition-all ${
                                !canDelete 
                                  ? 'text-gray-200 dark:text-gray-800 cursor-not-allowed'
                                  : 'text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-955/20'
                              }`}
                              title={canDelete ? "Revoke Key" : "Access Denied: You did not generate this key"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
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
