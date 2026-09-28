import { 
  signInWithEmailAndPassword, 
  signOut, 
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as secondarySignOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db, firebaseConfig } from './config';

/**
 * Log in / Sign up with Google.
 * Creates standard role 'user' if not existing.
 */
export const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  // Check if record exists in Firestore
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
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

    // Create profile preserving existing role if any
    await setDoc(userRef, {
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
    }, { merge: true });
  } else {
    // Update lastLogin without touching existing role (Admin/Client/Employee)
    await setDoc(userRef, {
      lastLogin: serverTimestamp()
    }, { merge: true });
  }

  return user;
};

/**
 * Log in a user with email and password.
 */
export const loginUser = async (email, password) => {
  return await signInWithEmailAndPassword(auth, email, password);
};

/**
 * Log out the currently authenticated user.
 */
export const logoutUser = async () => {
  return await signOut(auth);
};

/**
 * Update the logged-in user's password.
 * Performs critical re-authentication step.
 */
export const updateCurrentUserPassword = async (currentPassword, newPassword) => {
  const user = auth.currentUser;
  if (!user) throw new Error("No user is logged in.");
  
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
};

/**
 * Creates a client authentication account without signing out the active Admin.
 * Instantiates a temporary secondary Firebase app instance in memory.
 */
export const createSecondaryAuthUser = async (email, password) => {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPassword = (password || '').trim();

  if (!cleanEmail) {
    throw new Error("Email address is required.");
  }
  if (cleanPassword.length < 6) {
    throw new Error("Password must be at least 6 characters long (Firebase requirement).");
  }

  const secondaryAppName = `SecondaryApp-${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);
  
  try {
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, cleanPassword);
    // Explicitly sign out from the secondary auth instance immediately
    await secondarySignOut(secondaryAuth);
    return userCredential.user;
  } catch (authErr) {
    // If the account was previously created in Firebase Auth, recover gracefully
    if (authErr.code === 'auth/email-already-in-use') {
      try {
        const existingCred = await signInWithEmailAndPassword(secondaryAuth, cleanEmail, cleanPassword);
        await secondarySignOut(secondaryAuth);
        return existingCred.user;
      } catch {
        throw new Error(`Email "${cleanEmail}" is already registered in Firebase Authentication. Please use a different email or delete this user from Firebase Console -> Authentication.`);
      }
    } else if (authErr.code === 'auth/weak-password') {
      throw new Error("Password is too weak. Please use at least 6 characters.");
    } else if (authErr.code === 'auth/invalid-email') {
      throw new Error(`Invalid email address format: "${cleanEmail}".`);
    }
    throw authErr;
  } finally {
    // Delete the secondary app instance to release resources
    try {
      await deleteApp(secondaryApp);
    } catch (cleanErr) {
      console.warn("Could not delete secondary app instance:", cleanErr);
    }
  }
};
