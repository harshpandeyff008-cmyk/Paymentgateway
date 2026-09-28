import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { logoutUser } from '../firebase/auth';
import { subscribeToClientData } from '../firebase/firestore';
import { useToast } from './ToastContext';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [clientData, setClientData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const [impersonatedUser, setImpersonatedUser] = useState(null);
  const [impersonatedClientData, setImpersonatedClientData] = useState(null);

  const impersonateClient = async (uid) => {
    if (!currentUser) {
      showToast("Unauthorized: You must be logged in to impersonate.", "error");
      return false;
    }
    try {
      const realUserRef = doc(db, 'users', currentUser.uid);
      const realUserSnap = await getDoc(realUserRef);
      if (!realUserSnap.exists()) {
        showToast("Access Denied: Real profile not found.", "error");
        return false;
      }
      const realUserData = realUserSnap.data();
      if (realUserData.role !== 'superadmin') {
        showToast("Security Breach: Only SuperAdmin can login as client.", "error");
        return false;
      }

      const targetUserRef = doc(db, 'users', uid);
      const targetUserSnap = await getDoc(targetUserRef);
      if (!targetUserSnap.exists()) {
        showToast("Error: Target client profile not found.", "error");
        return false;
      }
      
      const targetData = targetUserSnap.data();
      if (targetData.role !== 'client') {
        showToast("Error: Can only impersonate clients.", "error");
        return false;
      }

      const subRef = doc(db, 'subscriptions', uid);
      const subSnap = await getDoc(subRef);
      const subData = subSnap.exists() ? subSnap.data() : {};

      const combinedData = {
        ...targetData,
        ...subData,
        purchaseDate: subData.purchaseDate?.toDate?.() || subData.purchaseDate,
        expiryDate: subData.expiryDate?.toDate?.() || subData.expiryDate,
        bindingStartDate: targetData.bindingStartDate?.toDate?.() || targetData.bindingStartDate || null,
        updatedAt: subData.updatedAt?.toDate?.() || subData.updatedAt
      };

      setImpersonatedUser({
        uid: uid,
        email: targetData.email,
        displayName: targetData.name
      });
      setImpersonatedClientData(combinedData);
      showToast(`Viewing dashboard as ${targetData.name}`, "success");
      return true;
    } catch (err) {
      console.error("Failed to impersonate:", err);
      showToast("Error loading client dashboard data.", "error");
      return false;
    }
  };

  const stopImpersonating = () => {
    setImpersonatedUser(null);
    setImpersonatedClientData(null);
    showToast("Exited client impersonation mode.", "success");
  };

  const [blockInfo, setBlockInfo] = useState(() => {
    try {
      const stored = localStorage.getItem('block_info');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const updateBlockInfo = (info) => {
    setBlockInfo(info);
    if (info) {
      localStorage.setItem('block_info', JSON.stringify(info));
    } else {
      localStorage.removeItem('block_info');
    }
  };

  useEffect(() => {
    let unsubscribeClient = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      // Clear any existing active client real-time listeners
      if (unsubscribeClient) {
        unsubscribeClient();
        unsubscribeClient = null;
      }

      if (user) {
        try {
          const uDocRef = doc(db, 'users', user.uid);
          let uDocSnap = await getDoc(uDocRef);
          let userData = null;

          if (!uDocSnap.exists()) {
            const isGoogleAuth = user.providerData?.some(p => p.providerId === 'google.com' || p.providerId === 'google');
            if (isGoogleAuth) {
              // Check if an existing profile (e.g. Admin or Client) exists with the same email
              let inheritedRole = 'user';
              let inheritedData = {};

              try {
                const emailQuery = query(collection(db, 'users'), where('email', '==', (user.email || '').toLowerCase()));
                const emailSnap = await getDocs(emailQuery);
                if (!emailSnap.empty) {
                  const match = emailSnap.docs[0].data();
                  if (match.role) inheritedRole = match.role;
                  inheritedData = match;
                }
              } catch (e) {
                console.warn("Role match check note:", e);
              }

              // Auto-initialize Google profile preserving existing role if any
              const newProfile = {
                ...inheritedData,
                name: user.displayName || inheritedData.name || 'Free Fire Gamer',
                email: (user.email || '').toLowerCase(),
                photoURL: user.photoURL || inheritedData.photoURL || '',
                role: inheritedRole,
                phone: inheritedData.phone || '',
                instagram: inheritedData.instagram || '',
                isBlocked: inheritedData.isBlocked || false,
                status: inheritedData.status || 'active',
                createdAt: inheritedData.createdAt || serverTimestamp(),
                lastLogin: serverTimestamp(),
                authProvider: 'google'
              };
              try {
                await setDoc(uDocRef, newProfile, { merge: true });
                userData = newProfile;
              } catch (writeErr) {
                console.warn("Could not write initial google profile:", writeErr);
                userData = newProfile;
              }
            } else {
              // Auth user exists but no Firestore profile (e.g. deleted client or console signups)
              await logoutUser();
              setCurrentUser(null);
              setUserDoc(null);
              setClientData(null);
              showToast("User profile not found. Access denied.", "error");
              setLoading(false);
              return;
            }
          } else {
            userData = uDocSnap.data();
          }

          if (userData.status === 'Removed' || userData.status === 'Suspended' || userData.isBlocked === true) {
            const actionDate = userData.removedAt?.toDate?.()?.toISOString() || 
                               userData.suspendedAt?.toDate?.()?.toISOString() || 
                               userData.removedAt || 
                               userData.suspendedAt || 
                               new Date().toISOString();
            const info = {
              reason: userData.removalReason || userData.suspensionReason || "Suspicious activity detected",
              message: userData.removalMessage || userData.suspensionMessage || "",
              actionType: userData.status || 'Suspended',
              date: actionDate
            };
            updateBlockInfo(info);

            await logoutUser();
            setCurrentUser(null);
            setUserDoc(null);
            setClientData(null);
            showToast(`Access Denied: Account is ${userData.status || 'Blocked'}.`, "error");
            setLoading(false);
            return;
          }

          const role = (userData.role || '').toLowerCase().trim();
          if (role === 'admin' || role === 'superadmin' || role === 'employee' || role === 'staff') {
            updateBlockInfo(null); // Clear block message on successful sign in
            setCurrentUser(user);
            setUserDoc(userData); // Immediately populate userDoc to eliminate race conditions
            
            // Set up real-time listener for the user's own profile doc updates
            unsubscribeClient = onSnapshot(uDocRef, (snap) => {
              if (snap.exists()) {
                setUserDoc(snap.data());
              }
            });

            setClientData(null);
            setLoading(false);
          } else if (role === 'client') {
            // Subscribe to client profile + subscription updates in real-time
            unsubscribeClient = subscribeToClientData(user.uid, (fullData) => {
              if (!fullData) {
                // Document deleted
                logoutUser();
                setCurrentUser(null);
                setUserDoc(null);
                setClientData(null);
                showToast("Your client record has been deleted by an administrator.", "error");
                setLoading(false);
                return;
              }

              if (fullData.status === 'Suspended' || fullData.status === 'Removed' || fullData.isBlocked === true) {
                const actionDate = fullData.removedAt?.toDate?.()?.toISOString() || 
                                   fullData.suspendedAt?.toDate?.()?.toISOString() || 
                                   fullData.removedAt || 
                                   fullData.suspendedAt || 
                                   new Date().toISOString();
                const info = {
                  reason: fullData.removalReason || fullData.suspensionReason || "Suspicious activity detected",
                  message: fullData.removalMessage || fullData.suspensionMessage || "",
                  actionType: fullData.status || 'Suspended',
                  date: actionDate
                };
                updateBlockInfo(info);

                logoutUser();
                setCurrentUser(null);
                setUserDoc(null);
                setClientData(null);
                showToast(`Your account has been ${fullData.status?.toLowerCase() || 'blocked'}.`, "error");
                setLoading(false);
                return;
              }

              updateBlockInfo(null); // Clear block message on successful data load
              setCurrentUser(user);
              setUserDoc(fullData);
              setClientData(fullData);
              setLoading(false);
            });
          } else {
            // Standard Gamer / User Role (from Google Login or public signup)
            updateBlockInfo(null);
            setCurrentUser(user);
            setUserDoc(userData);

            // Real-time listener for user profile doc updates (e.g. upgraded to client, etc.)
            unsubscribeClient = onSnapshot(uDocRef, (snap) => {
              if (snap.exists()) {
                setUserDoc(snap.data());
              }
            });

            setClientData(null);
            setLoading(false);
          }
        } catch (error) {
          console.error("Auth state synchronization error:", error);
          await logoutUser();
          setCurrentUser(null);
          setUserDoc(null);
          setClientData(null);
          showToast("Session verification failed.", "error");
          setLoading(false);
        }
      } else {
        // Sign-out action
        setCurrentUser(null);
        setUserDoc(null);
        setClientData(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeClient) unsubscribeClient();
    };
  }, [showToast]);

  return (
    <AuthContext.Provider
      value={{
        currentUser: impersonatedUser ? { uid: impersonatedUser.uid, email: impersonatedUser.email, displayName: impersonatedUser.displayName } : currentUser,
        userDoc: impersonatedUser ? impersonatedClientData : userDoc,
        clientData: impersonatedUser ? impersonatedClientData : clientData,
        realUser: currentUser,
        realUserDoc: userDoc,
        isImpersonating: !!impersonatedUser,
        impersonateClient,
        stopImpersonating,
        loading,
        blockInfo,
        setBlockInfo: updateBlockInfo,
        logout: logoutUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
