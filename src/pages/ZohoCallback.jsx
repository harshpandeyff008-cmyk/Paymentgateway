import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Loader, AlertTriangle, CheckCircle } from 'lucide-react';

export default function ZohoCallback() {
  const [searchParams] = useSearchParams();
  const { currentUser, userDoc, loading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState('processing'); // 'processing' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  
  const exchangeAttempted = useRef(false);

  // 1. Handle automatic redirects after success or error state updates
  useEffect(() => {
    if (status === 'success') {
      const t = setTimeout(() => navigate('/profile'), 3000);
      return () => clearTimeout(t);
    }
    if (status === 'error') {
      const t = setTimeout(() => navigate('/profile'), 4000);
      return () => clearTimeout(t);
    }
  }, [status, navigate]);

  // 2. Perform the token exchange flow exactly once
  useEffect(() => {
    let isMounted = true;
    let authTimer = null;

    if (loading) return;
    if (status !== 'processing') return;

    const code = searchParams.get('code');
    
    if (!code) {
      if (isMounted) {
        setStatus('error');
        setErrorMessage('Authorization code not found from Zoho. Redirecting to profile...');
      }
      return;
    }

    if (!currentUser) {
      authTimer = setTimeout(() => {
        if (isMounted) {
          setStatus('error');
          setErrorMessage('User session not active. Please login first.');
          navigate('/login');
        }
      }, 1000);
      return () => {
        isMounted = false;
        if (authTimer) clearTimeout(authTimer);
      };
    }

    // Ref lock to guarantee single token exchange call
    if (exchangeAttempted.current) return;
    exchangeAttempted.current = true;

    const exchangeCodeForTokens = async () => {
      try {
        const clientId = import.meta.env.VITE_ZOHO_CLIENT_ID || '1000.FZJ97A4AV5S97D1KBMEAZ69CUDZCPH';
        const clientSecret = import.meta.env.VITE_ZOHO_CLIENT_SECRET || 'befb4c2a53a5ede358f3f3eda7fe8e728f4115dae6';
        const redirectUri = window.location.origin + '/zoho-callback';

        if (!clientId || !clientSecret) {
          throw new Error('Zoho OAuth credentials not configured on the client.');
        }

        const isLocal = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' || 
                        window.location.port !== '';

        const proxyServerUrl = import.meta.env.VITE_ZOHO_PROXY_SERVER_URL || import.meta.env.VITE_IMAP_PROXY_SERVER_URL || 'https://imap-proxy-server.vercel.app';
        let tokenResponse;

        // Stage 1: Primary Configured Proxy Server
        if (proxyServerUrl) {
          try {
            tokenResponse = await fetch(`${proxyServerUrl}/zoho/token`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Bypass-Tunnel-Reminder': 'true'
              },
              body: JSON.stringify({ code, redirect_uri: redirectUri })
            });
            const ct = tokenResponse.headers.get('content-type') || '';
            if (!tokenResponse.ok || !ct.includes('application/json')) {
              console.warn("Primary proxy server returned non-JSON/error, trying HTTPS tunnel...");
              tokenResponse = null;
            }
          } catch (e) {
            console.warn("Primary proxy unreachable, trying HTTPS tunnel...", e);
            tokenResponse = null;
          }
        }

        // Stage 2: HTTPS Tunnel Proxy
        if (!tokenResponse) {
          try {
            tokenResponse = await fetch(`https://imap-proxy-server.vercel.app/zoho/token`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ code, redirect_uri: redirectUri })
            });
            const ct = tokenResponse.headers.get('content-type') || '';
            if (!tokenResponse.ok || !ct.includes('application/json')) {
              console.warn("HTTPS tunnel returned non-JSON/error, trying local proxy...");
              tokenResponse = null;
            }
          } catch (e) {
            console.warn("HTTPS tunnel unreachable...", e);
            tokenResponse = null;
          }
        }

        // Stage 3: Local Proxy
        if (!tokenResponse) {
          try {
            tokenResponse = await fetch(`http://127.0.0.1:8080/zoho/token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code, redirect_uri: redirectUri })
            });
            const ct = tokenResponse.headers.get('content-type') || '';
            if (!tokenResponse.ok || !ct.includes('application/json')) {
              tokenResponse = null;
            }
          } catch (e) {
            console.warn("Local proxy unreachable...", e);
            tokenResponse = null;
          }
        }

        if (!tokenResponse) {
          throw new Error('All proxy servers are unreachable. Please make sure the backend proxy server is running.');
        }

        if (!tokenResponse.ok) {
          let errMsg = 'Failed to exchange Zoho authorization code.';
          try {
            const errorData = await tokenResponse.json();
            if (errorData.error) errMsg += ` (${errorData.error})`;
          } catch {
            errMsg += ` (Status: ${tokenResponse.status})`;
          }
          throw new Error(errMsg);
        }

        const tokenData = await tokenResponse.json();
        const { access_token, refresh_token } = tokenData;

        if (!access_token) {
          throw new Error('No access_token returned by Zoho token exchange.');
        }

        // 2. Fetch Zoho Mail accounts list to get accountId and incomingMailAddress
        let accountsResponse;

        if (proxyServerUrl) {
          try {
            accountsResponse = await fetch(`${proxyServerUrl}/zoho/proxy`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Bypass-Tunnel-Reminder': 'true'
              },
              body: JSON.stringify({
                path: '/api/accounts',
                method: 'GET',
                token: access_token
              })
            });
            const ct = accountsResponse.headers.get('content-type') || '';
            if (!accountsResponse.ok || !ct.includes('application/json')) accountsResponse = null;
          } catch (e) {
            accountsResponse = null;
          }
        }

        if (!accountsResponse) {
          try {
            accountsResponse = await fetch(`https://imap-proxy-server.vercel.app/zoho/proxy`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                path: '/api/accounts',
                method: 'GET',
                token: access_token
              })
            });
            const ct = accountsResponse.headers.get('content-type') || '';
            if (!accountsResponse.ok || !ct.includes('application/json')) accountsResponse = null;
          } catch (e) {
            accountsResponse = null;
          }
        }

        if (!accountsResponse) {
          try {
            accountsResponse = await fetch(`http://127.0.0.1:8080/zoho/proxy`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Bypass-Tunnel-Reminder': 'true'
              },
              body: JSON.stringify({
                path: '/api/accounts',
                method: 'GET',
                token: access_token
              })
            });
            const ct = accountsResponse.headers.get('content-type') || '';
            if (!accountsResponse.ok || !ct.includes('application/json')) accountsResponse = null;
          } catch (e) {
            accountsResponse = null;
          }
        }

        if (!accountsResponse) {
          throw new Error('Failed to retrieve Zoho Mail profile: All proxy servers are unreachable or returned non-JSON.');
        }

        if (!accountsResponse.ok) {
          const errText = await accountsResponse.text();
          throw new Error(`Failed to retrieve Zoho Mail profile: ${errText}`);
        }

        const accountsData = await accountsResponse.json();
        if (!accountsData.data || accountsData.data.length === 0) {
          throw new Error('No active Zoho Mail accounts found under this profile.');
        }

        const primaryAccount = accountsData.data[0];
        const zohoEmail = primaryAccount.mailboxAddress || 
                           primaryAccount.incomingMailAddress || 
                           primaryAccount.incomingUserName || 
                           (primaryAccount.emailAddress && primaryAccount.emailAddress[0]?.mailId) || 
                           currentUser.email || 
                           'unknown@zoho.in';
        const zohoAccountId = primaryAccount.accountId || primaryAccount.zuid || '';

        if (!zohoAccountId) {
          throw new Error('Zoho Account ID could not be identified from the profile.');
        }

        // 3. Write Zoho credentials record to Firestore
        const credentialId = `${currentUser.uid}_${zohoEmail}`;
        const credRef = doc(db, 'zoho_credentials', credentialId);
        const isAdmin = userDoc?.role === 'superadmin' || userDoc?.role === 'admin';
        await setDoc(credRef, {
          userId: currentUser.uid,
          userName: userDoc?.name || 'Anonymous Client',
          userEmail: currentUser.email,
          assignedAdminId: currentUser.uid,
          zoho_email: zohoEmail,
          zoho_account_id: zohoAccountId,
          zoho_refresh_token: refresh_token,
          zoho_verified_by_admin: isAdmin,
          createdAt: new Date().toISOString()
        });

        if (isMounted) {
          setStatus('success');
          showToast(`Zoho Mail (${zohoEmail}) linked successfully!`, 'success');
        }

      } catch (err) {
        console.error("Zoho token exchange error:", err);
        if (isMounted) {
          setStatus('error');
          setErrorMessage(err.message || 'Failed to exchange tokens with Zoho.');
        }
      }
    };

    exchangeCodeForTokens();

    return () => {
      isMounted = false;
      if (authTimer) clearTimeout(authTimer);
    };
  }, [loading, currentUser, searchParams, navigate, showToast, userDoc]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950 p-6 text-center">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-8 shadow-xl space-y-6">
        
        {status === 'processing' && (
          <div className="flex flex-col items-center space-y-4">
            <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center rounded-2xl text-indigo-650 dark:text-indigo-400">
              <Loader className="w-7 h-7 animate-spin" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Connecting Zoho Mail</h3>
              <p className="text-xs text-gray-400 dark:text-gray-555 font-semibold leading-relaxed">
                Exchanging credentials with Zoho servers and mapping your mailbox keys. Please wait...
              </p>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center space-y-4">
            <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center rounded-2xl text-emerald-650 dark:text-emerald-400">
              <CheckCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Connection Successful</h3>
              <p className="text-xs text-gray-400 dark:text-gray-555 font-semibold leading-relaxed">
                Your Zoho Mail account has been linked successfully. Redirecting back to your profile...
              </p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center space-y-4">
            <div className="w-14 h-14 bg-rose-50 dark:bg-rose-955 flex items-center justify-center rounded-2xl text-rose-650 dark:text-rose-455">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Connection Failed</h3>
              <p className="text-xs text-rose-600 dark:text-rose-400 font-bold leading-relaxed">
                {errorMessage}
              </p>
              <p className="text-[10px] text-gray-400 font-medium pt-2">
                Returning you back to safety...
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
