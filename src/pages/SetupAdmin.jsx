import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useToast } from '../context/ToastContext';
import { Loader, UserPlus } from 'lucide-react';

/**
 * Temporary initialization route to set up the first administrator.
 * Automatically locks down if an admin already exists in the database.
 */
export default function SetupAdmin() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [adminExists, setAdminExists] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const docRef = doc(db, 'system', 'status');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().initialized === true) {
          setAdminExists(true);
        }
      } catch (err) {
        console.error("Error checking for existing admin:", err);
      } finally {
        setChecking(false);
      }
    };
    checkAdmin();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (adminExists) {
      showToast("Setup route disabled. An admin already exists.", "error");
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create Admin Profile in Firestore users
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        role: 'admin',
        name,
        email,
        mobile: '',
        createdAt: serverTimestamp()
      });

      // Write system initialization status to block setup route from being reused
      await setDoc(doc(db, 'system', 'status'), {
        initialized: true,
        createdAt: serverTimestamp()
      });

      showToast("Administrator portal initialized successfully!", "success");
      navigate('/login');
    } catch (err) {
      console.error(err);
      showToast(err.message || "Setup failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
        <Loader className="w-8 h-8 text-indigo-650 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl shadow-xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-indigo-50 dark:bg-indigo-950 rounded-2xl text-indigo-600 dark:text-indigo-400">
            <UserPlus className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Initialize Admin Portal</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create the master administrator account to manage subscriptions.
          </p>
        </div>

        {adminExists ? (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-955/30 text-amber-800 dark:text-amber-400 text-sm border border-amber-200 dark:border-amber-900/40 text-center font-medium">
            Setup is locked. An administrator account is already active. Please proceed to the login.
            <button
              onClick={() => navigate('/login')}
              className="mt-4 w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all text-xs shadow-md shadow-indigo-600/10"
            >
              Proceed to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-550 dark:text-gray-450 mb-1.5 uppercase">
                Admin Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="John Doe"
                className="w-full px-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white transition-all font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-550 dark:text-gray-450 mb-1.5 uppercase">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@domain.com"
                className="w-full px-4 py-2.5 text-sm bg-gray-55 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white transition-all font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-555 dark:text-gray-450 mb-1.5 uppercase">
                Admin Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Min. 6 characters"
                className="w-full px-4 py-2.5 text-sm bg-gray-55 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white transition-all font-semibold"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl shadow-lg shadow-indigo-650/20 hover:shadow-xl transition-all flex items-center justify-center gap-2 text-sm"
            >
              {loading && <Loader className="w-4 h-4 animate-spin" />}
              <span>Register Master Admin</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
