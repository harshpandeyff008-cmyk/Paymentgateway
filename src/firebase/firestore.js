import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  collection, 
  query, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  addDoc,
  limit,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from './config';

/**
 * Create a new Client profile and Subscription record in Firestore.
 * Also logs the create action in audit logs.
 */
export const createClientRecord = async (clientData, adminInfo) => {
  const { 
    uid, name, email, mobile, productName, purchaseDate, expiryDate, 
    validityDays, amountPaid, remainingBalance, commission, commissionPaid, status, notes, linkedGmail, linkedZoho, linkedImap,
    bindingStatus, bindingStartDate, bindingEmail, mailboxDisabled, mailboxDisabledReason, password
  } = clientData;

  const userRef = doc(db, 'users', uid);
  const subRef = doc(db, 'subscriptions', uid);

  // 1. Create User Document
  const assignedAdminId = adminInfo.role === 'admin' ? adminInfo.uid : null;

  await setDoc(userRef, {
    uid,
    role: 'client',
    name,
    email,
    mobile,
    linkedGmail: linkedGmail || '',
    linkedZoho: linkedZoho || '',
    linkedImap: linkedImap || '',
    bindingStatus: bindingStatus || 'none',
    bindingStartDate: bindingStartDate ? new Date(bindingStartDate) : null,
    bindingEmail: bindingEmail || '',
    mailboxDisabled: mailboxDisabled || false,
    mailboxDisabledReason: mailboxDisabledReason || '',
    warningDismissed: false,
    assignedAdminId: assignedAdminId || null,
    createdAt: serverTimestamp()
  });

  // 2. Create Subscription Document
  await setDoc(subRef, {
    uid,
    productName,
    purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
    expiryDate: expiryDate ? new Date(expiryDate) : null,
    validityDays: Number(validityDays) || 0,
    amountPaid: Number(amountPaid) || 0,
    remainingBalance: Number(remainingBalance) || 0,
    commission: Number(commission) || 0,
    commissionPaid: Number(commissionPaid) || 0,
    status,
    notes: notes || '',
    updatedAt: serverTimestamp()
  });

  // 3. Log Audit Trail
  await addAuditLog({
    adminUid: adminInfo.uid,
    adminEmail: adminInfo.email,
    action: 'CREATE_CLIENT',
    targetUid: uid,
    targetName: name,
    changes: {
      name: { old: null, new: name },
      email: { old: null, new: email },
      productName: { old: null, new: productName },
      status: { old: null, new: status },
      assignedAdminId: { old: null, new: assignedAdminId || 'None' }
    }
  });
};

/**
 * Create a new Admin user document in Firestore.
 * Also logs the create action in audit logs.
 */
export const createAdminRecord = async (adminData, adminInfo) => {
  const { 
    uid, name, email, mobile, role = 'admin', 
    allowLicenseKeys = false, initialPassword = '', password = '',
    selectedGmails = [], selectedZohos = [], selectedImaps = [] 
  } = adminData;
  const userRef = doc(db, 'users', uid);

  await setDoc(userRef, {
    uid,
    role,
    name,
    email,
    mobile: mobile || '',
    createdAt: serverTimestamp(),
    allowLicenseKeys: !!allowLicenseKeys,
    selectedGmails: selectedGmails || [],
    selectedZohos: selectedZohos || [],
    selectedImaps: selectedImaps || []
  });

  await addAuditLog({
    adminUid: adminInfo.uid,
    adminEmail: adminInfo.email,
    action: role === 'superadmin' ? 'CREATE_SUPERADMIN' : 'CREATE_ADMIN',
    targetUid: uid,
    targetName: name,
    changes: {
      name: { old: null, new: name },
      email: { old: null, new: email },
      role: { old: null, new: role },
      allowLicenseKeys: { old: null, new: !!allowLicenseKeys }
    }
  });
};

/**
 * Update administrator profile details and their Gmail monitoring assignments.
 */
export const updateAdminRecord = async (uid, updatedFields, originalFields, adminInfo) => {
  const { name, mobile, role, selectedGmails, selectedZohos, selectedImaps, allowLicenseKeys } = updatedFields;
  const userRef = doc(db, 'users', uid);

  const userUpdates = {};
  if (name !== undefined) userUpdates.name = name;
  if (mobile !== undefined) userUpdates.mobile = mobile;
  if (role !== undefined) userUpdates.role = role;
  if (allowLicenseKeys !== undefined) userUpdates.allowLicenseKeys = allowLicenseKeys;
  if (selectedGmails !== undefined) userUpdates.selectedGmails = selectedGmails;
  if (selectedZohos !== undefined) userUpdates.selectedZohos = selectedZohos;
  if (selectedImaps !== undefined) userUpdates.selectedImaps = selectedImaps;

  const changes = {};
  for (const key in updatedFields) {
    if (key !== 'selectedGmails' && key !== 'selectedZohos' && key !== 'selectedImaps' && updatedFields[key] !== undefined) {
      const oldVal = originalFields[key];
      const newVal = updatedFields[key];
      if (oldVal !== newVal) {
        changes[key] = { old: oldVal ?? null, new: newVal ?? null };
      }
    }
  }

  // Execute user doc updates
  if (Object.keys(userUpdates).length > 0) {
    await updateDoc(userRef, userUpdates);
  }

  // Gmail monitoring assignments sync
  if (selectedGmails !== undefined) {
    // 1. Fetch all connected Gmail credentials
    const snap = await getDocs(collection(db, 'gmail_credentials'));
    
    // 2. Loop and update assignments
    for (const docSnap of snap.docs) {
      const credId = docSnap.id;
      const credData = docSnap.data();
      const isCurrentlyAssigned = credData.assignedAdminId === uid;
      const shouldBeAssigned = selectedGmails.includes(credId);

      if (shouldBeAssigned && !isCurrentlyAssigned) {
        await updateDoc(doc(db, 'gmail_credentials', credId), {
          assignedAdminId: uid
        });
      } else if (!shouldBeAssigned && isCurrentlyAssigned) {
        await updateDoc(doc(db, 'gmail_credentials', credId), {
          assignedAdminId: null
        });
      }
    }
    
    // Record changes in audit log for gmails assignment
    const oldGmails = [];
    snap.forEach(d => {
      if (d.data().assignedAdminId === uid) oldGmails.push(d.data().gmail_email);
    });
    const newGmails = snap.docs
      .filter(d => selectedGmails.includes(d.id))
      .map(d => d.data().gmail_email);
      
    if (JSON.stringify(oldGmails.sort()) !== JSON.stringify(newGmails.sort())) {
      changes.assignedGmailMonitoring = { old: oldGmails.join(', ') || 'None', new: newGmails.join(', ') || 'None' };
    }
  }

  // Zoho monitoring assignments sync
  if (selectedZohos !== undefined) {
    // 1. Fetch all connected Zoho credentials
    const snap = await getDocs(collection(db, 'zoho_credentials'));
    
    // 2. Loop and update assignments
    for (const docSnap of snap.docs) {
      const credId = docSnap.id;
      const credData = docSnap.data();
      const isCurrentlyAssigned = credData.assignedAdminId === uid;
      const shouldBeAssigned = selectedZohos.includes(credId);

      if (shouldBeAssigned && !isCurrentlyAssigned) {
        await updateDoc(doc(db, 'zoho_credentials', credId), {
          assignedAdminId: uid
        });
      } else if (!shouldBeAssigned && isCurrentlyAssigned) {
        await updateDoc(doc(db, 'zoho_credentials', credId), {
          assignedAdminId: null
        });
      }
    }
    
    // Record changes in audit log for zohos assignment
    const oldZohos = [];
    snap.forEach(d => {
      if (d.data().assignedAdminId === uid) oldZohos.push(d.data().zoho_email);
    });
    const newZohos = snap.docs
      .filter(d => selectedZohos.includes(d.id))
      .map(d => d.data().zoho_email);
      
    if (JSON.stringify(oldZohos.sort()) !== JSON.stringify(newZohos.sort())) {
      changes.assignedZohoMonitoring = { old: oldZohos.join(', ') || 'None', new: newZohos.join(', ') || 'None' };
    }
  }

  // IMAP monitoring assignments sync
  if (selectedImaps !== undefined) {
    // 1. Fetch all connected IMAP credentials
    const snap = await getDocs(collection(db, 'imap_credentials'));
    
    // 2. Loop and update assignments
    for (const docSnap of snap.docs) {
      const credId = docSnap.id;
      const credData = docSnap.data();
      const isCurrentlyAssigned = credData.assignedAdminId === uid;
      const shouldBeAssigned = selectedImaps.includes(credId);

      if (shouldBeAssigned && !isCurrentlyAssigned) {
        await updateDoc(doc(db, 'imap_credentials', credId), {
          assignedAdminId: uid
        });
      } else if (!shouldBeAssigned && isCurrentlyAssigned) {
        await updateDoc(doc(db, 'imap_credentials', credId), {
          assignedAdminId: null
        });
      }
    }
    
    // Record changes in audit log for IMAP assignment
    const oldImaps = [];
    snap.forEach(d => {
      if (d.data().assignedAdminId === uid) oldImaps.push(d.data().imap_email);
    });
    const newImaps = snap.docs
      .filter(d => selectedImaps.includes(d.id))
      .map(d => d.data().imap_email);
      
    if (JSON.stringify(oldImaps.sort()) !== JSON.stringify(newImaps.sort())) {
      changes.assignedImapMonitoring = { old: oldImaps.join(', ') || 'None', new: newImaps.join(', ') || 'None' };
    }
  }

  // Create Audit Log if any changes were made
  if (Object.keys(changes).length > 0) {
    await addAuditLog({
      adminUid: adminInfo.uid,
      adminEmail: adminInfo.email,
      action: 'UPDATE_ADMIN',
      targetUid: uid,
      targetName: name || originalFields.name,
      changes
    });
  }
};

