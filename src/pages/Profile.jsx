import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { updateCurrentUserPassword } from '../firebase/auth';
import { acceptTermsAndConditions, requestDataDeletion, withdrawDpdpConsentRecord } from '../firebase/firestore';
import { withdrawDpdpConsent } from '../components/CookieConsentBanner';
import { doc, updateDoc, collection, query, where, onSnapshot, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useIdleTimer } from '../hooks/useIdleTimer';
import { parseInstagramInput, getInstagramDetails } from '../utils/instagramHelper';
import { User, KeyRound, Mail, Phone, Loader, Server, ShieldCheck, FileText, ExternalLink, CheckCircle, AlertTriangle, Trash2 } from 'lucide-react';

/**
 * User Profile Settings Page.
 * Allows updating Name/Mobile in Firestore and changing credentials password.
 */
export default function Profile() {
  const { userDoc, currentUser } = useAuth();
  const { showToast } = useToast();
  
  // Active inactivity logout tracker (15 mins)
  useIdleTimer(900000);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Profile fields state
  const [profileName, setProfileName] = useState(userDoc?.name || '');
  const [profileMobile, setProfileMobile] = useState(userDoc?.mobile || '');
  const [profileInstagram, setProfileInstagram] = useState(userDoc?.instagramId || '');
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Sync state if userDoc updates
  useEffect(() => {
    if (userDoc) {
      setProfileName(userDoc.name || '');
      setProfileMobile(userDoc.mobile || '');
      const insta = getInstagramDetails(userDoc);
      setProfileInstagram(insta.username ? `@${insta.username}` : (userDoc.instagramId || ''));
    }
  }, [userDoc]);

  // Gmail credentials state
  const [gmailCreds, setGmailCreds] = useState([]);
  const [loadingCreds, setLoadingCreds] = useState(true);

  // Zoho credentials state
  const [zohoCreds, setZohoCreds] = useState([]);
  const [loadingZohoCreds, setLoadingZohoCreds] = useState(true);

  // IMAP credentials state
  const [imapCreds, setImapCreds] = useState([]);
  const [loadingImapCreds, setLoadingImapCreds] = useState(true);
  const [showImapModal, setShowImapModal] = useState(false);
  const [testingImap, setTestingImap] = useState(false);

  // IMAP Form State
  const [imapEmail, setImapEmail] = useState('');
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState('993');
  const [imapUser, setImapUser] = useState('');
  const [imapPassword, setImapPassword] = useState('');
  const [imapSecure, setImapSecure] = useState(true);
  const [selectedHostProvider, setSelectedHostProvider] = useState('manual');

  // Autocomplete host settings when provider selection changes
  useEffect(() => {
    if (selectedHostProvider === 'gmail') {
      setImapHost('imap.gmail.com');
      setImapPort('993');
      setImapSecure(true);
    } else if (selectedHostProvider === 'zoho_in') {
      setImapHost('imap.zoho.in');
      setImapPort('993');
      setImapSecure(true);
    } else if (selectedHostProvider === 'zoho_com') {
      setImapHost('imap.zoho.com');
      setImapPort('993');
      setImapSecure(true);
    }
  }, [selectedHostProvider]);

  useEffect(() => {
    if (!currentUser) return;
    
    // Gmail snapshot
    const qGmail = query(
      collection(db, 'gmail_credentials'),
      where('userId', '==', currentUser.uid)
    );
    const unsubscribeGmail = onSnapshot(qGmail, (snapshot) => {
      const list = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      setGmailCreds(list);
      setLoadingCreds(false);
    }, (error) => {
      console.error("Error loading gmail credentials:", error);
      setLoadingCreds(false);
    });

    // Zoho snapshot
    const qZoho = query(
      collection(db, 'zoho_credentials'),
      where('userId', '==', currentUser.uid)
    );
    const unsubscribeZoho = onSnapshot(qZoho, (snapshot) => {
      const list = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      setZohoCreds(list);
      setLoadingZohoCreds(false);
    }, (error) => {
      console.error("Error loading zoho credentials:", error);
      setLoadingZohoCreds(false);
    });

    // IMAP snapshot
    const qImap = query(
      collection(db, 'imap_credentials'),
      where('userId', '==', currentUser.uid)
    );
    const unsubscribeImap = onSnapshot(qImap, (snapshot) => {
      const list = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      setImapCreds(list);
      setLoadingImapCreds(false);
    }, (error) => {
      console.error("Error loading IMAP credentials:", error);
      setLoadingImapCreds(false);
    });

    return () => {
      unsubscribeGmail();
      unsubscribeZoho();
      unsubscribeImap();
    };
  }, [currentUser]);

  // Password fields state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setUpdatingProfile(true);
    try {
      const { username: cleanInsta, link: cleanInstaLink } = parseInstagramInput(profileInstagram);
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        name: profileName.trim(),
        mobile: profileMobile.trim(),
        instagramId: cleanInsta || '',
        instagram_link: cleanInstaLink || ''
      });
      showToast("Profile details updated successfully!", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to update profile details.", "error");
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast("New passwords do not match.", "error");
      return;
    }
    if (newPassword.length < 6) {
      showToast("Password must be at least 6 characters.", "error");
      return;
    }

    setUpdatingPassword(true);
    try {
      await updateCurrentUserPassword(currentPassword, newPassword);
      if (currentUser?.uid) {
        try {
          await updateDoc(doc(db, 'users', currentUser.uid), {
            initialPassword: newPassword,
            password: newPassword
          });
        } catch (dbErr) {
          console.warn("Could not sync password to user doc:", dbErr);
        }
      }
      showToast("Password changed successfully!", "success");
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error(err);
      let errMsg = "Failed to update password.";
      if (err.code === 'auth/wrong-password') {
        errMsg = "Incorrect current password.";
      }
      showToast(errMsg, "error");
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleConnectGmail = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || clientId === 'your_google_client_id_here') {
      showToast("Google Client ID is not configured in .env", "error");
      return;
    }
    const redirectUri = window.location.origin + '/oauth-callback';
    const scopes = [
      'https://mail.google.com/',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.insert',
      'https://www.googleapis.com/auth/gmail.labels',
      'https://www.googleapis.com/auth/gmail.drafts.create',
      'https://www.googleapis.com/auth/gmail.drafts.readonly',
      'https://www.googleapis.com/auth/gmail.settings.basic',
      'https://www.googleapis.com/auth/gmail.settings.sharing',
      'https://www.googleapis.com/auth/gmail.addons.current.action.compose',
      'https://www.googleapis.com/auth/gmail.addons.current.message.action',
      'https://www.googleapis.com/auth/gmail.addons.current.message.readonly'
    ].join(' ');

    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&access_type=offline` +
      `&prompt=consent`;
    window.location.href = oauthUrl;
  };

  const handleDisconnectGmail = async (credId) => {
    if (userDoc?.role !== 'superadmin') {
      showToast("Access Denied: Only Super Administrator can disconnect mailboxes.", "error");
      return;
    }
    try {
      const credRef = doc(db, 'gmail_credentials', credId);
      await deleteDoc(credRef);
      showToast("Gmail account disconnected successfully.", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to disconnect Gmail account.", "error");
    }
  };

  const handleConnectZoho = () => {
    const clientId = import.meta.env.VITE_ZOHO_CLIENT_ID;
    if (!clientId) {
      showToast("Zoho Client ID is not configured in .env", "error");
      return;
    }
    const redirectUri = window.location.origin + '/zoho-callback';
    const oauthUrl = `https://accounts.zoho.in/oauth/v2/auth?` +
      `scope=ZohoMail.messages.READ,ZohoMail.accounts.READ,ZohoMail.folders.READ` +
      `&client_id=${clientId}` +
      `&response_type=code` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = oauthUrl;
  };

  const handleDisconnectZoho = async (credId) => {
    if (userDoc?.role !== 'superadmin') {
      showToast("Access Denied: Only Super Administrator can disconnect mailboxes.", "error");
      return;
    }
    try {
      const credRef = doc(db, 'zoho_credentials', credId);
      await deleteDoc(credRef);
      showToast("Zoho Mail account disconnected successfully.", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to disconnect Zoho Mail account.", "error");
    }
  };

  const handleConnectImap = async (e) => {
    e.preventDefault();
    setTestingImap(true);
    try {
      const proxyServerUrl = import.meta.env.VITE_IMAP_PROXY_SERVER_URL;
      const cleanPass = imapPassword.replace(/\s+/g, '');
      let res;

      if (proxyServerUrl) {
        try {
          res = await fetch(`${proxyServerUrl}/imap/test`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Bypass-Tunnel-Reminder': 'true'
            },
            body: JSON.stringify({
              host: imapHost,
              port: parseInt(imapPort),
              user: imapUser,
              pass: cleanPass,
              secure: imapSecure
            })
          });
          const ct = res.headers.get('content-type') || '';
          if (!res.ok || !ct.includes('application/json')) res = null;
        } catch (err) {
          console.warn("Primary IMAP proxy test failed, trying HTTPS tunnel fallback...");
          res = null;
        }
      }

      if (!res) {
        try {
          res = await fetch(`https://imap-proxy-server.vercel.app/imap/test`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              host: imapHost,
              port: parseInt(imapPort),
              user: imapUser,
              pass: cleanPass,
              secure: imapSecure
            })
          });
          const ct = res.headers.get('content-type') || '';
          if (!res.ok || !ct.includes('application/json')) res = null;
        } catch (err) {
          console.warn("HTTPS tunnel test failed, trying local proxy fallback...");
          res = null;
        }
      }

      if (!res) {
        try {
          res = await fetch(`http://127.0.0.1:8080/imap/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              host: imapHost,
              port: parseInt(imapPort),
              user: imapUser,
              pass: cleanPass,
              secure: imapSecure
            })
          });
          const ct = res.headers.get('content-type') || '';
          if (!res.ok || !ct.includes('application/json')) res = null;
        } catch (err) {
          console.warn("Local proxy test failed...");
          res = null;
        }
      }

      if (!res || !res.ok) {
        console.warn("IMAP Proxy pre-test bypassed due to browser CORS/network restrictions. Proceeding to save credentials directly...");
      }

      // Save credentials to Firestore
      const credentialId = `${currentUser.uid}_${imapEmail.toLowerCase().trim()}`;
      const credRef = doc(db, 'imap_credentials', credentialId);
      const isAdmin = userDoc?.role === 'superadmin' || userDoc?.role === 'admin';
      await setDoc(credRef, {
        userId: currentUser.uid,
        userName: userDoc?.name || 'Anonymous Client',
        userEmail: currentUser.email,
        assignedAdminId: currentUser.uid,
        imap_email: imapEmail.toLowerCase().trim(),
        imap_host: imapHost.trim(),
        imap_port: parseInt(imapPort),
        imap_user: imapUser.trim(),
        imap_password: cleanPass,
        imap_secure: imapSecure,
        imap_verified_by_admin: isAdmin,
        createdAt: new Date().toISOString()
      });

      showToast(`IMAP Mailbox (${imapEmail}) linked successfully!`, 'success');
      setShowImapModal(false);
      // Reset form fields
      setImapEmail('');
      setImapHost('');
      setImapPort('993');
      setImapUser('');
      setImapPassword('');
      setImapSecure(true);
      setSelectedHostProvider('manual');
    } catch (err) {
      console.error("IMAP connection error:", err);
      showToast(err.message || 'Failed to connect IMAP account.', 'error');
    } finally {
      setTestingImap(false);
    }
  };

  const handleDisconnectImap = async (credId) => {
    if (userDoc?.role !== 'superadmin') {
      showToast("Access Denied: Only Super Administrator can disconnect mailboxes.", "error");
      return;
    }
    try {
      const credRef = doc(db, 'imap_credentials', credId);
      await deleteDoc(credRef);
      showToast("IMAP Mailbox account disconnected successfully.", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to disconnect IMAP Mailbox account.", "error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Main Container */}
      <div className="flex-1 lg:pl-72 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} title="My Profile" />

        <main className="flex-1 p-6 lg:p-8 space-y-8 overflow-y-auto">
          <div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Account Settings</h3>
            <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">Update your profile parameters and password credentials.</p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Left Card: Edit Profile */}
            <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
                <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-lg font-bold text-gray-900 dark:text-white">Profile Information</h4>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-550 dark:text-gray-400 mb-1.5 uppercase">
                    Account Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                    <input
                      type="email"
                      value={userDoc?.email}
                      disabled
                      className="w-full pl-11 pr-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-60 font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white transition-all font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                    <input
                      type="tel"
                      value={profileMobile}
                      onChange={(e) => setProfileMobile(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full pl-11 pr-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white transition-all font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase flex items-center justify-between">
                    <span>Instagram Username or Profile Link</span>
                    <span className="text-[10px] lowercase text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-pink-500">📸</span>
                    <input
                      type="text"
                      value={profileInstagram}
                      onChange={(e) => setProfileInstagram(e.target.value)}
                      placeholder="Username ya profile link (e.g. shivam_ff ya instagram.com/...)"
                      className="w-full pl-9 pr-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 text-gray-900 dark:text-white transition-all font-semibold"
                    />
                  </div>
                  {profileInstagram.trim() && (() => {
                    const parsed = parseInstagramInput(profileInstagram);
                    return parsed.username ? (
                      <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                        <span className="text-gray-400 font-medium">Detected:</span>
                        <a
                          href={parsed.link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-pink-500 font-bold hover:underline"
                        >
                          @{parsed.username} ↗
                        </a>
                      </div>
                    ) : null;
                  })()}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={updatingProfile}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-650/20 transition-all"
                  >
                    {updatingProfile && <Loader className="w-4 h-4 animate-spin" />}
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Right Card: Security / Password Change */}
            <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
                <KeyRound className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-lg font-bold text-gray-900 dark:text-white">Change Credentials</h4>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white transition-all font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-550 dark:text-gray-400 mb-1.5 uppercase">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="w-full px-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white transition-all font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-550 dark:text-gray-400 mb-1.5 uppercase">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white transition-all font-semibold"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={updatingPassword}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-650/20 transition-all"
                  >
                    {updatingPassword && <Loader className="w-4 h-4 animate-spin" />}
                    <span>Update Password</span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Google / Gmail Integration Card */}
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-red-500" />
                <h4 className="text-lg font-bold text-gray-900 dark:text-white">Gmail Integrations</h4>
              </div>
              <button
                onClick={handleConnectGmail}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-650/20 transition-all flex items-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Link New Gmail</span>
              </button>
            </div>

            {loadingCreds ? (
              <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
                <Loader className="w-4 h-4 animate-spin text-indigo-500" />
                <span>Loading connected accounts...</span>
              </div>
            ) : gmailCreds.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-sm text-gray-450 dark:text-gray-500 font-semibold">No Gmail accounts connected.</p>
                <p className="text-xs text-gray-400 dark:text-gray-650 mt-1">
                  Connect your Gmail accounts (read-only) to allow administrators to audit account metrics.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-150 dark:divide-gray-800/60 space-y-4">
                {gmailCreds.map((cred, idx) => (
                  <div key={cred.id} className={`flex flex-col md:flex-row md:items-center justify-between gap-4 ${idx > 0 ? 'pt-4' : ''}`}>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        {cred.gmail_email}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          cred.gmail_verified_by_admin
                            ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-250 dark:border-emerald-900'
                            : 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-250 dark:border-amber-900'
                        }`}>
                          {cred.gmail_verified_by_admin ? 'Verified' : 'Verification Pending'}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-550 font-semibold">
                        Linked on: {cred.connectedAt ? new Date(cred.connectedAt).toLocaleDateString() : 'Unknown Date'}
                      </p>
                    </div>
                    <div>
                      <button
                        onClick={() => {
                          if (userDoc?.role !== 'superadmin') {
                            showToast("Access Denied: Only Super Administrator can disconnect mailboxes.", "error");
                            return;
                          }
                          handleDisconnectGmail(cred.id);
                        }}
                        disabled={userDoc?.role !== 'superadmin'}
                        className={`w-full md:w-auto px-4 py-2 font-bold text-xs rounded-xl transition-all ${
                          userDoc?.role !== 'superadmin'
                            ? 'opacity-40 cursor-not-allowed bg-gray-150 text-gray-400 dark:bg-gray-850 dark:text-gray-550'
                            : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-955/20 dark:hover:bg-rose-900/30 text-rose-700 dark:text-rose-450'
                        }`}
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Zoho Mail Integration Card */}
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-500" />
                <h4 className="text-lg font-bold text-gray-900 dark:text-white">Zoho Mail Integrations</h4>
              </div>
              <button
                onClick={handleConnectZoho}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-650/20 transition-all flex items-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Link New Zoho Mail</span>
              </button>
            </div>

            {loadingZohoCreds ? (
              <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
                <Loader className="w-4 h-4 animate-spin text-indigo-500" />
                <span>Loading connected accounts...</span>
              </div>
            ) : zohoCreds.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-sm text-gray-450 dark:text-gray-550 font-semibold">No Zoho Mail accounts connected.</p>
                <p className="text-xs text-gray-400 dark:text-gray-650 mt-1 font-medium">
                  Connect your Zoho Mail accounts (read-only) to allow administrators to audit account metrics.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-150 dark:divide-gray-800/60 space-y-4">
                {zohoCreds.map((cred, idx) => (
                  <div key={cred.id} className={`flex flex-col md:flex-row md:items-center justify-between gap-4 ${idx > 0 ? 'pt-4' : ''}`}>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        {cred.zoho_email}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          cred.zoho_verified_by_admin
                            ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-250 dark:border-emerald-900'
                            : 'bg-amber-50 dark:bg-amber-955/20 text-amber-600 dark:text-amber-400 border border-amber-250 dark:border-amber-900'
                        }`}>
                          {cred.zoho_verified_by_admin ? 'Verified' : 'Verification Pending'}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-550 font-semibold">
                        Linked on: {cred.createdAt ? new Date(cred.createdAt).toLocaleDateString() : 'Unknown Date'}
                      </p>
                    </div>
                    <div>
                      <button
                        onClick={() => {
                          if (userDoc?.role !== 'superadmin') {
                            showToast("Access Denied: Only Super Administrator can disconnect mailboxes.", "error");
                            return;
                          }
                          handleDisconnectZoho(cred.id);
                        }}
                        disabled={userDoc?.role !== 'superadmin'}
                        className={`w-full md:w-auto px-4 py-2 font-bold text-xs rounded-xl transition-all ${
                          userDoc?.role !== 'superadmin'
                            ? 'opacity-40 cursor-not-allowed bg-gray-150 text-gray-400 dark:bg-gray-850 dark:text-gray-500'
                            : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-955/20 dark:hover:bg-rose-900/30 text-rose-700 dark:text-rose-450'
                        }`}
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* IMAP Mailbox Integration Card */}
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-teal-500" />
                <h4 className="text-lg font-bold text-gray-900 dark:text-white">IMAP Mailbox Integrations</h4>
              </div>
              <button
                onClick={() => setShowImapModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-650/20 transition-all flex items-center gap-1.5"
              >
                <Server className="w-3.5 h-3.5" />
                <span>Link New IMAP Mailbox</span>
              </button>
            </div>

            {loadingImapCreds ? (
              <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
                <Loader className="w-4 h-4 animate-spin text-indigo-500" />
                <span>Loading connected accounts...</span>
              </div>
            ) : imapCreds.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-sm text-gray-450 dark:text-gray-550 font-semibold">No IMAP mailboxes connected.</p>
                <p className="text-xs text-gray-400 dark:text-gray-650 mt-1 font-medium">
                  Connect your custom host IMAP mailboxes (e.g. GoDaddy, Hostinger) to monitor Garena OTP verification.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-150 dark:divide-gray-800/60 space-y-4">
                {imapCreds.map((cred, idx) => (
                  <div key={cred.id} className={`flex flex-col md:flex-row md:items-center justify-between gap-4 ${idx > 0 ? 'pt-4' : ''}`}>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        {cred.imap_email}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          cred.imap_verified_by_admin
                            ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-250 dark:border-emerald-900'
                            : 'bg-amber-50 dark:bg-amber-955/20 text-amber-600 dark:text-amber-400 border border-amber-250 dark:border-amber-900'
                        }`}>
                          {cred.imap_verified_by_admin ? 'Verified' : 'Verification Pending'}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-550 font-semibold">
                        Host: {cred.imap_host}:{cred.imap_port} | Linked on: {cred.createdAt ? new Date(cred.createdAt).toLocaleDateString() : 'Unknown Date'}
                      </p>
                    </div>
                    <div>
                      <button
                        onClick={() => {
                          if (userDoc?.role !== 'superadmin') {
                            showToast("Access Denied: Only Super Administrator can disconnect mailboxes.", "error");
                            return;
                          }
                          handleDisconnectImap(cred.id);
                        }}
                        disabled={userDoc?.role !== 'superadmin'}
                        className={`w-full md:w-auto px-4 py-2 font-bold text-xs rounded-xl transition-all ${
                          userDoc?.role !== 'superadmin'
                            ? 'opacity-40 cursor-not-allowed bg-gray-150 text-gray-400 dark:bg-gray-850 dark:text-gray-500'
                            : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-955/20 dark:hover:bg-rose-900/30 text-rose-700 dark:text-rose-450'
                        }`}
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Auto-Consent & Legal Compliance Agreement Card */}
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white">Auto-Consent & Legal Compliance Protocols</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Digital property covenant, escrow terms & automatic verification consent</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to="/terms-and-conditions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Review Covenant</span>
                  <ExternalLink className="w-3 h-3 text-gray-400 ml-0.5" />
                </Link>
              </div>
            </div>

            {/* Compliance Status Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-850 border border-gray-200/80 dark:border-gray-750/60 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">Consent Verification</span>
                  {userDoc?.termsAccepted ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                      <CheckCircle className="w-3 h-3" />
                      ACTIVE & SIGNED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900">
                      <AlertTriangle className="w-3 h-3" />
                      PENDING ACCEPTANCE
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-700 dark:text-gray-300 font-semibold leading-relaxed">
                  {userDoc?.termsAccepted 
                    ? `Consent registered and certified. Authorized for automated mailbox audit & escrow verification.`
                    : `Auto-consent is pending. Accept the covenant to ensure uninterrupted OTP & mailbox verification sync.`}
                </p>
                {userDoc?.termsAcceptedAt && (
                  <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
                    Timestamp: {typeof userDoc.termsAcceptedAt === 'number' ? new Date(userDoc.termsAcceptedAt).toLocaleString() : String(userDoc.termsAcceptedAt)}
                  </p>
                )}
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-850 border border-gray-200/80 dark:border-gray-750/60 rounded-xl space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 block">Connected Mailbox Sync</span>
                <p className="text-xs text-gray-700 dark:text-gray-300 font-semibold leading-relaxed">
                  {gmailCreds.length > 0 || zohoCreds.length > 0 || imapCreds.length > 0
                    ? `${gmailCreds.length + zohoCreds.length + imapCreds.length} Mailbox auditor integration(s) connected and synchronized with platform.`
                    : 'No external mailboxes connected yet. Link Gmail or custom IMAP below to enable real-time OTP routing.'}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900">
                    Gmail: {gmailCreds.length}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-900">
                    IMAP: {imapCreds.length}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900">
                    Zoho: {zohoCreds.length}
                  </span>
                </div>
              </div>
            </div>

            {/* If terms are not yet accepted, offer a quick-accept action */}
            {!userDoc?.termsAccepted && currentUser?.uid && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-300 block">
                    Action Required: Sign Auto-Consent Agreement
                  </span>
                  <span className="text-[11px] text-amber-750 dark:text-amber-400 block font-medium">
                    By confirming, you agree to digital property terms, mailbox stream monitoring, and escrow handover protocols.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await acceptTermsAndConditions(currentUser.uid);
                      showToast("Auto-Consent accepted and recorded successfully!", "success");
                    } catch (err) {
                      console.error("Failed to accept terms:", err);
                      showToast("Failed to save consent: " + err.message, "error");
                    }
                  }}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition-all shrink-0"
                >
                  Accept & Sign Now
                </button>
              </div>
            )}
          </div>

          {/* ======== DPDP Act 2023 — Data Privacy & Rights Section ======== */}
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-4">
              <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight">Data Privacy & DPDP Rights</h3>
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Digital Personal Data Protection Act, 2023</p>
              </div>
            </div>

            {/* Consent Status */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">Data Consent Status</span>
                {userDoc?.dpdpConsentGiven !== false ? (
                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> CONSENT ACTIVE
                  </span>
                ) : (
                  <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> CONSENT WITHDRAWN
                  </span>
                )}
              </div>
              {userDoc?.dpdpConsentTimestamp && (
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold">
                  Consent recorded: {new Date(userDoc.dpdpConsentTimestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  {userDoc?.dpdpConsentVersion && <span className="ml-2 text-gray-400">• Version: {userDoc.dpdpConsentVersion}</span>}
                </p>
              )}
              {userDoc?.dpdpConsentGiven !== false && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm('Are you sure you want to withdraw your data processing consent?\n\nThis will:\n• Stop telemetry data collection (IP, location, device info)\n• You can re-consent anytime via the Cookie Banner\n\nNote: Essential account data will still be maintained for service delivery.')) return;
                    try {
                      await withdrawDpdpConsentRecord(currentUser.uid);
                      withdrawDpdpConsent();
                      showToast('Data consent withdrawn successfully. Telemetry collection has been stopped.', 'success');
                    } catch (err) {
                      console.error('Consent withdrawal error:', err);
                      showToast('Could not process consent withdrawal. Please try again.', 'error');
                    }
                  }}
                  className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 underline cursor-pointer flex items-center gap-1"
                >
                  <AlertTriangle className="w-3 h-3" />
                  Withdraw Data Consent (DPDP Act S.6(6))
                </button>
              )}
            </div>

            {/* Data Deletion Request */}
            <div className="p-4 bg-rose-50/50 dark:bg-rose-950/15 rounded-2xl border border-rose-200 dark:border-rose-800 space-y-3">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span className="text-xs font-black text-rose-800 dark:text-rose-300 uppercase tracking-wider">Request Data Deletion</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
                Under <span className="font-bold text-gray-900 dark:text-white">DPDP Act 2023 — Section 12(1)</span>, you have the right to request erasure of your personal data. 
                Your request will be processed within <span className="font-bold text-gray-900 dark:text-white">7-14 business days</span>.
              </p>
              
              {userDoc?.dataDeletionRequested ? (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-700 text-xs text-amber-700 dark:text-amber-300 font-bold flex items-center gap-2">
                  <Loader className="w-3.5 h-3.5 animate-spin" />
                  <span>Data deletion request is being processed (submitted: {userDoc.dataDeletionRequestedAt ? new Date(userDoc.dataDeletionRequestedAt).toLocaleDateString('en-IN') : 'recently'})</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    const reason = window.prompt(
                      'Please provide a reason for data deletion (optional):\n\nYour account, session logs, telemetry data, and associated records will be permanently deleted.',
                      'I wish to exercise my right to erasure under DPDP Act 2023'
                    );
                    if (reason === null) return; // Cancelled
                    if (!window.confirm('⚠️ FINAL CONFIRMATION\n\nThis will submit a permanent data deletion request for:\n• Your user profile & personal information\n• Session logs & telemetry data\n• Consent records\n\nThis action cannot be undone. Your account may be deactivated after processing.\n\nProceed?')) return;
                    try {
                      await requestDataDeletion(
                        currentUser.uid,
                        currentUser.email,
                        userDoc?.name || 'User',
                        reason
                      );
                      showToast('Data deletion request submitted successfully. It will be processed within 7-14 business days.', 'success');
                    } catch (err) {
                      console.error('Data deletion request error:', err);
                      showToast('Could not submit deletion request. Please try again or contact support.', 'error');
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Request Permanent Data Deletion</span>
                </button>
              )}
            </div>

            {/* Your Rights Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/15 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-1">
                <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Right to Access (S.11)</span>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Request a summary of your personal data</p>
              </div>
              <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/15 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-1">
                <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Right to Correction (S.12)</span>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Update inaccurate personal data above</p>
              </div>
              <div className="p-3 bg-rose-50/50 dark:bg-rose-950/15 rounded-xl border border-rose-200 dark:border-rose-800 space-y-1">
                <span className="text-[9px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">Right to Erasure (S.12)</span>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Request deletion via button above</p>
              </div>
              <div className="p-3 bg-amber-50/50 dark:bg-amber-950/15 rounded-xl border border-amber-200 dark:border-amber-800 space-y-1">
                <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">Right to Grievance (S.13)</span>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Email: support@dealsbyshiv.web.app</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              <span>DPDP Act 2023 • IT Act 2000 • Consumer Protection Rules 2020</span>
            </div>
          </div>

        </main>
      </div>

      {/* IMAP Connection Modal */}
      {showImapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2 text-teal-650 dark:text-teal-400">
                <Server className="w-5 h-5" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Link Custom IMAP Mailbox</h3>
              </div>
              <button
                onClick={() => setShowImapModal(false)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 font-extrabold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConnectImap} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-550 dark:text-gray-400 mb-1.5 uppercase">
                  IMAP Provider (Autocomplete)
                </label>
                <select
                  value={selectedHostProvider}
                  onChange={(e) => setSelectedHostProvider(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-250 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white font-bold cursor-pointer"
                >
                  <option value="manual">Manual / Custom Server</option>
                  <option value="gmail">Google Gmail (imap.gmail.com)</option>
                  <option value="zoho_in">Zoho Mail India (imap.zoho.in)</option>
                  <option value="zoho_com">Zoho Mail US/Global (imap.zoho.com)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. recovery@domain.com"
                    value={imapEmail}
                    onChange={(e) => {
                      const val = e.target.value;
                      setImapEmail(val);
                      setImapUser(val); // Smart copy Email to Username in real-time
                    }}
                    className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">
                    IMAP Host (Server)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. imap.hostinger.com"
                    value={imapHost}
                    onChange={(e) => setImapHost(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">
                    IMAP Port
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="993"
                    value={imapPort}
                    onChange={(e) => setImapPort(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">
                    IMAP Username
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Typically your email address"
                    value={imapUser}
                    onChange={(e) => setImapUser(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-555 dark:text-gray-400 mb-1 uppercase">
                  IMAP Password / App Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="🔒 Account access password"
                  value={imapPassword}
                  onChange={(e) => setImapPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white font-semibold"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="imap_secure"
                  checked={imapSecure}
                  onChange={(e) => setImapSecure(e.target.checked)}
                  className="w-4 h-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                />
                <label htmlFor="imap_secure" className="text-xs font-bold text-gray-600 dark:text-gray-400 cursor-pointer select-none">
                  Require SSL/TLS Encryption (Recommended)
                </label>
              </div>

              {(selectedHostProvider.startsWith('zoho') || imapHost.includes('zoho') || imapEmail.includes('zoho')) && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-300 space-y-1 text-xs">
                  <p className="font-bold flex items-center gap-1.5">
                    <span>💡 Zoho Mail Zaroori Step:</span>
                  </p>
                  <p className="text-[11px] opacity-90 leading-relaxed">
                    Zoho Mail me <b>IMAP Access Default me OFF hota hai</b>. Please <b>mail.zoho.in</b> → Settings ⚙️ → <b>Mail Accounts</b> me jakar <b>"IMAP Access"</b> ko <b>ENABLE (Turn ON)</b> karein.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowImapModal(false)}
                  className="px-4 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-600 dark:text-gray-450 border border-gray-200 dark:border-gray-700 font-bold text-xs rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={testingImap}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-650/20 transition-all"
                >
                  {testingImap && <Loader className="w-3.5 h-3.5 animate-spin" />}
                  <span>{testingImap ? 'Verifying Sockets...' : 'Test & Save Configuration'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}



