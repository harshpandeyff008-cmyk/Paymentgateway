import { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
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
  getDoc,
  addDoc, 
  updateDoc,
  deleteDoc, 
  getDocs, 
  where,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Store, 
  Loader, 
  Trash2, 
  UploadCloud, 
  FileText, 
  Mail, 
  Settings, 
  Video as VideoIcon, 
  X, 
  ExternalLink,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Key,
  Share2,
  Copy,
  Check,
  IndianRupee,
  Sparkles,
  RefreshCw,
  Edit,
  Plus,
  Save,
  Image as ImageIcon,
  MessageSquare,
  Phone,
  Send,
  ShieldCheck
} from 'lucide-react';

export default function FFStore() {
  const { currentUser, userDoc } = useAuth();
  const { showToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Normal admin is strictly blocked from FF Store
  if (userDoc?.role === 'admin') {
    return <Navigate to="/admin-dashboard" replace />;
  }

  const isEmployee = userDoc?.role === 'employee' || userDoc?.role === 'staff';
  const isSuperAdmin = userDoc?.role === 'superadmin';

  // States for store ledger
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [storefrontListings, setStorefrontListings] = useState([]);
  const [restockingId, setRestockingId] = useState(null);
  const [instaAccounts, setInstaAccounts] = useState([]);
  const [pushingAccId, setPushingAccId] = useState(null);

  // Active media carousel indices per catalog item (itemId -> number)
  const [cardMediaIndices, setCardMediaIndices] = useState({});

  // Form States
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEmail, setSelectedEmail] = useState('');
  
  // Multi-Media Upload State
  const [selectedFiles, setSelectedFiles] = useState([]); // [{ id, file, previewUrl, type, name, size }]
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState('');

  // Storefront Product States (in ₹ INR)
  const [price, setPrice] = useState(0);
  const [level, setLevel] = useState(60);
  const [rank, setRank] = useState('Heroic');
  const [skinsCount, setSkinsCount] = useState(25);
  const [charactersText, setCharactersText] = useState('Alok, Hayato, Chrono');
  const [accountUid, setAccountUid] = useState('');
  const [isOtherAccount, setIsOtherAccount] = useState(false);
  const [otherAccountName, setOtherAccountName] = useState('');
  const [otherAccountEmail, setOtherAccountEmail] = useState('');

  // Verified Mailboxes list
  const [mailboxes, setMailboxes] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Secret Link Modal States
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [secretEmail, setSecretEmail] = useState('');
  const [secretPrice, setSecretPrice] = useState(0);
  const [secretLinkUrl, setSecretLinkUrl] = useState('');
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Edit Item Modal States
  const [editingItem, setEditingItem] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrice, setEditPrice] = useState(0);
  const [editLevel, setEditLevel] = useState(60);
  const [editRank, setEditRank] = useState('Heroic');
  const [editSkinsCount, setEditSkinsCount] = useState(25);
  const [editCharactersText, setEditCharactersText] = useState('');
  const [editExistingMedia, setEditExistingMedia] = useState([]);
  const [editNewFiles, setEditNewFiles] = useState([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editUploadProgress, setEditUploadProgress] = useState(0);
  const [editUploadStatus, setEditUploadStatus] = useState('');
  const [editSelectedEmail, setEditSelectedEmail] = useState('');
  const [editIsOtherAccount, setEditIsOtherAccount] = useState(false);
  const [editOtherAccountEmail, setEditOtherAccountEmail] = useState('');
  const [editOtherAccountName, setEditOtherAccountName] = useState('');
  const [isEditDropdownOpen, setIsEditDropdownOpen] = useState(false);
  const editFileInputRef = useRef(null);

  // Configuration States (Env fallback with local storage override)
  const envCloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';
  const envPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '';
  const envStorefrontUrl = import.meta.env.VITE_STOREFRONT_API_URL || 'https://ffsstorebyshiv.web.app';
  const envStorefrontKey = import.meta.env.VITE_STOREFRONT_API_KEY || 'fs_live_clkvaW1VJYEnI6rsKeCM9iRZKolZBolK';
  
  const [cloudName, setCloudName] = useState(() => localStorage.getItem('cloudinary_cloud_name') || envCloudName);
  const [uploadPreset, setUploadPreset] = useState(() => localStorage.getItem('cloudinary_upload_preset') || envPreset);
  const [storefrontApiUrl, setStorefrontApiUrl] = useState(() => {
    const stored = localStorage.getItem('storefront_api_url');
    if (!stored || stored.includes('localhost') || stored.includes('127.0.0.1')) {
      localStorage.setItem('storefront_api_url', envStorefrontUrl);
      return envStorefrontUrl;
    }
    return stored;
  });
  const [storefrontApiKey, setStorefrontApiKey] = useState(() => {
    const stored = localStorage.getItem('storefront_api_key');
    return (stored && stored !== 'gamershield_shared_secret_key_2026') ? stored : envStorefrontKey;
  });
  const [showConfig, setShowConfig] = useState(false);

  // Super Admin Store Contact Settings States
  const [showContactModal, setShowContactModal] = useState(false);
  const [storeTelegram, setStoreTelegram] = useState('alexccseller');
  const [storeWhatsapp, setStoreWhatsapp] = useState('');
  const [storeBrandName, setStoreBrandName] = useState('Free Fire Official Deals');
  const [savingContact, setSavingContact] = useState(false);

  const fileInputRef = useRef(null);

  // Load Super Admin store contact channels from Firestore
  useEffect(() => {
    async function loadStoreContact() {
      try {
        const cSnap = await getDoc(doc(db, 'system_settings', 'store_contact'));
        if (cSnap.exists()) {
          const cd = cSnap.data();
          if (cd.telegram) setStoreTelegram(cd.telegram);
          if (cd.whatsapp) setStoreWhatsapp(cd.whatsapp);
          if (cd.brandName) {
            const cleanBn = /garena/i.test(cd.brandName) ? 'Free Fire Official Deals' : cd.brandName;
            setStoreBrandName(cleanBn);
          }
        }
      } catch (err) {
        console.warn("Failed to load store contact settings:", err);
      }
    }
    loadStoreContact();
  }, []);

  // Super Admin Save Store Contact Handler
  const handleSaveStoreContact = async (e) => {
    e.preventDefault();
    if (userDoc?.role !== 'superadmin') {
      showToast("Only Super Admin has permission to update store contact channels.", "error");
      return;
    }
    setSavingContact(true);
    try {
      await setDoc(doc(db, 'system_settings', 'store_contact'), {
        telegram: storeTelegram.trim().replace(/^@/, ''),
        whatsapp: storeWhatsapp.trim().replace(/[^0-9+]/g, ''),
        brandName: storeBrandName.trim() || 'Free Fire Official Deals',
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.email
      });
      showToast("Store Contact channels updated successfully! Changes are live on the Marketplace.", "success");
      setShowContactModal(false);
    } catch (err) {
      console.error("Failed to save contact settings:", err);
      showToast("Failed to save contact channels.", "error");
    } finally {
      setSavingContact(false);
    }
  };

  // Sync state values with localStorage
  useEffect(() => {
    localStorage.setItem('cloudinary_cloud_name', cloudName);
  }, [cloudName]);

  useEffect(() => {
    localStorage.setItem('cloudinary_upload_preset', uploadPreset);
  }, [uploadPreset]);

  useEffect(() => {
    localStorage.setItem('storefront_api_url', storefrontApiUrl);
  }, [storefrontApiUrl]);

  useEffect(() => {
    localStorage.setItem('storefront_api_key', storefrontApiKey);
  }, [storefrontApiKey]);

  // Real-time listener for store items & verified mailboxes loading
  useEffect(() => {
    if (!currentUser) return;

    // Load verified mailboxes
    const loadVerifiedMailboxes = async () => {
      try {
        const list = [];

        // Query Gmail
        const qGmail = query(collection(db, 'gmail_credentials'), where('gmail_verified_by_admin', '==', true));
        const snapGmail = await getDocs(qGmail);
        snapGmail.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({ 
            email: data.gmail_email, 
            type: 'gmail',
            game_uid: data.game_uid || data.ff_uid || '',
            game_id_name: data.game_id_name || '',
            price_inr: data.price_inr !== undefined && data.price_inr !== null ? Number(data.price_inr) : null
          });
        });

        // Query Zoho
        const qZoho = query(collection(db, 'zoho_credentials'), where('zoho_verified_by_admin', '==', true));
        const snapZoho = await getDocs(qZoho);
        snapZoho.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({ 
            email: data.zoho_email, 
            type: 'zoho',
            game_uid: data.game_uid || data.ff_uid || '',
            game_id_name: data.game_id_name || '',
            price_inr: data.price_inr !== undefined && data.price_inr !== null ? Number(data.price_inr) : null
          });
        });

        // Query IMAP
        const qImap = query(collection(db, 'imap_credentials'), where('imap_verified_by_admin', '==', true));
        const snapImap = await getDocs(qImap);
        snapImap.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({ 
            email: data.imap_email, 
            type: 'imap',
            game_uid: data.game_uid || data.ff_uid || '',
            game_id_name: data.game_id_name || '',
            price_inr: data.price_inr !== undefined && data.price_inr !== null ? Number(data.price_inr) : null
          });
        });

        // Deduplicate by email
        const uniqueList = [];
        const seen = new Set();
        for (const m of list) {
          if (!seen.has(m.email)) {
            seen.add(m.email);
            uniqueList.push(m);
          }
        }

        setMailboxes(uniqueList);
        if (uniqueList.length > 0) {
          setSelectedEmail((prev) => {
            if (!prev) {
              const defaultMb = uniqueList[0];
              if (defaultMb.price_inr !== null) {
                setPrice(defaultMb.price_inr);
              }
              return defaultMb.email;
            }
            return prev;
          });
        }

        // Collect all accounts with Instagram Link & Price
        const instaList = [];
        snapGmail.forEach(d => {
          const data = d.data();
          if (data.instagram_link && String(data.instagram_link).trim() !== '' && Number(data.price_inr || 0) > 0) {
            instaList.push({ id: d.id, ...data, email: data.gmail_email, type: 'gmail' });
          }
        });
        snapZoho.forEach(d => {
          const data = d.data();
          if (data.instagram_link && String(data.instagram_link).trim() !== '' && Number(data.price_inr || 0) > 0) {
            instaList.push({ id: d.id, ...data, email: data.zoho_email, type: 'zoho' });
          }
        });
        snapImap.forEach(d => {
          const data = d.data();
          if (data.instagram_link && String(data.instagram_link).trim() !== '' && Number(data.price_inr || 0) > 0) {
            instaList.push({ id: d.id, ...data, email: data.imap_email, type: 'imap' });
          }
        });
        setInstaAccounts(instaList);

      } catch (err) {
        console.error("Error loading verified mailboxes:", err);
        showToast("Failed to fetch verified mailboxes.", "error");
      }
    };

    loadVerifiedMailboxes();

    // Fetch storefront listings status
    const fetchListingsStatus = async () => {
      if (!storefrontApiUrl || storefrontApiUrl.includes('localhost') || storefrontApiUrl.includes('127.0.0.1')) return;
      try {
        const res = await fetch(`${storefrontApiUrl}/api/listings`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setStorefrontListings(data);
          } else {
            setStorefrontListings([]);
          }
        }
      } catch (err) {
        // Silent catch for background listing status polling
      }
    };

    fetchListingsStatus();
    const interval = setInterval(fetchListingsStatus, 10000); // sync every 10s

    const q = query(collection(db, 'ff_store'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setItems(list);
      setLoading(false);
    }, (error) => {
      console.error("Error subscribing to store items:", error);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [currentUser, showToast, storefrontApiUrl]);

  // Handle mailbox selection & price/UID auto-fill
  const handleSelectMailbox = (email) => {
    if (email === 'other') {
      setIsOtherAccount(true);
      setSelectedEmail('other');
      setIsDropdownOpen(false);
      setAccountUid('');
      showToast("Selected 'Other / Direct Account'. Please enter the Account Name / UID below.", "info");
      return;
    }

    setIsOtherAccount(false);
    setSelectedEmail(email);
    setIsDropdownOpen(false);
    const match = mailboxes.find(m => m.email === email);
    if (match) {
      if (match.price_inr !== null && match.price_inr !== undefined) {
        setPrice(Number(match.price_inr));
      }
      if (match.game_uid) {
        setAccountUid(match.game_uid);
      }
      if (match.game_id_name && !title) {
        setTitle(match.game_id_name);
      }
      if (match.price_inr || match.game_uid) {
        showToast(`Auto-filled details${match.game_uid ? ` (UID: ${match.game_uid})` : ''} from mailbox records.`, 'info');
      }
    }
  };

  // Handle multiple file selection
  const handleFilesChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newItems = [];
    for (const f of files) {
      if (f.size > 100 * 1024 * 1024) {
        showToast(`"${f.name}" exceeds 100MB max limit and was skipped.`, "error");
        continue;
      }

      let type = 'other';
      if (f.type.startsWith('image/')) type = 'image';
      else if (f.type.startsWith('video/')) type = 'video';

      const previewUrl = type === 'image' ? URL.createObjectURL(f) : null;
      newItems.push({
        id: Math.random().toString(36).substring(2, 9) + Date.now(),
        file: f,
        previewUrl,
        type,
        name: f.name,
        size: f.size
      });
    }

    setSelectedFiles(prev => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Remove individual file from preview list
  const handleRemoveFile = (idToRemove) => {
    setSelectedFiles(prev => {
      const filtered = prev.filter(f => f.id !== idToRemove);
      const removed = prev.find(f => f.id === idToRemove);
      if (removed && removed.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return filtered;
    });
  };

  // Upload to Cloudinary & Save item to Firestore
  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!selectedEmail) {
      showToast("Please select a linked game account or select 'Other'.", "error");
      return;
    }
    if (selectedEmail === 'other' && !otherAccountName.trim()) {
      showToast("Please enter an Account UID / Name for this custom direct listing.", "error");
      return;
    }
    if (!title.trim()) {
      showToast("Please enter a title.", "error");
      return;
    }
    if (selectedFiles.length === 0) {
      showToast("Please select at least one photo or video to upload.", "error");
      return;
    }
    if (!cloudName.trim() || !uploadPreset.trim()) {
      showToast("Cloudinary Cloud Name and Upload Preset are required. Configure them below.", "error");
      setShowConfig(true);
      return;
    }

    setIsUploading(true);
    setUploadProgress(5);
    setUploadStatusText(`Preparing ${selectedFiles.length} media file(s)...`);

    try {
      const uploadedMedia = [];
      const totalFiles = selectedFiles.length;

      // 1. Upload files to Cloudinary
      for (let i = 0; i < totalFiles; i++) {
        const item = selectedFiles[i];
        setUploadStatusText(`Uploading file ${i + 1} of ${totalFiles}: ${item.name}...`);

        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('upload_preset', uploadPreset);

        // `auto` lets Cloudinary detect whether this is an image or a video.
        // The endpoint must include a resource type; `/upload` alone is invalid.
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error?.message || `Failed to upload "${item.name}" to Cloudinary.`);
        }

        const uploadData = await response.json();
        uploadedMedia.push({
          url: uploadData.secure_url,
          type: uploadData.resource_type || item.type,
          name: item.name,
          publicId: uploadData.public_id
        });

        const currentProg = Math.round(((i + 1) / totalFiles) * 85);
        setUploadProgress(Math.max(10, currentProg));
      }

      setUploadStatusText("Saving listing details to store database...");
      setUploadProgress(90);

      const primaryMedia = uploadedMedia[0];
      const createdAtTimestamp = new Date().toISOString();

      const effectiveEmail = selectedEmail === 'other' 
        ? (otherAccountEmail.trim() || `direct_account_${Date.now()}@store.local`) 
        : selectedEmail;
      const effectiveUid = selectedEmail === 'other' 
        ? otherAccountName.trim() 
        : (accountUid || '');

      // 2. Save Item details to local Firestore (ff_store) - Standalone listing only
      const localDocRef = await addDoc(collection(db, 'ff_store'), {
        title: title.trim(),
        description: description.trim(),
        mediaUrl: primaryMedia.url,
        mediaType: primaryMedia.type,
        mediaList: uploadedMedia,
        linkedEmail: effectiveEmail,
        accountUid: effectiveUid,
        isDirectOtherAccount: selectedEmail === 'other',
        createdAt: createdAtTimestamp,
        createdByUid: currentUser.uid,
        createdByEmail: currentUser.email,
        price: Number(price) || 0,
        level: Number(level) || 1,
        rank,
        skinsCount: Number(skinsCount) || 0,
        characters: charactersText.split(',').map(c => c.trim()).filter(Boolean)
      });

      // 3. Optional sync with storefront API
      try {
        await fetch(`${storefrontApiUrl}/api/listings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': storefrontApiKey
          },
          body: JSON.stringify({
            game: 'Free Fire',
            title: title.trim(),
            description: description.trim(),
            price: Number(price) || 0,
            level: Number(level) || 1,
            rank: rank,
            skinsCount: Number(skinsCount) || 0,
            characters: charactersText.split(',').map(c => c.trim()).filter(Boolean),
            verified: true,
            sellerVerified: true,
            sellerEmail: effectiveEmail,
            sellerName: selectedEmail === 'other' ? (otherAccountName || 'Direct Seller') : 'System Verified',
            credentials: {
              email: effectiveEmail,
              pass: '[Direct Listing]',
              recoveryCode: 'DIRECT-FF-' + Math.floor(1000 + Math.random() * 9000)
            },
            createdAt: createdAtTimestamp,
            mediaUrl: primaryMedia.url,
            mediaType: primaryMedia.type,
            mediaList: uploadedMedia,
            linkedAdminDocId: localDocRef.id
          })
        });
      } catch (sfErr) {
        console.warn("External storefront sync skipped/failed:", sfErr.message);
      }

      showToast(`Successfully uploaded ${uploadedMedia.length} media file(s) and pushed listing!`, "success");
      
      // Reset Form
      setTitle('');
      setDescription('');
      setSelectedFiles([]);
      setOtherAccountName('');
      setOtherAccountEmail('');
      setIsOtherAccount(false);
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (err) {
      console.error("Save item failed:", err);
      showToast(err.message || "Failed to save store item.", "error");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatusText('');
    }
  };

  // Delete Store Item
  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Are you sure you want to delete the item "${item.title}"? This cannot be undone.`)) {
      return;
    }

    setDeletingId(item.id);
    try {
      // 1. Delete from local db
      await deleteDoc(doc(db, 'ff_store', item.id));

      // 2. Delete from storefront via API
      const storefrontResponse = await fetch(`${storefrontApiUrl}/api/listings/by-admin-id/${item.id}`, {
        method: 'DELETE',
        headers: {
          'x-api-key': storefrontApiKey
        }
      });

      if (!storefrontResponse.ok) {
        console.warn("Storefront deletion API call failed, but local deletion completed.");
      }

      showToast("Store item deleted successfully.", "success");
    } catch (err) {
      console.error("Error deleting store item:", err);
      showToast("Failed to delete store item.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  // Start Editing Item
  const handleStartEdit = (item) => {
    setEditingItem(item);
    setEditTitle(item.title || '');
    setEditDescription(item.description || '');
    setEditPrice(item.price !== undefined ? item.price : 0);
    setEditLevel(item.level !== undefined ? item.level : 60);
    setEditRank(item.rank || 'Heroic');
    setEditSkinsCount(item.skinsCount !== undefined ? item.skinsCount : 0);
    setEditCharactersText(Array.isArray(item.characters) ? item.characters.join(', ') : (item.characters || ''));
    
    // Check if this item was saved as an Outer / Direct Custom Account
    // or if its linkedEmail is not in our verified mailboxes list
    const isOuter = Boolean(
      item.isDirectOtherAccount || 
      item.selectedEmail === 'other' || 
      (item.linkedEmail && !mailboxes.some(m => m.email.toLowerCase() === (item.linkedEmail || '').toLowerCase()))
    );

    setEditIsOtherAccount(isOuter);
    if (isOuter) {
      setEditSelectedEmail('other');
      setEditOtherAccountEmail(item.linkedEmail || '');
      setEditOtherAccountName(item.accountUid || '');
    } else {
      setEditSelectedEmail(item.linkedEmail || (mailboxes[0]?.email || ''));
      setEditOtherAccountEmail('');
      setEditOtherAccountName('');
    }
    setIsEditDropdownOpen(false);

    const media = item.mediaList && item.mediaList.length > 0
      ? item.mediaList
      : (item.mediaUrl ? [{ url: item.mediaUrl, type: item.mediaType || 'image', name: 'Media' }] : []);
    
    setEditExistingMedia(media);
    setEditNewFiles([]);
    setEditModalOpen(true);
  };

  // Handle New Files Selected in Edit Modal
  const handleEditNewFilesChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newItems = [];
    for (const f of files) {
      if (f.size > 100 * 1024 * 1024) {
        showToast(`"${f.name}" exceeds 100MB max limit and was skipped.`, "error");
        continue;
      }
      let type = 'other';
      if (f.type.startsWith('image/')) type = 'image';
      else if (f.type.startsWith('video/')) type = 'video';

      const previewUrl = type === 'image' ? URL.createObjectURL(f) : null;
      newItems.push({
        id: Math.random().toString(36).substring(2, 9) + Date.now(),
        file: f,
        previewUrl,
        type,
        name: f.name,
        size: f.size
      });
    }

    setEditNewFiles(prev => [...prev, ...newItems]);
    if (editFileInputRef.current) editFileInputRef.current.value = '';
  };

  // Remove New File in Edit Modal
  const handleRemoveEditNewFile = (idToRemove) => {
    setEditNewFiles(prev => {
      const filtered = prev.filter(f => f.id !== idToRemove);
      const removed = prev.find(f => f.id === idToRemove);
      if (removed && removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return filtered;
    });
  };

  // Remove Existing Media in Edit Modal
  const handleRemoveEditExistingMedia = (idxToRemove) => {
    setEditExistingMedia(prev => prev.filter((_, idx) => idx !== idxToRemove));
  };

  // Save/Update Edited Item
  const handleSaveEditedItem = async (e) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!editTitle.trim()) {
      showToast("Please enter a title.", "error");
      return;
    }
    if (editExistingMedia.length === 0 && editNewFiles.length === 0) {
      showToast("Please keep or upload at least one photo or video.", "error");
      return;
    }

    setIsSavingEdit(true);
    setEditUploadProgress(10);
    setEditUploadStatus("Uploading newly attached media files...");

    try {
      const newlyUploadedMedia = [];
      const totalNew = editNewFiles.length;

      for (let i = 0; i < totalNew; i++) {
        const item = editNewFiles[i];
        setEditUploadStatus(`Uploading file ${i + 1} of ${totalNew}: ${item.name}...`);

        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('upload_preset', uploadPreset);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error?.message || `Failed to upload "${item.name}" to Cloudinary.`);
        }

        const uploadData = await response.json();
        newlyUploadedMedia.push({
          url: uploadData.secure_url,
          type: uploadData.resource_type || item.type,
          name: item.name,
          publicId: uploadData.public_id
        });

        const currentProg = Math.round(((i + 1) / totalNew) * 80);
        setEditUploadProgress(Math.max(20, currentProg));
      }

      setEditUploadStatus("Saving updated listing to database...");
      setEditUploadProgress(90);

      const finalMediaList = [...editExistingMedia, ...newlyUploadedMedia];
      if (finalMediaList.length === 0) {
        showToast("Please keep at least one photo or video.", "error");
        setIsSavingEdit(false);
        return;
      }
      const primaryMedia = finalMediaList[0];

      // Validate outer email if outer mode
      if (editIsOtherAccount && !editOtherAccountEmail.trim()) {
        showToast("Please enter an Outer Account Email / Gmail.", "error");
        setIsSavingEdit(false);
        return;
      }

      const effectiveEmail = editIsOtherAccount || editSelectedEmail === 'other'
        ? (editOtherAccountEmail.trim() || `direct_account_${Date.now()}@store.local`)
        : editSelectedEmail;

      const matchedMailbox = mailboxes.find(m => m.email === editSelectedEmail);
      const effectiveUid = editIsOtherAccount || editSelectedEmail === 'other'
        ? editOtherAccountName.trim()
        : (matchedMailbox?.game_uid || matchedMailbox?.game_id_name || editingItem.accountUid || '');

      const itemRef = doc(db, 'ff_store', editingItem.id);
      await updateDoc(itemRef, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        price: Number(editPrice) || 0,
        level: Number(editLevel) || 1,
        rank: editRank,
        skinsCount: Number(editSkinsCount) || 0,
        characters: editCharactersText.split(',').map(c => c.trim()).filter(Boolean),
        mediaUrl: primaryMedia.url,
        mediaType: primaryMedia.type,
        mediaList: finalMediaList,
        linkedEmail: effectiveEmail,
        accountUid: effectiveUid,
        isDirectOtherAccount: editIsOtherAccount || editSelectedEmail === 'other',
        updatedAt: new Date().toISOString()
      });

      // Optional sync with storefront API
      try {
        await fetch(`${storefrontApiUrl}/api/listings/by-admin-id/${editingItem.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': storefrontApiKey
          },
          body: JSON.stringify({
            title: editTitle.trim(),
            description: editDescription.trim(),
            price: Number(editPrice) || 0,
            level: Number(editLevel) || 1,
            rank: editRank,
            skinsCount: Number(editSkinsCount) || 0,
            characters: editCharactersText.split(',').map(c => c.trim()).filter(Boolean),
            mediaUrl: primaryMedia.url,
            mediaType: primaryMedia.type,
            mediaList: finalMediaList,
            sellerEmail: effectiveEmail,
            sellerName: (editIsOtherAccount || editSelectedEmail === 'other') ? (editOtherAccountName || 'Direct Seller') : 'System Verified'
          })
        });
      } catch (sfErr) {
        console.warn("Storefront sync skipped/failed:", sfErr.message);
      }

      showToast("Store listing updated successfully!", "success");
      setEditModalOpen(false);
      setEditingItem(null);
    } catch (err) {
      console.error("Failed to update item:", err);
      showToast(err.message || "Failed to update store item.", "error");
    } finally {
      setIsSavingEdit(false);
      setEditUploadProgress(0);
      setEditUploadStatus('');
    }
  };

  // Restock Store Item (Make it In-Stock again)
  const handleRestockItem = async (item) => {
    if (!window.confirm(`Are you sure you want to restock "${item.title}"? This will make the account available again for buyers.`)) {
      return;
    }

    setRestockingId(item.id);
    try {
      const response = await fetch(`${storefrontApiUrl}/api/listings/by-admin-id/${item.id}/restock`, {
        method: 'POST',
        headers: {
          'x-api-key': storefrontApiKey
        }
      });

      if (!response.ok) {
        throw new Error("Storefront API failed to restock item.");
      }

      setStorefrontListings(prev => prev.map(l => {
        if (l.linkedAdminDocId === item.id) {
          return { ...l, status: 'available', buyerEmail: '' };
        }
        return l;
      }));

      showToast("Store item restocked and is now live & available again!", "success");
    } catch (err) {
      console.error("Error restocking store item:", err);
      showToast(err.message || "Failed to restock store item.", "error");
    } finally {
      setRestockingId(null);
    }
  };

  // Push Instagram Account to Storefront
  const handlePushInstaAccountToStorefront = async (acc) => {
    const accTitle = acc.game_id_name || `Free Fire Account (Slot #${acc.id ? acc.id.slice(-4) : 'PRO'})`;
    setPushingAccId(acc.id);
    try {
      showToast(`Pushing "${accTitle}" to live storefront...`, "info");
      
      const createdAtTimestamp = new Date().toISOString();
      const localDocRef = await addDoc(collection(db, 'ff_store'), {
        title: accTitle,
        description: `Verified FF Account. Instagram Demo: ${acc.instagram_link}`,
        mediaUrl: acc.instagram_link,
        mediaType: 'image',
        linkedEmail: acc.email,
        createdAt: createdAtTimestamp,
        createdByUid: currentUser.uid,
        createdByEmail: currentUser.email,
        price: Number(acc.price_inr || 0),
        level: 65,
        rank: 'Heroic',
        skinsCount: 30,
        characters: ['Alok', 'Chrono', 'K', 'Hayato']
      });

      // Optional sync with external storefront API
      try {
        await fetch(`${storefrontApiUrl}/api/listings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': storefrontApiKey
          },
          body: JSON.stringify({
            game: 'Free Fire',
            title: accTitle,
            description: `Verified FF Account. Instagram Demo: ${acc.instagram_link}`,
            price: Number(acc.price_inr || 0),
            level: 65,
            rank: 'Heroic',
            skinsCount: 30,
            characters: ['Alok', 'Chrono', 'K', 'Hayato'],
            verified: true,
            sellerVerified: true,
            sellerEmail: acc.email,
            sellerName: 'FF Trusted Deals',
            credentials: {
              email: acc.email,
              pass: '[Escrow Verification Active]',
              recoveryCode: 'ESCROW-SECURE-' + Math.floor(1000 + Math.random() * 9000)
            },
            createdAt: createdAtTimestamp,
            mediaUrl: acc.instagram_link,
            mediaType: 'image',
            linkedAdminDocId: localDocRef.id
          })
        });
      } catch (sfErr) {
        console.warn("External storefront sync skipped/failed:", sfErr.message);
      }

      showToast(`Successfully pushed "${accTitle}" to Live Store Catalog & Telegram Bot!`, "success");
    } catch (err) {
      console.error("Push error:", err);
      showToast(err.message || "Failed to push account to store catalog.", "error");
    } finally {
      setPushingAccId(null);
    }
  };

  // Open Secret Link Modal & Pre-fill values
  const handleOpenSecretModal = (defaultEmail = selectedEmail, defaultPrice = price) => {
    const targetEm = defaultEmail || (mailboxes.length > 0 ? mailboxes[0].email : '');
    const match = mailboxes.find(m => m.email === targetEm);
    const targetPr = match && match.price_inr !== null ? match.price_inr : (defaultPrice || 0);

    setSecretEmail(targetEm);
    setSecretPrice(targetPr);
    setCopiedLink(false);

    const initialUrl = `${window.location.origin}/ff-store-upload?email=${encodeURIComponent(targetEm)}&price=${targetPr}`;
    setSecretLinkUrl(initialUrl);
    setShowSecretModal(true);
  };

  // Generate Unique Tracked Secret Token Link
  const handleGenerateTrackedSecretLink = async () => {
    if (!secretEmail) {
      showToast("Please select an email for the secret link.", "error");
      return;
    }

    setIsGeneratingLink(true);
    try {
      const tokenId = `tok_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
      await setDoc(doc(db, 'ff_upload_tokens', tokenId), {
        tokenId,
        email: secretEmail,
        price: Number(secretPrice) || 0,
        createdAt: serverTimestamp(),
        createdBy: currentUser.email,
        isRevoked: false,
        usageCount: 0
      });

      const fullUrl = `${window.location.origin}/ff-store-upload?token=${tokenId}&email=${encodeURIComponent(secretEmail)}&price=${secretPrice}`;
      setSecretLinkUrl(fullUrl);
      showToast("Unique authorized upload link generated!", "success");
    } catch (err) {
      console.error("Error creating upload token:", err);
      // Fallback to query param URL
      const fallbackUrl = `${window.location.origin}/ff-store-upload?email=${encodeURIComponent(secretEmail)}&price=${secretPrice}`;
      setSecretLinkUrl(fallbackUrl);
      showToast("Link prepared (direct parameters mode).", "info");
    } finally {
      setIsGeneratingLink(false);
    }
  };

  // Copy secret link to clipboard
  const handleCopySecretLink = () => {
    if (!secretLinkUrl) return;
    navigator.clipboard.writeText(secretLinkUrl);
    setCopiedLink(true);
    showToast("Secret upload link copied to clipboard!", "success");
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const selectedMailbox = mailboxes.find(m => m.email === selectedEmail);
  const editSelectedMailbox = mailboxes.find(m => m.email === editSelectedEmail);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex font-sans select-none">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      <div className="flex-1 lg:pl-72 flex flex-col min-w-0 h-screen overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-955/20 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-655 dark:text-indigo-400 shadow-sm shrink-0">
                  <Store className="w-5.5 h-5.5" />
                </div>
                <span>FF Store Media Manager</span>
              </h2>
              <p className="text-xs text-gray-455 dark:text-gray-500 font-semibold mt-1">
                Upload multiple photos/videos, set INR pricing, and generate secret guest upload links.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Open Live Marketplace Link */}
              <a
                href="/store"
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-955/30 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-black rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                title="View Customer Marketplace"
              >
                <Store className="w-4 h-4 text-emerald-600" />
                <span>View Live Store ↗</span>
              </a>

              {!isEmployee && (
                <>
                  {/* Generate Secret Upload Link Button */}
                <button
                  onClick={() => handleOpenSecretModal()}
                  className="flex items-center gap-2 px-4 py-2.5 text-xs bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black rounded-xl shadow-md shadow-indigo-600/20 transition-all shrink-0 cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Secret Upload Link</span>
                </button>

                {/* Cloudinary Config Button */}
                <button
                  onClick={() => setShowConfig(!showConfig)}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-all shrink-0 cursor-pointer"
                >
                  <Settings className="w-4 h-4" />
                  <span>Cloudinary Config</span>
                </button>

                {/* Super Admin Store Contact Settings Button */}
                {userDoc?.role === 'superadmin' && (
                  <button
                    onClick={() => setShowContactModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-xs bg-amber-50 hover:bg-amber-100 dark:bg-amber-955/30 dark:hover:bg-amber-900/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-300 font-extrabold rounded-xl shadow-xs transition-all shrink-0 cursor-pointer"
                    title="Edit Public TG & WhatsApp Contact Channels (Super Admin Only)"
                  >
                    <MessageSquare className="w-4 h-4 text-amber-600" />
                    <span>Contact Channels (TG/WA)</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

          {/* Collapsible Cloudinary Configuration Panel */}
          {showConfig && (
            <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-5 shadow-sm space-y-4 animate-fade-in">
              <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-550" />
                <span>Cloudinary Upload Credentials</span>
              </h4>
              <p className="text-[11px] text-gray-455 dark:text-gray-500 font-medium">
                Configure your Cloudinary credentials here. These settings are persisted locally in your browser storage.
              </p>
              <div className="p-3.5 bg-amber-50 dark:bg-amber-955/15 border border-amber-200 dark:border-amber-900/40 rounded-2xl flex gap-3 items-start">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-[10.5px] font-black text-amber-900 dark:text-amber-300 block uppercase tracking-wider">Unsigned Upload Preset Required</span>
                  <p className="text-[9.5px] text-amber-800 dark:text-amber-400/90 leading-relaxed font-bold">
                    For direct browser uploads, the preset MUST be whitelisted as <strong>Unsigned</strong> in your Cloudinary Settings (Settings ➔ Upload ➔ Upload presets ➔ Signing Mode: Unsigned). This allows secure uploading without exposing your API Secret.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Cloud Name</label>
                  <input
                    type="text"
                    value={cloudName}
                    onChange={(e) => setCloudName(e.target.value)}
                    placeholder="Enter Cloud Name"
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Unsigned Upload Preset</label>
                  <input
                    type="text"
                    value={uploadPreset}
                    onChange={(e) => setUploadPreset(e.target.value)}
                    placeholder="Enter Preset Name"
                    className="w-full px-3 py-2 text-xs bg-gray-55 dark:bg-gray-855 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white font-bold"
                  />
                </div>
              </div>

              {/* Storefront API Credentials Section */}
              <div className="border-t border-gray-150 dark:border-gray-800 pt-4 space-y-3">
                <h4 className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Key className="w-4 h-4 text-indigo-550" />
                  <span>Storefront API Settings</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Storefront API Endpoint URL</label>
                    <input
                      type="url"
                      value={storefrontApiUrl}
                      onChange={(e) => setStorefrontApiUrl(e.target.value)}
                      placeholder="e.g. https://ffsstorebyshiv.web.app"
                      className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-855 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white font-bold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Storefront API Key (X-API-KEY)</label>
                    <input
                      type="text"
                      value={storefrontApiKey}
                      onChange={(e) => setStorefrontApiKey(e.target.value)}
                      placeholder="Enter API Key"
                      className="w-full px-3 py-2 text-xs bg-gray-55 dark:bg-gray-855 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white font-bold font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Form and Ledger Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Upload form block (1/3 width) */}
            <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                  Upload Media Item
                </h3>
                <span className="text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-955/20 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-900/30">
                  Multiple Files
                </span>
              </div>

              {mailboxes.length === 0 ? (
                <div className="p-4 bg-amber-50 dark:bg-amber-955/20 border border-amber-250 dark:border-amber-900/40 rounded-2xl flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-550 shrink-0" />
                  <div className="text-xs font-bold text-amber-850 dark:text-amber-300">
                    No verified mailboxes available. Link custom mailboxes under profile settings and verify them first.
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveItem} className="space-y-4">
                  {/* Select Mailbox */}
                  <div className="relative">
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">
                      {isEmployee ? 'Select Linked Game Account / Slot *' : 'Link to Verified Email'}
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="w-full px-3 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white font-extrabold cursor-pointer flex items-center justify-between shadow-sm hover:bg-gray-100 dark:hover:bg-gray-750 transition-all"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {selectedEmail === 'other' ? (
                          <>
                            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                            <span className="truncate text-amber-600 dark:text-amber-400 font-extrabold">
                              ✨ Other / Direct Custom Account {otherAccountName ? `(${otherAccountName})` : ''}
                            </span>
                          </>
                        ) : selectedMailbox ? (
                          <>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              selectedMailbox.type === 'gmail' ? 'bg-rose-500' : selectedMailbox.type === 'zoho' ? 'bg-amber-500' : 'bg-teal-500'
                            }`} />
                            <span className="truncate">
                              {isEmployee
                                ? `🎮 Free Fire UID: ${selectedMailbox.game_uid || 'Slot Selected'} ${selectedMailbox.game_id_name ? `(${selectedMailbox.game_id_name})` : ''}`
                                : selectedMailbox.email}
                            </span>
                            {selectedMailbox.price_inr !== null && (
                              <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded shrink-0">
                                ₹{selectedMailbox.price_inr}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400 font-bold">
                            {isEmployee ? 'Select Game ID / Slot or Other...' : 'Select Email or Other...'}
                          </span>
                        )}
                      </div>
                      <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    </button>

                    {isDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                        <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-xl shadow-xl z-50 p-2 space-y-1 max-h-56 overflow-y-auto">
                          {/* Option 1 to N: Mailboxes */}
                          {mailboxes.map((m, idx) => {
                            const isChosen = m.email === selectedEmail;
                            return (
                              <button
                                key={m.email}
                                type="button"
                                onClick={() => handleSelectMailbox(m.email)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-between ${
                                  isChosen
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 truncate pr-2">
                                  <span className="truncate">
                                    {isEmployee
                                      ? `🎮 UID: ${m.game_uid || ('Slot #' + (idx + 1))} ${m.game_id_name ? `(${m.game_id_name})` : ''}`
                                      : m.email}
                                  </span>
                                  {m.price_inr !== null && (
                                    <span className={`text-[8.5px] font-black px-1 rounded ${
                                      isChosen ? 'bg-indigo-700 text-indigo-100' : 'text-emerald-600 dark:text-emerald-400'
                                    }`}>
                                      ₹{m.price_inr}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[8px] font-black uppercase border border-current px-1 rounded shrink-0">
                                  {isEmployee ? `Slot #${idx + 1}` : m.type}
                                </span>
                              </button>
                            );
                          })}

                          {/* Option: Other / Direct Custom Account */}
                          <button
                            type="button"
                            onClick={() => handleSelectMailbox('other')}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-between border-t border-dashed border-gray-200 dark:border-gray-700 mt-1 ${
                              selectedEmail === 'other'
                                ? 'bg-amber-600 text-white shadow-sm'
                                : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-955/30'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate pr-2">
                              <Sparkles className="w-3.5 h-3.5 shrink-0" />
                              <span className="font-extrabold truncate">✨ Other / Direct Custom Account (+ Manual Entry)</span>
                            </div>
                            <span className="text-[8px] font-black uppercase border border-current px-1 rounded shrink-0">
                              Direct
                            </span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Other / Direct Custom Account Manual Input Fields */}
                  {isOtherAccount && (
                    <div className="p-3.5 bg-amber-50/70 dark:bg-amber-955/20 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl space-y-3 animate-fade-in font-sans">
                      <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                        <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="text-[10.5px] font-black uppercase tracking-wider">
                          Custom Direct Listing (Standalone)
                        </span>
                      </div>
                      <p className="text-[10px] text-amber-700 dark:text-amber-400/90 font-medium leading-relaxed">
                        This direct account is only displayed on the store/website. It will <strong>NOT</strong> be linked to Email Monitor or mailbox import/export.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[9.5px] font-black text-amber-900 dark:text-amber-300 uppercase mb-1">
                            Account UID / Name *
                          </label>
                          <input
                            type="text"
                            required={isOtherAccount}
                            placeholder="e.g. UID: 2948190182 or Custom Name"
                            value={otherAccountName}
                            onChange={(e) => setOtherAccountName(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-800 rounded-xl text-gray-900 dark:text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-black text-amber-900 dark:text-amber-300 uppercase mb-1">
                            Contact / Reference Email (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. direct@store.com or note"
                            value={otherAccountEmail}
                            onChange={(e) => setOtherAccountEmail(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-800 rounded-xl text-gray-900 dark:text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Title */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">
                      Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Diamond Store Landing Page Banner"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-205 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">
                      Description
                    </label>
                    <textarea
                      placeholder="Enter account highlights, rare bundles, gun skins..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-205 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                    />
                  </div>

                  {/* Storefront Price (₹ INR) */}
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 flex items-center justify-between">
                        <span>Price (₹ INR) *</span>
                        {selectedMailbox?.price_inr !== null && selectedMailbox?.price_inr !== undefined && (
                          <span className="text-[8.5px] text-emerald-600 dark:text-emerald-400 font-bold">Auto-filled</span>
                        )}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">₹</span>
                        <input
                          type="number"
                          min="0"
                          value={price}
                          onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                          className="w-full pl-7 pr-3 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-205 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Multi-File Selector Zone */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-black text-gray-400 uppercase">
                        Select Photos &amp; Videos ({selectedFiles.length})
                      </label>
                      <span className="text-[8.5px] font-bold text-indigo-500 uppercase">
                        Upload Multiple
                      </span>
                    </div>

                    <input
                      type="file"
                      ref={fileInputRef}
                      multiple
                      onChange={handleFilesChange}
                      accept="image/*,video/*"
                      className="hidden"
                    />
                    
                    {/* Dropzone trigger button */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl p-5 text-center cursor-pointer hover:border-indigo-500 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all flex flex-col items-center justify-center space-y-1.5 group"
                    >
                      <UploadCloud className="w-7 h-7 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        Click to select Photos &amp; Videos
                      </span>
                      <span className="text-[9px] text-gray-400 font-semibold">
                        Select multiple images or gameplay clips (up to 100MB each)
                      </span>
                    </div>

                    {/* Selected Files Preview Gallery Grid */}
                    {selectedFiles.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          {selectedFiles.map((item, idx) => (
                            <div
                              key={item.id}
                              className="relative bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden group shadow-sm"
                            >
                              <div className="aspect-video bg-gray-100 dark:bg-gray-900 flex items-center justify-center overflow-hidden relative">
                                {item.type === 'image' && item.previewUrl ? (
                                  <img
                                    src={item.previewUrl}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : item.type === 'video' ? (
                                  <div className="w-full h-full bg-indigo-50 dark:bg-indigo-955/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                    <VideoIcon className="w-5 h-5" />
                                  </div>
                                ) : (
                                  <FileText className="w-5 h-5 text-gray-400" />
                                )}

                                <span className="absolute top-1 left-1 px-1 bg-black/60 rounded text-[7.5px] font-black text-white">
                                  #{idx + 1}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveFile(item.id)}
                                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow transition-all cursor-pointer"
                                  title="Remove"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>

                              <div className="p-1.5">
                                <p className="text-[9px] font-black text-gray-900 dark:text-white truncate" title={item.name}>
                                  {item.name}
                                </p>
                                <span className="text-[8px] font-bold text-gray-400 uppercase block">
                                  {(item.size / (1024 * 1024)).toFixed(1)} MB • {item.type}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action button / Progress */}
                  <div className="pt-2">
                    {isUploading ? (
                      <div className="space-y-2">
                        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden shadow-inner">
                          <div
                            className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-bold text-gray-400">
                          <span className="flex items-center gap-1.5">
                            <Loader className="w-3 h-3 animate-spin text-indigo-600" />
                            <span>{uploadStatusText || 'Uploading to Cloudinary...'}</span>
                          </span>
                          <span>{uploadProgress}%</span>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="submit"
                        disabled={selectedFiles.length === 0}
                        className="w-full flex items-center justify-center gap-1.5 px-6 py-3 bg-indigo-650 hover:bg-indigo-705 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-650/15 transition-all cursor-pointer"
                      >
                        <UploadCloud className="w-4 h-4" />
                        <span>Upload &amp; Save Media Listing</span>
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>

            {/* Store Grid Ledger (2/3 width) */}
            <div className="lg:col-span-2 space-y-6">

              {/* Instagram Accounts Quick Sync Panel */}
              {instaAccounts.length > 0 && (
                <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                    <div>
                      <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        <span>📱 Auto-Synced Instagram Accounts ({instaAccounts.length})</span>
                      </h3>
                      <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                        These accounts have Instagram demo links &amp; prices set in Email Monitor and are live on Telegram Bot.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {instaAccounts.map(acc => {
                      const isPushing = pushingAccId === acc.id;
                      const titleStr = acc.game_id_name || `Account (Slot #${acc.id ? acc.id.slice(-4) : 'PRO'})`;
                      return (
                        <div
                          key={acc.id}
                          className="p-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 rounded-2xl space-y-2 font-sans"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 truncate max-w-[140px]">
                              {titleStr}
                            </span>
                            <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-full border border-emerald-300 dark:border-emerald-800">
                              ₹{acc.price_inr}
                            </span>
                          </div>

                          <div className="text-[9.5px] text-gray-500 dark:text-gray-400 truncate flex items-center gap-1 font-mono">
                            <span>📸</span>
                            <a
                              href={acc.instagram_link}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-500 hover:underline truncate"
                            >
                              {acc.instagram_link}
                            </a>
                          </div>

                          <button
                            disabled={isPushing}
                            onClick={() => handlePushInstaAccountToStorefront(acc)}
                            className="w-full mt-1 py-1.5 px-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {isPushing ? (
                              <Loader className="w-3 h-3 animate-spin text-white" />
                            ) : (
                              <UploadCloud className="w-3 h-3 text-white" />
                            )}
                            <span>🚀 Push to Live Storefront Web App</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Catalog Items Header */}
              <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
                <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                  Store Items Catalog ({items.length})
                </h3>
              </div>

              {loading ? (
                <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-12 flex flex-col items-center justify-center space-y-3">
                  <Loader className="w-8 h-8 animate-spin text-indigo-655" />
                  <span className="text-xs text-gray-455 font-bold">Loading catalog records...</span>
                </div>
              ) : items.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-12 text-center">
                  <Store className="w-12 h-12 text-gray-300 dark:text-gray-800 mx-auto mb-2" />
                  <p className="text-xs text-gray-450 font-bold">No media products in catalog. Upload items on the left to populate the store.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {items.map((item) => {
                    const mediaArray = item.mediaList && item.mediaList.length > 0 
                      ? item.mediaList 
                      : [{ url: item.mediaUrl, type: item.mediaType, name: 'Media' }];
                    
                    const activeIdx = cardMediaIndices[item.id] || 0;
                    const activeMedia = mediaArray[activeIdx] || mediaArray[0];
                    const isVideo = activeMedia.type === 'video';

                    const sfItem = Array.isArray(storefrontListings) ? storefrontListings.find(l => l.linkedAdminDocId === item.id) : null;
                    const isSoldOut = sfItem ? sfItem.status === 'sold' : false;

                    return (
                      <div
                        key={item.id}
                        className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm flex flex-col group hover:shadow-md hover:border-gray-200 dark:hover:border-gray-700 transition-all duration-200 relative"
                      >
                        {/* Media display box with Carousel navigation */}
                        <div className="relative aspect-video bg-gray-100 dark:bg-gray-955 flex items-center justify-center border-b border-gray-150 dark:border-gray-800 overflow-hidden">
                          {isVideo ? (
                            <video
                              key={activeMedia.url}
                              src={activeMedia.url}
                              controls
                              className="w-full h-full object-cover"
                              preload="metadata"
                            />
                          ) : (
                            <img
                              key={activeMedia.url}
                              src={activeMedia.url}
                              alt={item.title}
                              className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                            />
                          )}

                          {isSoldOut && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 backdrop-blur-[2px]">
                              <span className="bg-rose-600 border border-rose-500 text-white text-[10px] font-black uppercase tracking-widest px-3.5 py-1 rounded-full shadow-lg">
                                Sold Out
                              </span>
                            </div>
                          )}

                          {/* Media Type & Counter Badge */}
                          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-20">
                            <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-black/60 backdrop-blur-sm text-white border border-white/10 tracking-widest">
                              {activeMedia.type}
                            </span>
                            {mediaArray.length > 1 && (
                              <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-indigo-600/80 backdrop-blur-sm text-white border border-indigo-400/30">
                                {activeIdx + 1}/{mediaArray.length}
                              </span>
                            )}
                          </div>

                          {/* Carousel Navigation Buttons if multiple media */}
                          {mediaArray.length > 1 && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setCardMediaIndices(prev => ({
                                    ...prev,
                                    [item.id]: (activeIdx - 1 + mediaArray.length) % mediaArray.length
                                  }));
                                }}
                                className="absolute left-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center shadow transition-all z-20 cursor-pointer"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setCardMediaIndices(prev => ({
                                    ...prev,
                                    [item.id]: (activeIdx + 1) % mediaArray.length
                                  }));
                                }}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center shadow transition-all z-20 cursor-pointer"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {/* Price Tag Pill */}
                          <div className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 bg-emerald-600/90 backdrop-blur-sm text-white text-[10px] font-black rounded-full shadow-md z-20">
                            ₹{item.price || 0}
                          </div>
                        </div>

                        {/* Details */}
                        <div className="p-5 flex-1 flex flex-col justify-between space-y-4 font-sans">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 text-[10px] text-indigo-650 dark:text-indigo-400 font-bold truncate">
                                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                <span className="truncate" title={item.accountUid && !item.accountUid.includes('@') ? `UID: ${item.accountUid}` : 'Verified Slot'}>
                                  {item.accountUid && !item.accountUid.includes('@') ? `🎮 UID: ${item.accountUid}` : '🎮 Verified Game Account'}
                                </span>
                              </div>
                              {item.isDirectOtherAccount ? (
                                <span className="text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 shrink-0 flex items-center gap-1">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  Outer
                                </span>
                              ) : (
                                <span className="text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 shrink-0 flex items-center gap-1">
                                  <Store className="w-2.5 h-2.5" />
                                  Stock
                                </span>
                              )}
                            </div>

                            <h4 className="text-xs font-black text-gray-900 dark:text-white leading-snug uppercase tracking-wide">
                              {item.title}
                            </h4>

                            {item.description && (
                              <p className="text-[10.5px] text-gray-455 dark:text-gray-400 leading-relaxed font-semibold line-clamp-2">
                                {item.description}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800/80">
                            <span className="text-[9px] text-gray-400 font-bold">
                              {new Date(item.createdAt).toLocaleDateString()}
                            </span>

                            <div className="flex items-center gap-2">
                              {isSoldOut && (
                                <button
                                  disabled={restockingId === item.id}
                                  onClick={() => handleRestockItem(item)}
                                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 font-extrabold rounded-lg text-[9px] uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-1 shrink-0 cursor-pointer"
                                  title="Restock Item"
                                >
                                  {restockingId === item.id ? (
                                    <Loader className="w-3 h-3 animate-spin text-emerald-555" />
                                  ) : (
                                    <RefreshCw className="w-3 h-3" />
                                  )}
                                  <span>Restock</span>
                                </button>
                              )}
                              <a
                                href={activeMedia.url}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-all"
                                title="Open Media Link"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                              {/* Edit Button */}
                              <button
                                onClick={() => handleStartEdit(item)}
                                className="p-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-955/20 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-[10.5px] font-bold"
                                title="Edit Item"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                disabled={deletingId === item.id}
                                onClick={() => handleDeleteItem(item)}
                                className="p-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-955/20 rounded-xl transition-all cursor-pointer"
                                title="Delete Item"
                              >
                                {deletingId === item.id ? (
                                  <Loader className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </main>
      </div>

      {/* Secret Upload Link Generator Modal */}
      {showSecretModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-955/20 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                    Secret Upload Link Generator
                  </h3>
                  <p className="text-[10.5px] text-gray-400 font-medium">
                    Create a direct upload portal link for an external worker/seller.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSecretModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Target Email Selector in Modal */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">
                  1. Select Target Mailbox for this Upload Link *
                </label>
                <select
                  value={secretEmail}
                  onChange={(e) => {
                    const em = e.target.value;
                    setSecretEmail(em);
                    const match = mailboxes.find(m => m.email === em);
                    if (match && match.price_inr !== null) {
                      setSecretPrice(match.price_inr);
                    }
                    setSecretLinkUrl(`${window.location.origin}/ff-store-upload?email=${encodeURIComponent(em)}&price=${match?.price_inr || secretPrice}`);
                  }}
                  className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  {mailboxes.map(m => (
                    <option key={m.email} value={m.email}>
                      {m.email} ({m.type.toUpperCase()}){m.price_inr !== null ? ` — ₹${m.price_inr}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price auto-filled */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">
                  2. Pre-set Price (₹ INR) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={secretPrice}
                    onChange={(e) => {
                      const pr = parseFloat(e.target.value) || 0;
                      setSecretPrice(pr);
                      setSecretLinkUrl(`${window.location.origin}/ff-store-upload?email=${encodeURIComponent(secretEmail)}&price=${pr}`);
                    }}
                    className="w-full pl-7 pr-3 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Generate Unique Token Button */}
              <button
                type="button"
                disabled={isGeneratingLink}
                onClick={handleGenerateTrackedSecretLink}
                className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-955/30 dark:hover:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[11px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isGeneratingLink ? (
                  <Loader className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>Generate Unique Tracked Secret Token</span>
              </button>

              {/* Generated Link Display and Copy Action */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">
                  Shareable Secret Link URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={secretLinkUrl}
                    className="flex-1 px-3 py-2.5 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-indigo-600 dark:text-indigo-300 font-mono font-bold truncate focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopySecretLink}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all shrink-0 cursor-pointer"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-300" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-2xl text-[10.5px] text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                💡 <strong>How it works:</strong> Anyone opening this link can upload multiple photos/videos and enter account details without logging in. The target email <span className="font-mono text-indigo-500 font-bold">({secretEmail})</span> and price <span className="text-emerald-500 font-bold">(₹{secretPrice})</span> will be pre-locked for them!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 sm:p-7 max-w-xl w-full shadow-2xl relative space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-955/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                    Edit Store Item
                  </h3>
                  <span className="text-[10px] text-gray-400 font-bold">
                    {editingItem.accountUid && !editingItem.accountUid.includes('@') ? `🎮 UID: ${editingItem.accountUid}` : '🎮 Verified Slot'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => { setEditModalOpen(false); setEditingItem(null); }}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedItem} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Account Link & Email Change Control (Stock vs Outer) */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700/80 rounded-2xl space-y-3 font-sans">
                <div className="flex items-center justify-between">
                  <label className="block text-[10.5px] font-black text-gray-900 dark:text-white uppercase tracking-wider">
                    Linked Account &amp; Email Setting *
                  </label>
                  <span className="text-[9px] font-bold text-gray-400 uppercase">
                    Change Stock ⇄ Outer
                  </span>
                </div>

                {/* Mode Switcher Tabs */}
                <div className="grid grid-cols-2 gap-2 bg-gray-200/70 dark:bg-gray-850 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setEditIsOtherAccount(false);
                      if (editSelectedEmail === 'other' || !editSelectedEmail) {
                        setEditSelectedEmail(mailboxes[0]?.email || '');
                      }
                      setIsEditDropdownOpen(false);
                    }}
                    className={`py-2 px-2.5 rounded-lg text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      !editIsOtherAccount
                        ? 'bg-white dark:bg-gray-750 text-indigo-600 dark:text-indigo-300 shadow-xs'
                        : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Stock Account</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditIsOtherAccount(true);
                      setEditSelectedEmail('other');
                      if (!editOtherAccountEmail && editingItem?.linkedEmail) {
                        setEditOtherAccountEmail(editingItem.linkedEmail);
                      }
                      if (!editOtherAccountName && editingItem?.accountUid) {
                        setEditOtherAccountName(editingItem.accountUid);
                      }
                      setIsEditDropdownOpen(false);
                    }}
                    className={`py-2 px-2.5 rounded-lg text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      editIsOtherAccount
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Outer / Direct</span>
                  </button>
                </div>

                {/* Sub-view: Stock Account (Choose from Email Monitor Mailboxes) */}
                {!editIsOtherAccount ? (
                  <div className="space-y-2 pt-1">
                    <div className="relative">
                      <label className="block text-[9.5px] font-black text-gray-500 dark:text-gray-400 uppercase mb-1">
                        Select Verified Stock Mailbox (Email Monitor)
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsEditDropdownOpen(!isEditDropdownOpen)}
                        className="w-full px-3 py-2.5 text-xs bg-white dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-gray-900 dark:text-white font-extrabold cursor-pointer flex items-center justify-between shadow-xs hover:border-indigo-400 transition-all"
                      >
                        <div className="flex items-center gap-2 truncate">
                          {editSelectedMailbox ? (
                            <>
                              <span className={`w-2 h-2 rounded-full shrink-0 ${
                                editSelectedMailbox.type === 'gmail' ? 'bg-rose-500' : editSelectedMailbox.type === 'zoho' ? 'bg-amber-500' : 'bg-teal-500'
                              }`} />
                              <span className="truncate">
                                {isEmployee
                                  ? `🎮 Free Fire UID: ${editSelectedMailbox.game_uid || 'Slot Selected'} ${editSelectedMailbox.game_id_name ? `(${editSelectedMailbox.game_id_name})` : ''}`
                                  : editSelectedMailbox.email}
                              </span>
                              {editSelectedMailbox.price_inr !== null && (
                                <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded shrink-0">
                                  ₹{editSelectedMailbox.price_inr}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400 font-bold truncate">
                              {editSelectedEmail || 'Select Stock Mailbox...'}
                            </span>
                          )}
                        </div>
                        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                      </button>

                      {isEditDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsEditDropdownOpen(false)} />
                          <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 p-2 space-y-1 max-h-52 overflow-y-auto">
                            {mailboxes.map((m, idx) => {
                              const isChosen = m.email === editSelectedEmail;
                              return (
                                <button
                                  key={m.email}
                                  type="button"
                                  onClick={() => {
                                    setEditSelectedEmail(m.email);
                                    setIsEditDropdownOpen(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-between ${
                                    isChosen
                                      ? 'bg-indigo-600 text-white shadow-xs'
                                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 truncate pr-2">
                                    <span className="truncate">
                                      {isEmployee
                                        ? `🎮 UID: ${m.game_uid || ('Slot #' + (idx + 1))} ${m.game_id_name ? `(${m.game_id_name})` : ''}`
                                        : m.email}
                                    </span>
                                    {m.price_inr !== null && (
                                      <span className={`text-[8.5px] font-black px-1 rounded ${
                                        isChosen ? 'bg-indigo-700 text-indigo-100' : 'text-emerald-600 dark:text-emerald-400'
                                      }`}>
                                        ₹{m.price_inr}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[8px] font-black uppercase border border-current px-1 rounded shrink-0">
                                    {m.type}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                    <p className="text-[9.5px] text-gray-500 dark:text-gray-400 font-semibold">
                      Linked to Email Monitor. OTPs &amp; verification will be monitored from this verified mailbox.
                    </p>
                  </div>
                ) : (
                  /* Sub-view: Outer Account (Manual Email & Name Entry) */
                  <div className="space-y-3 pt-1 animate-fade-in">
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[10px] text-amber-700 dark:text-amber-300 font-medium leading-relaxed">
                      💡 <strong>Outer Account (Direct):</strong> Staff ne galat Gmail daal di ho to yahan direct change kar sakte hain. Ye direct website listing hoti hai.
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9.5px] font-black text-amber-900 dark:text-amber-300 uppercase mb-1">
                          Outer Account Gmail / Email *
                        </label>
                        <input
                          type="email"
                          required={editIsOtherAccount}
                          value={editOtherAccountEmail}
                          onChange={(e) => setEditOtherAccountEmail(e.target.value)}
                          placeholder="e.g. correct_email@gmail.com"
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-850 border border-amber-300 dark:border-amber-700/80 rounded-xl text-gray-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                        />
                      </div>

                      <div>
                        <label className="block text-[9.5px] font-black text-amber-900 dark:text-amber-300 uppercase mb-1">
                          Outer Account UID / Name
                        </label>
                        <input
                          type="text"
                          value={editOtherAccountName}
                          onChange={(e) => setEditOtherAccountName(e.target.value)}
                          placeholder="e.g. UID: 2948190182 or Seller Name"
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-850 border border-amber-300 dark:border-amber-700/80 rounded-xl text-gray-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                />
              </div>

              {/* Price (₹ INR) */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Price (₹ INR) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={editPrice}
                    onChange={(e) => setEditPrice(Number(e.target.value))}
                    className="w-full pl-7 pr-3 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {/* Existing Media Gallery */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1.5 flex items-center justify-between">
                  <span>Attached Photos & Videos ({editExistingMedia.length})</span>
                </label>
                {editExistingMedia.length === 0 ? (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-[10px] text-gray-400 font-bold text-center">
                    No existing media attached. Please add new media below.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {editExistingMedia.map((m, idx) => (
                      <div key={idx} className="relative group rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 aspect-video bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        {m.type === 'video' ? (
                          <video src={m.url} className="w-full h-full object-cover" />
                        ) : (
                          <img src={m.url} alt="media" className="w-full h-full object-cover" />
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveEditExistingMedia(idx)}
                          className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-md shadow-sm hover:bg-rose-700 transition-all opacity-80 group-hover:opacity-100 cursor-pointer"
                          title="Remove media"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Photos / Videos */}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">
                  Upload Additional Photos or Videos
                </label>
                <input
                  ref={editFileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleEditNewFilesChange}
                  className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-indigo-50 dark:file:bg-indigo-955/30 file:text-indigo-600 dark:file:text-indigo-400 hover:file:bg-indigo-100 cursor-pointer"
                />

                {editNewFiles.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 mt-2.5">
                    {editNewFiles.map(f => (
                      <div key={f.id} className="relative group rounded-xl overflow-hidden border border-indigo-300 dark:border-indigo-800 aspect-video bg-indigo-50/20 flex items-center justify-center">
                        {f.type === 'video' ? (
                          <span className="text-[10px] font-bold text-indigo-500">Video</span>
                        ) : (
                          <img src={f.previewUrl} alt="preview" className="w-full h-full object-cover" />
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveEditNewFile(f.id)}
                          className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-md shadow-sm hover:bg-rose-700 transition-all cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Progress feedback */}
              {isSavingEdit && (
                <div className="space-y-1.5 p-3 bg-indigo-50 dark:bg-indigo-955/20 border border-indigo-200 dark:border-indigo-900 rounded-xl">
                  <div className="flex items-center justify-between text-[10px] font-black text-indigo-700 dark:text-indigo-300 uppercase">
                    <span>{editUploadStatus}</span>
                    <span>{editUploadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-indigo-100 dark:bg-indigo-950 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${editUploadProgress}%` }} />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => { setEditModalOpen(false); setEditingItem(null); }}
                  className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingEdit ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Super Admin Store Contact Channels Modal */}
      {showContactModal && userDoc?.role === 'superadmin' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-955/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                    Store Contact Channels
                  </h3>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-extrabold uppercase">
                    ⭐ Super Admin Exclusive
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowContactModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStoreContact} className="space-y-4 font-sans">
              {/* Telegram Username */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 flex items-center gap-1">
                  <Send className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Telegram Handle / ID *</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">@</span>
                  <input
                    type="text"
                    required
                    placeholder="alexccseller"
                    value={storeTelegram}
                    onChange={(e) => setStoreTelegram(e.target.value)}
                    className="w-full pl-7 pr-3 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                <p className="text-[9.5px] text-gray-400 font-medium mt-1">
                  Buyers will be redirected to <span className="font-mono text-indigo-500 font-bold">t.me/{storeTelegram.replace(/^@/, '') || 'username'}</span>
                </p>
              </div>

              {/* WhatsApp Number */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-500" />
                  <span>WhatsApp Number (Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. +919876543210 (with country code)"
                  value={storeWhatsapp}
                  onChange={(e) => setStoreWhatsapp(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
                <p className="text-[9.5px] text-gray-400 font-medium mt-1">
                  If provided, a direct WhatsApp chat button will also appear on all listing cards.
                </p>
              </div>

              {/* Brand / Store Title */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">
                  Store Display Name
                </label>
                <input
                  type="text"
                  value={storeBrandName}
                  onChange={(e) => setStoreBrandName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/40 rounded-xl text-[10px] text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
                💡 Only <strong>Super Admin</strong> can access and change these settings. Any change updates the live customer storefront immediately.
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingContact}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingContact ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save Channels</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
