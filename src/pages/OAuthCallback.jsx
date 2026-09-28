import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Loader, AlertTriangle, CheckCircle } from 'lucide-react';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const { currentUser, userDoc, loading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState('processing'); // 'processing' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (loading) return;

    const code = searchParams.get('code');
    
    if (!code) {
      setTimeout(() => {
        setStatus('error');
        setErrorMessage('Authorization code not found. Redirecting to profile...');
      }, 0);
      setTimeout(() => navigate('/profile'), 3000);
      return;
    }

    if (!currentUser) {
      setTimeout(() => {
        setStatus('error');
        setErrorMessage('User session not active. Please login first.');
      }, 0);
      setTimeout(() => navigate('/login'), 3000);
      return;
    }

    const exchangeCodeForTokens = async () => {
      try {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
        const redirectUri = window.location.origin + '/oauth-callback';

        if (!clientId || !clientSecret || clientId === 'your_google_client_id_here') {
          throw new Error('Google OAuth credentials not configured on the client.');
        }

        // 1. Exchange code for access & refresh tokens
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
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
          })
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json();
          throw new Error(errorData.error_description || 'Failed to exchange authorization code.');
        }

        const tokenData = await tokenResponse.json();
        const { access_token, refresh_token } = tokenData;

        if (!refresh_token) {
          throw new Error('No refresh token received. Please disconnect and reconnect, ensuring you grant offline consent.');
        }

        // 2. Fetch Gmail profile to get email address (routing through Vite proxy when running on localhost to avoid CORS)
        const gmailApiEndpoint = window.location.hostname === 'localhost' || 
                                 window.location.hostname === '127.0.0.1' || 
                                 window.location.port !== ''
          ? '/google-gmail-proxy/gmail/v1/users/me/profile'
          : 'https://gmail.googleapis.com/gmail/v1/users/me/profile';

        const profileResponse = await fetch(gmailApiEndpoint, {
          headers: { Authorization: `Bearer ${access_token}` }
        });

        if (!profileResponse.ok) {
          throw new Error('Failed to retrieve Gmail profile.');
        }

        const profileData = await profileResponse.json();
        const gmailEmail = profileData.emailAddress;

        // 3. Save tokens and email in Firestore gmail_credentials collection
        const credentialId = `${currentUser.uid}_${gmailEmail}`;
        const credRef = doc(db, 'gmail_credentials', credentialId);
        await setDoc(credRef, {
          userId: currentUser.uid,
          userName: userDoc?.name || 'Anonymous User',
          userEmail: userDoc?.email || 'No Email',
          gmail_email: gmailEmail,
          gmail_refresh_token: refresh_token,
          gmail_connected: true,
          gmail_verified_by_admin: false, // Default to pending verification
          connectedAt: new Date().toISOString()
        });

        setStatus('success');
        showToast(`Successfully linked Gmail account: ${gmailEmail}`, 'success');
        setTimeout(() => navigate('/profile'), 2000);
      } catch (err) {
        console.error('OAuth token exchange error:', err);
        setStatus('error');
        
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
        const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '';
        const isLocal = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' || 
                        window.location.port !== '';
        
        const debugInfo = {
          error: err.toString(),
          hostname: window.location.hostname,
          port: window.location.port,
          origin: window.location.origin,
          clientIdConfigured: clientId ? `${clientId.slice(0, 10)}...${clientId.slice(-10)}` : 'MISSING',
          clientSecretConfigured: clientSecret ? `${clientSecret.slice(0, 5)}...${clientSecret.slice(-5)}` : 'MISSING',
          hasCodeParam: !!searchParams.get('code'),
          codeLength: (searchParams.get('code') || '').length,
          endpointTried: isLocal ? '/google-token-proxy' : 'https://oauth2.googleapis.com/token'
        };

        setErrorMessage(JSON.stringify(debugInfo, null, 2));
        showToast('Failed to link Gmail account.', 'error');
      }
    };

    exchangeCodeForTokens();
  }, [searchParams, currentUser, navigate, showToast, loading]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-8 shadow-xl text-center space-y-6">
        {status === 'processing' && (
          <>
            <div className="flex justify-center">
              <Loader className="w-12 h-12 text-indigo-600 dark:text-indigo-400 animate-spin" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Connecting Gmail Account</h3>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Please wait while we establish a secure connection with Google APIs...
              </p>
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="flex justify-center">
              <CheckCircle className="w-12 h-12 text-emerald-500 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Gmail Connected!</h3>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Your email has been linked successfully. Redirecting you back...
              </p>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="flex justify-center">
              <AlertTriangle className="w-12 h-12 text-rose-500" />
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-rose-600 dark:text-rose-450">Connection Failed</h3>
              
              <div className="text-left bg-gray-50 dark:bg-gray-950 p-4 rounded-xl border border-gray-150 dark:border-gray-800 font-mono text-[10px] overflow-auto max-h-60 text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                {errorMessage}
              </div>
              
              <div className="pt-2">
                <button
                  onClick={() => navigate('/profile')}
                  className="w-full px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl transition-all"
                >
                  Return to Profile
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