/**
 * Update client profile and subscription details in Firestore.
 * Compares fields to record changes in the audit logs.
 */
export const updateClientRecord = async (uid, updatedFields, originalFields, adminInfo) => {
  const { 
    name, mobile, productName, purchaseDate, expiryDate, validityDays, 
    amountPaid, remainingBalance, commission, commissionPaid, status, notes, linkedGmail, linkedZoho, linkedImap,
    bindingStatus, bindingStartDate, bindingEmail, mailboxDisabled, mailboxDisabledReason, warningDismissed,
    selectedGmails, selectedZohos, selectedImaps, allowLicenseKeys
  } = updatedFields;

  const userRef = doc(db, 'users', uid);
  const subRef = doc(db, 'subscriptions', uid);

  const userUpdates = {};
  if (name !== undefined) userUpdates.name = name;
  if (mobile !== undefined) userUpdates.mobile = mobile;
  if (linkedGmail !== undefined) userUpdates.linkedGmail = linkedGmail;
  if (linkedZoho !== undefined) userUpdates.linkedZoho = linkedZoho;
  if (linkedImap !== undefined) userUpdates.linkedImap = linkedImap;
  if (bindingStatus !== undefined) userUpdates.bindingStatus = bindingStatus;
  if (bindingStartDate !== undefined) userUpdates.bindingStartDate = bindingStartDate ? new Date(bindingStartDate) : null;
  if (bindingEmail !== undefined) userUpdates.bindingEmail = bindingEmail;
  if (mailboxDisabled !== undefined) userUpdates.mailboxDisabled = mailboxDisabled;
  if (mailboxDisabledReason !== undefined) userUpdates.mailboxDisabledReason = mailboxDisabledReason;
  if (warningDismissed !== undefined) userUpdates.warningDismissed = warningDismissed;
  if (selectedGmails !== undefined) userUpdates.selectedGmails = selectedGmails;
  if (selectedZohos !== undefined) userUpdates.selectedZohos = selectedZohos;
  if (selectedImaps !== undefined) userUpdates.selectedImaps = selectedImaps;
  if (allowLicenseKeys !== undefined) userUpdates.allowLicenseKeys = allowLicenseKeys;

  const subUpdates = {};
  if (productName !== undefined) subUpdates.productName = productName;
  if (purchaseDate !== undefined) subUpdates.purchaseDate = purchaseDate ? new Date(purchaseDate) : null;
  if (expiryDate !== undefined) subUpdates.expiryDate = expiryDate ? new Date(expiryDate) : null;
  if (validityDays !== undefined) subUpdates.validityDays = Number(validityDays) || 0;
  if (amountPaid !== undefined) subUpdates.amountPaid = Number(amountPaid) || 0;
  if (remainingBalance !== undefined) subUpdates.remainingBalance = Number(remainingBalance) || 0;
  if (commission !== undefined) subUpdates.commission = Number(commission) || 0;
  if (commissionPaid !== undefined) subUpdates.commissionPaid = Number(commissionPaid) || 0;
  if (status !== undefined) subUpdates.status = status;
  if (notes !== undefined) subUpdates.notes = notes;
  subUpdates.updatedAt = serverTimestamp();

  // Compare original fields against updated ones for Audit Log
  const changes = {};
  for (const key in updatedFields) {
    if (updatedFields[key] !== undefined) {
      let oldVal = originalFields[key];
      let newVal = updatedFields[key];

      if (key === 'purchaseDate' || key === 'expiryDate') {
        oldVal = oldVal ? new Date(oldVal).toISOString().split('T')[0] : null;
        newVal = newVal ? new Date(newVal).toISOString().split('T')[0] : null;
      }

      if (oldVal !== newVal) {
        changes[key] = { old: oldVal ?? null, new: newVal ?? null };
      }
    }
  }

  // Execute database updates
  if (Object.keys(userUpdates).length > 0) {
    await updateDoc(userRef, userUpdates);
  }
  await updateDoc(subRef, subUpdates);

  // Create Audit Log if any changes were made
  if (Object.keys(changes).length > 0) {
    await addAuditLog({
      adminUid: adminInfo.uid,
      adminEmail: adminInfo.email,
      action: 'UPDATE_CLIENT',
      targetUid: uid,
      targetName: name || originalFields.name,
      changes
    });
  }
};

/**
 * Delete a client's Firestore records and log the action.
 */
export const deleteClientRecord = async (uid, clientName, adminInfo, options = {}) => {
  const { reason = '', message = '', notifyClient = true } = options;

  if (notifyClient) {
    // Soft Delete: Keep users doc but mark status as Removed
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      status: 'Removed',
      removalReason: reason,
      removalMessage: message,
      removedAt: serverTimestamp()
    });
    // Delete subscription record to clear them from active count & lists
    await deleteDoc(doc(db, 'subscriptions', uid));

    await addAuditLog({
      adminUid: adminInfo.uid,
      adminEmail: adminInfo.email,
      action: 'REMOVE_CLIENT_SOFT',
      targetUid: uid,
      targetName: clientName,
      changes: {
        status: { old: 'Active', new: 'Removed' },
        removalReason: { old: null, new: reason },
        removalMessage: { old: null, new: message }
      }
    });
  } else {
    // Hard Delete: Delete both docs completely
    await deleteDoc(doc(db, 'users', uid));
    await deleteDoc(doc(db, 'subscriptions', uid));

    await addAuditLog({
      adminUid: adminInfo.uid,
      adminEmail: adminInfo.email,
      action: 'DELETE_CLIENT_HARD',
      targetUid: uid,
      targetName: clientName,
      changes: {
        deleted: { old: false, new: true }
      }
    });
  }
};

