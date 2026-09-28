import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { parseInstagramInput, getInstagramDetails } from '../utils/instagramHelper';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useIdleTimer } from '../hooks/useIdleTimer';
import { 
  Mail, Loader, Search, X, AlertTriangle, 
  ShieldCheck, ShieldAlert, RefreshCw, Calendar, ArrowRight, Inbox, Trash2, Plus, Star, MailOpen,
  ArrowLeft, Download, Upload, FileJson, Copy, FileText, Check, ChevronDown, ChevronUp, Sliders
} from 'lucide-react';

export default function GmailMonitor() {
  useIdleTimer(900000); // 15 mins inactivity logout

  const { showToast } = useToast();
  const { currentUser, userDoc } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Tab State: 'gmail' | 'zoho' | 'imap'
  const [activeTab, setActiveTab] = useState('gmail');

  // List of connected users
  const [gmailUsers, setGmailUsers] = useState([]);
  const [loadingGmailUsers, setLoadingGmailUsers] = useState(true);
  const [zohoUsers, setZohoUsers] = useState([]);
  const [loadingZohoUsers, setLoadingZohoUsers] = useState(true);
  const [imapUsers, setImapUsers] = useState([]);
  const [loadingImapUsers, setLoadingImapUsers] = useState(true);

  // Selected user & active emails list
  const [selectedUser, setSelectedUser] = useState(null);
  const [mobileHeaderExpanded, setMobileHeaderExpanded] = useState(false);
  const [emails, setEmails] = useState([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [errorFetching, setErrorFetching] = useState('');
  const [gmailQuery, setGmailQuery] = useState('');

  // Reset mobile header expansion state when selected mailbox changes
  useEffect(() => {
    setMobileHeaderExpanded(false);
  }, [selectedUser?.id]);

  // Selected single email to view full body
  const [activeEmailDetails, setActiveEmailDetails] = useState(null);

  // Compose Modal states (Gmail only)
  const [composeModalOpen, setComposeModalOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Watch Topic states (Gmail only)
  const [editingTopic, setEditingTopic] = useState(false);
  const [topicInput, setTopicInput] = useState('');

  // Game ID Nickname states
  const [editingGameIdName, setEditingGameIdName] = useState(false);
  const [gameIdNameInput, setGameIdNameInput] = useState('');
  const [savingGameIdName, setSavingGameIdName] = useState(false);

  // Free Fire UID states
  const [editingGameUid, setEditingGameUid] = useState(false);
  const [gameUidInput, setGameUidInput] = useState('');
  const [savingGameUid, setSavingGameUid] = useState(false);

  // Pricing states
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);

  // Social Links states (Instagram & YouTube)
  const [editingInstaLink, setEditingInstaLink] = useState(false);
  const [instaLinkInput, setInstaLinkInput] = useState('');
  const [savingInstaLink, setSavingInstaLink] = useState(false);

  const [editingYoutubeLink, setEditingYoutubeLink] = useState(false);
  const [youtubeLinkInput, setYoutubeLinkInput] = useState('');
  const [savingYoutubeLink, setSavingYoutubeLink] = useState(false);

  // Import / Export states
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [copiedSample, setCopiedSample] = useState(false);

  const sampleJsonTemplate = JSON.stringify([
    {
      "email": "garena_account1@gmail.com",
      "password": "xvterobjzmyljxot",
      "host": "imap.gmail.com",
      "port": 993,
      "game_uid": "1948201825",
      "game_id_name": "500 wali ID",
      "price_inr": 500,
      "instagram_link": "https://instagram.com/your_id",
      "youtube_link": "https://youtube.com/@your_channel"
    },
    {
      "email": "garena_account2@gmail.com",
      "password": "abcd1234efgh5678",
      "host": "imap.gmail.com",
      "port": 993,
      "game_uid": "2849102941",
      "game_id_name": "1000 season 2",
      "price_inr": 1000,
      "instagram_link": "https://instagram.com/seller_page",
      "youtube_link": "https://youtube.com/@seller_stream"
    }
  ], null, 2);

  const handleCopySampleJson = () => {
    navigator.clipboard.writeText(sampleJsonTemplate);
    setCopiedSample(true);
    showToast("Sample JSON format copied to clipboard!", "info");
    setTimeout(() => setCopiedSample(false), 2500);
  };

  // File upload reader for import
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setImportText(content);
        showToast(`Loaded file: ${file.name}`, "info");
      }
    };
    reader.readAsText(file);
  };

  // Export ALL credentials (Gmail + Zoho + IMAP) including App Passwords to JSON file
  const handleExportCredentials = () => {
    const allAccounts = [
      ...gmailUsers.map(u => ({ ...u, _type: 'gmail' })),
      ...zohoUsers.map(u => ({ ...u, _type: 'zoho' })),
      ...imapUsers.map(u => ({ ...u, _type: 'imap' }))
    ];

    if (allAccounts.length === 0) {
      showToast("No credentials available to export across Gmail, Zoho, or IMAP.", "warning");
      return;
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      totalCount: allAccounts.length,
      counts: {
        gmail: gmailUsers.length,
        zoho: zohoUsers.length,
        imap: imapUsers.length
      },
      accounts: allAccounts.map(u => ({
        id: u.id,
        type: u._type,
        email: u.imap_email || u.gmail_email || u.zoho_email || '',
        password: u.imap_password || u.password || u.gmail_refresh_token || u.zoho_refresh_token || '',
        host: u.imap_host || (u._type === 'gmail' ? 'imap.gmail.com' : u._type === 'zoho' ? 'imap.zoho.in' : 'imap.gmail.com'),
        port: u.imap_port || 993,
        secure: u.imap_secure !== false,
        game_id_name: u.game_id_name || '',
        game_uid: u.game_uid || u.ff_uid || '',
        price_inr: u.price_inr !== undefined && u.price_inr !== null ? u.price_inr : 0,
        instagram_link: u.instagram_link || '',
        youtube_link: u.youtube_link || '',
        userName: u.userName || '',
        userEmail: u.userEmail || ''
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `all_email_accounts_export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Successfully exported ALL ${allAccounts.length} email accounts!`, "success");
  };

  // Import bulk credentials from JSON or CSV text
  const handleImportCredentials = async () => {
    if (!importText.trim()) {
      showToast("Please paste JSON data or select a file to import.", "warning");
      return;
    }

    setImporting(true);
    try {
      let itemsToImport = [];
      const rawStr = importText.trim();

      if (rawStr.startsWith('{') || rawStr.startsWith('[')) {
        const parsed = JSON.parse(rawStr);
        if (Array.isArray(parsed)) {
          itemsToImport = parsed;
        } else if (parsed.credentials && Array.isArray(parsed.credentials)) {
          itemsToImport = parsed.credentials;
        } else {
          itemsToImport = [parsed];
        }
      } else {
        // CSV line-by-line fallback: email, password, host, port, game_id_name, price_inr, game_uid
        const lines = rawStr.split('\n');
        for (const line of lines) {
          const parts = line.split(',').map(p => p.trim());
          if (parts.length >= 2 && parts[0].includes('@')) {
            itemsToImport.push({
              email: parts[0],
              password: parts[1],
              host: parts[2] || 'imap.gmail.com',
              port: parts[3] ? Number(parts[3]) : 993,
              game_id_name: parts[4] || '',
              price_inr: parts[5] ? Number(parts[5]) : 0,
              game_uid: parts[6] || ''
            });
          }
        }
      }

      if (itemsToImport.length === 0) {
        showToast("No valid email accounts found in import data.", "error");
        setImporting(false);
        return;
      }

      let count = 0;
      const targetCollection = activeTab === 'gmail' ? 'gmail_credentials' : activeTab === 'zoho' ? 'zoho_credentials' : 'imap_credentials';

      for (const item of itemsToImport) {
        const email = (item.email || item.imap_email || item.gmail_email || item.zoho_email || item.user || '').trim();
        const rawPass = (item.password || item.imap_password || item.pass || '').trim();
        if (!email || !rawPass) continue;

        // Auto-sanitize App Password (remove spaces)
        const cleanPass = rawPass.replace(/\s+/g, '');
        const docId = `${currentUser.uid}_${email}`;
        const docRef = doc(db, targetCollection, docId);

        const instaVal = item.instagram_link || item.instagram || item.insta_link || item.insta || null;
        const ytVal = item.youtube_link || item.youtube || item.yt_link || item.yt || null;
        const gameUidVal = (item.game_uid || item.ff_uid || item.gameUid || item.uid || '').toString().trim() || null;

        if (activeTab === 'imap') {
          await setDoc(docRef, {
            userId: currentUser.uid,
            userName: userDoc?.name || 'Administrator',
            userEmail: currentUser.email,
            assignedAdminId: currentUser.uid,
            imap_email: email,
            imap_user: email,
            imap_password: cleanPass,
            imap_host: (item.host || item.imap_host || 'imap.gmail.com').trim(),
            imap_port: item.port || item.imap_port ? Number(item.port || item.imap_port) : 993,
            imap_secure: item.secure !== false,
            imap_verified_by_admin: true,
            game_id_name: item.game_id_name || null,
            game_uid: gameUidVal,
            ff_uid: gameUidVal,
            price_inr: item.price_inr !== undefined && item.price_inr !== null ? Number(item.price_inr) : 0,
            instagram_link: instaVal,
            youtube_link: ytVal,
            createdAt: new Date().toISOString()
          }, { merge: true });
        } else if (activeTab === 'gmail') {
          await setDoc(docRef, {
            userId: currentUser.uid,
            userName: userDoc?.name || 'Administrator',
            userEmail: currentUser.email,
            assignedAdminId: currentUser.uid,
            gmail_email: email,
            gmail_refresh_token: cleanPass,
            gmail_watch_status: 'stopped',
            game_id_name: item.game_id_name || null,
            game_uid: gameUidVal,
            ff_uid: gameUidVal,
            price_inr: item.price_inr !== undefined && item.price_inr !== null ? Number(item.price_inr) : 0,
            instagram_link: instaVal,
            youtube_link: ytVal,
            createdAt: new Date().toISOString()
          }, { merge: true });
        } else if (activeTab === 'zoho') {
          await setDoc(docRef, {
            userId: currentUser.uid,
            userName: userDoc?.name || 'Administrator',
            userEmail: currentUser.email,
            assignedAdminId: currentUser.uid,
            zoho_email: email,
            zoho_account_id: item.zoho_account_id || item.account_id || '',
            zoho_refresh_token: cleanPass,
            zoho_verified_by_admin: true,
            game_id_name: item.game_id_name || null,
            game_uid: gameUidVal,
            ff_uid: gameUidVal,
            price_inr: item.price_inr !== undefined && item.price_inr !== null ? Number(item.price_inr) : 0,
            instagram_link: instaVal,
            youtube_link: ytVal,
            createdAt: new Date().toISOString()
          }, { merge: true });
        }
        count++;
      }

      showToast(`Successfully imported ${count} ${activeTab.toUpperCase()} account(s)!`, "success");
      setImportModalOpen(false);
      setImportText('');
    } catch (err) {
      console.error("Import error:", err);
      showToast("Failed to parse import data: " + err.message, "error");
    } finally {
      setImporting(false);
    }
  };

  const [admins, setAdmins] = useState([]);

  // Fetch all admins for operator dropdown selector (only for superadmin)
  useEffect(() => {
    if (!currentUser || !userDoc || userDoc.role !== 'superadmin') return;

    const q = query(
      collection(db, 'users'),
      where('role', '==', 'admin')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ uid: docSnap.id, ...docSnap.data() });
      });
      setAdmins(list);
    }, (error) => {
      console.error("Error listening to admins in Monitor:", error);
    });

    return () => unsubscribe();
  }, [currentUser, userDoc]);

  // Listen to connected Gmail users in Firestore
  // Listen to connected Gmail users in Firestore
  useEffect(() => {
    if (!userDoc) return;
    const q = query(collection(db, 'gmail_credentials'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        const credData = docSnap.data();
        if (userDoc.role === 'admin') {
          if (credData.assignedAdminId === currentUser.uid) {
            list.push({ id: docSnap.id, ...credData });
          }
        } else {
          list.push({ id: docSnap.id, ...credData });
        }
      });
      setGmailUsers(list);
      setLoadingGmailUsers(false);
    }, (error) => {
      console.error("Error listening to gmail credentials:", error);
      showToast("Error loading gmail accounts list.", "error");
      setLoadingGmailUsers(false);
    });

    return () => unsubscribe();
  }, [showToast, userDoc, currentUser]);

  // Listen to connected Zoho users in Firestore
  useEffect(() => {
    if (!userDoc) return;
    const q = query(collection(db, 'zoho_credentials'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        const credData = docSnap.data();
        if (userDoc.role === 'admin') {
          if (credData.assignedAdminId === currentUser.uid) {
            list.push({ id: docSnap.id, ...credData });
          }
        } else {
          list.push({ id: docSnap.id, ...credData });
        }
      });
      setZohoUsers(list);
      setLoadingZohoUsers(false);
    }, (error) => {
      console.error("Error listening to zoho credentials:", error);
      showToast("Error loading zoho accounts list.", "error");
      setLoadingZohoUsers(false);
    });

    return () => unsubscribe();
  }, [showToast, userDoc, currentUser]);

  // Listen to connected IMAP users in Firestore
  useEffect(() => {
    if (!userDoc) return;
    const q = query(collection(db, 'imap_credentials'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        const credData = docSnap.data();
        if (userDoc.role === 'admin') {
          if (credData.assignedAdminId === currentUser.uid) {
            list.push({ id: docSnap.id, ...credData });
          }
        } else {
          list.push({ id: docSnap.id, ...credData });
        }
      });
      setImapUsers(list);
      setLoadingImapUsers(false);
    }, (error) => {
      console.error("Error listening to IMAP credentials:", error);
      showToast("Error loading IMAP accounts list.", "error");
      setLoadingImapUsers(false);
    });

    return () => unsubscribe();
  }, [showToast, userDoc, currentUser]);

  // Keep selectedUser in sync with the latest list data from Firestore
  useEffect(() => {
    if (!selectedUser) return;
    const activeUsers = activeTab === 'gmail' ? gmailUsers : activeTab === 'zoho' ? zohoUsers : imapUsers;
    const updated = activeUsers.find(u => u.id === selectedUser.id);
    if (!updated) {
      setSelectedUser(null);
      setEmails([]);
      setErrorFetching('');
    } else {
      // Deep check to prevent redundant updates
      const updatedStr = JSON.stringify(updated);
      const currentStr = JSON.stringify(selectedUser);
      if (updatedStr !== currentStr) {
        setSelectedUser(updated);
      }
    }
  }, [gmailUsers, zohoUsers, imapUsers, activeTab, selectedUser?.id]);

  useEffect(() => {
    if (selectedUser && activeTab === 'gmail') {
      setTopicInput(selectedUser.gmail_watch_topic || 'gmail-notifications');
    } else {
      setTopicInput('gmail-notifications');
    }
    setEditingTopic(false);
  }, [selectedUser?.id, activeTab]);

  useEffect(() => {
    if (selectedUser) {
      setGameIdNameInput(selectedUser.game_id_name || '');
      setEditingGameIdName(false);
    }
  }, [selectedUser?.id]);

  const handleSaveGameIdName = async () => {
    if (!selectedUser) return;
    setSavingGameIdName(true);
    try {
      let collectionName = 'gmail_credentials';
      if (activeTab === 'zoho') collectionName = 'zoho_credentials';
      if (activeTab === 'imap') collectionName = 'imap_credentials';

      const trimmedName = gameIdNameInput.trim();
      await updateDoc(doc(db, collectionName, selectedUser.id), {
        game_id_name: trimmedName || null
      });

      setSelectedUser(prev => ({
        ...prev,
        game_id_name: trimmedName || null
      }));

      showToast("Game ID Name updated successfully!", "success");
      setEditingGameIdName(false);
    } catch (err) {
      console.error("Error updating Game ID Name:", err);
      showToast("Failed to update Game ID Name.", "error");
    } finally {
      setSavingGameIdName(false);
    }
  };

  useEffect(() => {
    if (selectedUser) {
      setGameUidInput(selectedUser.game_uid || selectedUser.ff_uid || selectedUser.gameUid || '');
      setEditingGameUid(false);
    }
  }, [selectedUser?.id]);

  const handleSaveGameUid = async () => {
    if (!selectedUser) return;
    setSavingGameUid(true);
    try {
      let collectionName = 'gmail_credentials';
      if (activeTab === 'zoho') collectionName = 'zoho_credentials';
      if (activeTab === 'imap') collectionName = 'imap_credentials';

      const cleanUid = gameUidInput.trim();
      await updateDoc(doc(db, collectionName, selectedUser.id), {
        game_uid: cleanUid || null,
        ff_uid: cleanUid || null
      });

      setSelectedUser(prev => ({
        ...prev,
        game_uid: cleanUid || null,
        ff_uid: cleanUid || null
      }));

      showToast("Free Fire UID updated successfully!", "success");
      setEditingGameUid(false);
    } catch (err) {
      console.error("Error updating Free Fire UID:", err);
      showToast("Failed to update Free Fire UID.", "error");
    } finally {
      setSavingGameUid(false);
    }
  };

  useEffect(() => {
    if (selectedUser) {
      setPriceInput(selectedUser.price_inr !== undefined && selectedUser.price_inr !== null ? String(selectedUser.price_inr) : '');
      setEditingPrice(false);
    }
  }, [selectedUser?.id]);

  const handleSavePrice = async () => {
    if (!selectedUser) return;
    setSavingPrice(true);
    try {
      let collectionName = 'gmail_credentials';
      if (activeTab === 'zoho') collectionName = 'zoho_credentials';
      if (activeTab === 'imap') collectionName = 'imap_credentials';

      const numericPrice = priceInput.trim() === '' ? null : Number(priceInput);
      await updateDoc(doc(db, collectionName, selectedUser.id), {
        price_inr: numericPrice
      });

      setSelectedUser(prev => ({
        ...prev,
        price_inr: numericPrice
      }));

      showToast("Price updated successfully!", "success");
      setEditingPrice(false);
    } catch (err) {
      console.error("Error updating price:", err);
      showToast("Failed to update price.", "error");
    } finally {
      setSavingPrice(false);
    }
  };

  useEffect(() => {
    if (selectedUser) {
      setInstaLinkInput(selectedUser.instagram_link || '');
      setEditingInstaLink(false);
      setYoutubeLinkInput(selectedUser.youtube_link || '');
      setEditingYoutubeLink(false);
    }
  }, [selectedUser?.id]);

  const handleSaveInstaLink = async () => {
    if (!selectedUser) return;
    setSavingInstaLink(true);
    try {
      let collectionName = 'gmail_credentials';
      if (activeTab === 'zoho') collectionName = 'zoho_credentials';
      if (activeTab === 'imap') collectionName = 'imap_credentials';

      const { username: parsedUser, link: parsedLink } = parseInstagramInput(instaLinkInput);
      const finalLink = parsedLink || null;
      await updateDoc(doc(db, collectionName, selectedUser.id), {
        instagram_link: finalLink,
        instagramId: parsedUser || null
      });

      setSelectedUser(prev => ({
        ...prev,
        instagram_link: finalLink,
        instagramId: parsedUser || null
      }));

      showToast(parsedUser ? `Instagram @${parsedUser} linked successfully!` : "Instagram link updated successfully!", "success");
      setEditingInstaLink(false);
    } catch (err) {
      console.error("Error updating Instagram link:", err);
      showToast("Failed to update Instagram link.", "error");
    } finally {
      setSavingInstaLink(false);
    }
  };

  const handleSaveYoutubeLink = async () => {
    if (!selectedUser) return;
    setSavingYoutubeLink(true);
    try {
      let collectionName = 'gmail_credentials';
      if (activeTab === 'zoho') collectionName = 'zoho_credentials';
      if (activeTab === 'imap') collectionName = 'imap_credentials';

      const trimmedLink = youtubeLinkInput.trim();
      await updateDoc(doc(db, collectionName, selectedUser.id), {
        youtube_link: trimmedLink || null
      });

      setSelectedUser(prev => ({
        ...prev,
        youtube_link: trimmedLink || null
      }));

      showToast("YouTube link updated successfully!", "success");
      setEditingYoutubeLink(false);
    } catch (err) {
      console.error("Error updating YouTube link:", err);
      showToast("Failed to update YouTube link.", "error");
    } finally {
      setSavingYoutubeLink(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedUser(null);
    setEmails([]);
    setErrorFetching('');
    setActiveEmailDetails(null);
    setSearchQuery('');
  };

  // Gmail Assignments & Verification Logic
  const handleAssignGmailAdmin = async (gmailCredId, adminUid) => {
    try {
      showToast("Updating operator assignment...", "info");
      const credRef = doc(db, 'gmail_credentials', gmailCredId);
      await updateDoc(credRef, {
        assignedAdminId: adminUid || null
      });
      showToast("Operator assignment updated successfully!", "success");
    } catch (err) {
      console.error("Failed to assign Gmail operator:", err);
      showToast("Failed to assign Gmail operator: " + err.message, "error");
    }
  };

  const handleToggleVerification = async (credId, currentStatus) => {
    try {
      const credRef = doc(db, 'gmail_credentials', credId);
      await updateDoc(credRef, {
        gmail_verified_by_admin: !currentStatus
      });
      showToast(`Gmail account ${!currentStatus ? 'Verified' : 'Unverified'} successfully!`, "success");
    } catch (err) {
      console.error("Verification update error:", err);
      showToast("Failed to update verification status.", "error");
    }
  };

  const handleDeleteConnection = async (credId) => {
    if (userDoc?.role !== 'superadmin') {
      showToast("Access Denied: Only Super Administrator can disconnect mailboxes.", "error");
      return;
    }
    if (!window.confirm("Are you sure you want to remove this Gmail connection from the database?")) return;
    try {
      const credRef = doc(db, 'gmail_credentials', credId);
      await deleteDoc(credRef);
      showToast("Gmail connection deleted successfully.", "success");
      if (selectedUser?.id === credId) {
        setSelectedUser(null);
        setEmails([]);
        setErrorFetching('');
      }
    } catch (err) {
      console.error("Delete connection error:", err);
      showToast("Failed to delete Gmail connection.", "error");
    }
  };

  // Zoho Assignments & Verification Logic
  const handleAssignZohoAdmin = async (zohoCredId, adminUid) => {
    try {
      showToast("Updating operator assignment...", "info");
      const credRef = doc(db, 'zoho_credentials', zohoCredId);
      await updateDoc(credRef, {
        assignedAdminId: adminUid || null
      });
      showToast("Operator assignment updated successfully!", "success");
    } catch (err) {
      console.error("Failed to assign Zoho operator:", err);
      showToast("Failed to assign Zoho operator: " + err.message, "error");
    }
  };

  const handleToggleZohoVerification = async (credId, currentStatus) => {
    try {
      const credRef = doc(db, 'zoho_credentials', credId);
      await updateDoc(credRef, {
        zoho_verified_by_admin: !currentStatus
      });
      showToast(`Zoho account ${!currentStatus ? 'Verified' : 'Unverified'} successfully!`, "success");
    } catch (err) {
      console.error("Verification update error:", err);
      showToast("Failed to update verification status.", "error");
    }
  };

  const handleDeleteZohoConnection = async (credId) => {
    if (userDoc?.role !== 'superadmin') {
      showToast("Access Denied: Only Super Administrator can disconnect mailboxes.", "error");
      return;
    }
    if (!window.confirm("Are you sure you want to remove this Zoho connection from the database?")) return;
    try {
      const credRef = doc(db, 'zoho_credentials', credId);
      await deleteDoc(credRef);
      showToast("Zoho connection deleted successfully.", "success");
      if (selectedUser?.id === credId) {
        setSelectedUser(null);
        setEmails([]);
        setErrorFetching('');
      }
    } catch (err) {
      console.error("Delete connection error:", err);
      showToast("Failed to delete Zoho connection.", "error");
    }
  };

  // IMAP Assignments & Verification Logic
  const handleAssignImapAdmin = async (imapCredId, adminUid) => {
    try {
      showToast("Updating operator assignment...", "info");
      const credRef = doc(db, 'imap_credentials', imapCredId);
      await updateDoc(credRef, {
        assignedAdminId: adminUid || null
      });
      showToast("Operator assignment updated successfully!", "success");
    } catch (err) {
      console.error("Failed to assign IMAP operator:", err);
      showToast("Failed to assign IMAP operator: " + err.message, "error");
    }
  };

  const handleToggleImapVerification = async (credId, currentStatus) => {
    try {
      const credRef = doc(db, 'imap_credentials', credId);
      await updateDoc(credRef, {
        imap_verified_by_admin: !currentStatus
      });
      showToast(`IMAP account ${!currentStatus ? 'Verified' : 'Unverified'} successfully!`, "success");
    } catch (err) {
      console.error("Verification update error:", err);
      showToast("Failed to update verification status.", "error");
    }
  };

  const handleDeleteImapConnection = async (credId) => {
    if (userDoc?.role !== 'superadmin') {
      showToast("Access Denied: Only Super Administrator can disconnect mailboxes.", "error");
      return;
    }
    if (!window.confirm("Are you sure you want to remove this IMAP connection from the database?")) return;
    try {
      const credRef = doc(db, 'imap_credentials', credId);
      await deleteDoc(credRef);
      showToast("IMAP connection deleted successfully.", "success");
      if (selectedUser?.id === credId) {
        setSelectedUser(null);
        setEmails([]);
        setErrorFetching('');
      }
    } catch (err) {
      console.error("Delete connection error:", err);
      showToast("Failed to delete IMAP connection.", "error");
    }
  };

  // Gmail Token Refresh Flow
  const getFreshAccessToken = async (user) => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret || clientId === 'your_google_client_id_here') {
      throw new Error("Google OAuth credentials are not fully configured in your .env file.");
    }
    const isLocal = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' || 
                    window.location.port !== '';
    const tokenEndpoint = isLocal
      ? '/google-token-proxy'
      : 'https://oauth2.googleapis.com/token';

    const tokenResponse = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: user.gmail_refresh_token,
        grant_type: 'refresh_token'
      })
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to refresh Google session access token.");
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  };

  // Zoho Token Refresh Flow with proxy fallback
  const getFreshZohoAccessToken = async (user) => {
    const clientId = import.meta.env.VITE_ZOHO_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_ZOHO_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("Zoho OAuth credentials are not fully configured in your .env file.");
    }
    const isLocal = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' || 
                    window.location.port !== '';
    const configuredProxy = import.meta.env.VITE_ZOHO_PROXY_SERVER_URL;
    const proxyCandidates = [
      configuredProxy,
      'https://imap-proxy-server.vercel.app',
      'https://hispanic-florists-cook-llp.trycloudflare.com',
      'https://ffstore-imap-proxy.loca.lt',
      isLocal ? 'http://127.0.0.1:8080' : null
    ].filter(Boolean);

    let tokenResponse = null;

    for (const url of proxyCandidates) {
      try {
        const res = await fetch(`${url}/zoho/refresh`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(url.includes('loca.lt') ? { 'Bypass-Tunnel-Reminder': 'true' } : {})
          },
          body: JSON.stringify({ refresh_token: user.zoho_refresh_token })
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          tokenResponse = res;
          break;
        }
      } catch (err) {
        console.warn(`Zoho proxy refresh attempt failed on ${url}:`, err.message);
      }
    }

    if (!tokenResponse) {
      const tokenEndpoint = isLocal
        ? '/zoho-token-proxy/oauth/v2/token'
        : `https://corsproxy.org/?${encodeURIComponent('https://accounts.zoho.in/oauth/v2/token')}`;

      try {
        tokenResponse = await fetch(tokenEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: user.zoho_refresh_token,
            grant_type: 'refresh_token'
          })
        });
      } catch (clientErr) {
        console.warn("Direct client-side OAuth refresh failed:", clientErr);
      }
    }

    if (!tokenResponse || !tokenResponse.ok) {
      throw new Error("Failed to refresh Zoho session access token. Reconnect your account.");
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  };

  // Reusable Zoho API Request Helper (Routes through proxy server or local/cors proxy fallback)
  const executeZohoRequest = async (path, method, accessToken, body = null) => {
    const isLocalUrl = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' || 
                       window.location.port !== '';
    const configuredProxy = import.meta.env.VITE_ZOHO_PROXY_SERVER_URL;
    const proxyCandidates = [
      configuredProxy,
      'https://imap-proxy-server.vercel.app',
      'https://hispanic-florists-cook-llp.trycloudflare.com',
      'https://ffstore-imap-proxy.loca.lt',
      isLocalUrl ? 'http://127.0.0.1:8080' : null
    ].filter(Boolean);

    for (const url of proxyCandidates) {
      try {
        const response = await fetch(`${url}/zoho/proxy`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(url.includes('loca.lt') ? { 'Bypass-Tunnel-Reminder': 'true' } : {})
          },
          body: JSON.stringify({ path, method, token: accessToken, body })
        });
        const contentType = response.headers.get('content-type') || '';
        if (response.ok && contentType.includes('application/json')) {
          const data = await response.json();
          return data;
        }
      } catch (err) {
        console.warn(`Zoho proxy request failed on ${url}:`, err.message);
      }
    }

    // Direct / Local / CORS proxy fallback
    const buildZohoUrl = (p) => {
      const fullUrl = `https://mail.zoho.in${p}`;
      return isLocalUrl ? `/zoho-mail-proxy${p}` : `https://corsproxy.org/?${encodeURIComponent(fullUrl)}`;
    };

    const options = {
      method,
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`
      }
    };
    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    const response = await fetch(buildZohoUrl(path), options);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Zoho API error: ${response.status}`);
    }
    return data;
  };

  // Fetch Gmail Inbox Messages
  const fetchGmailMessages = useCallback(async (user, queryStr = '') => {
    if (!user || !user.gmail_refresh_token) return;

    setLoadingEmails(true);
    setErrorFetching('');
    setEmails([]);

    try {
      const accessToken = await getFreshAccessToken(user);

      const isLocalUrl = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' || 
                         window.location.port !== '';
      const gmailApiBase = isLocalUrl
        ? '/google-gmail-proxy'
        : 'https://gmail.googleapis.com';

      let listResponse;
      let jsFilterActive = false;
      try {
        const queryParams = new URLSearchParams({ maxResults: 10 });
        if (queryStr.trim()) {
          queryParams.append('q', queryStr.trim());
        }
        const fetchUrl = `${gmailApiBase}/gmail/v1/users/me/messages?${queryParams.toString()}`;
        listResponse = await fetch(fetchUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (listResponse.status === 403) {
          const fallbackUrl = `${gmailApiBase}/gmail/v1/users/me/messages?maxResults=50`;
          listResponse = await fetch(fallbackUrl, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          if (listResponse.ok) {
            jsFilterActive = true;
          }
        }
      } catch (e) {
        throw new Error(`Fetch Messages List Error: ${e.message}`);
      }

      if (!listResponse.ok) {
        const errBody = await listResponse.text();
        throw new Error(`Gmail API returned error (${listResponse.status}): ${errBody}`);
      }

      const listData = await listResponse.json();
      const messagesList = listData.messages || [];

      if (messagesList.length === 0) {
        setEmails([]);
        setLoadingEmails(false);
        return;
      }

      const resolvedEmails = await Promise.all(
        messagesList.map(async (msgItem) => {
          let detailResponse;
          try {
            detailResponse = await fetch(`${gmailApiBase}/gmail/v1/users/me/messages/${msgItem.id}?format=full`, {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
          } catch (e) {
            console.error(`Fetch Message Details Error for ID ${msgItem.id}:`, e);
            return null;
          }
          
          if (!detailResponse.ok) return null;
          const detailData = await detailResponse.json();

          const getHeader = (headers, name) => {
            const headerObj = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
            return headerObj ? headerObj.value : '';
          };

          const headers = detailData.payload.headers || [];
          const fromVal = getHeader(headers, 'From') || '';
          const subjectVal = getHeader(headers, 'Subject') || '';
          const snippetVal = detailData.snippet || '';

          if (jsFilterActive && queryStr.trim()) {
            const term = queryStr.trim().toLowerCase();
            let isMatch = false;
            if (term.startsWith('from:')) {
              const sender = term.substring(5).trim();
              isMatch = fromVal.toLowerCase().includes(sender);
            } else if (term.startsWith('subject:')) {
              const sub = term.substring(8).trim();
              isMatch = subjectVal.toLowerCase().includes(sub);
            } else {
              isMatch = fromVal.toLowerCase().includes(term) ||
                        subjectVal.toLowerCase().includes(term) ||
                        snippetVal.toLowerCase().includes(term);
            }
            if (!isMatch) return null;
          }

          return {
            id: detailData.id,
            threadId: detailData.threadId,
            snippet: snippetVal,
            subject: subjectVal || '(No Subject)',
            from: fromVal || 'Unknown Sender',
            date: getHeader(headers, 'Date') || 'Unknown Date',
            payload: detailData.payload,
            labelIds: detailData.labelIds || [],
            provider: 'gmail'
          };
        })
      );

      setEmails(resolvedEmails.filter(Boolean));
    } catch (err) {
      console.error("Fetch Gmail error:", err);
      setErrorFetching(err.message || "An unknown error occurred while retrieving emails.");
      showToast("Error retrieving emails.", "error");
    } finally {
      setLoadingEmails(false);
    }
  }, [showToast]);

  // Fetch Zoho Inbox Messages
  const fetchZohoMessages = useCallback(async (user, queryStr = '') => {
    if (!user || !user.zoho_refresh_token) return;

    setLoadingEmails(true);
    setErrorFetching('');
    setEmails([]);

    try {
      const accessToken = await getFreshZohoAccessToken(user);

      // 1. Fetch folders to find Inbox & Newsletter folder IDs
      const foldersData = await executeZohoRequest(`/api/accounts/${user.zoho_account_id}/folders`, 'GET', accessToken);
      const folderList = foldersData.data || [];
      const inboxFolder = folderList.find(f => f.folderName.toLowerCase() === 'inbox');
      const newsletterFolder = folderList.find(f => f.folderName.toLowerCase() === 'newsletter');

      // 2. Query messages
      let messagesList = [];
      if (queryStr.trim()) {
        const path = `/api/accounts/${user.zoho_account_id}/messages/search?searchKey=${encodeURIComponent(queryStr.trim())}&limit=20`;
        const listData = await executeZohoRequest(path, 'GET', accessToken);
        messagesList = listData.data || [];
      } else {
        const fetchPromises = [];
        if (inboxFolder) {
          fetchPromises.push(executeZohoRequest(`/api/accounts/${user.zoho_account_id}/messages/view?folderId=${inboxFolder.folderId}&limit=15`, 'GET', accessToken));
        }
        if (newsletterFolder) {
          fetchPromises.push(executeZohoRequest(`/api/accounts/${user.zoho_account_id}/messages/view?folderId=${newsletterFolder.folderId}&limit=15`, 'GET', accessToken));
        }
        const responses = await Promise.all(fetchPromises);
        responses.forEach(res => {
          if (res && res.data) {
            messagesList = [...messagesList, ...res.data];
          }
        });
        // Sort combined messages by sentTime descending (latest first)
        messagesList.sort((a, b) => Number(b.sentTime || 0) - Number(a.sentTime || 0));
      }

      if (messagesList.length === 0) {
        setEmails([]);
        setLoadingEmails(false);
        return;
      }

      const resolvedEmails = messagesList.map((msgItem) => {
        return {
          id: msgItem.messageId,
          snippet: msgItem.summary || '',
          subject: msgItem.subject || '(No Subject)',
          from: msgItem.sender || 'Unknown Sender',
          date: msgItem.sentTime ? new Date(Number(msgItem.sentTime)).toString() : 'Unknown Date',
          accountId: user.zoho_account_id,
          folderId: msgItem.folderId || (inboxFolder ? inboxFolder.folderId : ''),
          provider: 'zoho'
        };
      });

      setEmails(resolvedEmails);
    } catch (err) {
      console.error("Fetch Zoho error:", err);
      setErrorFetching(err.message || "An error occurred while retrieving Zoho emails.");
      showToast("Error retrieving Zoho emails.", "error");
    } finally {
      setLoadingEmails(false);
    }
  }, [showToast]);

  // Fetch IMAP Messages with local fallback
  const fetchImapMessages = useCallback(async (user, queryStr = '') => {
    if (!user) return;

    setLoadingEmails(true);
    setErrorFetching('');
    setEmails([]);

    try {
      const isLocal = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' || 
                      window.location.port !== '';
      const configuredProxy = import.meta.env.VITE_IMAP_PROXY_SERVER_URL;
      const proxyCandidates = [
        configuredProxy,
        'https://imap-proxy-server.vercel.app',
        'https://hispanic-florists-cook-llp.trycloudflare.com',
        'https://ffstore-imap-proxy.loca.lt',
        isLocal ? 'http://127.0.0.1:8080' : null
      ].filter(Boolean);

      let resData = null;
      let lastErrorMessage = '';

      for (const url of proxyCandidates) {
        try {
          const res = await fetch(`${url}/imap/fetch`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              ...(url.includes('loca.lt') ? { 'Bypass-Tunnel-Reminder': 'true' } : {})
            },
            body: JSON.stringify({
              host: user.imap_host,
              port: user.imap_port,
              user: user.imap_user,
              pass: user.imap_password,
              secure: user.imap_secure,
              folders: ['INBOX', 'Newsletter'],
              limit: 25,
              query: queryStr
            })
          });

          const contentType = res.headers.get('content-type') || '';
          if (res.ok && contentType.includes('application/json')) {
            const parsed = await res.json();
            if (parsed && (parsed.data || parsed.success !== false)) {
              resData = parsed;
              break;
            }
          } else if (contentType.includes('application/json')) {
            const errParsed = await res.json();
            lastErrorMessage = errParsed.error || errParsed.message || '';
          } else {
            console.warn(`Proxy ${url} returned non-JSON response (e.g. HTML or suspended). Trying next fallback...`);
          }
        } catch (err) {
          console.warn(`IMAP fetch failed on ${url}:`, err.message);
          lastErrorMessage = err.message;
        }
      }

      if (!resData) {
        let errMsg = lastErrorMessage || "IMAP Proxy server is offline. Please ensure the local proxy server is running or tunnel is active.";
        if ((errMsg === 'Command failed' || errMsg.includes('Command failed')) && (user.imap_host?.includes('zoho') || user.imap_email?.includes('zoho'))) {
          errMsg = 'Zoho Mail me IMAP Access band (Disabled) hai. Zoho Mail Settings me jaakar IMAP Access ko Turn ON karein.';
        }
        throw new Error(errMsg);
      }

      const messagesList = resData.data || [];

      const resolvedEmails = messagesList.map((msgItem) => {
        return {
          id: msgItem.messageId,
          snippet: msgItem.summary || '',
          subject: msgItem.subject || '(No Subject)',
          from: msgItem.sender || 'Unknown Sender',
          date: msgItem.sentTime ? new Date(msgItem.sentTime).toString() : 'Unknown Date',
          accountId: user.imap_email,
          body: msgItem.body || '',
          provider: 'imap'
        };
      });

      setEmails(resolvedEmails);
    } catch (err) {
      console.error("Fetch IMAP error:", err);
      setErrorFetching(err.message || "An error occurred while retrieving IMAP emails.");
      showToast("Error retrieving IMAP emails.", "error");
    } finally {
      setLoadingEmails(false);
    }
  }, [showToast]);

  // Load emails when user or query changes
  useEffect(() => {
    if (selectedUser) {
      if (activeTab === 'gmail' && selectedUser.gmail_verified_by_admin) {
        fetchGmailMessages(selectedUser, gmailQuery);
      } else if (activeTab === 'zoho' && selectedUser.zoho_verified_by_admin) {
        fetchZohoMessages(selectedUser, gmailQuery);
      } else if (activeTab === 'imap' && selectedUser.imap_verified_by_admin) {
        fetchImapMessages(selectedUser, gmailQuery);
      }
    } else {
      setEmails([]);
      setErrorFetching('');
    }
  }, [selectedUser?.id, selectedUser?.gmail_verified_by_admin, selectedUser?.zoho_verified_by_admin, selectedUser?.imap_verified_by_admin, activeTab, gmailQuery, fetchGmailMessages, fetchZohoMessages, fetchImapMessages]);

  // Open single Email (Gmail vs Zoho vs IMAP)
  const handleOpenEmail = async (email) => {
    if (email.provider === 'zoho') {
      try {
        showToast("Loading Zoho message body...", "info");
        const accessToken = await getFreshZohoAccessToken(selectedUser);
        const contentData = await executeZohoRequest(`/api/accounts/${email.accountId}/folders/${email.folderId}/messages/${email.id}/content`, 'GET', accessToken);
        const contentBody = contentData.data?.content || 'No body content returned.';
        
        setActiveEmailDetails({
          ...email,
          body: contentBody
        });
      } catch (err) {
        console.error(err);
        showToast("Failed to fetch email body: " + err.message, "error");
      }
    } else if (email.provider === 'imap') {
      // IMAP body is already included in the fetch response
      setActiveEmailDetails({
        ...email,
        body: email.body || email.snippet || 'No body content returned.'
      });
    } else {
      // Gmail decode
      const body = getDecodedBody(email.payload);
      setActiveEmailDetails({
        ...email,
        body
      });
    }
  };

  // Decode Base64URL for Gmail Payload
  const getDecodedBody = (payload) => {
    if (!payload) return "No text content found.";
    let plainText = '';
    let htmlText = '';

    const extractParts = (part) => {
      if (!part) return;
      if (part.body && part.body.data) {
        if (part.mimeType === 'text/plain') {
          plainText = part.body.data;
        } else if (part.mimeType === 'text/html') {
          htmlText = part.body.data;
        }
      }
      if (part.parts && part.parts.length > 0) {
        part.parts.forEach(extractParts);
      }
    };

    extractParts(payload);

    const rawData = htmlText || plainText || (payload.body && payload.body.data) || '';
    if (!rawData) return "No text content found in message body.";

    try {
      const base64 = rawData.replace(/-/g, '+').replace(/_/g, '/');
      return decodeURIComponent(escape(window.atob(base64)));
    } catch (e) {
      console.error("Base64 decode error:", e);
      return "Unable to format message body.";
    }
  };

  const formatEmailDate = (dateStr) => {
    if (!dateStr || dateStr === 'Unknown Date') return 'Unknown Date';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
    } catch {
      return dateStr;
    }
  };

  // Parse OTP/Verification code inside snippet or body text (Accurate context-aware detection)
  const extractOTP = (text, subject = '') => {
    let rawText = (subject || "") + " " + (text || "");
    if (!rawText.trim()) return null;

    // 1. Primary rule: Explicit keyword followed by 6-8 digit code
    const explicitKeywordPattern = /(?:verification\s*(?:code|pin|passcode)|security\s*(?:code|pin)|auth(?:entication)?\s*(?:code|pin)|one[- ]time\s*password|login\s*(?:code|pin)|confirmation\s*code|mã\s*xác\s*(?:nhận|thực)|kode\s*verifikasi|otp|passcode|pin)[\s:=–—\-#]*([0-9]{6,8})\b/i;
    const kwMatch = rawText.match(explicitKeywordPattern);
    if (kwMatch && kwMatch[1]) {
      return kwMatch[1];
    }

    // 2. Code followed by keyword: e.g. "849201 is your verification code"
    const prefixKeywordPattern = /\b([0-9]{6,8})\b(?:\s+is\s+(?:your\s+)?(?:garena\s+)?(?:verification|security|auth|confirmation|login|otp)\s*(?:code|pin|password)?)/i;
    const prefixMatch = rawText.match(prefixKeywordPattern);
    if (prefixMatch && prefixMatch[1]) {
      return prefixMatch[1];
    }

    // 3. Highlighted HTML code elements (e.g. bolded or styled code numbers)
    const htmlCodePattern = /<(?:b|strong|h[1-6]|span|div|p|td|font)[^>]*>\s*([0-9]{6,8})\s*<\/(?:b|strong|h[1-6]|span|div|p|td|font)>/i;
    const htmlCodeMatch = rawText.match(htmlCodePattern);
    if (htmlCodeMatch && htmlCodeMatch[1]) {
      const candidate = htmlCodeMatch[1];
      if (!(candidate.startsWith('202') || candidate.startsWith('203'))) {
        return candidate;
      }
    }

    // 4. Contextual verification check (requires email context to be verification-related)
    const isVerificationContext = /(?:verification|verify|security|garena|authenticat|password|code|otp|confirm)/i.test(subject || "") ||
                                 /(?:verification|verify|security|garena|authenticat|password|code|otp|confirm)/i.test(rawText);

    if (isVerificationContext) {
      let cleanText = rawText.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
      const candidates = [...cleanText.matchAll(/(?:^|[\s:;.,!?'"()\[\]{}–—\-])([0-9]{6})(?:$|[\s:;.,!?'"()\[\]{}–—\-])/g)];
      for (const c of candidates) {
        const num = c[1];
        if (num.startsWith('202') || num.startsWith('203')) continue; // Exclude year numbers
        if (/^(\d)\1+$/.test(num)) continue; // Exclude repetitive dummy numbers
        if (num === '123456' || num === '654321') continue;
        return num;
      }
    }

    return null;
  };

  // Trash message (Gmail vs Zoho)
  const handleDeleteGmailMessage = async (messageId) => {
    if (activeTab === 'zoho') {
      await handleDeleteZohoMessage(messageId);
      return;
    }

    if (!selectedUser) return;
    if (!window.confirm("Are you sure you want to move this email to trash in Gmail?")) return;
    
    try {
      showToast("Moving message to trash...", "info");
      const accessToken = await getFreshAccessToken(selectedUser);
      const isLocalUrl = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' || 
                         window.location.port !== '';
      const gmailApiBase = isLocalUrl
        ? '/google-gmail-proxy'
        : 'https://gmail.googleapis.com';

      const trashUrl = `${gmailApiBase}/gmail/v1/users/me/messages/${messageId}/trash`;
      const response = await fetch(trashUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gmail API returned error: ${errText}`);
      }

      showToast("Email moved to trash successfully.", "success");
      setActiveEmailDetails(null);
      fetchGmailMessages(selectedUser, gmailQuery);
    } catch (err) {
      console.error("Trash error:", err);
      showToast("Failed to move email to trash.", "error");
    }
  };

  const handleDeleteZohoMessage = async (messageId) => {
    if (!selectedUser) return;
    if (!window.confirm("Are you sure you want to delete this email in Zoho Mail?")) return;
    try {
      showToast("Moving message to trash...", "info");
      const accessToken = await getFreshZohoAccessToken(selectedUser);
      await executeZohoRequest(
        `/api/accounts/${selectedUser.zoho_account_id}/messages/${messageId}`,
        'PUT',
        accessToken,
        { action: 'trash' }
      );

      showToast("Email moved to Zoho trash.", "success");
      setActiveEmailDetails(null);
      fetchZohoMessages(selectedUser, gmailQuery);
    } catch (err) {
      console.error(err);
      showToast("Failed to move Zoho email to trash.", "error");
    }
  };

  // Permanent Delete (Gmail only)
  const handlePermanentlyDelete = async (messageId) => {
    if (!selectedUser) return;
    if (!window.confirm("CRITICAL: Are you sure you want to permanently delete this email? This cannot be undone!")) return;
    
    try {
      showToast("Permanently deleting message...", "info");
      const accessToken = await getFreshAccessToken(selectedUser);
      const isLocalUrl = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' || 
                         window.location.port !== '';
      const gmailApiBase = isLocalUrl
        ? '/google-gmail-proxy'
        : 'https://gmail.googleapis.com';

      const deleteUrl = `${gmailApiBase}/gmail/v1/users/me/messages/${messageId}`;
      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gmail API returned error: ${errText}`);
      }

      showToast("Email permanently deleted.", "success");
      setActiveEmailDetails(null);
      fetchGmailMessages(selectedUser, gmailQuery);
    } catch (err) {
      console.error("Permanent delete error:", err);
      showToast("Failed to permanently delete email.", "error");
    }
  };

  // Gmail Label Modification Flow (Starred/Unread)
  const handleModifyLabels = async (messageId, modifications) => {
    if (!selectedUser) return;
    try {
      const accessToken = await getFreshAccessToken(selectedUser);
      const isLocalUrl = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' || 
                         window.location.port !== '';
      const gmailApiBase = isLocalUrl
        ? '/google-gmail-proxy'
        : 'https://gmail.googleapis.com';

      const modifyUrl = `${gmailApiBase}/gmail/v1/users/me/messages/${messageId}/modify`;
      const response = await fetch(modifyUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(modifications)
      });

      if (!response.ok) {
        throw new Error("Gmail Modify API returned error status: " + response.status);
      }

      const updatedMsg = await response.json();
      showToast("Message labels updated successfully.", "success");
      
      // Update local state details to reflect stars
      setActiveEmailDetails(prev => prev && prev.id === messageId ? { ...prev, labelIds: updatedMsg.labelIds } : prev);
      setEmails(prev => prev.map(m => m.id === messageId ? { ...m, labelIds: updatedMsg.labelIds } : m));
    } catch (err) {
      console.error(err);
      showToast("Failed to update message labels.", "error");
    }
  };

  // Gmail Send Reply / Compose Flow
  const handleComposeSend = async (e) => {
    e.preventDefault();
    if (!selectedUser || !composeTo || !composeBody) return;

    setSendingEmail(true);
    try {
      const accessToken = await getFreshAccessToken(selectedUser);
      const isLocalUrl = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' || 
                         window.location.port !== '';
      const gmailApiBase = isLocalUrl
        ? '/google-gmail-proxy'
        : 'https://gmail.googleapis.com';

      // Create RFC 2822 formatted raw message
      const rfc2822Message = [
        `To: ${composeTo}`,
        `Subject: ${composeSubject}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        '',
        composeBody
      ].join('\r\n');

      const rawBase64 = window.btoa(unescape(encodeURIComponent(rfc2822Message)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const sendUrl = `${gmailApiBase}/gmail/v1/users/me/messages/send`;
      const response = await fetch(sendUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw: rawBase64 })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gmail API send returned: ${errText}`);
      }

      showToast("Email dispatched successfully!", "success");
      setComposeModalOpen(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      fetchGmailMessages(selectedUser, gmailQuery);
    } catch (err) {
      console.error(err);
      showToast("Failed to send email: " + err.message, "error");
    } finally {
      setSendingEmail(false);
    }
  };

  // Gmail Push Subscription Setup (Google Pub/Sub Webhook)
  const handleSubscribePush = async () => {
    if (!selectedUser) return;
    const topic = topicInput.trim();
    if (!topic) {
      showToast("Please enter a valid Google Pub/Sub topic path.", "warning");
      return;
    }
    
    try {
      showToast("Subscribing to Gmail push notifications...", "info");
      const accessToken = await getFreshAccessToken(selectedUser);
      const isLocal = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' || 
                      window.location.port !== '';
      const gmailApiBase = isLocal
        ? '/google-gmail-proxy'
        : 'https://gmail.googleapis.com';

      const watchUrl = `${gmailApiBase}/gmail/v1/users/me/watch`;
      const response = await fetch(watchUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          topicName: topic,
          labelIds: ["INBOX"]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gmail Watch API returned error: ${errText}`);
      }

      const data = await response.json();
      const expirationTime = data.expiration;
      
      const credRef = doc(db, 'gmail_credentials', selectedUser.id);
      await updateDoc(credRef, {
        gmail_watch_status: 'active',
        gmail_watch_expiration: new Date(Number(expirationTime)).toISOString(),
        gmail_watch_history_id: data.historyId,
        gmail_watch_topic: topic
      });

      setSelectedUser(prev => ({
        ...prev,
        gmail_watch_status: 'active',
        gmail_watch_expiration: new Date(Number(expirationTime)).toISOString(),
        gmail_watch_history_id: data.historyId,
        gmail_watch_topic: topic
      }));

      showToast("Successfully subscribed to Gmail real-time push events!", "success");
    } catch (err) {
      console.error("Watch error:", err);
      showToast("Failed to enable push notifications: " + err.message, "error");
    }
  };

  const handleUnsubscribePush = async () => {
    if (!selectedUser) return;
    try {
      showToast("Removing watch listener...", "info");
      const accessToken = await getFreshAccessToken(selectedUser);
      const isLocal = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' || 
                      window.location.port !== '';
      const gmailApiBase = isLocal
        ? '/google-gmail-proxy'
        : 'https://gmail.googleapis.com';

      const stopUrl = `${gmailApiBase}/gmail/v1/users/me/stop`;
      const response = await fetch(stopUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!response.ok && response.status !== 404) {
        const errText = await response.text();
        throw new Error(`Google Stop API returned error: ${errText}`);
      }

      const credRef = doc(db, 'gmail_credentials', selectedUser.id);
      await updateDoc(credRef, {
        gmail_watch_status: 'stopped',
        gmail_watch_expiration: null
      });

      setSelectedUser(prev => ({
        ...prev,
        gmail_watch_status: 'stopped',
        gmail_watch_expiration: null
      }));

      showToast("Push notifications subscription terminated.", "success");
    } catch (err) {
      console.error("Stop watch error:", err);
      showToast("Failed to stop push notifications: " + err.message, "error");
    }
  };

  const handleSaveCustomTopicName = async () => {
    if (!selectedUser) return;
    const topic = topicInput.trim();
    if (!topic) return;

    try {
      const credRef = doc(db, 'gmail_credentials', selectedUser.id);
      await updateDoc(credRef, {
        gmail_watch_topic: topic
      });
      setSelectedUser(prev => ({ ...prev, gmail_watch_topic: topic }));
      setEditingTopic(false);
      showToast("Default watch topic updated locally.", "success");
    } catch (err) {
      showToast("Failed to update topic path.", "error");
    }
  };

  // Filters connected accounts by client name, email address, or Game ID name
  const activeUsers = activeTab === 'gmail' ? gmailUsers : activeTab === 'zoho' ? zohoUsers : imapUsers;
  const filteredUsers = activeUsers.filter(user => {
    const emailStr = activeTab === 'gmail' ? user.gmail_email : activeTab === 'zoho' ? user.zoho_email : user.imap_email;
    const cleanEmail = emailStr || '';
    const cleanUserName = user.userName || '';
    const cleanGameId = user.game_id_name || '';
    const cleanGameUid = user.game_uid || user.ff_uid || '';
    const cleanPrice = user.price_inr !== undefined && user.price_inr !== null ? String(user.price_inr) : '';
    const cleanInsta = user.instagram_link || '';
    const cleanYt = user.youtube_link || '';
    const queryLower = searchQuery.toLowerCase();
    return cleanEmail.toLowerCase().includes(queryLower) ||
           cleanUserName.toLowerCase().includes(queryLower) ||
           cleanGameId.toLowerCase().includes(queryLower) ||
           cleanGameUid.toLowerCase().includes(queryLower) ||
           cleanPrice.includes(queryLower) ||
           cleanInsta.toLowerCase().includes(queryLower) ||
           cleanYt.toLowerCase().includes(queryLower);
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex font-sans">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      <div className="flex-1 lg:pl-72 flex flex-col min-w-0 h-screen overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(true)} title={`${activeTab === 'gmail' ? 'Gmail' : activeTab === 'zoho' ? 'Zoho' : 'IMAP'} Monitoring Inbox`} />

        {/* Tab System Selector & Bulk Import/Export Toolbar */}
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3 flex items-center justify-between gap-4 overflow-x-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleTabChange('gmail')}
              className={`px-5 py-2.5 text-xs font-black rounded-xl transition-all duration-200 flex items-center gap-2 ${
                activeTab === 'gmail'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/20 scale-[1.02]'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              Gmail Monitor
            </button>
            <button
              onClick={() => handleTabChange('zoho')}
              className={`px-5 py-2.5 text-xs font-black rounded-xl transition-all duration-200 flex items-center gap-2 ${
                activeTab === 'zoho'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/20 scale-[1.02]'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              Zoho Mail Monitor
            </button>
            <button
              onClick={() => handleTabChange('imap')}
              className={`px-5 py-2.5 text-xs font-black rounded-xl transition-all duration-200 flex items-center gap-2 ${
                activeTab === 'imap'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/20 scale-[1.02]'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              IMAP Mailbox Monitor
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportCredentials}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 transition-all flex items-center gap-1.5 shadow-sm"
              title="Export all credentials to JSON file including App Passwords"
            >
              <Download className="w-3.5 h-3.5 text-indigo-500" />
              <span>Export Accounts</span>
            </button>
            <button
              onClick={() => setImportModalOpen(true)}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/80 transition-all flex items-center gap-1.5 shadow-sm"
              title="Bulk import accounts with App Passwords"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-500" />
              <span>Import Accounts</span>
            </button>
          </div>
        </div>

        <main className="flex-1 flex overflow-hidden">
          
          {/* Left Panel: Accounts list (1/3 width) */}
          <div className={`w-full lg:w-96 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full shrink-0 ${
            selectedUser ? 'hidden lg:flex' : 'flex'
          }`}>
            <div className="p-4 space-y-3.5 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
                    <ShieldCheck className="w-4 h-4 text-white" />
                  </div>
                  {activeTab === 'gmail' ? 'Gmail' : activeTab === 'zoho' ? 'Zoho' : 'IMAP'} Accounts
                </h3>
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full">
                  {filteredUsers.length}
                </span>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 font-semibold">
                Manage and audit connected {activeTab === 'gmail' ? 'Gmail' : activeTab === 'zoho' ? 'Zoho' : 'IMAP'} addresses.
              </p>

              <button
                onClick={handleExportCredentials}
                className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>EXPORT ALL {gmailUsers.length + zohoUsers.length + imapUsers.length} ACCOUNTS (JSON)</span>
              </button>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search email or game ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-xs bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-gray-900 dark:text-white transition-all font-semibold placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60 p-2 space-y-1">
              {(activeTab === 'gmail' ? loadingGmailUsers : activeTab === 'zoho' ? loadingZohoUsers : loadingImapUsers) ? (
                <div className="flex flex-col items-center justify-center p-8 space-y-2">
                  <Loader className="w-6 h-6 animate-spin text-indigo-500" />
                  <span className="text-xs text-gray-400 font-bold">Loading users...</span>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center p-8">
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-bold">No connected mailboxes found.</p>
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const isSelected = selectedUser?.id === user.id;
                  const currentEmail = activeTab === 'gmail' ? user.gmail_email : activeTab === 'zoho' ? user.zoho_email : user.imap_email;
                  const isVerified = activeTab === 'gmail' ? user.gmail_verified_by_admin : activeTab === 'zoho' ? user.zoho_verified_by_admin : user.imap_verified_by_admin;
                  return (
                    <div
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className={`w-full text-left p-3.5 rounded-2xl cursor-pointer transition-all duration-200 border group ${
                        isSelected 
                          ? 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-800 shadow-md shadow-indigo-500/5 ring-1 ring-indigo-200/50 dark:ring-indigo-900/30' 
                          : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:border-gray-200 dark:hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap gap-1.5 mb-1.5">
                            {user.game_id_name && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 gap-1 shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                Game ID: {user.game_id_name}
                              </span>
                            )}
                            {(user.game_uid || user.ff_uid) && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-955/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-900/40 gap-1 shadow-xs font-mono">
                                🎮 UID: {user.game_uid || user.ff_uid}
                              </span>
                            )}
                            {user.price_inr !== undefined && user.price_inr !== null && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-450 border border-emerald-200 dark:border-emerald-900/40 gap-0.5 shadow-sm">
                                ₹{user.price_inr}
                              </span>
                            )}
                            {(() => {
                              const insta = getInstagramDetails(user);
                              if (!insta.link) return null;
                              return (
                                <a
                                  href={insta.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-fuchsia-50 dark:bg-fuchsia-950/60 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-200 dark:border-fuchsia-900/40 gap-1 shadow-sm hover:underline"
                                  title={insta.username ? `@${insta.username}` : 'Instagram Profile'}
                                >
                                  📸 {insta.username ? `@${insta.username}` : 'Insta'}
                                </a>
                              );
                            })()}
                            {user.youtube_link && (
                              <a
                                href={user.youtube_link.startsWith('http') ? user.youtube_link : `https://${user.youtube_link}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 gap-1 shadow-sm hover:underline"
                              >
                                🔴 YouTube
                              </a>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {currentEmail}
                          </p>
                          <p className="text-xs text-gray-450 dark:text-gray-550 truncate font-semibold">
                            Connected by: {user.userName || 'Anonymous User'}
                          </p>
                          <span className="text-[10px] text-gray-400 dark:text-gray-650 block mt-0.5 truncate font-mono">
                            Owner: {user.userEmail}
                          </span>
                        </div>

                        {/* Verification & Delete connection */}
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (activeTab === 'gmail') {
                                handleToggleVerification(user.id, isVerified);
                              } else if (activeTab === 'zoho') {
                                handleToggleZohoVerification(user.id, isVerified);
                              } else {
                                handleToggleImapVerification(user.id, isVerified);
                              }
                            }}
                            className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
                              isVerified
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900'
                                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900'
                            }`}
                          >
                            {isVerified ? 'VERIFIED' : 'PENDING'}
                          </button>
                          {userDoc?.role === 'superadmin' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (activeTab === 'gmail') {
                                  handleDeleteConnection(user.id);
                                } else if (activeTab === 'zoho') {
                                  handleDeleteZohoConnection(user.id);
                                } else {
                                  handleDeleteImapConnection(user.id);
                                }
                              }}
                              className="p-1 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
                              title="Delete Connection"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right panel: Inbox display (2/3 width) */}
          <div className={`flex-1 bg-gray-50 dark:bg-gray-950 flex flex-col h-full overflow-hidden ${
            selectedUser ? 'flex' : 'hidden lg:flex'
          }`}>
            {!selectedUser ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Inbox className="w-8 h-8" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h4 className="text-base font-bold text-gray-900 dark:text-white">Audit Inbox Viewer</h4>
                  <p className="text-xs text-gray-400 dark:text-gray-600 leading-relaxed font-semibold">
                    Select a connected {activeTab === 'gmail' ? 'Gmail' : activeTab === 'zoho' ? 'Zoho' : 'IMAP'} mailbox from the left panel to review logs, verify tokens, and extract active codes.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header panel */}
                <div className="p-3 sm:p-5 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 space-y-3">
                  {/* Top Bar: Always visible */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        onClick={() => setSelectedUser(null)}
                        className="lg:hidden p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl shrink-0"
                        title="Back to account list"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest truncate">
                            Auditing Mailbox
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black shrink-0 ${
                            (activeTab === 'gmail' ? selectedUser.gmail_verified_by_admin : activeTab === 'zoho' ? selectedUser.zoho_verified_by_admin : selectedUser.imap_verified_by_admin)
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                          }`}>
                            {(activeTab === 'gmail' ? selectedUser.gmail_verified_by_admin : activeTab === 'zoho' ? selectedUser.zoho_verified_by_admin : selectedUser.imap_verified_by_admin)
                              ? 'Verified' : 'Pending'
                            }
                          </span>
                        </div>
                        <h3 className="text-sm sm:text-base font-black text-gray-900 dark:text-white truncate">
                          {selectedUser.game_id_name ? `🎯 ${selectedUser.game_id_name}` : (activeTab === 'gmail' ? selectedUser.gmail_email : activeTab === 'zoho' ? selectedUser.zoho_email : selectedUser.imap_email)}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => activeTab === 'gmail' ? fetchGmailMessages(selectedUser, gmailQuery) : activeTab === 'zoho' ? fetchZohoMessages(selectedUser, gmailQuery) : fetchImapMessages(selectedUser, gmailQuery)}
                        disabled={loadingEmails}
                        className="p-2 sm:px-3.5 sm:py-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl border border-gray-200 dark:border-gray-700 transition-all flex items-center gap-1.5 shadow-sm"
                        title="Refresh Inbox"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingEmails ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Refresh Inbox</span>
                      </button>

                      {activeTab === 'gmail' && (
                        <button
                          onClick={() => {
                            setComposeTo('');
                            setComposeSubject('');
                            setComposeBody('');
                            setComposeModalOpen(true);
                          }}
                          className="p-2 sm:px-3.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-650/10 flex items-center gap-1.5"
                          title="Compose Email"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Compose</span>
                        </button>
                      )}

                      {/* Mobile Controls Expansion Toggle */}
                      <button
                        onClick={() => setMobileHeaderExpanded(!mobileHeaderExpanded)}
                        className="sm:hidden px-2 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-extrabold text-[11px] rounded-xl border border-indigo-200 dark:border-indigo-800/60 flex items-center gap-1"
                        title="Toggle Header Controls"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>{mobileHeaderExpanded ? 'Less' : 'Controls'}</span>
                        {mobileHeaderExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Detailed Controls Section: Visible always on sm+, toggled on mobile */}
                  <div className={`${mobileHeaderExpanded ? 'block' : 'hidden sm:block'} pt-2 space-y-3 border-t border-gray-100 dark:border-gray-800`}>
                    {/* Game ID Name & Price Customization Panel */}
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Game ID Name Section */}
                      {editingGameIdName ? (
                        <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1 rounded-xl shadow-inner">
                          <input
                            type="text"
                            value={gameIdNameInput}
                            onChange={(e) => setGameIdNameInput(e.target.value)}
                            placeholder="Enter Game ID / Nickname..."
                            className="bg-transparent text-xs font-bold text-gray-900 dark:text-white focus:outline-none w-48 py-1"
                          />
                          <button
                            onClick={handleSaveGameIdName}
                            disabled={savingGameIdName}
                            className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[9px] uppercase tracking-wider rounded-lg"
                          >
                            {savingGameIdName ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingGameIdName(false)}
                            className="text-gray-400 hover:text-rose-500 font-bold text-[9px] uppercase tracking-wider px-1"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {selectedUser.game_id_name ? (
                            <h3 className="text-base font-black text-rose-500 flex items-center gap-1.5">
                              <span>🎯 Game ID: {selectedUser.game_id_name}</span>
                            </h3>
                          ) : (
                            <h3 className="text-base font-black text-gray-900 dark:text-white truncate">
                              {activeTab === 'gmail' ? selectedUser.gmail_email : activeTab === 'zoho' ? selectedUser.zoho_email : selectedUser.imap_email}
                            </h3>
                          )}

                          <button
                            onClick={() => {
                              setGameIdNameInput(selectedUser.game_id_name || '');
                              setEditingGameIdName(true);
                            }}
                            className="p-1 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/80 transition-all"
                            title="Edit Game ID Name"
                          >
                            <span className="text-[10px] font-black uppercase text-indigo-500 hover:underline">
                              {selectedUser.game_id_name ? '[Edit Name]' : '[Give Game ID Name]'}
                            </span>
                          </button>
                        </div>
                      )}

                      <span className="text-gray-300 dark:text-gray-700 font-bold">•</span>

                      {/* Free Fire UID Section */}
                      {editingGameUid ? (
                        <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1 rounded-xl shadow-inner">
                          <span className="text-xs font-bold text-amber-500">🎮 UID:</span>
                          <input
                            type="text"
                            value={gameUidInput}
                            onChange={(e) => setGameUidInput(e.target.value)}
                            placeholder="Enter Free Fire Game UID..."
                            className="bg-transparent text-xs font-bold text-gray-900 dark:text-white focus:outline-none w-44 py-1 font-mono"
                          />
                          <button
                            onClick={handleSaveGameUid}
                            disabled={savingGameUid}
                            className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white font-black text-[9px] uppercase tracking-wider rounded-lg"
                          >
                            {savingGameUid ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingGameUid(false)}
                            className="text-gray-400 hover:text-rose-500 font-bold text-[9px] uppercase tracking-wider px-1"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {(selectedUser.game_uid || selectedUser.ff_uid) ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-955/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-mono shadow-xs">
                              <span>🎮 FF UID: {selectedUser.game_uid || selectedUser.ff_uid}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(selectedUser.game_uid || selectedUser.ff_uid);
                                  showToast("Free Fire UID copied!", "success");
                                }}
                                className="ml-1 text-amber-600 hover:text-amber-800 dark:hover:text-amber-200 cursor-pointer"
                                title="Copy UID"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </span>
                          ) : (
                            <span className="text-xs font-black text-gray-400 dark:text-gray-500">
                              No Free Fire UID
                            </span>
                          )}

                          <button
                            onClick={() => {
                              setGameUidInput(selectedUser.game_uid || selectedUser.ff_uid || '');
                              setEditingGameUid(true);
                            }}
                            className="p-1 text-gray-400 hover:text-amber-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/80 transition-all cursor-pointer"
                            title="Edit Free Fire UID"
                          >
                            <span className="text-[10px] font-black uppercase text-amber-600 hover:underline">
                              {(selectedUser.game_uid || selectedUser.ff_uid) ? '[Edit UID]' : '[+ Add FF UID]'}
                            </span>
                          </button>
                        </div>
                      )}

                      <span className="text-gray-300 dark:text-gray-700 font-bold">•</span>

                      {/* Pricing Section */}
                      {editingPrice ? (
                        <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1 rounded-xl shadow-inner">
                          <span className="text-xs font-bold text-gray-400">₹</span>
                          <input
                            type="number"
                            value={priceInput}
                            onChange={(e) => setPriceInput(e.target.value)}
                            placeholder="Enter Price (INR)..."
                            className="bg-transparent text-xs font-bold text-gray-900 dark:text-white focus:outline-none w-28 py-1"
                          />
                          <button
                            onClick={handleSavePrice}
                            disabled={savingPrice}
                            className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[9px] uppercase tracking-wider rounded-lg"
                          >
                            {savingPrice ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingPrice(false)}
                            className="text-gray-400 hover:text-rose-500 font-bold text-[9px] uppercase tracking-wider px-1"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {selectedUser.price_inr !== undefined && selectedUser.price_inr !== null ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-450 border border-emerald-200 dark:border-emerald-900/40 shadow-sm">
                              ₹{selectedUser.price_inr}
                            </span>
                          ) : (
                            <span className="text-xs font-black text-gray-400 dark:text-gray-500">
                              No Price Set
                            </span>
                          )}

                          <button
                            onClick={() => {
                              setPriceInput(selectedUser.price_inr !== undefined && selectedUser.price_inr !== null ? String(selectedUser.price_inr) : '');
                              setEditingPrice(true);
                            }}
                            className="p-1 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/80 transition-all"
                            title="Edit Price"
                          >
                            <span className="text-[10px] font-black uppercase text-indigo-500 hover:underline">
                              {selectedUser.price_inr !== undefined && selectedUser.price_inr !== null ? '[Edit Price]' : '[Set Price]'}
                            </span>
                          </button>
                        </div>
                      )}

                      <span className="text-gray-300 dark:text-gray-700 font-bold">•</span>

                      {/* Instagram Link Section */}
                      {editingInstaLink ? (
                        <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1 rounded-xl shadow-inner">
                          <span className="text-xs font-bold text-fuchsia-500">📸</span>
                          <input
                            type="text"
                            value={instaLinkInput}
                            onChange={(e) => setInstaLinkInput(e.target.value)}
                            placeholder="Username ya profile link..."
                            className="bg-transparent text-xs font-bold text-gray-900 dark:text-white focus:outline-none w-44 py-1"
                          />
                          <button
                            onClick={handleSaveInstaLink}
                            disabled={savingInstaLink}
                            className="px-2 py-1 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-black text-[9px] uppercase tracking-wider rounded-lg"
                          >
                            {savingInstaLink ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingInstaLink(false)}
                            className="text-gray-400 hover:text-rose-500 font-bold text-[9px] uppercase tracking-wider px-1"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {(() => {
                            const insta = getInstagramDetails(selectedUser);
                            if (insta.link) {
                              return (
                                <a
                                  href={insta.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-black uppercase tracking-wider bg-fuchsia-50 dark:bg-fuchsia-950/60 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-200 dark:border-fuchsia-900/40 shadow-sm hover:underline gap-1"
                                  title={insta.username ? `@${insta.username}` : 'Instagram Profile'}
                                >
                                  📸 {insta.username ? `@${insta.username}` : 'Insta Link'}
                                </a>
                              );
                            }
                            return (
                              <span className="text-xs font-black text-gray-400 dark:text-gray-500">
                                No Insta Link
                              </span>
                            );
                          })()}

                          <button
                            onClick={() => {
                              setInstaLinkInput(selectedUser.instagram_link || '');
                              setEditingInstaLink(true);
                            }}
                            className="p-1 text-gray-400 hover:text-fuchsia-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/80 transition-all"
                            title="Edit Instagram Link"
                          >
                            <span className="text-[10px] font-black uppercase text-fuchsia-500 hover:underline">
                              {selectedUser.instagram_link ? '[Edit Insta]' : '[Set Insta Link]'}
                            </span>
                          </button>
                        </div>
                      )}

                      <span className="text-gray-300 dark:text-gray-700 font-bold">•</span>

                      {/* YouTube Link Section */}
                      {editingYoutubeLink ? (
                        <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1 rounded-xl shadow-inner">
                          <span className="text-xs font-bold text-red-500">🔴</span>
                          <input
                            type="text"
                            value={youtubeLinkInput}
                            onChange={(e) => setYoutubeLinkInput(e.target.value)}
                            placeholder="https://youtube.com/..."
                            className="bg-transparent text-xs font-bold text-gray-900 dark:text-white focus:outline-none w-44 py-1"
                          />
                          <button
                            onClick={handleSaveYoutubeLink}
                            disabled={savingYoutubeLink}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white font-black text-[9px] uppercase tracking-wider rounded-lg"
                          >
                            {savingYoutubeLink ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingYoutubeLink(false)}
                            className="text-gray-400 hover:text-rose-500 font-bold text-[9px] uppercase tracking-wider px-1"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {selectedUser.youtube_link ? (
                            <a
                              href={selectedUser.youtube_link.startsWith('http') ? selectedUser.youtube_link : `https://${selectedUser.youtube_link}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-black uppercase tracking-wider bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 shadow-sm hover:underline gap-1"
                            >
                              🔴 YouTube Link
                            </a>
                          ) : (
                            <span className="text-xs font-black text-gray-400 dark:text-gray-500">
                              No YT Link
                            </span>
                          )}

                          <button
                            onClick={() => {
                              setYoutubeLinkInput(selectedUser.youtube_link || '');
                              setEditingYoutubeLink(true);
                            }}
                            className="p-1 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/80 transition-all"
                            title="Edit YouTube Link"
                          >
                            <span className="text-[10px] font-black uppercase text-red-500 hover:underline">
                              {selectedUser.youtube_link ? '[Edit YT]' : '[Set YT Link]'}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>

                    {selectedUser.game_id_name && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-extrabold mt-0.5">
                        Email: {activeTab === 'gmail' ? selectedUser.gmail_email : activeTab === 'zoho' ? selectedUser.zoho_email : selectedUser.imap_email}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                      Connected by: {selectedUser.userName} | Owner: {selectedUser.userEmail}
                    </p>

                    {/* Gmail-only Pub/Sub Topic and Assignments */}
                    {activeTab === 'gmail' && (
                      <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                        <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
                          <span className="text-[10px] font-bold text-gray-400 uppercase shrink-0">Push Watch Topic:</span>
                          {editingTopic ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={topicInput}
                                onChange={(e) => setTopicInput(e.target.value)}
                                className="px-3 py-1 bg-gray-50 dark:bg-gray-800 text-xs border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white font-bold w-64 focus:outline-none"
                              />
                              <button
                                onClick={handleSaveCustomTopicName}
                                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-lg"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingTopic(false);
                                  setTopicInput(selectedUser.gmail_watch_topic || 'gmail-notifications');
                                }}
                                className="p-1.5 text-gray-400 hover:text-gray-600"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <code className="text-xs px-2.5 py-1 bg-gray-50 dark:bg-gray-800/80 rounded-lg text-indigo-650 dark:text-indigo-400 font-bold border border-gray-150 dark:border-gray-800 font-mono">
                                {selectedUser.gmail_watch_topic || 'gmail-notifications'}
                              </code>
                              <button
                                onClick={() => setEditingTopic(true)}
                                className="text-[10px] font-bold text-gray-400 hover:text-indigo-600 underline"
                              >
                                (Edit)
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Operator Assignments Dropdown (only for superadmin) */}
                        {userDoc?.role === 'superadmin' && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Operator:</span>
                            <select
                              value={selectedUser.assignedAdminId || ''}
                              onChange={(e) => handleAssignGmailAdmin(selectedUser.id, e.target.value)}
                              className="bg-gray-50 dark:bg-gray-800 text-xs px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none font-bold"
                            >
                              <option value="">Unassigned (Superadmin Only)</option>
                              {admins.map(admin => (
                                <option key={admin.uid} value={admin.uid}>
                                  {admin.name} ({admin.email.split('@')[0]})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Zoho-only Assignments */}
                    {activeTab === 'zoho' && userDoc?.role === 'superadmin' && (
                      <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-col md:flex-row gap-4 justify-end items-start md:items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Operator:</span>
                          <select
                            value={selectedUser.assignedAdminId || ''}
                            onChange={(e) => handleAssignZohoAdmin(selectedUser.id, e.target.value)}
                            className="bg-gray-50 dark:bg-gray-800 text-xs px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none font-bold"
                          >
                            <option value="">Unassigned (Superadmin Only)</option>
                            {admins.map(admin => (
                              <option key={admin.uid} value={admin.uid}>
                                {admin.name} ({admin.email.split('@')[0]})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* IMAP-only Assignments */}
                    {activeTab === 'imap' && userDoc?.role === 'superadmin' && (
                      <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-col md:flex-row gap-4 justify-end items-start md:items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Operator:</span>
                          <select
                            value={selectedUser.assignedAdminId || ''}
                            onChange={(e) => handleAssignImapAdmin(selectedUser.id, e.target.value)}
                            className="bg-gray-50 dark:bg-gray-800 text-xs px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none font-bold"
                          >
                            <option value="">Unassigned (Superadmin Only)</option>
                            {admins.map(admin => (
                              <option key={admin.uid} value={admin.uid}>
                                {admin.name} ({admin.email.split('@')[0]})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Verification Pending blocker */}
                {activeTab === 'gmail' && !selectedUser.gmail_verified_by_admin && (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50">
                      <ShieldAlert className="w-7 h-7" />
                    </div>
                    <div className="space-y-1.5 max-w-sm">
                      <h4 className="text-base font-bold text-gray-900 dark:text-white">Verification Required</h4>
                      <p className="text-xs text-gray-400 dark:text-gray-550 leading-relaxed font-semibold">
                        This Gmail connection has not been verified by a Super Administrator. Verify this profile from the left panel to begin auditing.
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === 'zoho' && !selectedUser.zoho_verified_by_admin && (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-955/20 flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50">
                      <ShieldAlert className="w-7 h-7" />
                    </div>
                    <div className="space-y-1.5 max-w-sm">
                      <h4 className="text-base font-bold text-gray-900 dark:text-white">Verification Required</h4>
                      <p className="text-xs text-gray-400 dark:text-gray-550 leading-relaxed font-semibold">
                        This Zoho Mail connection has not been verified by a Super Administrator. Verify this profile from the left panel to begin auditing.
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === 'imap' && !selectedUser.imap_verified_by_admin && (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-955/20 flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50">
                      <ShieldAlert className="w-7 h-7" />
                    </div>
                    <div className="space-y-1.5 max-w-sm">
                      <h4 className="text-base font-bold text-gray-900 dark:text-white">Verification Required</h4>
                      <p className="text-xs text-gray-400 dark:text-gray-550 leading-relaxed font-semibold">
                        This IMAP connection has not been verified by a Super Administrator. Verify this profile from the left panel to begin auditing.
                      </p>
                    </div>
                  </div>
                )}

                {/* Email logs */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  
                  {/* Search query input */}
                  {((activeTab === 'gmail' && selectedUser.gmail_verified_by_admin) || (activeTab === 'zoho' && selectedUser.zoho_verified_by_admin) || (activeTab === 'imap' && selectedUser.imap_verified_by_admin)) && (
                    <div className="px-4 py-3 bg-gray-50/50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-800 flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder={activeTab === 'gmail' ? "Search Gmail query (e.g. from:account@garena.com or subject:verify)..." : activeTab === 'zoho' ? "Search Zoho query..." : "Search IMAP messages..."}
                          value={gmailQuery}
                          onChange={(e) => setGmailQuery(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white transition-all font-semibold"
                        />
                      </div>
                      
                      {activeTab === 'gmail' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setGmailQuery('from:account@garena.com')}
                            className="px-2.5 py-1.5 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-750 text-[10px] font-bold border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400"
                          >
                            Garena Mail
                          </button>
                          <button
                            onClick={() => setGmailQuery('subject:verification')}
                            className="px-2.5 py-1.5 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-750 text-[10px] font-bold border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400"
                          >
                            Verification
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Messages list container */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {loadingEmails ? (
                      <div className="flex flex-col items-center justify-center p-12 space-y-2">
                        <Loader className="w-8 h-8 animate-spin text-indigo-500" />
                        <span className="text-xs text-gray-400 font-bold">Synchronizing mailbox messages...</span>
                      </div>
                    ) : errorFetching ? (
                      <div className="p-6 bg-red-50 dark:bg-red-955/10 border border-red-200 dark:border-red-900/30 rounded-2xl space-y-3">
                        <div className="flex gap-2 text-red-700 dark:text-red-400">
                          <AlertTriangle className="w-5 h-5 shrink-0" />
                          <div>
                            <h4 className="text-sm font-bold">Fetch Error / Proxy Status</h4>
                            <p className="text-xs leading-relaxed mt-0.5">{errorFetching}</p>
                          </div>
                        </div>

                        {(errorFetching.toLowerCase().includes('imap') || errorFetching.toLowerCase().includes('command failed') || errorFetching.toLowerCase().includes('zoho')) && (
                          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-300 space-y-1.5 text-xs">
                            <p className="font-bold flex items-center gap-1.5">
                              <span>📌 Zoho Mail IMAP Enable Karne Ka Tarika:</span>
                            </p>
                            <ol className="list-decimal list-inside space-y-1 text-[11px] opacity-95 leading-relaxed">
                              <li><b>mail.zoho.in</b> par jakar is account se login karein.</li>
                              <li>Top-right corner me <b>Settings (⚙️ Gear icon)</b> par click karein.</li>
                              <li><b>Mail Accounts</b> option par click karein aur apna account chunein.</li>
                              <li>Neeche scroll karke <b>"IMAP Access"</b> ka checkbox <b>ENABLE (Turn ON)</b> karein.</li>
                              <li>Save karne ke baad yahan aakar <b>Retry API Request</b> dabayein!</li>
                            </ol>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            onClick={() => activeTab === 'gmail' ? fetchGmailMessages(selectedUser, gmailQuery) : activeTab === 'zoho' ? fetchZohoMessages(selectedUser, gmailQuery) : fetchImapMessages(selectedUser, gmailQuery)}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-red-600/10 flex items-center gap-1.5"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Retry API Request</span>
                          </button>
                          <a
                            href="https://imap-proxy-server.vercel.app/health"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-600/10 flex items-center gap-1.5"
                          >
                            <span>⚡ Check Proxy Health (Vercel)</span>
                          </a>
                        </div>
                      </div>
                    ) : emails.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-12 text-center text-gray-400">
                        <Inbox className="w-10 h-10 mb-2" />
                        <p className="text-xs font-bold">No matching messages found in mailbox.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {emails.map((email) => {
                          const parsedOtp = extractOTP(email.snippet || email.body || '', email.subject || '');
                          return (
                            <div
                              key={email.id}
                              onClick={() => handleOpenEmail(email)}
                              className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl hover:border-indigo-400 dark:hover:border-indigo-700 cursor-pointer shadow-sm hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between group"
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-gray-900 dark:text-white truncate max-w-[200px]">
                                    {email.from}
                                  </span>
                                  <span className="text-[10px] font-medium text-gray-400 flex items-center gap-1">
                                    <Calendar className="w-3 h-3 shrink-0" />
                                    {formatEmailDate(email.date)}
                                  </span>
                                </div>
                                <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate">
                                  {email.subject}
                                </h4>
                                <p className="text-[11px] text-gray-450 dark:text-gray-500 truncate font-medium">
                                  {email.snippet}
                                </p>
                                
                                {/* OTP Code Alert Banner inside message list */}
                                {parsedOtp && (
                                  <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-800/60 text-xs font-black select-all shadow-sm">
                                    <span>🔑 Extracted Code:</span>
                                    <span className="bg-emerald-100 dark:bg-emerald-900 px-1.5 py-0.5 rounded font-mono font-black text-emerald-800 dark:text-emerald-300">
                                      {parsedOtp}
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline">
                                  Inspect Payload
                                  <ArrowRight className="w-3 h-3" />
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteGmailMessage(email.id);
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all"
                                  title="Trash Email"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Slide-out Full Message Details Panel/Modal */}
      {activeEmailDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs">
          <div 
            onClick={() => setActiveEmailDetails(null)}
            className="absolute inset-0"
          />
          <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col border-l border-l-gray-200 dark:border-l-gray-850 transition-all duration-300">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-900/80">
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block mb-0.5">
                  Secure Message Viewer
                </span>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                  {activeEmailDetails.subject}
                </h4>
              </div>
              <button
                onClick={() => setActiveEmailDetails(null)}
                className="p-2 text-gray-400 hover:text-gray-655 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Action Toolbar */}
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {activeEmailDetails.provider === 'gmail' && (
                  <>
                    {/* Mark Read/Unread */}
                    <button
                      onClick={() => handleModifyLabels(activeEmailDetails.id, 
                        activeEmailDetails.labelIds?.includes('UNREAD') ? { removeLabelIds: ['UNREAD'] } : { addLabelIds: ['UNREAD'] }
                      )}
                      className="px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[10px] font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 transition-all flex items-center gap-1 shadow-xs"
                      title={activeEmailDetails.labelIds?.includes('UNREAD') ? "Mark as Read" : "Mark as Unread"}
                    >
                      <MailOpen className="w-3.5 h-3.5" />
                      <span>{activeEmailDetails.labelIds?.includes('UNREAD') ? 'Mark Read' : 'Mark Unread'}</span>
                    </button>

                    {/* Star/Unstar */}
                    <button
                      onClick={() => handleModifyLabels(activeEmailDetails.id, 
                        activeEmailDetails.labelIds?.includes('STARRED') ? { removeLabelIds: ['STARRED'] } : { addLabelIds: ['STARRED'] }
                      )}
                      className="px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[10px] font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 transition-all flex items-center gap-1 shadow-xs"
                      title={activeEmailDetails.labelIds?.includes('STARRED') ? "Remove Star" : "Star message"}
                    >
                      <Star className={`w-3.5 h-3.5 ${activeEmailDetails.labelIds?.includes('STARRED') ? 'fill-amber-400 text-amber-500' : ''}`} />
                      <span>{activeEmailDetails.labelIds?.includes('STARRED') ? 'Unstar' : 'Star'}</span>
                    </button>

                    {/* Reply */}
                    <button
                      onClick={() => {
                        const fromStr = activeEmailDetails.from || '';
                        const cleanEmail = fromStr.includes('<') && fromStr.includes('>')
                          ? fromStr.substring(fromStr.indexOf('<') + 1, fromStr.indexOf('>')).trim()
                          : fromStr.trim();
                        setComposeTo(cleanEmail);
                        setComposeSubject(`Re: ${activeEmailDetails.subject || ''}`);
                        setComposeModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[10px] font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 transition-all flex items-center gap-1 shadow-xs"
                      title="Reply to sender"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Reply</span>
                    </button>

                    {/* Real-time Watch Toggle */}
                    {selectedUser?.gmail_watch_status === 'active' && selectedUser.gmail_watch_expiration && !isNaN(new Date(selectedUser.gmail_watch_expiration).getTime()) && new Date(selectedUser.gmail_watch_expiration) >= new Date() ? (
                      <button
                        onClick={handleUnsubscribePush}
                        className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-[10px] font-bold text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-all flex items-center gap-1 shadow-sm"
                        title="Stop push notifications for this mailbox"
                      >
                        <span>Unsubscribe</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleSubscribePush}
                        className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-900/50 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all flex items-center gap-1 shadow-xs"
                        title="Enable/Renew push notifications for this mailbox"
                      >
                        <span>{selectedUser?.gmail_watch_status === 'active' ? 'Re-subscribe' : 'Subscribe'}</span>
                      </button>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {/* Trash */}
                <button
                  onClick={() => handleDeleteGmailMessage(activeEmailDetails.id)}
                  className="p-1.5 text-gray-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all"
                  title="Move to Trash"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                {/* Permanent Delete (Gmail only) */}
                {activeEmailDetails.provider === 'gmail' && (
                  <button
                    onClick={() => handlePermanentlyDelete(activeEmailDetails.id)}
                    className="p-1.5 text-gray-550 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-all border border-transparent hover:border-red-200 dark:hover:border-red-900"
                    title="Permanently Delete (Skip Trash)"
                  >
                    <X className="w-3.5 h-3.5 text-red-500" />
                  </button>
                )}
              </div>
            </div>

            {/* Info panel */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 space-y-1.5 text-xs text-gray-500 dark:text-gray-400 font-semibold">
              <p><span className="text-gray-400">From:</span> <strong className="text-gray-800 dark:text-gray-300 font-bold">{activeEmailDetails.from}</strong></p>
              <p><span className="text-gray-400">Date:</span> {formatEmailDate(activeEmailDetails.date)}</p>
              <p className="font-mono text-[10px]"><span className="text-gray-450">ID:</span> {activeEmailDetails.id}</p>
              
              {/* Highlight Extracted OTP inside details panel */}
              {extractOTP(activeEmailDetails.body || activeEmailDetails.snippet, activeEmailDetails.subject) && (
                <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-xl flex items-center justify-between gap-4 select-all">
                  <div>
                    <span className="text-[10px] text-emerald-650 dark:text-emerald-400 font-black uppercase tracking-wider block mb-0.5">Extracted Verification Code</span>
                    <span className="text-lg font-mono font-black tracking-widest text-emerald-800 dark:text-emerald-300 select-all">
                      {extractOTP(activeEmailDetails.body || activeEmailDetails.snippet, activeEmailDetails.subject)}
                    </span>
                  </div>
                  <div className="text-[10px] text-emerald-500 dark:text-emerald-450 font-bold border border-emerald-200 dark:border-emerald-800 px-2 py-1 rounded bg-white dark:bg-gray-900 shrink-0">
                    Click/Double click to copy code
                  </div>
                </div>
              )}
            </div>

            {/* Email Body content */}
            <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-gray-950">
              {((activeEmailDetails.body || '')).includes('<html>') || ((activeEmailDetails.body || '')).includes('<div') || ((activeEmailDetails.body || '')).includes('<table') ? (
                <iframe
                  title="Secure Email content frame"
                  srcDoc={activeEmailDetails.body || ''}
                  className="w-full h-full border-none rounded-lg bg-white"
                  sandbox="allow-same-origin"
                />
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-xs text-gray-800 dark:text-gray-300 leading-relaxed font-medium">
                  {activeEmailDetails.body || ''}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Compose Quick Email Modal (Gmail Only) */}
      {composeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl shadow-2xl animate-modal-pop p-6 space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Mail className="w-5 h-5 text-indigo-650" />
                <span>Compose Quick Email / Draft</span>
              </h3>
              <button
                onClick={() => setComposeModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-655 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleComposeSend} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Recipient To:</label>
                <input
                  type="email"
                  required
                  placeholder="name@domain.com"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white transition-all font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Subject Line:</label>
                <input
                  type="text"
                  required
                  placeholder="Subject parameter"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white transition-all font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">HTML Message Body:</label>
                <textarea
                  rows={6}
                  required
                  placeholder="Write message body content..."
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white transition-all font-semibold font-mono leading-relaxed"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setComposeModalOpen(false)}
                  className="px-4 py-2.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingEmail}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-650/10 flex items-center gap-1.5"
                >
                  {sendingEmail && <Loader className="w-3.5 h-3.5 animate-spin" />}
                  <span>Send Email</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Credentials Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 dark:text-white">
                    Bulk Import {activeTab.toUpperCase()} Credentials
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
                    Paste JSON / CSV or upload file to add multiple accounts at once.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setImportModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Actions toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl border border-indigo-200 dark:border-indigo-800 cursor-pointer flex items-center gap-1.5 transition-all">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Choose .json / .csv File</span>
                  <input
                    type="file"
                    accept=".json,.txt,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleCopySampleJson}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-xl border border-gray-200 dark:border-gray-700 transition-all flex items-center gap-1.5"
                >
                  {copiedSample ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
                  <span>{copiedSample ? 'Copied!' : 'Copy Sample Format'}</span>
                </button>
              </div>

              {/* JSON/CSV Input Textarea */}
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                  Paste JSON Array or CSV:
                </label>
                <textarea
                  rows={8}
                  placeholder={`[\n  {\n    "email": "user@gmail.com",\n    "password": "xvte robj zmyl jxot",\n    "game_id_name": "500 wali",\n    "price_inr": 500\n  }\n]`}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  className="w-full px-4 py-3 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white font-mono leading-relaxed font-semibold transition-all"
                />
              </div>

              <div className="bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/50 p-3 rounded-2xl text-[11px] text-amber-800 dark:text-amber-300 font-semibold leading-relaxed flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  App Passwords with spaces (e.g. <code>xvte robj zmyl jxot</code>) will be automatically sanitized &amp; spaces stripped during import!
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-150 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportCredentials}
                disabled={importing || !importText.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-all"
              >
                {importing && <Loader className="w-3.5 h-3.5 animate-spin" />}
                <span>Process &amp; Import Accounts</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
