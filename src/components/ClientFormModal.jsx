import React, { useState, useEffect } from 'react';
import { X, Calendar, Loader, AlertTriangle } from 'lucide-react';
import { db } from '../firebase/config';
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';

/**
 * Modal dialog for creating and editing accounts (Admins and Clients).
 * Performs validity calculation for clients and hides subscription fields for admins.
 */
export default function ClientFormModal({ isOpen, onClose, client, onSubmit, currentUserRole, currentUserId }) {
  const isEdit = !!client;

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    mobile: '',
    role: 'client', // Default role
    productName: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    expiryDate: '',
    validityValue: '30',
    validityUnit: 'days',
    amountPaid: '0',
    remainingBalance: '0',
    commission: '0',
    commissionPaid: '0',
    status: 'Active',
    notes: '',
    linkedGmail: '',
    linkedZoho: '',
    linkedImap: '',
    bindingStatus: 'none',
    bindingStartDate: '',
    bindingEmail: '',
    mailboxDisabled: false,
    mailboxDisabledReason: ''
  });

  const PREDEFINED_REASONS = [
    "Verification suspended due to active binding process",
    "Suspicious activity detected",
    "Security check required",
    "Temporary maintenance"
  ];

  const [selectedReasonOption, setSelectedReasonOption] = useState(PREDEFINED_REASONS[0]);
  const [customReasonText, setCustomReasonText] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [bypassWarning, setBypassWarning] = useState(false);
  
  const [availableGmails, setAvailableGmails] = useState([]);
  const [gmailAccounts, setGmailAccounts] = useState([]);
  const [selectedGmails, setSelectedGmails] = useState([]);

  const [availableZohos, setAvailableZohos] = useState([]);
  const [zohoAccounts, setZohoAccounts] = useState([]);
  const [selectedZohos, setSelectedZohos] = useState([]);

  const [availableImaps, setAvailableImaps] = useState([]);
  const [imapAccounts, setImapAccounts] = useState([]);
  const [selectedImaps, setSelectedImaps] = useState([]);

  const [gmailSearch, setGmailSearch] = useState('');
  const [zohoSearch, setZohoSearch] = useState('');
  const [imapSearch, setImapSearch] = useState('');

  const handleToggleGmail = (gmailId) => {
    setSelectedGmails(prev => 
      prev.includes(gmailId)
        ? prev.filter(id => id !== gmailId)
        : [...prev, gmailId]
    );
  };

  const handleToggleZoho = (zohoId) => {
    setSelectedZohos(prev => 
      prev.includes(zohoId)
        ? prev.filter(id => id !== zohoId)
        : [...prev, zohoId]
    );
  };

  const handleToggleImap = (imapId) => {
    setSelectedImaps(prev => 
      prev.includes(imapId)
        ? prev.filter(id => id !== imapId)
        : [...prev, imapId]
    );
  };

  // Fetch available Gmail & Zoho auditor connections
  useEffect(() => {
    if (isOpen) {
      const fetchGmails = async () => {
        try {
          const querySnapshot = await getDocs(collection(db, 'gmail_credentials'));
          const list = [];
          const fullList = [];
          querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const isAssignedToMe = data.assignedAdminId === currentUserId;
            const isSuperadmin = currentUserRole === 'superadmin';
            const isAlreadyLinked = client && client.linkedGmail === data.gmail_email;
            if (isSuperadmin || isAssignedToMe || isAlreadyLinked) {
              list.push(data.gmail_email);
            }
            fullList.push({ id: docSnap.id, ...data });
          });
          setAvailableGmails(list);
          setGmailAccounts(fullList);

          // Reset selected gmails if creating
          if (!isEdit) {
            setSelectedGmails([]);
          } else if (client.role === 'admin' || client.role === 'superadmin') {
            // Load pre-existing assignments
            const assigned = [];
            fullList.forEach(item => {
              if (item.assignedAdminId === client.uid) {
                assigned.push(item.id);
              }
            });
            setSelectedGmails(assigned);
          }
        } catch (e) {
          console.error("Error fetching gmails:", e);
        }
      };

      const fetchZohos = async () => {
        try {
          const querySnapshot = await getDocs(collection(db, 'zoho_credentials'));
          const list = [];
          const fullList = [];
          querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const isAssignedToMe = data.assignedAdminId === currentUserId;
            const isSuperadmin = currentUserRole === 'superadmin';
            const isAlreadyLinked = client && client.linkedZoho === data.zoho_email;
            if (isSuperadmin || isAssignedToMe || isAlreadyLinked) {
              list.push(data.zoho_email);
            }
            fullList.push({ id: docSnap.id, ...data });
          });
          setAvailableZohos(list);
          setZohoAccounts(fullList);

          // Reset selected zohos if creating
          if (!isEdit) {
            setSelectedZohos([]);
          } else if (client.role === 'admin' || client.role === 'superadmin') {
            // Load pre-existing assignments
            const assigned = [];
            fullList.forEach(item => {
              if (item.assignedAdminId === client.uid) {
                assigned.push(item.id);
              }
            });
            setSelectedZohos(assigned);
          }
        } catch (e) {
          console.error("Error fetching zohos:", e);
        }
      };

      const fetchImaps = async () => {
        try {
          const querySnapshot = await getDocs(collection(db, 'imap_credentials'));
          const list = [];
          const fullList = [];
          querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const isAssignedToMe = data.assignedAdminId === currentUserId;
            const isSuperadmin = currentUserRole === 'superadmin';
            const isAlreadyLinked = client && client.linkedImap === data.imap_email;
            if (isSuperadmin || isAssignedToMe || isAlreadyLinked) {
              list.push(data.imap_email);
            }
            fullList.push({ id: docSnap.id, ...data });
          });
          setAvailableImaps(list);
          setImapAccounts(fullList);

          // Reset selected imaps if creating
          if (!isEdit) {
            setSelectedImaps([]);
          } else if (client.role === 'admin' || client.role === 'superadmin') {
            // Load pre-existing assignments
            const assigned = [];
            fullList.forEach(item => {
              if (item.assignedAdminId === client.uid) {
                assigned.push(item.id);
              }
            });
            setSelectedImaps(assigned);
          }
        } catch (e) {
          console.error("Error fetching imaps:", e);
        }
      };

      fetchGmails();
      fetchZohos();
      fetchImaps();
    }
  }, [isOpen, client, isEdit]);

  // Sync form state when modal opens or details change
  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || '',
        email: client.email || '',
        password: client.initialPassword || client.password || '',
        mobile: client.mobile || '',
        role: client.role || 'client',
        productName: client.productName || '',
        purchaseDate: client.purchaseDate ? new Date(client.purchaseDate).toISOString().split('T')[0] : '',
        expiryDate: client.expiryDate ? new Date(client.expiryDate).toISOString().split('T')[0] : '',
        validityValue: client.validityDays || '30',
        validityUnit: 'days',
        amountPaid: client.amountPaid || '0',
        remainingBalance: client.remainingBalance || '0',
        commission: client.commission || '0',
        commissionPaid: client.commissionPaid || '0',
        status: client.status || 'Active',
        notes: client.notes || '',
        linkedGmail: client.linkedGmail || '',
        linkedZoho: client.linkedZoho || '',
        linkedImap: client.linkedImap || '',
        bindingStatus: client.bindingStatus || 'none',
        bindingStartDate: client.bindingStartDate ? new Date(client.bindingStartDate).toISOString().split('T')[0] : '',
        bindingEmail: client.bindingEmail || '',
        mailboxDisabled: client.mailboxDisabled || false,
        mailboxDisabledReason: client.mailboxDisabledReason || '',
        allowLicenseKeys: client.allowLicenseKeys || false
      });

      const reason = client.mailboxDisabledReason || '';
      if (PREDEFINED_REASONS.includes(reason)) {
        setSelectedReasonOption(reason);
        setCustomReasonText('');
      } else if (reason) {
        setSelectedReasonOption('custom');
        setCustomReasonText(reason);
      } else {
        setSelectedReasonOption(PREDEFINED_REASONS[0]);
        setCustomReasonText('');
      }
    } else {
      setFormData({
        name: '',
        email: '',
        password: '',
        mobile: '',
        role: 'client',
        productName: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        expiryDate: '',
        validityValue: '30',
        validityUnit: 'days',
        amountPaid: '0',
        remainingBalance: '0',
        commission: '0',
        commissionPaid: '0',
        status: 'Active',
        notes: '',
        linkedGmail: '',
        linkedZoho: '',
        linkedImap: '',
        bindingStatus: 'none',
        bindingStartDate: '',
        bindingEmail: '',
        mailboxDisabled: false,
        mailboxDisabledReason: '',
        allowLicenseKeys: false
      });
      setSelectedReasonOption(PREDEFINED_REASONS[0]);
      setCustomReasonText('');
    }
    setError('');
    setGmailSearch('');
    setZohoSearch('');
    setImapSearch('');
    setDuplicateWarning(null);
    setBypassWarning(false);
  }, [client, isOpen]);

  // Recalculate Expiry Date based on Purchase Date + Validity (Clients only)
  useEffect(() => {
    if (formData.role === 'client' && formData.purchaseDate && formData.validityValue) {
      const pDate = new Date(formData.purchaseDate);
      const val = parseInt(formData.validityValue, 10);
      if (!isNaN(val) && !isNaN(pDate.getTime())) {
        if (formData.validityUnit === 'months') {
          pDate.setMonth(pDate.getMonth() + val);
        } else {
          pDate.setDate(pDate.getDate() + val);
        }
        setFormData(prev => ({
          ...prev,
          expiryDate: pDate.toISOString().split('T')[0]
        }));
      }
    }
  }, [formData.purchaseDate, formData.validityValue, formData.validityUnit, formData.role]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e, forceBypass = false) => {
    if (e && e.preventDefault) e.preventDefault();
    setError('');

    const cleanEmail = (formData.email || '').trim().toLowerCase();
    const cleanPassword = (formData.password || '').trim();

    if (!cleanEmail) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!isEdit && cleanPassword.length < 6) {
      setError("Password must be at least 6 characters long (Firebase requirement).");
      return;
    }

    setLoading(true);

    try {
      let payload;

      if (formData.role === 'admin' || formData.role === 'superadmin' || formData.role === 'employee') {
        payload = {
          name: formData.name,
          email: formData.email,
          password: formData.password,
          mobile: formData.mobile,
          role: formData.role,
          selectedGmails: (formData.role === 'superadmin' || formData.role === 'employee') ? [] : selectedGmails,
          selectedZohos: (formData.role === 'superadmin' || formData.role === 'employee') ? [] : selectedZohos,
          selectedImaps: (formData.role === 'superadmin' || formData.role === 'employee') ? [] : selectedImaps,
          allowLicenseKeys: formData.allowLicenseKeys || false
        };
      } else {
        // Validity Calculations for client subscriptions
        let days = Number(formData.validityValue);
        if (formData.validityUnit === 'months') {
          days = days * 30;
        }

        let finalReason = '';
        if (formData.mailboxDisabled) {
          finalReason = selectedReasonOption === 'custom' ? customReasonText : selectedReasonOption;
        }

        payload = {
          ...formData,
          role: 'client',
          validityDays: days,
          amountPaid: Number(formData.amountPaid) || 0,
          remainingBalance: Number(formData.remainingBalance) || 0,
          commission: Number(formData.commission) || 0,
          commissionPaid: Number(formData.commissionPaid) || 0,
          mailboxDisabledReason: finalReason
        };
      }

      // Check for duplicate email assignment (only for client roles, and if not bypassed)
      // Per business rules: only warn if the ID was booked or assigned to another client within 48 hours!
      if (formData.role === 'client' && !forceBypass && !bypassWarning) {
        const checkList = [];
        if (formData.linkedGmail) checkList.push({ field: 'linkedGmail', value: formData.linkedGmail, type: 'Gmail' });
        if (formData.linkedZoho) checkList.push({ field: 'linkedZoho', value: formData.linkedZoho, type: 'Zoho' });
        if (formData.linkedImap) checkList.push({ field: 'linkedImap', value: formData.linkedImap, type: 'IMAP' });

        let duplicateClientDetails = null;
        const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
        const now = Date.now();

        for (const item of checkList) {
          // 1. Check if the mailbox is actively booked in inventory_bookings
          const bookingDocId = String(item.value).replace(/[\/\.\#\$\[\]]/g, '_');
          try {
            const bSnap = await getDoc(doc(db, 'inventory_bookings', bookingDocId));
            const bData = bSnap.exists() ? bSnap.data() : null;
            if (bData && bData.bookingStatus === 'booked' && bData.bookingExpiresAt) {
              const bookingExpires = new Date(bData.bookingExpiresAt).getTime();
              if (bookingExpires > now) {
                const remainingHours = Math.max(1, Math.ceil((bookingExpires - now) / (1000 * 60 * 60)));
                duplicateClientDetails = {
                  name: `Booked in Inventory (${bData.bookedByEmail || 'Admin'})`,
                  email: bData.bookedByEmail || 'Inventory Booking',
                  type: item.type,
                  value: item.value,
                  remainingHours: remainingHours,
                  isInventory: true
                };
                break;
              }
            }
          } catch (bErr) {
            console.warn("Error checking inventory bookings:", bErr);
          }

          // 2. Check if another client was assigned this ID within the last 48 hours
          const q = query(
            collection(db, 'users'),
            where('role', '==', 'client'),
            where(item.field, '==', item.value)
          );
          const snap = await getDocs(q);

          for (const docSnap of snap.docs) {
            const otherClient = docSnap.data();
            const otherUid = otherClient.uid || docSnap.id;

            // If editing, make sure it's not the same client
            if (isEdit && otherUid === client.uid) {
              continue;
            }

            // Fetch other client's subscription for exact booking/expiry dates
            let subData = null;
            try {
              const subSnap = await getDoc(doc(db, 'subscriptions', otherUid));
              if (subSnap.exists()) {
                subData = subSnap.data();
              }
            } catch (subErr) {
              console.warn("Error reading other client subscription:", subErr);
            }

            // Gather all activity/booking timestamps for other client
            const activityTimestamps = [];
            if (otherClient.createdAt) activityTimestamps.push(new Date(otherClient.createdAt).getTime());
            if (otherClient.purchaseDate) activityTimestamps.push(new Date(otherClient.purchaseDate).getTime());
            if (otherClient.bindingStartDate) activityTimestamps.push(new Date(otherClient.bindingStartDate).getTime());
            if (otherClient.lastOtpScannedAt) activityTimestamps.push(typeof otherClient.lastOtpScannedAt === 'number' ? otherClient.lastOtpScannedAt : new Date(otherClient.lastOtpScannedAt).getTime());
            if (otherClient.lastOtpViewedAt) activityTimestamps.push(new Date(otherClient.lastOtpViewedAt).getTime());
            if (otherClient.updatedAt) activityTimestamps.push(new Date(otherClient.updatedAt).getTime());
            if (subData?.purchaseDate) activityTimestamps.push(new Date(subData.purchaseDate).getTime());
            if (subData?.createdAt) activityTimestamps.push(new Date(subData.createdAt).getTime());
            if (subData?.updatedAt?.toDate) activityTimestamps.push(subData.updatedAt.toDate().getTime());

            // Determine other client's subscription expiry
            const rawExpiry = otherClient.expiryDate || subData?.expiryDate;
            const expiryTime = rawExpiry ? (rawExpiry.toDate ? rawExpiry.toDate().getTime() : new Date(rawExpiry).getTime()) : 0;

            const latestActiveTime = activityTimestamps.length > 0 ? Math.max(...activityTimestamps.filter(t => !isNaN(t) && t > 0)) : 0;

            // An ID is considered "booked within 48 hours" only if:
            // (a) The subscription is still currently active: now < expiryTime
            // OR (b) The assignment/booking/scan was made within the last 48 hours: (now - latestActiveTime) < FORTY_EIGHT_HOURS_MS
            const isSubscriptionActive = expiryTime > 0 && now < expiryTime;
            const isWithin48Hours = latestActiveTime > 0 && (now - latestActiveTime) < FORTY_EIGHT_HOURS_MS;

            if (isSubscriptionActive || isWithin48Hours) {
              const remainingMs = isSubscriptionActive 
                ? (expiryTime - now) 
                : (FORTY_EIGHT_HOURS_MS - (now - latestActiveTime));
              const remainingHours = Math.max(1, Math.ceil(remainingMs / (1000 * 60 * 60)));

              duplicateClientDetails = {
                name: otherClient.name || 'Anonymous Client',
                email: otherClient.email,
                type: item.type,
                value: item.value,
                remainingHours: remainingHours,
                isInventory: false
              };
              break;
            } else {
              // 48 hours have passed! The previous client's 48-hour access is over.
              // Clear the stale mailbox pointer from the expired client document to prevent stale conflicts.
              try {
                await updateDoc(doc(db, 'users', docSnap.id), {
                  [item.field]: ''
                });
              } catch (cleanErr) {
                console.warn("Could not clean expired mailbox reference:", cleanErr);
              }
            }
          }

          if (duplicateClientDetails) break;
        }

        if (duplicateClientDetails) {
          setDuplicateWarning(duplicateClientDetails);
          setLoading(false);
          return; // Pause submission, wait for admin confirmation
        }
      }

      await onSubmit(payload);
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred during submission.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl shadow-2xl animate-modal-pop max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-150 dark:border-gray-800 shrink-0">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            {isEdit ? 'Update Account Details' : formData.role === 'admin' ? 'Register Administrator' : formData.role === 'employee' ? 'Register Store Staff / Employee' : 'Register New Client'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl">
              {error}
            </div>
          )}

          {/* Section: Basic Identity */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Account Credentials & Role
            </h4>

            {/* Account Role Dropdown (Create Mode Only) */}
            {!isEdit && (currentUserRole === 'superadmin' || currentUserRole === 'admin') && (
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-450 mb-1.5 uppercase">
                  Account Role
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white font-medium transition-all"
                >
                  <option value="client">Client (Default)</option>
                  <option value="employee">Employee / Store Staff (FF Store Access Only)</option>
                  <option value="admin">Administrator</option>
                  {currentUserRole === 'superadmin' && (
                    <option value="superadmin">Super Administrator</option>
                  )}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-455 mb-1.5 uppercase">
                  Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  disabled={isEdit}
                  className="w-full px-4 py-2.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-black dark:text-white disabled:opacity-60 transition-all font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-550 dark:text-gray-455 mb-1.5 uppercase">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={isEdit}
                  placeholder="name@example.com"
                  className="w-full px-4 py-2.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-black dark:text-white disabled:opacity-60 transition-all font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-550 dark:text-gray-455 mb-1.5 uppercase">
                  {isEdit ? 'Login Password' : 'Initial Password'}
                </label>
                <input
                  type="text"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required={!isEdit}
                  minLength={6}
                  placeholder={isEdit ? "Set/Update client login password" : "Min. 6 characters"}
                  className="w-full px-4 py-2.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-black dark:text-white transition-all font-bold font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-550 dark:text-gray-455 mb-1.5 uppercase">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleChange}
                  disabled={isEdit}
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-4 py-2.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-black dark:text-white disabled:opacity-60 transition-all font-bold"
                />
              </div>
            </div>
          </div>

          {/* Section: Operator Access Permissions (Admins Only) */}
          {formData.role === 'admin' && currentUserRole === 'superadmin' && (
            <div className="space-y-4 pt-4 border-t border-gray-150 dark:border-gray-800 animate-fade-in">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-555">
                Operator Permissions
              </h4>
              
              {/* License Key Permission Toggle */}
              <div className="pb-3 border-b border-gray-150 dark:border-gray-800">
                <label className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs font-bold cursor-pointer select-none transition-all bg-indigo-50/20 dark:bg-indigo-950/10 border-indigo-200 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-400">
                  <input
                    type="checkbox"
                    checked={formData.allowLicenseKeys || false}
                    onChange={(e) => {
                      setFormData(prev => ({
                        ...prev,
                        allowLicenseKeys: e.target.checked
                      }));
                    }}
                    className="w-4 h-4 text-indigo-650 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div>
                    <span className="block font-black text-gray-900 dark:text-white">Allow License Key Management</span>
                    <span className="block text-[10px] text-gray-400 font-semibold mt-0.5 leading-normal">
                      Authorizes this administrator to generate, copy, and view single-use registration keys.
                    </span>
                  </div>
                </label>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-gray-555 dark:text-gray-450 mb-1 uppercase font-black">
                  Assign Gmail Monitoring
                </label>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-normal font-bold">
                  Select which connected Gmail addresses this administrator is authorized to monitor.
                </p>
                {gmailAccounts.length > 0 && (
                  <input
                    type="text"
                    placeholder="🔍 Search Gmail addresses..."
                    value={gmailSearch}
                    onChange={(e) => setGmailSearch(e.target.value)}
                    className="w-full px-3.5 py-2 bg-gray-100 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-black dark:text-white font-bold transition-all text-xs"
                  />
                )}
                {gmailAccounts.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No connected Gmail accounts found.</p>
                ) : gmailAccounts.filter(acc => acc.gmail_email.toLowerCase().includes(gmailSearch.toLowerCase())).length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No matching Gmail addresses found.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-40 overflow-y-auto pr-1 border border-gray-150 dark:border-gray-800 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-950">
                    {gmailAccounts
                      .filter(acc => acc.gmail_email.toLowerCase().includes(gmailSearch.toLowerCase()))
                      .map(account => {
                        const isChecked = selectedGmails.includes(account.id);
                        return (
                          <label
                            key={account.id}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer select-none transition-all ${
                              isChecked
                                ? 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-400'
                                : 'bg-white dark:bg-gray-900 border-gray-150 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleGmail(account.id)}
                              className="w-3.5 h-3.5 text-indigo-650 rounded border-gray-300 focus:ring-indigo-500/20 cursor-pointer"
                            />
                            <span className="truncate">{account.gmail_email}</span>
                          </label>
                        );
                      })}
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-2">
                <label className="block text-xs font-bold text-gray-555 dark:text-gray-450 mb-1 uppercase font-black">
                  Assign Zoho Monitoring
                </label>
                <p className="text-[10px] text-gray-400 dark:text-gray-550 leading-normal font-bold">
                  Select which connected Zoho Mail addresses this administrator is authorized to monitor.
                </p>
                {zohoAccounts.length > 0 && (
                  <input
                    type="text"
                    placeholder="🔍 Search Zoho addresses..."
                    value={zohoSearch}
                    onChange={(e) => setZohoSearch(e.target.value)}
                    className="w-full px-3.5 py-2 bg-gray-100 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-black dark:text-white font-bold transition-all text-xs"
                  />
                )}
                {zohoAccounts.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No connected Zoho accounts found.</p>
                ) : zohoAccounts.filter(acc => acc.zoho_email.toLowerCase().includes(zohoSearch.toLowerCase())).length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No matching Zoho addresses found.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-40 overflow-y-auto pr-1 border border-gray-150 dark:border-gray-800 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-950">
                    {zohoAccounts
                      .filter(acc => acc.zoho_email.toLowerCase().includes(zohoSearch.toLowerCase()))
                      .map(account => {
                        const isChecked = selectedZohos.includes(account.id);
                        return (
                          <label
                            key={account.id}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer select-none transition-all ${
                              isChecked
                                ? 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-400'
                                : 'bg-white dark:bg-gray-900 border-gray-150 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleZoho(account.id)}
                              className="w-3.5 h-3.5 text-indigo-650 rounded border-gray-300 focus:ring-indigo-500/20 cursor-pointer"
                            />
                            <span className="truncate">{account.zoho_email}</span>
                          </label>
                        );
                      })}
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-2">
                <label className="block text-xs font-bold text-gray-555 dark:text-gray-455 mb-1 uppercase font-black">
                  Assign IMAP Monitoring
                </label>
                <p className="text-[10px] text-gray-400 dark:text-gray-550 leading-normal font-bold">
                  Select which connected IMAP addresses this administrator is authorized to monitor.
                </p>
                {imapAccounts.length > 0 && (
                  <input
                    type="text"
                    placeholder="🔍 Search IMAP addresses..."
                    value={imapSearch}
                    onChange={(e) => setImapSearch(e.target.value)}
                    className="w-full px-3.5 py-2 bg-gray-100 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-black dark:text-white font-bold transition-all text-xs"
                  />
                )}
                {imapAccounts.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No connected IMAP accounts found.</p>
                ) : imapAccounts.filter(acc => acc.imap_email.toLowerCase().includes(imapSearch.toLowerCase())).length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No matching IMAP addresses found.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-40 overflow-y-auto pr-1 border border-gray-150 dark:border-gray-800 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-950">
                    {imapAccounts
                      .filter(acc => acc.imap_email.toLowerCase().includes(imapSearch.toLowerCase()))
                      .map(account => {
                        const isChecked = selectedImaps.includes(account.id);
                        return (
                          <label
                            key={account.id}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer select-none transition-all ${
                              isChecked
                                ? 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-400'
                                : 'bg-white dark:bg-gray-900 border-gray-150 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleImap(account.id)}
                              className="w-3.5 h-3.5 text-indigo-650 rounded border-gray-300 focus:ring-indigo-500/20 cursor-pointer"
                            />
                            <span className="truncate">{account.imap_email}</span>
                          </label>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section: Subscription & Financials (Clients Only) */}
          {formData.role === 'client' && (
            <div className="space-y-4 pt-4 border-t border-gray-150 dark:border-gray-800 animate-fade-in">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Subscription & Financial Info
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-455 mb-1.5 uppercase">
                    Product / Service Name
                  </label>
                  <input
                    type="text"
                    name="productName"
                    value={formData.productName}
                    onChange={handleChange}
                    required={formData.role === 'client'}
                    disabled={isEdit}
                    placeholder="e.g. SaaS Premium Enterprise"
                    className="w-full px-4 py-2.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-black dark:text-white disabled:opacity-60 transition-all font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-455 mb-1.5 uppercase">
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    name="purchaseDate"
                    value={formData.purchaseDate}
                    onChange={handleChange}
                    required={formData.role === 'client'}
                    disabled={isEdit}
                    className="w-full px-4 py-2.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-black dark:text-white disabled:opacity-60 transition-all font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-gray-555 dark:text-gray-455 mb-1.5 uppercase">
                      Validity
                    </label>
                    <input
                      type="number"
                      name="validityValue"
                      value={formData.validityValue}
                      onChange={handleChange}
                      min="1"
                      required={formData.role === 'client'}
                      className="w-full px-4 py-2.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-black dark:text-white transition-all font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-555 dark:text-gray-455 mb-1.5 uppercase">
                      Unit
                    </label>
                    <select
                      name="validityUnit"
                      value={formData.validityUnit}
                      onChange={handleChange}
                      className="w-full px-3 py-2.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-black dark:text-white font-bold transition-all"
                    >
                      <option value="days">Days</option>
                      <option value="months">Months</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-555 dark:text-gray-455 mb-1.5 uppercase">
                    Calculated Expiry Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-405" />
                    <input
                      type="date"
                      name="expiryDate"
                      value={formData.expiryDate}
                      onChange={handleChange}
                      required={formData.role === 'client'}
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-250 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-black dark:text-white transition-all font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-555 dark:text-gray-455 mb-1.5 uppercase">
                    Amount Paid (₹)
                  </label>
                  <input
                    type="number"
                    name="amountPaid"
                    value={formData.amountPaid}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    required={formData.role === 'client'}
                    className="w-full px-4 py-2.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-black dark:text-white transition-all font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-555 dark:text-gray-455 mb-1.5 uppercase">
                    Remaining Balance (₹)
                  </label>
                  <input
                    type="number"
                    name="remainingBalance"
                    value={formData.remainingBalance}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    required={formData.role === 'client'}
                    className="w-full px-4 py-2.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-black dark:text-white transition-all font-bold border-indigo-250 dark:border-indigo-900/60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-555 dark:text-gray-455 mb-1.5 uppercase">
                    Commission Due (₹)
                  </label>
                  <input
                    type="number"
                    name="commission"
                    value={formData.commission}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    required={formData.role === 'client'}
                    className="w-full px-4 py-2.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-black dark:text-white transition-all font-bold border-indigo-250 dark:border-indigo-900/60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-555 dark:text-gray-455 mb-1.5 uppercase">
                    Commission Paid (₹)
                  </label>
                  <input
                    type="number"
                    name="commissionPaid"
                    value={formData.commissionPaid}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    required={formData.role === 'client'}
                    className="w-full px-4 py-2.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-black dark:text-white transition-all font-bold border-indigo-250 dark:border-indigo-900/60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-555 dark:text-gray-455 mb-1.5 uppercase">
                    Account Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-255 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-black dark:text-white font-bold transition-all"
                  >
                    <option value="Active">Active</option>
                    <option value="Expired">Expired</option>
                    <option value="Suspended">Suspended</option>
                    <option value="ContactSeller">🚨 Contact to Seller Immediately</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-555 dark:text-gray-455 mb-1.5 uppercase">
                    Link Auditor Gmail (Optional)
                  </label>
                  <select
                    name="linkedGmail"
                    value={formData.linkedGmail}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-255 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-black dark:text-white font-bold transition-all"
                  >
                    <option value="">None</option>
                    {availableGmails.map(email => (
                      <option key={email} value={email}>{email}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-555 dark:text-gray-455 mb-1.5 uppercase">
                    Link Auditor Zoho (Optional)
                  </label>
                  <select
                    name="linkedZoho"
                    value={formData.linkedZoho}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-255 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-black dark:text-white font-bold transition-all"
                  >
                    <option value="">None</option>
                    {availableZohos.map(email => (
                      <option key={email} value={email}>{email}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-555 dark:text-gray-455 mb-1.5 uppercase">
                    Link Auditor IMAP (Optional)
                  </label>
                  <select
                    name="linkedImap"
                    value={formData.linkedImap}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-255 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-black dark:text-white font-bold transition-all"
                  >
                    <option value="">None</option>
                    {availableImaps.map(email => (
                      <option key={email} value={email}>{email}</option>
                    ))}
                  </select>
                </div>

                {/* Garena Mailbox Disabling Settings */}
                <div className="sm:col-span-2 p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      name="mailboxDisabled"
                      checked={formData.mailboxDisabled}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, mailboxDisabled: e.target.checked }));
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-650 focus:ring-indigo-500/20 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                      Disable Garena OTP Verification Mailbox
                    </span>
                  </label>

                  {formData.mailboxDisabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
                      <div>
                        <label className="block text-xs font-bold text-gray-555 dark:text-gray-455 mb-1.5 uppercase">
                          Reason for Stopping OTP
                        </label>
                        <select
                          value={selectedReasonOption}
                          onChange={(e) => setSelectedReasonOption(e.target.value)}
                          className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-750 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-black dark:text-white font-bold transition-all"
                        >
                          {PREDEFINED_REASONS.map(reason => (
                            <option key={reason} value={reason}>{reason}</option>
                          ))}
                          <option value="custom">Other (Custom Reason)</option>
                        </select>
                      </div>

                      {selectedReasonOption === 'custom' && (
                        <div className="animate-fade-in">
                          <label className="block text-xs font-bold text-gray-555 dark:text-gray-455 mb-1.5 uppercase">
                            Custom Disable Cause
                          </label>
                          <input
                            type="text"
                            value={customReasonText}
                            onChange={(e) => setCustomReasonText(e.target.value)}
                            required
                            placeholder="e.g. suspicious activity detected..."
                            className="w-full px-4 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-750 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-black dark:text-white transition-all font-bold"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-555 dark:text-gray-455 mb-1.5 uppercase">
                    Game Binding Status
                  </label>
                  <select
                    name="bindingStatus"
                    value={formData.bindingStatus}
                    onChange={(e) => {
                      const status = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        bindingStatus: status,
                        bindingStartDate: (status === 'pending' && !prev.bindingStartDate) 
                          ? new Date().toISOString().split('T')[0] 
                          : prev.bindingStartDate
                      }));
                    }}
                    className="w-full px-3 py-2.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-255 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-black dark:text-white font-bold transition-all"
                  >
                    <option value="none">No Active Binding</option>
                    <option value="pending">Binding In Progress (15d Timer)</option>
                    <option value="completed">Binding Completed</option>
                  </select>
                </div>

                {formData.bindingStatus !== 'none' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-gray-555 dark:text-gray-455 mb-1.5 uppercase">
                        Timer Start Date
                      </label>
                      <input
                        type="date"
                        name="bindingStartDate"
                        value={formData.bindingStartDate}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-black dark:text-white transition-all font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-555 dark:text-gray-455 mb-1.5 uppercase">
                        Binding Email Address
                      </label>
                      <input
                        type="text"
                        name="bindingEmail"
                        value={formData.bindingEmail}
                        onChange={handleChange}
                        placeholder="e.g. user@gmail.com"
                        required={formData.bindingStatus === 'pending'}
                        className="w-full px-4 py-2.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-black dark:text-white transition-all font-bold"
                      />
                    </div>
                  </>
                )}
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-550 dark:text-gray-455 mb-1.5 uppercase">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Enter client preferences, follow-up logs, or custom notes..."
                  className="w-full px-4 py-2.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-black dark:text-white transition-all border-indigo-250 dark:border-indigo-900/60 font-bold"
                />
              </div>
            </div>
          )}

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-150 dark:border-gray-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-55 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-750 disabled:bg-indigo-400 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-650/20 hover:shadow-xl transition-all"
            >
              {loading && <Loader className="w-4 h-4 animate-spin" />}
              <span>{isEdit ? 'Save Changes' : formData.role === 'admin' ? 'Create Admin Account' : formData.role === 'employee' ? 'Create Employee Account' : 'Create Client Account'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Duplicate Warning Dialog Overlay */}
      {duplicateWarning && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/70 backdrop-blur-sm rounded-3xl animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 shadow-2xl space-y-6 text-center">
            <div className="flex flex-col items-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-955/35 flex items-center justify-center text-amber-550 dark:text-amber-400 border border-amber-250 dark:border-amber-900/60 animate-bounce">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">Duplicate Email Link Detected</h3>
            </div>
            
            <div className="bg-amber-50/50 dark:bg-amber-955/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl p-4 text-xs font-bold text-amber-800 dark:text-amber-300 leading-relaxed text-left space-y-2">
              <p className="text-center font-black text-sm text-rose-600 dark:text-rose-450 uppercase tracking-wide">
                ⚠️ Don't do this!
              </p>
              <p className="text-center text-gray-700 dark:text-gray-300 text-xs">
                Customer can confuse or can harm your bank.
              </p>
              <div className="pt-2 border-t border-amber-200/40 text-[10px] text-gray-500 dark:text-gray-400 font-mono space-y-1">
                <p><strong>Duplicate:</strong> {duplicateWarning.value} ({duplicateWarning.type})</p>
                <p><strong>Already Linked To:</strong> {duplicateWarning.name} ({duplicateWarning.email})</p>
                {duplicateWarning.remainingHours && (
                  <p className="text-amber-600 dark:text-amber-400 font-bold pt-0.5">
                    <strong>Active 48h Booking:</strong> ~{duplicateWarning.remainingHours} hours remaining
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDuplicateWarning(null)}
                className="px-4 py-2 bg-gray-55 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 font-bold text-xs rounded-xl transition-all"
              >
                Go Back & Edit
              </button>
              <button
                type="button"
                onClick={async () => {
                  setDuplicateWarning(null);
                  setBypassWarning(true);
                  await handleSubmit(null, true);
                }}
                className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-650/20 transition-all"
              >
                Ignore and Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