/**
 * Write a record to the `audit_logs` collection.
 */
export const addAuditLog = async ({ adminUid, adminEmail, action, targetUid, targetName, changes }) => {
  try {
    const logRef = collection(db, 'audit_logs');
    await addDoc(logRef, {
      adminUid,
      adminEmail,
      action,
      targetUid,
      targetName,
      changes,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Error creating audit log:", error);
  }
};

/**
 * Fetch all client accounts for the administrator client list.
 */
export const getAllClients = async (userRole, userUid) => {
  const usersSnapshot = await getDocs(collection(db, 'users'));
  const subsSnapshot = await getDocs(collection(db, 'subscriptions'));

  const subsMap = {};
  subsSnapshot.forEach(docSnap => {
    subsMap[docSnap.id] = docSnap.data();
  });

  const clients = [];

  usersSnapshot.forEach(docSnap => {
    const userData = docSnap.data();
    if (userData.role === 'client') {
      const subData = subsMap[docSnap.id] || {};

      const purchaseDate = subData.purchaseDate?.toDate?.() || 
                           (subData.purchaseDate ? new Date(subData.purchaseDate) : (userData.createdAt?.toDate?.() || new Date()));
      const expiryDate = subData.expiryDate?.toDate?.() || 
                         (subData.expiryDate ? new Date(subData.expiryDate) : (userData.planExpiresAt ? new Date(userData.planExpiresAt) : null));

      clients.push({
        uid: docSnap.id,
        id: docSnap.id,
        name: userData.name || userData.email || 'Client',
        email: userData.email || '',
        mobile: userData.mobile || userData.phone || '',
        productName: subData.productName || 'Trial Access',
        amountPaid: subData.amountPaid || 0,
        remainingBalance: subData.remainingBalance || 0,
        commission: subData.commission || 0,
        commissionPaid: subData.commissionPaid || 0,
        validityDays: subData.validityDays || 0,
        ...subData,
        ...userData,
        status: userData.status === 'Suspended' || userData.status === 'Removed' 
          ? userData.status 
          : (subData.status || userData.status || 'Active'),
        purchaseDate,
        expiryDate,
        bindingStartDate: userData.bindingStartDate?.toDate?.() || userData.bindingStartDate || null,
        updatedAt: subData.updatedAt?.toDate?.() || subData.updatedAt || new Date()
      });
    }
  });

  return clients;
};

/**
 * Subscribes to changes in a single user profile & subscription.
 * Triggers callback instantly on update.
 */
export const subscribeToClientData = (uid, callback) => {
  const userRef = doc(db, 'users', uid);
  const subRef = doc(db, 'subscriptions', uid);

  let userData = null;
  let subData = null;

  const triggerCallback = () => {
    if (userData && subData) {
      callback({
        ...userData,
        ...subData,
        purchaseDate: subData.purchaseDate?.toDate?.() || subData.purchaseDate,
        expiryDate: subData.expiryDate?.toDate?.() || subData.expiryDate,
        bindingStartDate: userData.bindingStartDate?.toDate?.() || userData.bindingStartDate || null,
        updatedAt: subData.updatedAt?.toDate?.() || subData.updatedAt
      });
    } else if (userData) {
      callback({ 
        ...userData, 
        bindingStartDate: userData.bindingStartDate?.toDate?.() || userData.bindingStartDate || null,
        status: 'Active' 
      });
    }
  };

  const unsubUser = onSnapshot(userRef, (docSnap) => {
    if (docSnap.exists()) {
      userData = docSnap.data();
      triggerCallback();
    } else {
      callback(null); // User deleted
    }
  }, () => callback(null));

  const unsubSub = onSnapshot(subRef, (docSnap) => {
    if (docSnap.exists()) {
      subData = docSnap.data();
      triggerCallback();
    }
  }, () => {});

  return () => {
    unsubUser();
    unsubSub();
  };
};

/**
 * Fetch all admin audit logs ordered by timestamp.
 */
export const fetchAuditLogs = async () => {
  const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(q);
  const logs = [];
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    logs.push({
      id: docSnap.id,
      ...data,
      timestamp: data.timestamp?.toDate?.() || data.timestamp
    });
  });
  return logs;
};

/**
 * Fetch all administrator accounts.
 */
export const getAllAdmins = async () => {
  const usersSnapshot = await getDocs(collection(db, 'users'));
  const admins = [];
  usersSnapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (data.role === 'admin' || data.role === 'superadmin') {
      admins.push({
        ...data,
        createdAt: data.createdAt?.toDate?.() || data.createdAt
      });
    }
  });
  return admins;
};

/**
 * Delete an administrator's user profile document in Firestore.
 */
export const deleteAdminRecord = async (uid, adminName, adminInfo) => {
  await deleteDoc(doc(db, 'users', uid));

  await addAuditLog({
    adminUid: adminInfo.uid,
    adminEmail: adminInfo.email,
    action: 'DELETE_ADMIN',
    targetUid: uid,
    targetName: adminName,
    changes: {
      deleted: { old: false, new: true }
    }
  });
};

/**
 * Suspends own account in case of suspicious behavior (simulated security event).
 */
export const suspendOwnAccount = async (uid, reason, message) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    status: 'Suspended',
    suspensionReason: reason,
    suspensionMessage: message,
    suspendedAt: serverTimestamp()
  });
};

/**
 * Unsuspend a client account.
 */
export const unsuspendClientRecord = async (uid, clientName, adminInfo) => {
  const userRef = doc(db, 'users', uid);
  const subRef = doc(db, 'subscriptions', uid);

  // Restore user document status
  await updateDoc(userRef, {
    status: 'Active',
    suspensionReason: null,
    suspensionMessage: null,
    suspendedAt: null
  });

  // Restore subscription document status
  await updateDoc(subRef, {
    status: 'Active',
    updatedAt: serverTimestamp()
  });

  // Add Log Entry in Audit Trail
  await addAuditLog({
    adminUid: adminInfo.uid,
    adminEmail: adminInfo.email,
    action: 'UNSUSPEND_CLIENT',
    targetUid: uid,
    targetName: clientName,
    changes: {
      status: { old: 'Suspended', new: 'Active' }
    }
  });
};

/**
 * Request administrator support chat.
 */
export const requestSupport = async (clientUid, clientName, clientEmail) => {
  const chatRef = doc(db, 'chats', clientUid);
  await setDoc(chatRef, {
    clientUid,
    clientName,
    clientEmail,
    status: 'requesting',
    disappearingEnabled: false,
    disappearTime: 15,
    requestedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });

  // Auto-generate automatic greeting & instruction message from Admin Support
  const msgRef = collection(db, 'chats', clientUid, 'messages');
  await addDoc(msgRef, {
    senderId: 'admin',
    senderName: 'Admin Support',
    text: `Hello ${clientName || 'User'}, kindly aap apna sara problem likh ke message chhod dein. We will be in touch with you within 24 to 48 hours. Thank you! 🙏`,
    createdAt: serverTimestamp()
  });
};

/**
 * Update chat configurations (e.g. toggle disappearing messages).
 */
