import React, { useState, useEffect, useCallback } from 'react';
import { 
  Boxes, 
  Search, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Bookmark, 
  RefreshCw, 
  Mail, 
  ShieldCheck, 
  ShieldAlert,
  Filter, 
  Loader, 
  UserCheck, 
  Lock, 
  Zap,
  Tag,
  User,
  Check,
  AlertTriangle,
  UserPlus,
  Users,
  X,
  Shield
} from 'lucide-react';
import { db } from '../firebase/config';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc,
  updateDoc 
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

export default function Inventory() {
  const { currentUser, userDoc } = useAuth();
  const { showToast } = useToast();

  const isSuperAdmin = userDoc?.role === 'superadmin';
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Raw Data Collections
  const [mailboxes, setMailboxes] = useState([]);
  const [storeItems, setStoreItems] = useState([]);
  const [licenseKeys, setLicenseKeys] = useState([]);
  const [bookings, setBookings] = useState({});
  const [adminUsers, setAdminUsers] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Super Admin Permission Modal States
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [modalAllowKeys, setModalAllowKeys] = useState(false);
  const [modalSelectedGmails, setModalSelectedGmails] = useState([]);
  const [modalSelectedZohos, setModalSelectedZohos] = useState([]);
  const [modalSelectedImaps, setModalSelectedImaps] = useState([]);
  const [gmailSearch, setGmailSearch] = useState('');
  const [zohoSearch, setZohoSearch] = useState('');
  const [imapSearch, setImapSearch] = useState('');
  const [savingPermissions, setSavingPermissions] = useState(false);

  // Card-Level Quick Assign Popover
  const [assignPopoverItemId, setAssignPopoverItemId] = useState(null);

  // Live timer for 48h countdowns
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 0. Fetch Admin Users List (for Super Admin permission management)
  useEffect(() => {
    if (!currentUser || !isSuperAdmin) return;

    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const users = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.role === 'admin' || d.role === 'superadmin') {
          users.push({ id: docSnap.id, ...d });
        }
      });
      setAdminUsers(users);
      if (users.length > 0 && !selectedAdminId) {
        const firstAdmin = users.find(u => u.role === 'admin') || users[0];
        setSelectedAdminId(firstAdmin.id);
      }
    });

    return () => unsub();
  }, [currentUser, isSuperAdmin, selectedAdminId]);

  // Sync Modal Form Data when selectedAdminId changes
  useEffect(() => {
    if (!selectedAdminId) return;
    const target = adminUsers.find(u => u.id === selectedAdminId);
    if (target) {
      setModalAllowKeys(!!target.allowLicenseKeys);
      setModalSelectedGmails(target.selectedGmails || []);
      setModalSelectedZohos(target.selectedZohos || []);
      setModalSelectedImaps(target.selectedImaps || []);
    }
  }, [selectedAdminId, adminUsers]);

  // 1. Load Mailboxes (Strict Super Admin vs Assigned Admin Permission Rules)
  const loadMailboxes = useCallback(async () => {
    try {
      const list = [];
      const isSuperAdminUser = userDoc?.role === 'superadmin';

      const userGmails = userDoc?.selectedGmails || [];
      const userZohos = userDoc?.selectedZohos || [];
      const userImaps = userDoc?.selectedImaps || [];

      // Gmail
      const snapGmail = await getDocs(collection(db, 'gmail_credentials'));
      snapGmail.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.gmail_email) {
          let isAssignedToAdmin = false;
          if (isSuperAdminUser) {
            isAssignedToAdmin = true;
          } else {
            isAssignedToAdmin = userGmails.includes(d.gmail_email) || 
                                userGmails.includes(docSnap.id) || 
                                d.assignedAdminId === currentUser?.uid;
          }

          if (isAssignedToAdmin) {
            list.push({ 
              id: docSnap.id, 
              email: d.gmail_email, 
              type: 'gmail', 
              verified: !!d.gmail_verified_by_admin,
              collectionName: 'gmail_credentials',
              fieldKey: 'gmail_verified_by_admin',
              assignedAdminId: d.assignedAdminId || null,
              game_id_name: d.game_id_name || null,
              game_uid: d.game_uid || d.ff_uid || null,
              price_inr: d.price_inr !== undefined ? d.price_inr : null
            });
          }
        }
      });

      // Zoho
      const snapZoho = await getDocs(collection(db, 'zoho_credentials'));
      snapZoho.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.zoho_email) {
          let isAssignedToAdmin = false;
          if (isSuperAdminUser) {
            isAssignedToAdmin = true;
          } else {
            isAssignedToAdmin = userZohos.includes(d.zoho_email) || 
                                userZohos.includes(docSnap.id) || 
                                d.assignedAdminId === currentUser?.uid;
          }

          if (isAssignedToAdmin) {
            list.push({ 
              id: docSnap.id, 
              email: d.zoho_email, 
              type: 'zoho', 
              verified: !!d.zoho_verified_by_admin,
              collectionName: 'zoho_credentials',
              fieldKey: 'zoho_verified_by_admin',
              assignedAdminId: d.assignedAdminId || null,
              game_id_name: d.game_id_name || null,
              game_uid: d.game_uid || d.ff_uid || null,
              price_inr: d.price_inr !== undefined ? d.price_inr : null
            });
          }
        }
      });

      // IMAP
      const snapImap = await getDocs(collection(db, 'imap_credentials'));
      snapImap.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.imap_email) {
          let isAssignedToAdmin = false;
          if (isSuperAdminUser) {
            isAssignedToAdmin = true;
          } else {
            isAssignedToAdmin = userImaps.includes(d.imap_email) || 
                                userImaps.includes(docSnap.id) || 
                                d.assignedAdminId === currentUser?.uid;
          }

          if (isAssignedToAdmin) {
            list.push({ 
              id: docSnap.id, 
              email: d.imap_email, 
              type: 'imap', 
              verified: !!d.imap_verified_by_admin,
              collectionName: 'imap_credentials',
              fieldKey: 'imap_verified_by_admin',
              assignedAdminId: d.assignedAdminId || null,
              game_id_name: d.game_id_name || null,
              game_uid: d.game_uid || d.ff_uid || null,
              price_inr: d.price_inr !== undefined ? d.price_inr : null
            });
          }
        }
      });

      // Deduplicate by email
      const unique = [];
      const seen = new Set();
      for (const item of list) {
        if (!seen.has(item.email)) {
          seen.add(item.email);
          unique.push(item);
        }
      }

      setMailboxes(unique);
    } catch (err) {
      console.error("Error loading mailboxes:", err);
    }
  }, [userDoc, currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadMailboxes();
    }
  }, [currentUser, loadMailboxes]);

  // 2. Realtime Listeners
  useEffect(() => {
    if (!currentUser) return;

    const unsubStore = onSnapshot(collection(db, 'ff_store'), (snap) => {
      const list = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setStoreItems(list);
    });

    const unsubKeys = onSnapshot(collection(db, 'license_keys'), (snap) => {
      const list = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setLicenseKeys(list);
    });

    const unsubBookings = onSnapshot(collection(db, 'inventory_bookings'), (snap) => {
      const map = {};
      snap.forEach((docSnap) => {
        map[docSnap.id] = docSnap.data();
      });
      setBookings(map);
      setLoading(false);
    }, () => setLoading(false));

    return () => {
      unsubStore();
      unsubKeys();
      unsubBookings();
    };
  }, [currentUser]);

  // Handle Authorize / Unauthorize Toggle (Super Admin only)
  const handleToggleAuthorize = async (item) => {
    if (!item.collectionName || !item.fieldKey) return;
    setActionLoadingId(item.id);
    try {
      const newStatus = !item.verified;
      await updateDoc(doc(db, item.collectionName, item.id), {
        [item.fieldKey]: newStatus
      });
      showToast(`Account "${item.email}" ${newStatus ? 'Authorized' : 'Unauthorized'} successfully!`, "success");
      await loadMailboxes();
    } catch (err) {
      console.error("Failed to update authorization:", err);
      showToast("Failed to update account authorization.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Save Permissions Modal Changes (Super Admin)
  const handleSaveModalPermissions = async () => {
    if (!selectedAdminId) return;
    setSavingPermissions(true);
    try {
      const targetUser = adminUsers.find(u => u.id === selectedAdminId);
      
      await updateDoc(doc(db, 'users', selectedAdminId), {
        allowLicenseKeys: modalAllowKeys,
        selectedGmails: modalSelectedGmails,
        selectedZohos: modalSelectedZohos,
        selectedImaps: modalSelectedImaps
      });

      // Sync assignedAdminId on gmail_credentials
      const snapGmail = await getDocs(collection(db, 'gmail_credentials'));
      for (const d of snapGmail.docs) {
        const email = d.data().gmail_email;
        const isAssigned = modalSelectedGmails.includes(email) || modalSelectedGmails.includes(d.id);
        if (isAssigned && d.data().assignedAdminId !== selectedAdminId) {
          await updateDoc(doc(db, 'gmail_credentials', d.id), { assignedAdminId: selectedAdminId });
        } else if (!isAssigned && d.data().assignedAdminId === selectedAdminId) {
          await updateDoc(doc(db, 'gmail_credentials', d.id), { assignedAdminId: null });
        }
      }

      // Sync assignedAdminId on zoho_credentials
      const snapZoho = await getDocs(collection(db, 'zoho_credentials'));
      for (const d of snapZoho.docs) {
        const email = d.data().zoho_email;
        const isAssigned = modalSelectedZohos.includes(email) || modalSelectedZohos.includes(d.id);
        if (isAssigned && d.data().assignedAdminId !== selectedAdminId) {
          await updateDoc(doc(db, 'zoho_credentials', d.id), { assignedAdminId: selectedAdminId });
        } else if (!isAssigned && d.data().assignedAdminId === selectedAdminId) {
          await updateDoc(doc(db, 'zoho_credentials', d.id), { assignedAdminId: null });
        }
      }

      // Sync assignedAdminId on imap_credentials
      const snapImap = await getDocs(collection(db, 'imap_credentials'));
      for (const d of snapImap.docs) {
        const email = d.data().imap_email;
        const isAssigned = modalSelectedImaps.includes(email) || modalSelectedImaps.includes(d.id);
        if (isAssigned && d.data().assignedAdminId !== selectedAdminId) {
          await updateDoc(doc(db, 'imap_credentials', d.id), { assignedAdminId: selectedAdminId });
        } else if (!isAssigned && d.data().assignedAdminId === selectedAdminId) {
          await updateDoc(doc(db, 'imap_credentials', d.id), { assignedAdminId: null });
        }
      }

      showToast(`Permissions updated for ${targetUser?.name || targetUser?.email || 'Admin'}!`, "success");
      setIsPermissionModalOpen(false);
      await loadMailboxes();
    } catch (err) {
      console.error("Error updating permissions:", err);
      showToast("Failed to update admin permissions.", "error");
    } finally {
      setSavingPermissions(false);
    }
  };

  // Toggle Single Email Assignment for an Admin User
  const handleToggleEmailAssignment = async (adminUid, item) => {
    try {
      const adminDoc = adminUsers.find(u => u.id === adminUid);
      if (!adminDoc) return;

      let fieldName = 'selectedGmails';
      if (item.type === 'zoho') fieldName = 'selectedZohos';
      if (item.type === 'imap') fieldName = 'selectedImaps';

      const currentList = adminDoc[fieldName] || [];
      const emailOrId = item.email;
      const isCurrentlyAssigned = currentList.includes(emailOrId) || currentList.includes(item.id);

      let newList = [];
      if (isCurrentlyAssigned) {
        newList = currentList.filter(x => x !== emailOrId && x !== item.id);
      } else {
        newList = [...currentList, emailOrId];
      }

      await updateDoc(doc(db, 'users', adminUid), {
        [fieldName]: newList
      });

      // Also update assignedAdminId on credential doc if applicable
      if (item.collectionName && item.id) {
        await updateDoc(doc(db, item.collectionName, item.id), {
          assignedAdminId: !isCurrentlyAssigned ? adminUid : null
        });
      }

      showToast(`Mailbox "${item.email}" ${!isCurrentlyAssigned ? 'assigned to' : 'removed from'} ${adminDoc.name || adminDoc.email}`, "success");
      await loadMailboxes();
    } catch (err) {
      console.error("Error toggling admin email access:", err);
      showToast("Failed to update email assignment.", "error");
    }
  };

  // Combine Mailboxes & Store Items into Unified Inventory
  const inventoryList = React.useMemo(() => {
    const combined = [];
    const seenEmails = new Set();
    const TWO_DAYS_MS = 48 * 60 * 60 * 1000;

    mailboxes.forEach((m) => {
      seenEmails.add(m.email);

      const assignedKey = licenseKeys.find(
        (k) => (k.assignedMailbox === m.email || k.mailboxDocId === m.id)
      );

      let isClientActive = false;
      let clientExpiresAt = null;

      if (assignedKey) {
        const keyTime = new Date(assignedKey.redeemedAt || assignedKey.createdAt).getTime();
        const expiryTime = keyTime + TWO_DAYS_MS;

        if (now < expiryTime) {
          isClientActive = true;
          clientExpiresAt = new Date(expiryTime).toISOString();
        }
      }

      const bookingDocId = String(m.email).replace(/[\/\.\#\$\[\]]/g, '_');
      const bookingData = bookings[bookingDocId] || bookings[m.email] || {};
      const isBooked = bookingData.bookingStatus === 'booked' && 
        bookingData.bookingExpiresAt && 
        new Date(bookingData.bookingExpiresAt).getTime() > now;

      let status = 'available';
      if (isClientActive) {
        status = 'assigned';
      } else if (isBooked) {
        status = 'booked';
      }

      combined.push({
        id: m.id || m.email,
        email: m.email,
        title: `Mailbox: ${m.email}`,
        type: m.type,
        verified: m.verified,
        collectionName: m.collectionName,
        fieldKey: m.fieldKey,
        source: 'Client Management',
        status: status,
        booking: isBooked ? bookingData : null,
        assignedKey: assignedKey || null,
        isClientActive: isClientActive,
        clientExpiresAt: clientExpiresAt,
        rawDoc: m,
        game_id_name: m.game_id_name || null,
        game_uid: m.game_uid || null,
        price_inr: m.price_inr !== undefined ? m.price_inr : null
      });
    });

    storeItems.forEach((s) => {
      if (s.linkedEmail && seenEmails.has(s.linkedEmail)) {
        const existing = combined.find((c) => c.email === s.linkedEmail);
        if (existing) {
          existing.title = s.title || existing.title;
          existing.price_inr = s.price || existing.price_inr;
          existing.mediaUrl = s.mediaUrl;
          existing.mediaType = s.mediaType;
          existing.storeDocId = s.id;
        }
      } else {
        // If s is not linked to any seen mailbox:
        // Non-superadmins must ONLY see items assigned to them
        if (!isSuperAdmin) {
          if (s.linkedEmail && !seenEmails.has(s.linkedEmail)) {
            return; // Skip! Belongs to an unassigned account
          }
          if (!s.linkedEmail && s.createdByUid !== currentUser?.uid) {
            return; // Skip! Not created by or assigned to this admin
          }
        }

        const bookingDocId = String(s.id).replace(/[\/\.\#\$\[\]]/g, '_');
        const bookingData = bookings[bookingDocId] || bookings[s.id] || {};
        const isBooked = bookingData.bookingStatus === 'booked' && 
          bookingData.bookingExpiresAt && 
          new Date(bookingData.bookingExpiresAt).getTime() > now;

        let isClientActive = false;
        let clientExpiresAt = null;

        if (s.createdAt && s.status === 'sold') {
          const itemTime = new Date(s.createdAt).getTime();
          const expiryTime = itemTime + TWO_DAYS_MS;
          if (now < expiryTime) {
            isClientActive = true;
            clientExpiresAt = new Date(expiryTime).toISOString();
          }
        }

        let status = 'available';
        if (isClientActive) {
          status = 'assigned';
        } else if (isBooked) {
          status = 'booked';
        }

        combined.push({
          id: s.id,
          email: s.linkedEmail || 'No Linked Email',
          title: s.title || 'Store Product',
          type: s.mediaType || 'store',
          verified: true,
          price_inr: s.price || null,
          mediaUrl: s.mediaUrl,
          mediaType: s.mediaType,
          source: 'FF Store',
          status: status,
          booking: isBooked ? bookingData : null,
          isClientActive: isClientActive,
          clientExpiresAt: clientExpiresAt,
          storeDocId: s.id,
          rawDoc: s,
          game_id_name: null
        });
      }
    });

    return combined;
  }, [mailboxes, storeItems, licenseKeys, bookings, now, isSuperAdmin, currentUser]);

  const getBookingDocId = (id) => {
    return String(id).replace(/[\/\.\#\$\[\]]/g, '_');
  };

  // Auto-Expire Bookings after 48 Hours
  useEffect(() => {
    Object.keys(bookings).forEach(async (key) => {
      const b = bookings[key];
      if (b.bookingStatus === 'booked' && b.bookingExpiresAt) {
        const expiresTime = new Date(b.bookingExpiresAt).getTime();
        if (expiresTime <= Date.now()) {
          console.log(`Auto-expiring 2-day booking for ID: ${key}`);
          try {
            await setDoc(doc(db, 'inventory_bookings', key), {
              bookingStatus: 'none',
              bookedAt: null,
              bookingExpiresAt: null,
              bookedByEmail: null
            }, { merge: true });

            showToast(`2-Day Booking expired for ${key}. Item is now Available!`, "info");
          } catch (err) {
            console.error("Error auto-expiring booking:", err);
          }
        }
      }
    });
  }, [now, bookings, showToast]);

  // Handle Book for 2 Days (48 Hours)
  const handleBookItem = async (item) => {
    setActionLoadingId(item.id);
    try {
      const bookedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const docId = getBookingDocId(item.id);

      await setDoc(doc(db, 'inventory_bookings', docId), {
        bookingId: item.id,
        itemEmail: item.email,
        itemTitle: item.title,
        bookingStatus: 'booked',
        bookedAt: bookedAt,
        bookingExpiresAt: expiresAt,
        bookedByEmail: currentUser?.email || 'Admin'
      }, { merge: true });

      showToast(`"${item.email || item.title}" booked for 2 Days (48 hours)!`, "success");
    } catch (err) {
      console.error("Failed to book item:", err);
      showToast(err.message || "Failed to book item.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Cancel Booking
  const handleCancelBooking = async (item) => {
    setActionLoadingId(item.id);
    try {
      const docId = getBookingDocId(item.id);
      await setDoc(doc(db, 'inventory_bookings', docId), {
        bookingStatus: 'none',
        bookedAt: null,
        bookingExpiresAt: null,
        bookedByEmail: null
      }, { merge: true });

      showToast(`Booking canceled for "${item.email || item.title}". Item is now Available!`, "success");
    } catch (err) {
      console.error("Failed to cancel booking:", err);
      showToast(err.message || "Failed to release booking.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Countdown Formatter
  const formatCountdown = (expiresAt) => {
    if (!expiresAt) return '00h 00m 00s';
    const diff = new Date(expiresAt).getTime() - now;
    if (diff <= 0) return '00h 00m 00s';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${hours}h ${minutes}m ${seconds}s`;
  };

  // Filter Logic
  const filteredItems = inventoryList.filter((item) => {
    if (filterTab === 'available' && item.status !== 'available') return false;
    if (filterTab === 'booked' && item.status !== 'booked') return false;
    if (filterTab === 'assigned' && item.status !== 'assigned') return false;
    if (filterTab === 'authorized' && !item.verified) return false;
    if (filterTab === 'unauthorized' && item.verified) return false;

    if (priceFilter !== 'all') {
      const priceVal = item.price_inr !== undefined && item.price_inr !== null ? Number(item.price_inr) : null;
      if (priceVal !== Number(priceFilter)) {
        return false;
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchEmail = (item.email || '').toLowerCase().includes(q);
      const matchTitle = (item.title || '').toLowerCase().includes(q);
      const matchGameId = (item.game_id_name || '').toLowerCase().includes(q);
      const matchPrice = item.price_inr !== undefined && item.price_inr !== null ? String(item.price_inr).includes(q) : false;
      return matchEmail || matchTitle || matchGameId || matchPrice;
    }
    return true;
  });

  // Real-time Counters
  const countTotal = inventoryList.length;
  const countAvailable = inventoryList.filter((i) => i.status === 'available').length;
  const countBooked = inventoryList.filter((i) => i.status === 'booked').length;
  const countAssigned = inventoryList.filter((i) => i.status === 'assigned').length;
  const countAuthorized = inventoryList.filter((i) => i.verified).length;
  const countUnauthorized = inventoryList.filter((i) => !i.verified).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans select-none">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      <div className="lg:pl-72 min-h-screen flex flex-col min-w-0">
        <Navbar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

        <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full flex-1">
          
          {/* Header Banner */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
                  <Boxes className="w-6 h-6" />
                </span>
                <div>
                  <h1 className="text-base sm:text-lg font-black text-gray-900 dark:text-white uppercase tracking-wide">
                    Client Management & Stock Ledger
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mt-0.5">
                    Real-time inventory ledger with 48-Hour auto-expiration rule & Admin permission controls.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
              {isSuperAdmin && (
                <button
                  onClick={() => setIsPermissionModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Users className="w-4 h-4" />
                  <span>Assign Admin Permissions</span>
                </button>
              )}

              <span className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-955/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-900/60">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                2-Day Auto Free Active
              </span>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div 
              onClick={() => setFilterTab('all')}
              className={`border rounded-2xl p-4 shadow-sm space-y-1 cursor-pointer transition-all ${
                filterTab === 'all'
                  ? 'bg-indigo-50/40 dark:bg-indigo-955/40 border-indigo-400 ring-2 ring-indigo-500/20'
                  : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'
              }`}
            >
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Total Mailboxes</span>
              <span className="text-2xl font-black text-gray-900 dark:text-white">{countTotal}</span>
            </div>

            <div 
              onClick={() => setFilterTab('available')}
              className={`border rounded-2xl p-4 shadow-sm space-y-1 cursor-pointer transition-all ${
                filterTab === 'available'
                  ? 'bg-emerald-50/50 dark:bg-emerald-955/40 border-emerald-500 ring-2 ring-emerald-500/20'
                  : 'bg-white dark:bg-gray-900 border-emerald-200 dark:border-emerald-900/50'
              }`}
            >
              <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                In Stock (Available)
              </span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{countAvailable}</span>
            </div>

            <div 
              onClick={() => setFilterTab('booked')}
              className={`border rounded-2xl p-4 shadow-sm space-y-1 cursor-pointer transition-all ${
                filterTab === 'booked'
                  ? 'bg-amber-50/50 dark:bg-amber-955/40 border-amber-500 ring-2 ring-amber-500/20'
                  : 'bg-white dark:bg-gray-900 border-amber-200 dark:border-amber-900/50'
              }`}
            >
              <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest block flex items-center gap-1">
                <Bookmark className="w-3.5 h-3.5" />
                Booked (Admin 2 Days)
              </span>
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{countBooked}</span>
            </div>

            <div 
              onClick={() => setFilterTab('assigned')}
              className={`border rounded-2xl p-4 shadow-sm space-y-1 cursor-pointer transition-all ${
                filterTab === 'assigned'
                  ? 'bg-indigo-50/50 dark:bg-indigo-955/40 border-indigo-500 ring-2 ring-indigo-500/20'
                  : 'bg-white dark:bg-gray-900 border-indigo-200 dark:border-indigo-900/50'
              }`}
            >
              <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" />
                Client Access (&lt; 2 Days)
              </span>
              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{countAssigned}</span>
            </div>
          </div>

          {/* Unified Filter Bar */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search email or title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-xs bg-gray-55 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Price Filter Selector */}
              <div className="w-full sm:w-auto flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 shadow-sm">
                <span className="text-[10px] font-black uppercase text-gray-400 whitespace-nowrap">Price:</span>
                <select
                  value={priceFilter}
                  onChange={(e) => setPriceFilter(e.target.value)}
                  className="bg-transparent text-xs font-black text-gray-900 dark:text-white focus:outline-none cursor-pointer pr-4"
                >
                  <option value="all" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">All Prices</option>
                  <option value="300" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">₹300</option>
                  <option value="500" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">₹500</option>
                  <option value="1000" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">₹1,000</option>
                  <option value="1500" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">₹1,500</option>
                  <option value="2000" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">₹2,000</option>
                  <option value="2500" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">₹2,500</option>
                  <option value="3000" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">₹3,000</option>
                  <option value="4000" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">₹4,000</option>
                  <option value="5000" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">₹5,000</option>
                  <option value="8000" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">₹8,000</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              <Filter className="w-4 h-4 text-gray-400 shrink-0 mr-1" />
              {[
                { key: 'all', label: `All (${countTotal})` },
                { key: 'available', label: `In Stock (${countAvailable})` },
                { key: 'booked', label: `Booked (${countBooked})` },
                { key: 'assigned', label: `Client Active (${countAssigned})` },
                ...(isSuperAdmin ? [
                  { key: 'authorized', label: `Authorized (${countAuthorized})` },
                  { key: 'unauthorized', label: `Pending (${countUnauthorized})` }
                ] : [])
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilterTab(tab.key)}
                  className={`px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                    filterTab === tab.key
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-750'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cards Grid */}
          {loading ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-16 flex flex-col items-center justify-center space-y-3 shadow-sm">
              <Loader className="w-8 h-8 animate-spin text-indigo-600" />
              <span className="text-xs text-gray-400 font-bold">Syncing IMAP stock records...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-16 text-center space-y-2 shadow-sm">
              <Boxes className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto" />
              <p className="text-xs text-gray-400 font-bold">No mailboxes or accounts found matching criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map((item) => {
                const isBooked = item.status === 'booked';
                const isAssigned = item.status === 'assigned';
                const isAvailable = item.status === 'available';
                const isAuthorized = item.verified;
                const isPopoverOpen = assignPopoverItemId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`bg-white dark:bg-gray-900 border rounded-3xl p-5 shadow-sm flex flex-col justify-between space-y-4 transition-all duration-200 relative ${
                      !isAuthorized
                        ? 'border-amber-300 dark:border-amber-800/60 bg-amber-50/10'
                        : isBooked
                        ? 'border-amber-400 dark:border-amber-500/60 ring-2 ring-amber-400/20'
                        : isAssigned
                        ? 'border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/5'
                        : 'border-emerald-200 dark:border-emerald-900/40 hover:border-indigo-300'
                    }`}
                  >
                    {/* Header info */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                          item.type === 'gmail' ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900/50' :
                          item.type === 'zoho' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50' :
                          'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-900/50'
                        }`}>
                          {item.type || 'Mailbox'}
                        </span>

                        {/* Authorization Badge */}
                        {isSuperAdmin && (
                          isAuthorized ? (
                            <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-widest rounded-full flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                              Authorized
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase tracking-widest rounded-full flex items-center gap-1">
                              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                              Pending Verification
                            </span>
                          )
                        )}
                      </div>

                      {/* Stock Status Badge */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {isAvailable && (
                          <span className="px-3 py-1 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest rounded-full inline-flex items-center gap-1 shadow-sm">
                            <CheckCircle2 className="w-3 h-3" />
                            In Stock (Available)
                          </span>
                        )}

                        {isBooked && (
                          <span className="px-3 py-1 bg-amber-500 text-black text-[9px] font-black uppercase tracking-widest rounded-full inline-flex items-center gap-1 animate-pulse shadow-sm">
                            <Clock className="w-3 h-3" />
                            Booked (2 Days)
                          </span>
                        )}

                        {isAssigned && (
                          <span className="px-3 py-1 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest rounded-full inline-flex items-center gap-1 shadow-sm">
                            <UserCheck className="w-3 h-3" />
                            Client In-Use (&lt; 2 Days)
                          </span>
                        )}

                        {item.game_id_name && (
                          <span className="px-3 py-1 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-[9px] font-black uppercase tracking-widest rounded-full inline-flex items-center gap-1 border border-rose-200 dark:border-rose-900/40 shadow-sm">
                            🎯 {item.game_id_name}
                          </span>
                        )}

                        {item.game_uid && (
                          <span className="px-3 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[9px] font-black uppercase tracking-widest rounded-full inline-flex items-center gap-1 border border-amber-300 dark:border-amber-900/40 shadow-xs font-mono">
                            🎮 UID: {item.game_uid}
                          </span>
                        )}

                        {item.price_inr !== undefined && item.price_inr !== null && (
                          <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-widest rounded-full inline-flex items-center gap-1 border border-emerald-200 dark:border-emerald-900/40 shadow-sm">
                            ₹{item.price_inr}
                          </span>
                        )}
                      </div>

                      {/* Title & Email */}
                      <div>
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-gray-900 dark:text-white truncate">
                          <Mail className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span className="truncate text-gray-900 dark:text-white font-extrabold" title={item.email}>{item.email}</span>
                        </div>
                        {item.title && item.title !== `Mailbox: ${item.email}` && (
                          <p className="text-[11px] font-bold text-gray-500 dark:text-gray-300 mt-1 truncate">
                            {item.title}
                          </p>
                        )}
                      </div>

                      {/* Client 2-Day Access Countdown - Ultra High Contrast */}
                      {isAssigned && item.clientExpiresAt && (
                        <div className="p-3.5 bg-indigo-950/90 dark:bg-indigo-950/95 border border-indigo-500/50 rounded-2xl space-y-2 text-xs shadow-inner">
                          <div className="flex items-center justify-between font-black text-white">
                            <span className="flex items-center gap-1.5 text-indigo-200">
                              <User className="w-4 h-4 text-indigo-400" />
                              <span>Client 2-Day Access:</span>
                            </span>
                            <span className="font-mono font-black text-xs sm:text-sm text-cyan-300 bg-slate-900 px-2.5 py-1 rounded-xl border border-cyan-500/40 shadow-sm">
                              {formatCountdown(item.clientExpiresAt)}
                            </span>
                          </div>
                          <span className="text-[10px] text-indigo-200 font-extrabold block">
                            After timer reaches 0, ID automatically becomes Available (In-Stock) again!
                          </span>
                        </div>
                      )}

                      {/* Admin Booking Countdown Timer Panel - Ultra High Contrast */}
                      {isBooked && item.booking && (
                        <div className="p-3.5 bg-amber-950/90 dark:bg-amber-950/95 border border-amber-500/60 rounded-2xl space-y-2 shadow-inner">
                          <div className="flex items-center justify-between font-black text-amber-200">
                            <span className="flex items-center gap-1.5 text-amber-200">
                              <Clock className="w-4 h-4 text-amber-400" />
                              <span>Admin Booking:</span>
                            </span>
                            <span className="font-mono font-black text-xs sm:text-sm text-amber-300 bg-slate-900 px-2.5 py-1 rounded-xl border border-amber-500/40 shadow-sm">
                              {formatCountdown(item.booking.bookingExpiresAt)}
                            </span>
                          </div>
                          {item.booking.bookedByEmail && (
                            <p className="text-[10px] text-amber-200 font-extrabold truncate">
                              Booked By: {item.booking.bookedByEmail}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-col space-y-2 relative">
                      {/* Super Admin Quick Assign & Verification Control Bar */}
                      {isSuperAdmin && (
                        <div className="flex items-center gap-1.5 w-full">
                          {/* Super Admin Authorize Button */}
                          {item.collectionName && (
                            <button
                              disabled={actionLoadingId === item.id}
                              onClick={() => handleToggleAuthorize(item)}
                              className={`flex-1 py-1.5 px-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                isAuthorized
                                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600'
                                  : 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700'
                              }`}
                            >
                              {actionLoadingId === item.id ? (
                                <Loader className="w-3 h-3 animate-spin" />
                              ) : isAuthorized ? (
                                <>
                                  <ShieldAlert className="w-3 h-3 text-rose-500" />
                                  <span>Revoke</span>
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>Authorize</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* Quick Assign Admin Popover Button */}
                          <button
                            onClick={() => setAssignPopoverItemId(isPopoverOpen ? null : item.id)}
                            className="py-1.5 px-3 bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1 hover:bg-indigo-100 cursor-pointer transition-all"
                            title="Assign access to specific admins"
                          >
                            <UserPlus className="w-3 h-3" />
                            <span>Assign Admin</span>
                          </button>
                        </div>
                      )}

                      {/* Popover Dropdown for Quick Assigning to Admins */}
                      {isSuperAdmin && isPopoverOpen && (
                        <div className="absolute bottom-12 left-0 right-0 z-30 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-3 shadow-xl space-y-2 animate-in fade-in zoom-in-95">
                          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-1.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
                              Grant Access to Admin:
                            </span>
                            <button onClick={() => setAssignPopoverItemId(null)} className="text-gray-400 hover:text-gray-600">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="max-h-40 overflow-y-auto space-y-1.5">
                            {adminUsers.length === 0 ? (
                              <p className="text-[9px] text-gray-400">No admins found.</p>
                            ) : (
                              adminUsers.map((admin) => {
                                let fieldName = 'selectedGmails';
                                if (item.type === 'zoho') fieldName = 'selectedZohos';
                                if (item.type === 'imap') fieldName = 'selectedImaps';

                                const list = admin[fieldName] || [];
                                const isAssigned = list.includes(item.email) || list.includes(item.id);

                                return (
                                  <label
                                    key={admin.id}
                                    className="flex items-center justify-between p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer text-[10px] font-bold text-gray-800 dark:text-gray-200"
                                  >
                                    <span className="truncate pr-2">{admin.name || admin.email}</span>
                                    <input
                                      type="checkbox"
                                      checked={isAssigned}
                                      onChange={() => handleToggleEmailAssignment(admin.id, item)}
                                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                    />
                                  </label>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-[9px] font-black uppercase text-gray-400 dark:text-gray-400">
                          {item.source}
                        </span>

                        <div>
                          {isAvailable && (
                            <button
                              disabled={actionLoadingId === item.id}
                              onClick={() => handleBookItem(item)}
                              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-black font-black text-[10px] uppercase tracking-wider rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                              title="Reserve this account for 48 hours (2 Days)"
                            >
                              {actionLoadingId === item.id ? (
                                <Loader className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Bookmark className="w-3.5 h-3.5" />
                              )}
                              <span>Book for 2 Days</span>
                            </button>
                          )}

                          {isBooked && (
                            <button
                              disabled={actionLoadingId === item.id}
                              onClick={() => handleCancelBooking(item)}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-955/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 font-extrabold text-[9.5px] uppercase tracking-wider rounded-xl transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="Release reservation back to Available"
                            >
                              {actionLoadingId === item.id ? (
                                <Loader className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5" />
                              )}
                              <span>Cancel Booking</span>
                            </button>
                          )}

                          {isAssigned && (
                            <span className="text-[10px] font-black text-cyan-300 uppercase tracking-wider bg-indigo-950 px-2.5 py-1 rounded-lg border border-indigo-700/60 shadow-sm">
                              Auto-Frees In {formatCountdown(item.clientExpiresAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Super Admin Permissions Modal Dialog (Matches User Screenshot UI) */}
      {isSuperAdmin && isPermissionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0f172a] border border-gray-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-white font-sans">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-800 flex items-center justify-between bg-slate-900/80">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
                  <Shield className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-base font-black tracking-wide uppercase">
                    Update Admin Operator Permissions
                  </h2>
                  <p className="text-xs text-gray-400 font-semibold">
                    Manage mailbox access and stock visibility for administrators
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsPermissionModalOpen(false)}
                className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* Select Admin Dropdown */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Select Administrator User Account
                </label>
                <select
                  value={selectedAdminId}
                  onChange={(e) => setSelectedAdminId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/80 border border-gray-700 rounded-2xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                >
                  {adminUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.email} ({user.email}) - Role: {user.role}
                    </option>
                  ))}
                </select>
              </div>

              {/* Allow License Key Management Checkbox Box */}
              <div className="p-4 bg-slate-800/50 border border-gray-700/80 rounded-2xl flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-xs font-black text-white flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={modalAllowKeys}
                      onChange={(e) => setModalAllowKeys(e.target.checked)}
                      className="rounded border-gray-600 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <span>Allow License Key Generation</span>
                  </label>
                  <p className="text-[10px] text-gray-400 pl-6">
                    Authorizes this administrator to create, copy, and manage license keys for their assigned mailboxes.
                  </p>
                </div>
              </div>

              {/* Gmail Monitoring Checklist */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                    ASSIGN GMAIL MONITORING
                  </span>
                  <span className="text-[10px] font-bold text-gray-400">
                    {modalSelectedGmails.length} Selected
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search Gmail addresses..."
                    value={gmailSearch}
                    onChange={(e) => setGmailSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-800/60 border border-gray-700 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                  {mailboxes.filter(m => m.type === 'gmail' && m.email.toLowerCase().includes(gmailSearch.toLowerCase())).map((m) => {
                    const isChecked = modalSelectedGmails.includes(m.email) || modalSelectedGmails.includes(m.id);
                    return (
                      <label 
                        key={m.id}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isChecked 
                            ? 'bg-indigo-950/40 border-indigo-500/60 text-white' 
                            : 'bg-slate-800/40 border-gray-800 text-gray-300 hover:border-gray-700'
                        }`}
                      >
                        <span className="text-xs font-bold truncate pr-2">{m.email}</span>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setModalSelectedGmails(prev => [...prev, m.email]);
                            } else {
                              setModalSelectedGmails(prev => prev.filter(x => x !== m.email && x !== m.id));
                            }
                          }}
                          className="rounded border-gray-600 text-indigo-600 focus:ring-indigo-500 w-4 h-4 shrink-0"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Zoho Monitoring Checklist */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                    ASSIGN ZOHO MONITORING
                  </span>
                  <span className="text-[10px] font-bold text-gray-400">
                    {modalSelectedZohos.length} Selected
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search Zoho addresses..."
                    value={zohoSearch}
                    onChange={(e) => setZohoSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-800/60 border border-gray-700 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                  {mailboxes.filter(m => m.type === 'zoho' && m.email.toLowerCase().includes(zohoSearch.toLowerCase())).map((m) => {
                    const isChecked = modalSelectedZohos.includes(m.email) || modalSelectedZohos.includes(m.id);
                    return (
                      <label 
                        key={m.id}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isChecked 
                            ? 'bg-amber-950/40 border-amber-500/60 text-white' 
                            : 'bg-slate-800/40 border-gray-800 text-gray-300 hover:border-gray-700'
                        }`}
                      >
                        <span className="text-xs font-bold truncate pr-2">{m.email}</span>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setModalSelectedZohos(prev => [...prev, m.email]);
                            } else {
                              setModalSelectedZohos(prev => prev.filter(x => x !== m.email && x !== m.id));
                            }
                          }}
                          className="rounded border-gray-600 text-amber-500 focus:ring-amber-500 w-4 h-4 shrink-0"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* IMAP Monitoring Checklist */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                    ASSIGN IMAP MONITORING
                  </span>
                  <span className="text-[10px] font-bold text-gray-400">
                    {modalSelectedImaps.length} Selected
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search IMAP addresses..."
                    value={imapSearch}
                    onChange={(e) => setImapSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-800/60 border border-gray-700 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                  {mailboxes.filter(m => m.type === 'imap' && m.email.toLowerCase().includes(imapSearch.toLowerCase())).map((m) => {
                    const isChecked = modalSelectedImaps.includes(m.email) || modalSelectedImaps.includes(m.id);
                    return (
                      <label 
                        key={m.id}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isChecked 
                            ? 'bg-emerald-950/40 border-emerald-500/60 text-white' 
                            : 'bg-slate-800/40 border-gray-800 text-gray-300 hover:border-gray-700'
                        }`}
                      >
                        <span className="text-xs font-bold truncate pr-2">{m.email}</span>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setModalSelectedImaps(prev => [...prev, m.email]);
                            } else {
                              setModalSelectedImaps(prev => prev.filter(x => x !== m.email && x !== m.id));
                            }
                          }}
                          className="rounded border-gray-600 text-emerald-500 focus:ring-emerald-500 w-4 h-4 shrink-0"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-800 bg-slate-900/80 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsPermissionModalOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-gray-700 text-xs font-bold text-gray-300 hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={savingPermissions}
                onClick={handleSaveModalPermissions}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {savingPermissions ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Save Permissions</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