export const updateChatConfig = async (clientUid, updates) => {
  const chatRef = doc(db, 'chats', clientUid);
  await updateDoc(chatRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
};

/**
 * Send support chat message.
 */
export const sendChatMessage = async (clientUid, senderId, senderName, text) => {
  const msgRef = collection(db, 'chats', clientUid, 'messages');
  await addDoc(msgRef, {
    senderId,
    senderName,
    text,
    createdAt: serverTimestamp()
  });
  
  // Touch parent chat record
  const chatRef = doc(db, 'chats', clientUid);
  await updateDoc(chatRef, {
    updatedAt: serverTimestamp()
  });
};

/**
 * Listen to chat parent status changes in real-time.
 */
export const subscribeToChat = (clientUid, callback) => {
  const chatRef = doc(db, 'chats', clientUid);
  return onSnapshot(chatRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data());
    } else {
      callback(null);
    }
  }, () => callback(null));
};

/**
 * Listen to incoming chat messages in real-time.
 */
export const subscribeToMessages = (clientUid, callback) => {
  const msgCollection = collection(db, 'chats', clientUid, 'messages');
  const q = query(msgCollection, orderBy('createdAt', 'asc'));
  
  return onSnapshot(q, (snapshot) => {
    const messages = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      messages.push({
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || data.createdAt || new Date()
      });
    });
    callback(messages);
  }, (err) => {
    console.error("Failed to subscribe to messages for clientUid:", clientUid, err);
    callback([]);
  });
};

/**
 * Listen to all active support requests (Admins).
 * Uses real-time listeners on the chats collection.
 */
export const subscribeToActiveSupportRequests = (callback) => {
  const chatsCollection = collection(db, 'chats');
  return onSnapshot(chatsCollection, (snapshot) => {
    const requests = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.status === 'requesting' || data.status === 'active') {
        requests.push({
          id: docSnap.id,
          ...data,
          requestedAt: data.requestedAt?.toDate?.() || data.requestedAt,
          updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
        });
      }
    });
    // Sort client-side by updatedAt desc to prevent composite index errors in Firestore
    requests.sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    });
    callback(requests);
  }, () => callback([]));
};

/**
 * Delete a specific chat message from database (disappearing messages trigger).
 */
export const deleteMessageRecord = async (clientUid, messageId) => {
  try {
    await deleteDoc(doc(db, 'chats', clientUid, 'messages', messageId));
  } catch (error) {
    console.error("Error deleting message:", error);
  }
};

/**
 * Accept support request (Admin).
 */
export const acceptSupportRequest = async (clientUid) => {
  const chatRef = doc(db, 'chats', clientUid);
  await updateDoc(chatRef, {
    status: 'active',
    updatedAt: serverTimestamp()
  });
};

/**
 * End support session and wipe chat history completely.
 */
export const endSupportSession = async (clientUid) => {
  const chatRef = doc(db, 'chats', clientUid);
  
  // 1. Reset chat status to idle
  await updateDoc(chatRef, {
    status: 'idle',
    disappearingEnabled: false,
    updatedAt: serverTimestamp()
  });

  // 2. Wipe subcollection documents
  const msgCollection = collection(db, 'chats', clientUid, 'messages');
  const msgSnap = await getDocs(msgCollection);
  const deletePromises = [];
  msgSnap.forEach(docSnap => {
    deletePromises.push(deleteDoc(doc(db, 'chats', clientUid, 'messages', docSnap.id)));
  });
  await Promise.all(deletePromises);
};

/**
 * Log client active session metadata in Firestore.
 */
export const logClientSession = async (clientUid, sessionData) => {
  const sessionCol = collection(db, 'users', clientUid, 'sessions');
  await addDoc(sessionCol, {
    ...sessionData,
    timestamp: serverTimestamp()
  });
};

/**
 * Fetch client session log records (ordered by timestamp desc).
 */
export const getClientSessions = async (clientUid) => {
  const sessionCol = collection(db, 'users', clientUid, 'sessions');
  const q = query(sessionCol, orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(q);
  const logs = [];
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    logs.push({
      id: docSnap.id,
      ...data,
      timestamp: data.timestamp?.toDate?.() || data.timestamp
    });
  });
  return logs;
};

/**
 * Fetch all session logs for all users.
 */
export const getAllUserSessions = async (userRole, userUid) => {
  const usersSnapshot = await getDocs(collection(db, 'users'));
  const clientUids = [];
  usersSnapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (data.role === 'client') {
      clientUids.push({ uid: docSnap.id, name: data.name, email: data.email });
    }
  });

  const allSessions = [];
  await Promise.all(clientUids.map(async (client) => {
    try {
      const sessionCol = collection(db, 'users', client.uid, 'sessions');
      const q = query(sessionCol, orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        allSessions.push({
          id: docSnap.id,
          clientName: client.name,
          clientEmail: client.email,
          ...data,
          timestamp: data.timestamp?.toDate?.() || data.timestamp
        });
      });
    } catch (err) {
      console.warn(`Could not load sessions for client ${client.name}:`, err);
    }
  }));

  // Sort by timestamp descending
  allSessions.sort((a, b) => {
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return bTime - aTime;
  });

  return allSessions;
};

/**
 * Dynamically extends client subscription in Firestore after successful Razorpay checkout.
 */
export const extendClientSubscription = async (clientUid, daysAdded, amountPaidForExtension) => {
  const subRef = doc(db, 'subscriptions', clientUid);
  const subSnap = await getDoc(subRef);
  if (!subSnap.exists()) {
    throw new Error("Subscription record not found.");
  }
  const subData = subSnap.data();

  const currentValidity = Number(subData.validityDays) || 0;
  const currentPaid = Number(subData.amountPaid) || 0;
  
  // Calculate new expiry date: if current expiry is in the future, add to it. Otherwise, add to today.
  let currentExpiry = subData.expiryDate?.toDate?.() || subData.expiryDate;
  let baseDate = new Date();
  if (currentExpiry && new Date(currentExpiry) > new Date()) {
    baseDate = new Date(currentExpiry);
  }
  baseDate.setDate(baseDate.getDate() + daysAdded);

  await updateDoc(subRef, {
    validityDays: currentValidity + daysAdded,
    amountPaid: currentPaid + amountPaidForExtension,
    expiryDate: baseDate,
    status: 'Active',
    updatedAt: serverTimestamp()
  });

  // Log in Audit Trail
  try {
    const logRef = collection(db, 'audit_logs');
    await addDoc(logRef, {
      adminUid: 'automated',
      adminEmail: 'payment@automated.com',
      action: 'CLIENT_SUBSCRIPTION_EXTENDED',
      targetUid: clientUid,
      targetName: subData.productName || 'Client Subscription',
      changes: {
        validityDays: { old: currentValidity, new: currentValidity + daysAdded },
        amountPaid: { old: currentPaid, new: currentPaid + amountPaidForExtension }
      },
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Error creating payment audit log:", error);
  }
};

/**
 * Record user acceptance of the terms and conditions in Firestore.
 */
export const acceptTermsAndConditions = async (uid) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    termsAccepted: true,
    termsAcceptedAt: serverTimestamp()
  });
};

/**
 * Listen to regional geofencing settings in real-time.
 */
export const subscribeToBlockedRegions = (callback) => {
  const docRef = doc(db, 'system_settings', 'regions');
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data().blockedStates || []);
    } else {
      callback([]);
    }
  }, () => callback([]));
};

/**
 * Update blocked Indian states list in geofencing settings.
 */
export const updateBlockedRegions = async (blockedStates, adminInfo) => {
  const docRef = doc(db, 'system_settings', 'regions');
  await setDoc(docRef, {
    blockedStates,
    updatedAt: serverTimestamp()
  }, { merge: true });

  await addAuditLog({
    adminUid: adminInfo.uid,
    adminEmail: adminInfo.email,
    action: 'UPDATE_GEOFENCING',
    targetUid: 'system_settings/regions',
    targetName: 'Geofencing Settings',
    changes: {
      blockedStates: { old: null, new: blockedStates }
    }
  });
};

/**
 * Listen to regional geofencing blocked IPs in real-time.
 */
export const subscribeToBlockedIps = (callback) => {
  const docRef = doc(db, 'system_settings', 'regions');
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data().blockedIps || []);
    } else {
      callback([]);
    }
  }, () => callback([]));
};

/**
 * Update blocked IP list in geofencing settings.
 */
export const updateBlockedIps = async (blockedIps, adminInfo) => {
  const docRef = doc(db, 'system_settings', 'regions');
  await setDoc(docRef, {
    blockedIps,
    updatedAt: serverTimestamp()
  }, { merge: true });

  await addAuditLog({
    adminUid: adminInfo.uid,
    adminEmail: adminInfo.email,
    action: 'UPDATE_BLOCKED_IPS',
    targetUid: 'system_settings/regions',
    targetName: 'IP Blocklist Settings',
    changes: {
      blockedIps: { old: null, new: blockedIps }
    }
  });
};

/**
 * Listen to global maintenance mode settings in real-time.
 */
export const subscribeToMaintenanceMode = (callback) => {
  const docRef = doc(db, 'system_settings', 'maintenance');
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data());
    } else {
      callback({ maintenanceMode: false, maintenanceMessage: '' });
    }
  }, () => callback({ maintenanceMode: false, maintenanceMessage: '' }));
};

/**
 * Update global maintenance mode settings.
 */
export const updateMaintenanceMode = async (maintenanceMode, maintenanceMessage, adminInfo, allowAdminLogin = true) => {
  const docRef = doc(db, 'system_settings', 'maintenance');
  await setDoc(docRef, {
    maintenanceMode,
    maintenanceMessage: maintenanceMessage || '',
    allowAdminLogin: allowAdminLogin !== false,
    updatedAt: serverTimestamp()
  }, { merge: true });

  await addAuditLog({
    adminUid: adminInfo?.uid || 'system',
    adminEmail: adminInfo?.email || 'admin',
    action: 'UPDATE_MAINTENANCE_MODE',
    targetUid: 'system_settings/maintenance',
    targetName: 'Maintenance Settings',
    changes: {
      maintenanceMode: { old: null, new: maintenanceMode },
      maintenanceMessage: { old: null, new: maintenanceMessage },
      allowAdminLogin: { old: null, new: allowAdminLogin !== false }
    }
  });
};

/**
 * Assign a client to an admin operator.
 */
export const assignClientToAdmin = async (clientUid, adminUid, adminInfo) => {
  const userRef = doc(db, 'users', clientUid);
  await updateDoc(userRef, {
    assignedAdminId: adminUid || null
  });

  // Fetch admin name if assigned, otherwise write 'Unassigned'
  let adminName = 'Unassigned';
  if (adminUid) {
    const adminRef = doc(db, 'users', adminUid);
    const adminSnap = await getDoc(adminRef);
    if (adminSnap.exists()) {
      adminName = adminSnap.data().name || 'Admin';
    }
  }

  // Add audit log
  await addAuditLog({
    adminUid: adminInfo.uid,
    adminEmail: adminInfo.email,
    action: 'ASSIGN_CLIENT',
    targetUid: clientUid,
    targetName: adminName,
    changes: {
      assignedAdminId: { old: null, new: adminUid || 'None' }
    }
  });
};

/**
 * Upgrade user to superadmin.
 */
export const makeMeSuperadmin = async (uid) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    role: 'superadmin'
  });
};/**
 * Assign a Gmail credential to a specific administrator operator.
 */
export const assignGmailToAdmin = async (gmailCredId, adminUid) => {
  const credRef = doc(db, 'gmail_credentials', gmailCredId);
  await updateDoc(credRef, {
    assignedAdminId: adminUid || null
  });
};

/**
 * Assign a Zoho credential to a specific administrator operator.
 */
export const assignZohoToAdmin = async (zohoCredId, adminUid) => {
  const credRef = doc(db, 'zoho_credentials', zohoCredId);
  await updateDoc(credRef, {
    assignedAdminId: adminUid || null
  });
};

/**
 * Assign an IMAP credential to a specific administrator operator.
 */
export const assignImapToAdmin = async (imapCredId, adminUid) => {
  const credRef = doc(db, 'imap_credentials', imapCredId);
  await updateDoc(credRef, {
    assignedAdminId: adminUid || null
  });
};

/**
 * Toggle a client's suspension status.
 */
export const toggleClientSuspension = async (uid, clientName, currentStatus, adminInfo) => {
  const userRef = doc(db, 'users', uid);
  const subRef = doc(db, 'subscriptions', uid);
  const nextStatus = currentStatus === 'Suspended' ? 'Active' : 'Suspended';

  // Update user document
  await updateDoc(userRef, {
    status: nextStatus,
    suspensionReason: nextStatus === 'Suspended' ? 'Suspended by admin' : null,
    suspendedAt: nextStatus === 'Suspended' ? serverTimestamp() : null
  });

  // Update subscription document
  await updateDoc(subRef, {
    status: nextStatus,
    updatedAt: serverTimestamp()
  });

  // Add Log Entry in Audit Trail
  await addAuditLog({
    adminUid: adminInfo.uid,
    adminEmail: adminInfo.email,
    action: nextStatus === 'Suspended' ? 'SUSPEND_CLIENT' : 'UNSUSPEND_CLIENT',
    targetUid: uid,
    targetName: clientName,
    changes: {
      status: { old: currentStatus, new: nextStatus }
    }
  });
};

/**
 * Generate Telegram license keys in firestore.
 */
export const generateTelegramLicenseKeys = async (count, validityDays, price, assignedMailbox, mailboxType, adminInfo) => {
  const generatedKeys = [];
  const adminUid = adminInfo?.uid || '';
  const adminEmail = adminInfo?.email || '';
  const adminRole = adminInfo?.role || 'admin';
  const adminName = adminInfo?.name || adminEmail || 'Admin';

  for (let i = 0; i < count; i++) {
    const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
    const keyId = `TG-${randomPart}`;
    const docRef = doc(db, 'telegram_license_keys', keyId);
    
    await setDoc(docRef, {
      keyId,
      validityDays: Number(validityDays) || 2,
      price: Number(price) || 300,
      status: 'active',
      redeemedByChatId: '',
      redeemedAt: '',
      assignedMailbox: assignedMailbox || '',
      mailboxType: mailboxType || '',
      createdAt: Date.now(),
      createdByUid: adminUid,
      createdByEmail: adminEmail,
      createdByRole: adminRole,
      createdByName: adminName
    });
    
    generatedKeys.push(keyId);
  }

  await addAuditLog({
    adminUid: adminUid,
    adminEmail: adminEmail,
    action: 'GENERATE_TELEGRAM_KEYS',
    targetUid: 'telegram_license_keys',
    targetName: `Telegram Keys (${count} count)`,
    changes: {
      generatedKeys: { old: null, new: generatedKeys }
    }
  });
};

/**
 * Subscribe to all generated Telegram license keys in real-time.
 */
export const subscribeToTelegramLicenseKeys = (callback) => {
  const colRef = collection(db, 'telegram_license_keys');
  const q = query(colRef, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(d => d.data());
    callback(list);
  }, () => callback([]));
};

/**
 * Delete a specific Telegram license key.
 */
export const deleteTelegramLicenseKey = async (keyId, adminInfo) => {
  const docRef = doc(db, 'telegram_license_keys', keyId);
  await deleteDoc(docRef);

  await addAuditLog({
    adminUid: adminInfo.uid,
    adminEmail: adminInfo.email,
    action: 'DELETE_TELEGRAM_KEY',
    targetUid: keyId,
    targetName: `Telegram Key: ${keyId}`,
    changes: {
      deleted: { old: false, new: true }
    }
  });
};

/**
 * Subscribe to all active Telegram user sessions in real-time.
 */
export const subscribeToTelegramUserSessions = (callback) => {
  const colRef = collection(db, 'telegram_user_sessions');
  return onSnapshot(colRef, (snapshot) => {
    const list = snapshot.docs.map(d => d.data());
    callback(list);
  }, () => callback([]));
};

/**
 * Delete / Kick a Telegram user session.
 */
export const deleteTelegramUserSession = async (chatId, adminInfo) => {
  const docRef = doc(db, 'telegram_user_sessions', String(chatId));
  await deleteDoc(docRef);

  await addAuditLog({
    adminUid: adminInfo.uid,
    adminEmail: adminInfo.email,
    action: 'DELETE_TELEGRAM_USER_SESSION',
    targetUid: String(chatId),
    targetName: `Telegram User: ${chatId}`,
    changes: {
      deleted: { old: false, new: true }
    }
  });
};

/**
 * Extend a Telegram user session by a number of days.
 */
export const extendTelegramUserSession = async (chatId, extensionDays, adminInfo) => {
  const docRef = doc(db, 'telegram_user_sessions', String(chatId));
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    const data = docSnap.data();
    const currentExpiry = data.licenseExpiry || Date.now();
    const newExpiry = currentExpiry + (Number(extensionDays) * 24 * 60 * 60 * 1000);
    
    await updateDoc(docRef, {
      licenseExpiry: newExpiry
    });

    await addAuditLog({
      adminUid: adminInfo.uid,
      adminEmail: adminInfo.email,
      action: 'EXTEND_TELEGRAM_USER_SESSION',
      targetUid: String(chatId),
      targetName: `Telegram User: ${chatId}`,
      changes: {
        licenseExpiry: { old: currentExpiry, new: newExpiry }
      }
    });
  }
};

/**
 * Subscribe to Telegram Bot global settings (Enable/Disable, maintenance notice).
 */
export const subscribeToTelegramBotSettings = (callback) => {
  const docRef = doc(db, 'system_settings', 'telegram_bot');
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ exists: true, ...docSnap.data() });
    } else {
      callback({ exists: false, is_enabled: true, maintenance_message: '' });
    }
  }, (err) => {
    console.error("Error subscribing to telegram bot settings:", err);
  });
};

/**
 * Update Telegram Bot settings (Enable/Disable, maintenance notice).
 */
export const updateTelegramBotSettings = async (settings, adminInfo) => {
  const docRef = doc(db, 'system_settings', 'telegram_bot');
  const snap = await getDoc(docRef);
  const oldData = snap.exists() ? snap.data() : { is_enabled: true };

  await setDoc(docRef, {
    ...settings,
    updated_at: Date.now(),
    updated_by: adminInfo?.email || 'admin'
  }, { merge: true });

  await addAuditLog({
    adminUid: adminInfo?.uid || 'admin',
    adminEmail: adminInfo?.email || 'admin',
    action: settings.is_enabled === false ? 'DISABLE_TELEGRAM_BOT' : 'ENABLE_TELEGRAM_BOT',
    targetUid: 'system_settings/telegram_bot',
    targetName: `Telegram Bot: ${settings.is_enabled === false ? 'Disabled' : 'Enabled'}`,
    changes: {
      is_enabled: { old: oldData.is_enabled ?? true, new: settings.is_enabled }
    }
  });
};


// ============================================================
// DPDP ACT 2023 COMPLIANCE FUNCTIONS
// Digital Personal Data Protection Act, 2023
// Information Technology Act, 2000
// Consumer Protection (E-Commerce) Rules, 2020
// ============================================================

/**
 * Record DPDP consent in the user's Firestore document.
 * Stores: consent flag, ISO timestamp, consent version, IP (if available), user agent.
 * Compliant with: DPDP Act 2023 Section 6 (Consent), Section 5 (Notice)
 */
export const saveDpdpConsent = async (uid, additionalMeta = {}) => {
  const userRef = doc(db, 'users', uid);
  const now = new Date();
  
  const consentRecord = {
    dpdpConsentGiven: true,
    dpdpConsentTimestamp: now.toISOString(),
    dpdpConsentVersion: 'v1.0-sept2026',
    dpdpConsentMethod: additionalMeta.method || 'cookie_banner',
    dpdpConsentUserAgent: additionalMeta.userAgent || navigator.userAgent || 'Unknown',
    dpdpConsentIP: additionalMeta.ip || 'not_collected',
    dpdpActReference: 'Digital Personal Data Protection Act, 2023 — Section 6',
    itActReference: 'Information Technology Act, 2000 — Section 43A',
    lastConsentUpdate: serverTimestamp()
  };

  await updateDoc(userRef, consentRecord);

  // Also write to a dedicated consent_logs collection for audit trail
  try {
    const consentLogRef = collection(db, 'dpdp_consent_logs');
    await addDoc(consentLogRef, {
      uid,
      ...consentRecord,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.warn("DPDP consent log write note:", err);
  }
};

/**
 * Record DPDP consent withdrawal in Firestore.
 * Compliant with: DPDP Act 2023 Section 6(6) — Right to withdraw consent
 */
export const withdrawDpdpConsentRecord = async (uid) => {
  const userRef = doc(db, 'users', uid);
  const now = new Date();

  await updateDoc(userRef, {
    dpdpConsentGiven: false,
    dpdpConsentWithdrawnAt: now.toISOString(),
    dpdpConsentWithdrawalMethod: 'user_profile_action',
    lastConsentUpdate: serverTimestamp()
  });

  // Log withdrawal for audit
  try {
    const consentLogRef = collection(db, 'dpdp_consent_logs');
    await addDoc(consentLogRef, {
      uid,
      action: 'CONSENT_WITHDRAWN',
      timestamp: now.toISOString(),
      method: 'user_profile_action',
      actReference: 'DPDP Act 2023 — Section 6(6)',
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.warn("DPDP consent withdrawal log note:", err);
  }
};

/**
 * Submit a Data Deletion Request (Right to Erasure).
 * Creates a record in `data_deletion_requests` collection for admin processing.
 * Compliant with: DPDP Act 2023 Section 12 — Right of Data Principal
 * Timeline: Must be processed within 7-14 business days per DPDP guidelines.
 */
export const requestDataDeletion = async (uid, userEmail, userName, reason = '') => {
  const now = new Date();
  
  const deletionRequest = {
    uid,
    email: userEmail,
    name: userName,
    reason: reason || 'User requested data deletion under DPDP Act 2023',
    status: 'pending',
    requestedAt: now.toISOString(),
    requestTimestamp: serverTimestamp(),
    expectedCompletionDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    actReference: 'Digital Personal Data Protection Act, 2023 — Section 12(1)',
    itActReference: 'Information Technology (Reasonable Security Practices) Rules, 2011',
    processingNotes: '',
    processedAt: null,
    processedBy: null
  };

  // Write to dedicated collection
  const requestRef = collection(db, 'data_deletion_requests');
  const docRef = await addDoc(requestRef, deletionRequest);

  // Also mark the user profile with pending deletion flag
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      dataDeletionRequested: true,
      dataDeletionRequestId: docRef.id,
      dataDeletionRequestedAt: now.toISOString()
    });
  } catch (err) {
    console.warn("User profile deletion flag note:", err);
  }

  // Log in audit trail
  try {
    await addAuditLog({
      adminUid: uid,
      adminEmail: userEmail,
      action: 'DATA_DELETION_REQUESTED',
      targetUid: uid,
      targetName: userName,
      changes: {
        dataDeletionRequested: { old: false, new: true },
        actReference: 'DPDP Act 2023 Section 12'
      }
    });
  } catch (err) {
    console.warn("Deletion request audit log note:", err);
  }

  return docRef.id;
};

// ==========================================
// WEBSITE ANALYTICS & VISITOR TELEMETRY API
// ==========================================

/**
 * Record a pageview in Firestore with daily rollup aggregation.
 */
export const recordPageViewInFirestore = async (pageData) => {
  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const hour = now.getHours();

    // 1. Add record into analytics_pageviews
    const pageviewsCol = collection(db, 'analytics_pageviews');
    await addDoc(pageviewsCol, {
      ...pageData,
      createdAt: serverTimestamp(),
      dateStr: todayStr,
      hour
    });

    // 2. Update/create daily summary rollup in analytics_daily_summary
    const summaryRef = doc(db, 'analytics_daily_summary', todayStr);
    const summarySnap = await getDoc(summaryRef);
    
    const pathKey = (pageData.path || '/').replace(/[./#$[\]]/g, '_');
    const deviceKey = pageData.device || 'Desktop';
    const browserKey = pageData.browser || 'Other';
    const osKey = pageData.os || 'Other';
    const referrerKey = (pageData.referrer || 'Direct').replace(/[./#$[\]]/g, '_');

    if (summarySnap.exists()) {
      const data = summarySnap.data();
      const currentHourly = data.hourlyViews || new Array(24).fill(0);
      currentHourly[hour] = (currentHourly[hour] || 0) + 1;

      const pageMap = data.pageBreakdown || {};
      pageMap[pathKey] = (pageMap[pathKey] || 0) + 1;

      const deviceMap = data.deviceBreakdown || {};
      deviceMap[deviceKey] = (deviceMap[deviceKey] || 0) + 1;

      const browserMap = data.browserBreakdown || {};
      browserMap[browserKey] = (browserMap[browserKey] || 0) + 1;

      const osMap = data.osBreakdown || {};
      osMap[osKey] = (osMap[osKey] || 0) + 1;

      const refMap = data.referrerBreakdown || {};
      refMap[referrerKey] = (refMap[referrerKey] || 0) + 1;

      const uniqueVisitors = new Set(data.uniqueVisitorsList || []);
      if (pageData.visitorId) uniqueVisitors.add(pageData.visitorId);

      await updateDoc(summaryRef, {
        totalViews: (data.totalViews || 0) + 1,
        uniqueCount: uniqueVisitors.size,
        uniqueVisitorsList: Array.from(uniqueVisitors).slice(-2000),
        hourlyViews: currentHourly,
        pageBreakdown: pageMap,
        deviceBreakdown: deviceMap,
        browserBreakdown: browserMap,
        osBreakdown: osMap,
        referrerBreakdown: refMap,
        lastUpdated: serverTimestamp()
      });
    } else {
      const initialHourly = new Array(24).fill(0);
      initialHourly[hour] = 1;

      await setDoc(summaryRef, {
        date: todayStr,
        totalViews: 1,
        uniqueCount: 1,
        uniqueVisitorsList: pageData.visitorId ? [pageData.visitorId] : [],
        hourlyViews: initialHourly,
        pageBreakdown: { [pathKey]: 1 },
        deviceBreakdown: { [deviceKey]: 1 },
        browserBreakdown: { [browserKey]: 1 },
        osBreakdown: { [osKey]: 1 },
        referrerBreakdown: { [referrerKey]: 1 },
        lastUpdated: serverTimestamp()
      });
    }
  } catch (err) {
    console.warn("Firestore recordPageView error:", err?.message);
  }
};

/**
 * Record a custom conversion or interaction event.
 */
export const recordEventInFirestore = async (eventData) => {
  try {
    const eventsCol = collection(db, 'analytics_events');
    await addDoc(eventsCol, {
      ...eventData,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.warn("Firestore recordEvent error:", err?.message);
  }
};

/**
 * Record a live visitor heartbeat in analytics_live_sessions.
 */
export const recordLiveHeartbeatInFirestore = async (sessionData) => {
  try {
    if (!sessionData.sessionId) return;
    const sessionRef = doc(db, 'analytics_live_sessions', sessionData.sessionId);
    await setDoc(sessionRef, {
      ...sessionData,
      lastPing: Date.now(),
      lastUpdated: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.warn("Firestore live heartbeat error:", err?.message);
  }
};

/**
 * Real-time listener for currently active live visitors.
 */
export const subscribeToLiveVisitors = (callback) => {
  const sessionsCol = collection(db, 'analytics_live_sessions');
  return onSnapshot(sessionsCol, (snapshot) => {
    const activeCutoff = Date.now() - 3 * 60 * 1000; // Active within last 3 minutes
    const liveList = [];
    snapshot.forEach((d) => {
      const data = d.data();
      if (data.lastPing && data.lastPing >= activeCutoff) {
        liveList.push({ id: d.id, ...data });
      }
    });
    callback(liveList);
  }, (err) => {
    console.warn("Live visitors subscription error:", err?.message);
    callback([]);
  });
};

/**
 * Fetch and aggregate comprehensive website analytics for specified timeframe.
 */
export const getWebsiteAnalyticsData = async (timeRange = '30d') => {
  try {
    // 1. Fetch recent raw pageviews (up to 150 records for live feed & recent inspection)
    const pageviewsCol = collection(db, 'analytics_pageviews');
    const recentPvQuery = query(pageviewsCol, orderBy('createdAt', 'desc'), limit(150));
    
    let rawPageviews = [];
    try {
      const pvSnap = await getDocs(recentPvQuery);
      pvSnap.forEach(d => {
        rawPageviews.push({ id: d.id, ...d.data() });
      });
    } catch (e) {
      console.warn("Error fetching recent pageviews:", e?.message);
    }

    // 2. Fetch daily summaries
    const summariesCol = collection(db, 'analytics_daily_summary');
    const summarySnap = await getDocs(summariesCol);
    const dailySummaries = [];
    summarySnap.forEach(d => {
      dailySummaries.push({ id: d.id, ...d.data() });
    });

    // 3. Fetch custom events
    const eventsCol = collection(db, 'analytics_events');
    const eventsQuery = query(eventsCol, orderBy('createdAt', 'desc'), limit(100));
    const rawEvents = [];
    try {
      const eventsSnap = await getDocs(eventsQuery);
      eventsSnap.forEach(d => {
        rawEvents.push({ id: d.id, ...d.data() });
      });
    } catch (e) {
      console.warn("Error fetching analytics events:", e?.message);
    }

    // If no data exists yet, return empty structure or trigger baseline seed
    return {
      rawPageviews,
      dailySummaries,
      rawEvents
    };
  } catch (err) {
    console.error("Failed to load website analytics data:", err);
    return { rawPageviews: [], dailySummaries: [], rawEvents: [] };
  }
};

/**
 * Seed high-fidelity, realistic baseline historical website analytics data.
 * Useful for establishing rich analytics charts immediately.
 */
export const seedSampleAnalyticsData = async () => {
  const batch = writeBatch(db);
  const now = new Date();
  
  const pages = [
    { path: '/store', title: 'FF Store & Marketplace', weight: 0.42 },
    { path: '/', title: 'Home Storefront', weight: 0.22 },
    { path: '/ff-store-upload', title: 'Upload FF Account', weight: 0.12 },
    { path: '/pricing', title: 'License & Pricing Plans', weight: 0.08 },
    { path: '/login', title: 'Login & Staff Portal', weight: 0.06 },
    { path: '/terms-and-conditions', title: 'Terms & Conditions', weight: 0.04 },
    { path: '/privacy-policy', title: 'DPDP Privacy Policy', weight: 0.03 },
    { path: '/contact-us', title: 'Contact Support Team', weight: 0.03 }
  ];

  const referrers = [
    { name: 'Direct', weight: 0.35 },
    { name: 'Telegram', weight: 0.30 },
    { name: 'Google Search', weight: 0.15 },
    { name: 'YouTube', weight: 0.10 },
    { name: 'Instagram', weight: 0.06 },
    { name: 'WhatsApp', weight: 0.04 }
  ];

  const devices = [
    { name: 'Mobile', weight: 0.68 },
    { name: 'Desktop', weight: 0.28 },
    { name: 'Tablet', weight: 0.04 }
  ];

  const browsers = [
    { name: 'Chrome', weight: 0.62 },
    { name: 'Safari', weight: 0.18 },
    { name: 'Edge', weight: 0.08 },
    { name: 'Firefox', weight: 0.05 },
    { name: 'Samsung Internet', weight: 0.05 },
    { name: 'Opera', weight: 0.02 }
  ];

  const oss = [
    { name: 'Android', weight: 0.60 },
    { name: 'Windows', weight: 0.24 },
    { name: 'iOS', weight: 0.12 },
    { name: 'macOS', weight: 0.03 },
    { name: 'Linux', weight: 0.01 }
  ];

  const states = [
    'Maharashtra', 'Uttar Pradesh', 'Delhi', 'West Bengal', 'Bihar', 
    'Gujarat', 'Rajasthan', 'Karnataka', 'Madhya Pradesh', 'Tamil Nadu'
  ];

  // Helper to pick weighted item
  const pickWeighted = (items) => {
    let r = Math.random();
    let sum = 0;
    for (const item of items) {
      sum += item.weight;
      if (r <= sum) return item.name || item.path;
    }
    return items[0].name || items[0].path;
  };

  // Generate for past 30 days
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    
    // Daily views range from 120 to 380 with upward growth trend
    const baseViews = 140 + Math.floor((30 - i) * 5.5) + Math.floor(Math.random() * 80);
    const uniqueCount = Math.floor(baseViews * (0.65 + Math.random() * 0.15));

    const hourlyViews = new Array(24).fill(0);
    for (let h = 0; h < 24; h++) {
      // Natural traffic curve (peak in evening 14:00 - 23:00)
      const hourMultiplier = (h >= 14 && h <= 23) ? 1.8 : (h >= 8 && h < 14) ? 1.0 : 0.3;
      hourlyViews[h] = Math.max(1, Math.floor((baseViews / 24) * hourMultiplier * (0.8 + Math.random() * 0.4)));
    }

    const pageBreakdown = {};
    pages.forEach(p => {
      const key = p.path.replace(/[./#$[\]]/g, '_');
      pageBreakdown[key] = Math.floor(baseViews * p.weight * (0.9 + Math.random() * 0.2));
    });

    const deviceBreakdown = {};
    devices.forEach(dev => {
      deviceBreakdown[dev.name] = Math.floor(baseViews * dev.weight);
    });

    const browserBreakdown = {};
    browsers.forEach(b => {
      browserBreakdown[b.name] = Math.floor(baseViews * b.weight);
    });

    const osBreakdown = {};
    oss.forEach(o => {
      osBreakdown[o.name] = Math.floor(baseViews * o.weight);
    });

    const referrerBreakdown = {};
    referrers.forEach(r => {
      const key = r.name.replace(/[./#$[\]]/g, '_');
      referrerBreakdown[key] = Math.floor(baseViews * r.weight);
    });

    const summaryRef = doc(db, 'analytics_daily_summary', dateStr);
    batch.set(summaryRef, {
      date: dateStr,
      totalViews: baseViews,
      uniqueCount,
      hourlyViews,
      pageBreakdown,
      deviceBreakdown,
      browserBreakdown,
      osBreakdown,
      referrerBreakdown,
      lastUpdated: serverTimestamp()
    });
  }

  // Generate 25 recent live feed pageviews
  for (let j = 0; j < 25; j++) {
    const pvRef = doc(collection(db, 'analytics_pageviews'));
    const pageObj = pages[Math.floor(Math.random() * pages.length)];
    const chosenDevice = pickWeighted(devices);
    const chosenBrowser = pickWeighted(browsers);
    const chosenOS = pickWeighted(oss);
    const chosenRef = pickWeighted(referrers);
    const chosenState = states[Math.floor(Math.random() * states.length)];
    const pvTime = new Date(now.getTime() - j * (3 + Math.floor(Math.random() * 7)) * 60 * 1000);

    batch.set(pvRef, {
      path: pageObj.path,
      title: pageObj.title,
      visitorId: 'vid_sim_' + Math.random().toString(36).substring(2, 9),
      sessionId: 'sid_sim_' + Math.random().toString(36).substring(2, 9),
      device: chosenDevice,
      browser: chosenBrowser,
      os: chosenOS,
      referrer: chosenRef,
      country: 'India',
      region: chosenState,
      screen: chosenDevice === 'Mobile' ? '390x844' : '1920x1080',
      language: 'en-US',
      timezone: 'Asia/Kolkata',
      createdAt: pvTime,
      timestamp: pvTime.toISOString()
    });
  }

  // Generate 4 active live sessions
  for (let k = 0; k < 4; k++) {
    const liveRef = doc(db, 'analytics_live_sessions', `live_session_${k + 1}`);
    const pageObj = pages[k % pages.length];
    batch.set(liveRef, {
      visitorId: `vid_active_${k + 1}`,
      sessionId: `live_session_${k + 1}`,
      currentPath: pageObj.path,
      device: k % 2 === 0 ? 'Mobile' : 'Desktop',
      browser: k % 2 === 0 ? 'Chrome' : 'Safari',
      os: k % 2 === 0 ? 'Android' : 'Windows',
      country: 'India',
      region: states[k % states.length],
      lastPing: Date.now() - k * 30000,
      lastUpdated: serverTimestamp()
    });
  }

  await batch.commit();
};

/**
 * Super Admin tool to clear / purge all analytics collections.
 */
export const clearWebsiteAnalyticsData = async (adminInfo) => {
  // Purge daily summaries
  const dailySnap = await getDocs(collection(db, 'analytics_daily_summary'));
  const batch1 = writeBatch(db);
  dailySnap.forEach(d => batch1.delete(d.ref));
  await batch1.commit();

  // Purge raw pageviews
  const pvSnap = await getDocs(collection(db, 'analytics_pageviews'));
  const batch2 = writeBatch(db);
  pvSnap.forEach(d => batch2.delete(d.ref));
  await batch2.commit();

  // Purge live sessions
  const liveSnap = await getDocs(collection(db, 'analytics_live_sessions'));
  const batch3 = writeBatch(db);
  liveSnap.forEach(d => batch3.delete(d.ref));
  await batch3.commit();

  // Log in audit logs
  await addAuditLog({
    adminUid: adminInfo.uid,
    adminEmail: adminInfo.email,
    action: 'PURGE_ANALYTICS_DATA',
    targetUid: 'system',
    targetName: 'Website Analytics Database',
    changes: {
      recordsPurged: { old: 'populated', new: 'cleared' }
    }
  });
};

