import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useIdleTimer } from '../hooks/useIdleTimer';
import { suspendOwnAccount, logClientSession, acceptTermsAndConditions, subscribeToBlockedRegions, subscribeToBlockedIps } from '../firebase/firestore';
import SupportChatWidget from '../components/SupportChatWidget';
import { hasDpdpConsent } from '../components/CookieConsentBanner';
import { auth, db } from '../firebase/config';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { parseInstagramInput, getInstagramDetails } from '../utils/instagramHelper';
import { 
  Calendar, 
  CreditCard, 
  DollarSign, 
  Mail, 
  Phone, 
  Clock, 
  AlertTriangle, 
  FileText,
  ShieldAlert,
  ShieldCheck,
  Loader,
  Sparkles,
  RefreshCw,
  Inbox,
  Video,
  Play,
  CheckCircle,
  Zap,
  Camera,
  Check,
  X
} from 'lucide-react';

/**
 * Client Dashboard View.
 * Displays real-time subscription status, countdown clock, financial figures, and notes.
 */
export default function ClientDashboard() {
  const navigate = useNavigate();
  const { currentUser, userDoc, clientData, isImpersonating, stopImpersonating } = useAuth();
  const { showToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Instagram ID Prompt Modal for New and Old Users
  const [showInstaModal, setShowInstaModal] = useState(false);
  const [instaInput, setInstaInput] = useState('');
  const [savingInsta, setSavingInsta] = useState(false);

  useEffect(() => {
    if (!currentUser || !userDoc) return;
    // Check if user has no instagramId saved and has not dismissed the modal in this session
    const instaDetails = getInstagramDetails(userDoc);
    const hasInsta = !!instaDetails.username;
    const isDismissed = sessionStorage.getItem('dismissed_insta_popup') === 'true';

    if (!hasInsta && !isDismissed) {
      const timer = setTimeout(() => {
        setShowInstaModal(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [currentUser, userDoc]);

  const handleSaveInstagram = async (e) => {
    if (e) e.preventDefault();
    if (!instaInput.trim()) return;

    setSavingInsta(true);
    try {
      const { username, link } = parseInstagramInput(instaInput);
      if (!username) {
        showToast("Please enter a valid Instagram username or link.", "error");
        setSavingInsta(false);
        return;
      }
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        instagramId: username,
        instagram_link: link,
        updatedAt: new Date().toISOString()
      });

      showToast(`Instagram @${username} linked successfully! 🎉`, "success");
      setShowInstaModal(false);
    } catch (err) {
      console.error("Failed to save Instagram ID:", err);
      showToast("Failed to save Instagram ID.", "error");
    } finally {
      setSavingInsta(false);
    }
  };

  const handleSkipInstagram = () => {
    sessionStorage.setItem('dismissed_insta_popup', 'true');
    setShowInstaModal(false);
  };

  // Default fallback if real-time clientData is resolving
  const data = clientData || {};

  // Expiration days arithmetic
  const getDaysRemaining = (expiry) => {
    if (!expiry) return 0;
    const expDate = new Date(expiry);
    const diff = expDate.getTime() - Date.now();
    if (diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const daysRemaining = getDaysRemaining(data.expiryDate);
  const isExpired = data.expiryDate ? (daysRemaining <= 0 || data.status === 'Expired') : false;
  const isWarning = data.expiryDate ? (daysRemaining > 0 && daysRemaining <= 7) : false;
  const linkedEmail = data.linkedGmail || data.linkedZoho || data.linkedImap;
  
  const [termsCheckbox, setTermsCheckbox] = useState(false);
  const [termsLoading, setTermsLoading] = useState(false);
  const [telemetryInfo, setTelemetryInfo] = useState(null);

  // Recovery email binding timer state
  const [bindingTimeLeft, setBindingTimeLeft] = useState(null);
  const [bindingPercent, setBindingPercent] = useState(0);

  // 48-hour OTP view limit states
  const [canRequestOtp, setCanRequestOtp] = useState(true);
  const [cooldownText, setCooldownText] = useState('');
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState(null);
  const [isRefreshingOtp, setIsRefreshingOtp] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(0);
  const [latestOtpToShow, setLatestOtpToShow] = useState(null);
  const [latestDetectedOtp, setLatestDetectedOtp] = useState(null);
  const [scannedEmailDetails, setScannedEmailDetails] = useState(null);
  const [showingScanResults, setShowingScanResults] = useState(false);
  const [rulesDrawerOpen, setRulesDrawerOpen] = useState(false);

  // Geofencing & IP states
  const [userIp, setUserIp] = useState('Unknown');
  const [detectedRegion, setDetectedRegion] = useState('');
  const [blockedStates, setBlockedStates] = useState([]);
  const [blockedIps, setBlockedIps] = useState([]);

  useEffect(() => {
    const unsub = subscribeToBlockedRegions((states) => {
      setBlockedStates(states);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeToBlockedIps((ips) => {
      setBlockedIps(ips);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const fetchGeo = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (res.ok) {
          const resData = await res.json();
          setUserIp(resData.ip || 'Unknown');
          if (resData.region) {
            setDetectedRegion(resData.region);
          }
        }
      } catch (err) {
        console.warn("Geofencing check failed to retrieve location:", err);
      }
    };
    fetchGeo();
  }, []);

  const isRegionBlocked = userDoc?.role !== 'admin' && detectedRegion && blockedStates.some(
    state => state.toLowerCase() === detectedRegion.toLowerCase()
  );

  const isIpBlocked = userDoc?.role !== 'admin' && userIp && blockedIps.some(
    ip => ip.trim() === userIp.trim()
  );

  useEffect(() => {
    if (!clientData || !clientData.bindingStatus || clientData.bindingStatus !== 'pending' || !clientData.bindingStartDate) {
      setBindingTimeLeft(null);
      setBindingPercent(0);
      return;
    }

    const calculateTime = () => {
      let startMs = 0;
      if (clientData.bindingStartDate && typeof clientData.bindingStartDate.toDate === 'function') {
        startMs = clientData.bindingStartDate.toDate().getTime();
      } else if (clientData.bindingStartDate) {
        startMs = new Date(clientData.bindingStartDate).getTime();
      }

      if (!startMs || isNaN(startMs)) {
        setBindingTimeLeft(null);
        setBindingPercent(0);
        return;
      }

      const totalMs = 15 * 24 * 60 * 60 * 1000; // 15 Days
      const targetMs = startMs + totalMs;
      const nowMs = Date.now();
      const remainingMs = targetMs - nowMs;

      if (remainingMs <= 0) {
        setBindingTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
        setBindingPercent(100);
      } else {
        const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
        setBindingTimeLeft({ days, hours, minutes, seconds, expired: false });
        
        const elapsedMs = nowMs - startMs;
        const pct = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
        setBindingPercent(pct);
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [clientData]);

  // 48-hour OTP Cooldown & 1-Time Scan Unified verification check (Telegram + Website)
  useEffect(() => {
    // If admin has granted an extra scan, bypass cooldown check entirely!
    if (userDoc?.extraScanGranted === true || data.extraScanGranted === true) {
      setCanRequestOtp(true);
      setCooldownText('');
      setCooldownTimeLeft(null);
      return;
    }

    const rawLastTime = data.lastOtpScannedAt || data.lastOtpViewedAt || userDoc?.lastOtpScannedAt || userDoc?.lastOtpViewedAt;
    const isScanUsed = data.otpUsed === true || userDoc?.otpUsed === true || (data.otpScanCount || 0) >= 1 || (userDoc?.otpScanCount || 0) >= 1 || !!rawLastTime;

    if (!isScanUsed) {
      setCanRequestOtp(true);
      setCooldownText('');
      setCooldownTimeLeft(null);
      return;
    }

    // Determine timestamp of last OTP scan (supporting number, Firestore Timestamp, or ISO string)
    let lastScanMs = Date.now();
    if (rawLastTime) {
      if (typeof rawLastTime === 'number') {
        lastScanMs = rawLastTime;
      } else if (typeof rawLastTime.toDate === 'function') {
        lastScanMs = rawLastTime.toDate().getTime();
      } else if (typeof rawLastTime === 'string') {
        const parsed = new Date(rawLastTime).getTime();
        if (!isNaN(parsed)) lastScanMs = parsed;
      }
    }

    const checkCooldown = () => {
      const now = Date.now();
      const cooldownMs = 48 * 60 * 60 * 1000; // 48 hours
      const elapsed = now - lastScanMs;

      if (elapsed >= cooldownMs) {
        setCanRequestOtp(true);
        setCooldownText('');
        setCooldownTimeLeft(null);
      } else {
        setCanRequestOtp(false);
        const remaining = cooldownMs - elapsed;
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        setCooldownText(`${hours}h ${minutes}m ${seconds}s remaining`);
        setCooldownTimeLeft({ hours, minutes, seconds });
      }
    };

    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, [
    userDoc?.lastOtpViewedAt, 
    userDoc?.lastOtpScannedAt, 
    userDoc?.otpUsed, 
    userDoc?.otpScanCount, 
    userDoc?.extraScanGranted,
    data.lastOtpScannedAt,
    data.lastOtpViewedAt,
    data.otpUsed,
    data.otpScanCount,
    data.extraScanGranted
  ]);

  // Auto-revoke mailbox if subscription expires
  useEffect(() => {
    if (isExpired && (data.linkedGmail || data.linkedZoho || data.linkedImap)) {
      const autoRevoke = async () => {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          await updateDoc(userRef, {
            linkedGmail: '',
            linkedZoho: '',
            linkedImap: ''
          });
          showToast("Your subscription has expired. Mailbox access has been revoked.", "warning");
        } catch (err) {
          console.error("Auto-revoking mailbox failed on expiration:", err);
        }
      };
      autoRevoke();
    }
  }, [isExpired, data.linkedGmail, data.linkedZoho, data.linkedImap, currentUser]);

  const recordOtpViewTime = async (detectedOtp = null) => {
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const updates = {
        otpUsed: true,
        otpScanCount: (data.otpScanCount || 0) + 1,
        lastOtpViewedAt: new Date().toISOString(),
        lastOtpScannedAt: Date.now(),
        extraScanGranted: false // Reset extra scan permission once used
      };
      if (detectedOtp && detectedOtp !== 'NO_OTP_FOUND' && detectedOtp !== 'FULL_EMAIL_SHOWN') {
        updates.lastExtractedOtp = detectedOtp;
        updates.lastExtractedOtpAt = Date.now();
      }
      await updateDoc(userRef, updates);
    } catch (err) {
      console.error("Error saving OTP view time to database:", err);
    }
  };

  const handleStartOtpScan = async () => {
    if (!canRequestOtp || isRefreshingOtp) return;
    setIsRefreshingOtp(true);
    setRefreshProgress(0);

    // Concurrently trigger email fetch with force bypass
    const fetchPromise = fetchLinkedEmails(true);

    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 25;
      if (progress <= 90) {
        setRefreshProgress(progress);
      }
    }, 350);

    try {
      const fetched = await fetchPromise;
      clearInterval(progressInterval);
      setRefreshProgress(100);

      // Brief pause to display completion smoothly
      await new Promise((r) => setTimeout(r, 350));

      if (fetched && fetched.length > 0) {
        // Inspect all fetched emails to extract the latest verification code
        const latestEmail = fetched[0];
        const latestBody = latestEmail.payload ? getEmailBodyText(latestEmail.payload) : (latestEmail.body || "");
        let foundOtp = extractOTP(latestEmail.subject, latestBody, latestEmail.snippet);

        // If not found in first email, check other emails
        if (!foundOtp) {
          for (let i = 1; i < fetched.length; i++) {
            const item = fetched[i];
            const body = item.payload ? getEmailBodyText(item.payload) : (item.body || "");
            const code = extractOTP(item.subject, body, item.snippet);
            if (code) {
              foundOtp = code;
              break;
            }
          }
        }

        const emailDetails = {
          ...latestEmail,
          body: latestBody,
          detectedCode: foundOtp
        };
        setScannedEmailDetails(emailDetails);

        await recordOtpViewTime(foundOtp);
        setShowingScanResults(true);

        if (foundOtp) {
          setLatestDetectedOtp(foundOtp);
          setLatestOtpToShow(foundOtp);
          showToast(`Garena Verification Code Detected: ${foundOtp}!`, "success");
        } else {
          setLatestOtpToShow('FULL_EMAIL_SHOWN');
          showToast("Latest Garena email retrieved! Review full email below.", "success");
        }
      } else {
        await recordOtpViewTime('NO_OTP_FOUND');
        setShowingScanResults(true);
        setLatestOtpToShow('NO_OTP_FOUND');
        showToast("Scan completed. No recent Garena emails detected in stream.", "warning");
      }
    } catch (err) {
      clearInterval(progressInterval);
      console.error("Error performing stream scan:", err);
      showToast("Failed to fetch stream: " + (err.message || "Unknown error"), "error");
    } finally {
      setIsRefreshingOtp(false);
      // NOTE: We deliberately do NOT call setLatestOtpToShow(null) here so that the modal stays open!
    }
  };

  const showTermsModal = clientData && clientData.termsAccepted !== true;

  const handleAcceptTerms = async () => {
    if (!termsCheckbox) return;
    setTermsLoading(true);
    try {
      await acceptTermsAndConditions(currentUser.uid);
      
      // Log the T&C Acceptance event in the client telemetry logs
      const tcsessionData = {
        ...(telemetryInfo || {
          ip: userIp || 'Unknown',
          country: 'Unknown',
          latitude: null,
          longitude: null,
          locationPermission: 'denied',
          userAgent: navigator.userAgent,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          language: navigator.language,
          platform: navigator.platform,
          connectionType: navigator.connection?.effectiveType || 'Unknown',
          clientName: userDoc?.name || currentUser.displayName || 'Client',
          clientEmail: currentUser.email
        }),
        eventType: 'Terms Acceptance',
        details: 'Client accepted Terms & Conditions via portal prompt.'
      };
      if (!isImpersonating) {
        await logClientSession(currentUser.uid, tcsessionData);
      }
    } catch (err) {
      console.error("Error accepting terms:", err);
    } finally {
      setTermsLoading(false);
    }
  };

  // Inactivity auto logout (15 minutes)
  useIdleTimer(900000);

  useEffect(() => {
    if (!currentUser) return;
    
    // Check if session is already logged in sessionStorage to prevent duplicates on hot reloading
    const sessionKey = `session_logged_${currentUser.uid}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, 'true');

    const trackSession = async () => {
      if (isImpersonating) {
        console.log("Impersonation active: Session logging is bypassed.");
        return;
      }

      // DPDP Act 2023 Compliance: Only collect detailed telemetry if user has given consent
      const consentGiven = hasDpdpConsent();

      let ip = 'consent_not_given';
      let country = 'consent_not_given';

      if (consentGiven) {
        try {
          const res = await fetch('https://ipapi.co/json/');
          if (res.ok) {
            const data = await res.json();
            ip = data.ip || 'Unknown';
            country = data.country_name || 'Unknown';
          }
        } catch (err) {
          console.warn("Could not retrieve IP/Country via external API:", err);
        }
      }

      const saveTelemetry = async (latitude = null, longitude = null, permissionGranted = false) => {
        try {
          const sessionData = {
            // Essential data (always logged for security)
            clientName: userDoc?.name || currentUser.displayName || 'Client',
            clientEmail: currentUser.email,
            dpdpConsentGiven: consentGiven,
            // Detailed telemetry (only if DPDP consent given)
            ip: consentGiven ? ip : 'consent_not_given',
            country: consentGiven ? country : 'consent_not_given',
            latitude: consentGiven ? latitude : null,
            longitude: consentGiven ? longitude : null,
            locationPermission: consentGiven ? (permissionGranted ? 'granted' : 'denied') : 'consent_not_given',
            userAgent: consentGiven ? navigator.userAgent : 'consent_not_given',
            screenResolution: consentGiven ? `${window.screen.width}x${window.screen.height}` : 'consent_not_given',
            language: consentGiven ? navigator.language : 'consent_not_given',
            platform: consentGiven ? navigator.platform : 'consent_not_given',
            connectionType: consentGiven ? (navigator.connection?.effectiveType || 'Unknown') : 'consent_not_given'
          };
          setTelemetryInfo(sessionData);
          await logClientSession(currentUser.uid, sessionData);
        } catch (dbErr) {
          console.error("Failed to write telemetry metadata to Firestore:", dbErr);
        }
      };

      // DPDP: Only request geolocation if consent is given
      if (consentGiven && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            saveTelemetry(pos.coords.latitude, pos.coords.longitude, true);
          },
          (err) => {
            console.warn("Geolocation permission denied:", err);
            saveTelemetry(null, null, false);
          },
          { timeout: 10000 }
        );
      } else {
        saveTelemetry(null, null, false);
      }
    };

    trackSession();
  }, [currentUser, userDoc]);
  // Parse OTP/Verification code inside subject, body payload, or snippet (Multilingual: EN, VN, ID)
  const extractOTP = (subject = '', bodyPayload = '', snippet = '') => {
    const rawSubject = (subject || "").trim();
    const rawSnippet = (snippet || "").trim();
    let rawBody = (bodyPayload || "").trim();

    if (!rawSubject && !rawSnippet && !rawBody) return null;

    // Clean HTML tags, styles, scripts, and entities from raw body to get pure plaintext
    const cleanBody = rawBody
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\s+/g, ' ');

    // 1. High priority: Direct search inside snippet and subject (Gmail pre-parsed snippet is cleanest!)
    const snippetCandidates = [rawSnippet, rawSubject];
    for (const text of snippetCandidates) {
      if (!text) continue;
      // Explicit keyword followed by 6-8 digit code
      const kwMatch = text.match(/(?:verification\s*(?:code|pin|passcode)|security\s*(?:code|pin)|auth(?:entication)?\s*(?:code|pin)|one[- ]time\s*password|login\s*(?:code|pin)|confirmation\s*code|mã\s*(?:xác\s*(?:nhận|thực)|bảo\s*mật)|kode\s*verifikasi|otp|passcode|pin)[\s:=–—\-#]*([0-9]{6,8})\b/i);
      if (kwMatch && kwMatch[1]) {
        const code = kwMatch[1];
        if (!code.startsWith('202') && !code.startsWith('203')) return code;
      }
      // Code followed by keyword: e.g. "849201 is your verification code" or "849201 là mã xác nhận"
      const prefixMatch = text.match(/\b([0-9]{6,8})\b(?:\s+(?:is|là|adalah)\s+(?:your\s+)?(?:garena\s+)?(?:verification|security|auth|confirmation|login|otp|mã\s*xác\s*(?:nhận|thực))\s*(?:code|pin|password)?)/i);
      if (prefixMatch && prefixMatch[1]) {
        const code = prefixMatch[1];
        if (!code.startsWith('202') && !code.startsWith('203')) return code;
      }
    }

    // 2. Cleaned body search with explicit patterns
    const explicitPatterns = [
      /(?:verification\s*(?:code|pin|passcode)|security\s*(?:code|pin)|auth(?:entication)?\s*(?:code|pin)|one[- ]time\s*password|login\s*(?:code|pin)|confirmation\s*code|mã\s*(?:xác\s*(?:nhận|thực)|bảo\s*mật)|kode\s*verifikasi|otp|passcode|pin)[\s:=–—\-#]*([0-9]{6,8})\b/i,
      /\b([0-9]{6,8})\b(?:\s+(?:is|là|adalah)\s+(?:your\s+)?(?:garena\s+)?(?:verification|security|auth|confirmation|login|otp|mã\s*xác\s*(?:nhận|thực))\s*(?:code|pin|password)?)/i,
      /(?:code|mã|otp|pin)[\s:–—\-#]+([0-9]{6,8})\b/i
    ];

    for (const pattern of explicitPatterns) {
      const match = cleanBody.match(pattern);
      if (match && match[1]) {
        const code = match[1];
        if (!code.startsWith('202') && !code.startsWith('203') && !/^(\d)\1+$/.test(code)) {
          return code;
        }
      }
    }

    // 3. Highlighted HTML code elements in raw body (e.g. <span>123456</span> or <b>123456</b> or <td>123456</td>)
    const htmlCodePattern = /<(?:b|strong|h[1-6]|span|div|p|td|font)[^>]*>\s*([0-9]{6,8})\s*<\/(?:b|strong|h[1-6]|span|div|p|td|font)>/gi;
    let htmlCodeMatch;
    while ((htmlCodeMatch = htmlCodePattern.exec(rawBody)) !== null) {
      const candidate = htmlCodeMatch[1];
      if (!candidate.startsWith('202') && !candidate.startsWith('203') && !/^(\d)\1+$/.test(candidate) && candidate !== '123456' && candidate !== '654321') {
        return candidate;
      }
    }

    // 4. Contextual verification check across all available text
    const fullCombined = `${rawSubject} ${rawSnippet} ${cleanBody}`;
    const isVerificationContext = /(?:verification|verify|security|garena|authenticat|password|code|otp|confirm|xác\s*nhận|xác\s*thực|bảo\s*mật|verifikasi)/i.test(fullCombined);

    if (isVerificationContext) {
      const candidates = [...fullCombined.matchAll(/(?:^|[\s:;.,!?'"()\[\]{}–—\-])([0-9]{6})(?:$|[\s:;.,!?'"()\[\]{}–—\-])/g)];
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

  // Recursively extract text from Gmail payload parts and decode from Base64
  const getEmailBodyText = (payload) => {
    if (!payload) return "";

    const decodeBase64 = (str) => {
      try {
        let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
        // Add required base64 padding if missing
        const pad = base64.length % 4;
        if (pad === 2) {
          base64 += '==';
        } else if (pad === 3) {
          base64 += '=';
        }

        const rawBinary = window.atob(base64);
        const bytes = new Uint8Array(rawBinary.length);
        for (let i = 0; i < rawBinary.length; i++) {
          bytes[i] = rawBinary.charCodeAt(i);
        }
        return new TextDecoder("utf-8").decode(bytes);
      } catch (e) {
        console.error("Base64 decode failed:", e);
        return "";
      }
    };

    if (payload.body && payload.body.data) {
      return decodeBase64(payload.body.data);
    }

    if (payload.parts) {
      let body = "";
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body && part.body.data) {
          body += decodeBase64(part.body.data);
        } else if (part.mimeType === 'text/html' && part.body && part.body.data) {
          body += decodeBase64(part.body.data);
        } else if (part.parts) {
          body += getEmailBodyText(part);
        }
      }
      return body;
    }

    return "";
  };

  // Generate a cleaner fallback snippet from decoded body if the API returned empty snippet
  const cleanSnippet = (snippet, decodedBody) => {
    if (snippet && snippet !== '(No Snippet Available)' && snippet.trim().length > 0) {
      return snippet;
    }
    if (!decodedBody) return "(No Snippet Available)";
    
    let text = decodedBody.replace(/<[^>]*>/g, ' ');
    text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    text = text.replace(/\s+/g, ' ').trim();
    
    if (text.length === 0) return "(No Snippet Available)";
    return text.substring(0, 155) + (text.length > 155 ? "..." : "");
  };

  // Real-time verification emails fetch from linked Gmail or Zoho auditor connection
  const [emails, setEmails] = useState([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [errorEmails, setErrorEmails] = useState('');

  const getFreshZohoAccessToken = async (user) => {
    const clientId = import.meta.env.VITE_ZOHO_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_ZOHO_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("Zoho OAuth credentials are not fully configured in your .env file.");
    }
    const isLocal = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' || 
                    window.location.port !== '';
    const proxyServerUrl = import.meta.env.VITE_ZOHO_PROXY_SERVER_URL;
    let tokenResponse;
    let useProxy = !!proxyServerUrl;

    if (useProxy) {
      try {
        tokenResponse = await fetch(`${proxyServerUrl}/zoho/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: user.zoho_refresh_token })
        });
        if (!tokenResponse.ok) {
          console.warn("Render Zoho proxy token refresh returned non-ok status, falling back to client-side OAuth refresh...");
          useProxy = false;
        }
      } catch (err) {
        console.warn("Render Zoho proxy token refresh failed, falling back to client-side OAuth refresh:", err);
        useProxy = false;
      }
    }

    if (!useProxy) {
      const tokenEndpoint = isLocal
        ? '/zoho-token-proxy/oauth/v2/token'
        : `https://corsproxy.org/?${encodeURIComponent('https://accounts.zoho.in/oauth/v2/token')}`;

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
    }

    if (!tokenResponse.ok) {
      throw new Error("Failed to refresh Zoho session access token. Reconnect your account.");
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  };

  const executeZohoRequest = async (path, method, accessToken, body = null) => {
    const proxyServerUrl = import.meta.env.VITE_ZOHO_PROXY_SERVER_URL;
    const isLocalUrl = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' || 
                       window.location.port !== '';
    let useProxy = !!proxyServerUrl;

    if (useProxy) {
      try {
        const response = await fetch(`${proxyServerUrl}/zoho/proxy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path, method, token: accessToken, body })
        });
        if (response.ok) {
          const data = await response.json();
          return data;
        }
        console.warn("Render Zoho proxy request returned non-ok status, falling back to direct client-side request...");
        useProxy = false;
      } catch (err) {
        console.warn("Render Zoho proxy request failed, falling back to direct client-side request:", err);
        useProxy = false;
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

  
  // Hydrate cached mailbox messages on load so mailbox is synced with website
  useEffect(() => {
    if (!currentUser?.uid) return;
    const cacheKey = `mailbox_cache_${currentUser.uid}`;
    try {
      const saved = localStorage.getItem(cacheKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEmails(parsed);
          setShowingScanResults(true);
          const first = parsed[0];
          const b = first.payload ? getEmailBodyText(first.payload) : (first.body || "");
          const c = extractOTP(first.subject, b, first.snippet);
          setScannedEmailDetails({
            ...first,
            body: b,
            detectedCode: c
          });
          if (c) {
            setLatestDetectedOtp(c);
          }
        }
      }
    } catch (e) {
      console.warn("Failed to load cached mailbox from localStorage:", e);
    }
  }, [currentUser?.uid]);

  const fetchLinkedEmails = React.useCallback(async (isExplicitScan = false) => {
    if (!linkedEmail) return [];
    if (data.mailboxDisabled) return [];
    if (isExpired) {
      setErrorEmails('Your 48-hour license subscription has expired. Console access is locked.');
      return [];
    }
    if (!isExplicitScan && !canRequestOtp && !data.extraScanGranted) {
      setErrorEmails('OTP already scanned (1/1 limit reached). Console is locked.');
      return [];
    }

    setLoadingEmails(true);
    setErrorEmails('');

    try {
      if (data.linkedGmail) {
        // --- Gmail Fetch Block ---
        const q = query(
          collection(db, 'gmail_credentials'),
          where('gmail_email', '==', data.linkedGmail)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          throw new Error("Linked auditor connection is offline or disconnected.");
        }

        let credData;
        snapshot.forEach(docSnap => {
          credData = docSnap.data();
        });

        if (!credData || !credData.gmail_refresh_token) {
          throw new Error("Auditor authentication refresh token is missing.");
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
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
            client_secret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET,
            refresh_token: credData.gmail_refresh_token,
            grant_type: 'refresh_token'
          })
        });

        if (!tokenResponse.ok) {
          throw new Error("Failed to exchange auditor session access token.");
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        const gmailApiBase = isLocal
          ? '/google-gmail-proxy'
          : 'https://gmail.googleapis.com';

        let listResponse;
        let jsFilterActive = false;
        const searchQuery = encodeURIComponent('garena OR verification OR security OR OTP OR "xác nhận" OR "xác thực"');
        const listUrl = `${gmailApiBase}/gmail/v1/users/me/messages?maxResults=10&q=${searchQuery}`;
        listResponse = await fetch(listUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!listResponse.ok || listResponse.status === 403) {
          const fallbackUrl = `${gmailApiBase}/gmail/v1/users/me/messages?maxResults=20`;
          listResponse = await fetch(fallbackUrl, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          if (listResponse.ok) {
            jsFilterActive = true;
          }
        }

        if (!listResponse.ok) {
          throw new Error("Failed to list mailbox messages from Gmail API.");
        }

        const listData = await listResponse.json();
        let messagesList = listData.messages || [];

        // If specific search query returned 0 messages, fall back to fetching latest inbox messages
        if (messagesList.length === 0 && !jsFilterActive) {
          const fallbackUrl = `${gmailApiBase}/gmail/v1/users/me/messages?maxResults=20`;
          const fbRes = await fetch(fallbackUrl, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          if (fbRes.ok) {
            const fbData = await fbRes.json();
            messagesList = fbData.messages || [];
            jsFilterActive = true;
          }
        }

        if (messagesList.length === 0) {
          setEmails([]);
          return [];
        }

        const resolved = await Promise.all(
          messagesList.map(async (msgItem) => {
            try {
              const detailUrl = `${gmailApiBase}/gmail/v1/users/me/messages/${msgItem.id}?format=full`;
              const detailResponse = await fetch(detailUrl, {
                headers: { Authorization: `Bearer ${accessToken}` }
              });
              if (!detailResponse.ok) return null;
              const detailData = await detailResponse.json();
              
              const getHeader = (headers, name) => {
                const h = headers.find(header => header.name.toLowerCase() === name.toLowerCase());
                return h ? h.value : '';
              };

              const headers = detailData.payload.headers || [];
              const fromHeader = getHeader(headers, 'From') || '';
              const subjectHeader = getHeader(headers, 'Subject') || '';

              if (jsFilterActive) {
                const combinedHeaders = `${fromHeader} ${subjectHeader}`.toLowerCase();
                const isTarget = combinedHeaders.includes('garena') ||
                                 combinedHeaders.includes('verification') ||
                                 combinedHeaders.includes('security') ||
                                 combinedHeaders.includes('otp') ||
                                 combinedHeaders.includes('code') ||
                                 combinedHeaders.includes('xác nhận') ||
                                 combinedHeaders.includes('xác thực') ||
                                 combinedHeaders.includes('verifikasi');
                if (!isTarget) return null;
              }

              return {
                id: detailData.id,
                snippet: detailData.snippet,
                subject: subjectHeader || '(No Subject)',
                from: fromHeader || 'Unknown Sender',
                date: getHeader(headers, 'Date') || 'Unknown Date',
                payload: detailData.payload
              };
            } catch (err) {
              console.error(err);
              return null;
            }
          })
        );

        let resEmails = resolved.filter(Boolean);

        // Fallback: If filtered list is empty but messages exist in the inbox, fetch the first 3 messages directly so client never gets empty!
        if (resEmails.length === 0 && messagesList.length > 0) {
          const fallbackResolved = await Promise.all(
            messagesList.slice(0, 3).map(async (msgItem) => {
              try {
                const detailUrl = `${gmailApiBase}/gmail/v1/users/me/messages/${msgItem.id}?format=full`;
                const detailResponse = await fetch(detailUrl, {
                  headers: { Authorization: `Bearer ${accessToken}` }
                });
                if (!detailResponse.ok) return null;
                const detailData = await detailResponse.json();
                const headers = detailData.payload?.headers || [];
                const getHeader = (hList, name) => {
                  const h = hList.find(header => header.name.toLowerCase() === name.toLowerCase());
                  return h ? h.value : '';
                };
                return {
                  id: detailData.id,
                  snippet: detailData.snippet,
                  subject: getHeader(headers, 'Subject') || '(No Subject)',
                  from: getHeader(headers, 'From') || 'Unknown Sender',
                  date: getHeader(headers, 'Date') || 'Unknown Date',
                  payload: detailData.payload
                };
              } catch (err) {
                return null;
              }
            })
          );
          resEmails = fallbackResolved.filter(Boolean);
        }

        setEmails(resEmails);
        if (currentUser?.uid && resEmails.length > 0) {
          try {
            localStorage.setItem(`mailbox_cache_${currentUser.uid}`, JSON.stringify(resEmails));
          } catch (cErr) { console.warn('Cache save error:', cErr); }
        }
        return resEmails;
      } else if (data.linkedZoho || data.linkedImap) {
        const targetEmail = (data.linkedImap || data.linkedZoho || '').trim().toLowerCase();
        const proxyServerUrl = import.meta.env.VITE_IMAP_PROXY_SERVER_URL || 'https://imap-proxy-server.vercel.app';

        // ---------------------------------------------------------------------
        // TIER 1: Check imap_credentials (supports Zoho IMAP, Gmail IMAP, custom host)
        // ---------------------------------------------------------------------
        let imapCredData = null;
        try {
          const imapQ = query(
            collection(db, 'imap_credentials'),
            where('imap_email', '==', targetEmail)
          );
          const imapSnapshot = await getDocs(imapQ);
          if (!imapSnapshot.empty) {
            imapSnapshot.forEach(d => { imapCredData = d.data(); });
          } else {
            const allImap = await getDocs(collection(db, 'imap_credentials'));
            const matched = allImap.docs.find(d => {
              const dt = d.data();
              const em = (dt.imap_email || dt.imap_user || dt.email || '').toLowerCase().trim();
              return em === targetEmail;
            });
            if (matched) imapCredData = matched.data();
          }
        } catch (e) {
          console.warn("IMAP credentials query error:", e);
        }

        if (imapCredData && imapCredData.imap_password) {
          try {
            const res = await fetch(`${proxyServerUrl}/imap/fetch`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                host: imapCredData.imap_host || (targetEmail.includes('zoho') ? 'imap.zoho.in' : 'imap.gmail.com'),
                port: imapCredData.imap_port || 993,
                user: imapCredData.imap_user || targetEmail,
                pass: imapCredData.imap_password,
                secure: imapCredData.imap_secure !== false,
                folders: ['Newsletter', 'INBOX', 'Notification', 'Spam'],
                limit: 25
              })
            });

            if (res && res.ok) {
              const resData = await res.json();
              const messagesList = resData.data || [];

              if (messagesList.length > 0) {
                // Prioritize Garena emails (e.g. from account@garena.com)
                const garenaEmails = messagesList.filter(msgItem => {
                  const fromVal = (msgItem.sender || '').toLowerCase();
                  const subjectVal = (msgItem.subject || '').toLowerCase();
                  const summaryVal = (msgItem.summary || '').toLowerCase();
                  const fullScope = `${fromVal} ${subjectVal} ${summaryVal}`;
                  return fullScope.includes('garena') || 
                         fullScope.includes('account@garena') ||
                         fullScope.includes('free fire') ||
                         fullScope.includes('verification') || 
                         fullScope.includes('security') || 
                         fullScope.includes('otp') || 
                         fullScope.includes('code');
                });

                const targetList = garenaEmails.length > 0 ? garenaEmails : messagesList;
                targetList.sort((a, b) => Number(b.sentTime || 0) - Number(a.sentTime || 0));

                const resolved = targetList.slice(0, 5).map((msgItem) => ({
                  id: msgItem.messageId || String(msgItem.sentTime),
                  snippet: msgItem.summary || '',
                  subject: msgItem.subject || '(No Subject)',
                  from: msgItem.sender || 'Unknown Sender',
                  date: msgItem.sentTime ? new Date(msgItem.sentTime).toString() : 'Unknown Date',
                  accountId: imapCredData.imap_email || targetEmail,
                  provider: 'imap',
                  body: msgItem.body || msgItem.summary || ''
                }));

                if (resolved.length > 0) {
                  setEmails(resolved);
                  if (currentUser?.uid) {
                    try {
                      localStorage.setItem(`mailbox_cache_${currentUser.uid}`, JSON.stringify(resolved));
                    } catch (cErr) { console.warn('Cache save error:', cErr); }
                  }
                  return resolved;
                }
              }
            }
          } catch (imapErr) {
            console.warn("Tier 1 IMAP fetch attempt failed:", imapErr);
          }
        }

        // ---------------------------------------------------------------------
        // TIER 2: Check zoho_credentials via Zoho REST OAuth API
        // ---------------------------------------------------------------------
        let zohoCredData = null;
        try {
          const zohoQ = query(
            collection(db, 'zoho_credentials'),
            where('zoho_email', '==', targetEmail)
          );
          const zohoSnapshot = await getDocs(zohoQ);
          if (!zohoSnapshot.empty) {
            zohoSnapshot.forEach(d => { zohoCredData = d.data(); });
          } else {
            const allZoho = await getDocs(collection(db, 'zoho_credentials'));
            const matched = allZoho.docs.find(d => {
              const dt = d.data();
              const em = (dt.zoho_email || dt.email || '').toLowerCase().trim();
              return em === targetEmail;
            });
            if (matched) zohoCredData = matched.data();
          }
        } catch (e) {
          console.warn("Zoho credentials query error:", e);
        }

        if (zohoCredData && zohoCredData.zoho_refresh_token) {
          try {
            const accessToken = await getFreshZohoAccessToken(zohoCredData);

            const fetchPromises = [
              executeZohoRequest(`/api/accounts/${zohoCredData.zoho_account_id}/messages/search?searchKey=garena&limit=25`, 'GET', accessToken).catch(() => ({ data: [] })),
              executeZohoRequest(`/api/accounts/${zohoCredData.zoho_account_id}/messages/search?searchKey=account@garena.com&limit=25`, 'GET', accessToken).catch(() => ({ data: [] }))
            ];

            try {
              const foldersData = await executeZohoRequest(`/api/accounts/${zohoCredData.zoho_account_id}/folders`, 'GET', accessToken);
              const folderList = foldersData.data || [];
              const newsletterFolder = folderList.find(f => f.folderName.toLowerCase() === 'newsletter');
              const inboxFolder = folderList.find(f => f.folderName.toLowerCase() === 'inbox');
              if (newsletterFolder) {
                fetchPromises.push(executeZohoRequest(`/api/accounts/${zohoCredData.zoho_account_id}/messages/view?folderId=${newsletterFolder.folderId}&limit=25`, 'GET', accessToken).catch(() => ({ data: [] })));
              }
              if (inboxFolder) {
                fetchPromises.push(executeZohoRequest(`/api/accounts/${zohoCredData.zoho_account_id}/messages/view?folderId=${inboxFolder.folderId}&limit=25`, 'GET', accessToken).catch(() => ({ data: [] })));
              }
            } catch (fErr) {
              console.warn("Zoho folders list error:", fErr);
            }

            const responses = await Promise.all(fetchPromises);
            let combinedMessages = [];
            const seenIds = new Set();
            responses.forEach(res => {
              if (res && res.data && Array.isArray(res.data)) {
                res.data.forEach(m => {
                  if (m && m.messageId && !seenIds.has(m.messageId)) {
                    seenIds.add(m.messageId);
                    combinedMessages.push(m);
                  }
                });
              }
            });

            if (combinedMessages.length > 0) {
              const garenaFilter = combinedMessages.filter(msgItem => {
                const fromVal = (msgItem.sender || '').toLowerCase();
                const subjectVal = (msgItem.subject || '').toLowerCase();
                const summaryVal = (msgItem.summary || '').toLowerCase();
                const fullScope = `${fromVal} ${subjectVal} ${summaryVal}`;
                return fullScope.includes('garena') || 
                       fullScope.includes('account@garena') ||
                       fullScope.includes('free fire') ||
                       fullScope.includes('verification') || 
                       fullScope.includes('security') || 
                       fullScope.includes('otp') || 
                       fullScope.includes('code');
              });

              let targetList = garenaFilter.length > 0 ? garenaFilter : combinedMessages;
              targetList.sort((a, b) => Number(b.sentTime || 0) - Number(a.sentTime || 0));

              const resolved = await Promise.all(
                targetList.slice(0, 5).map(async (msgItem) => {
                  let contentBody = '';
                  try {
                    const contentData = await executeZohoRequest(
                      `/api/accounts/${zohoCredData.zoho_account_id}/folders/${msgItem.folderId}/messages/${msgItem.messageId}/content`, 
                      'GET', 
                      accessToken
                    );
                    contentBody = contentData.data?.content || '';
                  } catch (err) {
                    console.error("Zoho body load failed:", err);
                  }
                  return {
                    id: msgItem.messageId,
                    snippet: msgItem.summary || '',
                    subject: msgItem.subject || '(No Subject)',
                    from: msgItem.sender || 'Unknown Sender',
                    date: msgItem.sentTime ? new Date(Number(msgItem.sentTime)).toString() : 'Unknown Date',
                    accountId: zohoCredData.zoho_account_id,
                    folderId: msgItem.folderId,
                    provider: 'zoho',
                    body: contentBody
                  };
                })
              );

              if (resolved.length > 0) {
                setEmails(resolved);
                if (currentUser?.uid) {
                  try {
                    localStorage.setItem(`mailbox_cache_${currentUser.uid}`, JSON.stringify(resolved));
                  } catch (cErr) { console.warn('Cache save error:', cErr); }
                }
                return resolved;
              }
            }
          } catch (zohoErr) {
            console.warn("Tier 2 Zoho REST fetch failed:", zohoErr);
          }
        }

        // ---------------------------------------------------------------------
        // TIER 3: Direct fallback to server /api/otp/garena
        // ---------------------------------------------------------------------
        const isLocalHost = window.location.hostname === 'localhost' || 
                            window.location.hostname === '127.0.0.1' || 
                            window.location.port !== '';
        const otpProxyCandidates = [
          proxyServerUrl,
          'https://imap-proxy-server.vercel.app',
          'https://hispanic-florists-cook-llp.trycloudflare.com',
          'https://ffstore-imap-proxy.loca.lt',
          isLocalHost ? 'http://127.0.0.1:8080' : null
        ].filter(Boolean);

        for (const candidateBase of otpProxyCandidates) {
          try {
            const otpApiRes = await fetch(`${candidateBase}/api/otp/garena?email=${encodeURIComponent(targetEmail)}`, {
              headers: { 
                'x-api-key': 'garena_sec_9988_a7f92b4c81d3',
                ...(candidateBase.includes('loca.lt') ? { 'Bypass-Tunnel-Reminder': 'true' } : {})
              }
            });
            const ct = otpApiRes.headers.get('content-type') || '';
            if (otpApiRes.ok && ct.includes('application/json')) {
              const otpData = await otpApiRes.json();
              if (otpData.success && (otpData.otp || otpData.code)) {
                const codeVal = otpData.otp || otpData.code;
                const fallbackEmailObj = [{
                  id: 'garena_otp_' + Date.now(),
                  snippet: `Official Garena Verification Code: ${codeVal}`,
                  subject: otpData.subject || 'Verification Code for Your Free Fire Max Account',
                  from: otpData.sender || 'account@garena.com',
                  date: otpData.receivedAt ? new Date(otpData.receivedAt).toString() : new Date().toString(),
                  provider: 'api',
                  body: `<div style="padding:24px; font-family:sans-serif; text-align:center; background:#ffffff; color:#111827;">
                    <h3 style="margin:0 0 12px 0; color:#e11d48; font-size:20px;">Garena Free Fire Verification</h3>
                    <p style="font-size:14px; color:#4b5563; margin-bottom:16px;">You requested a verification code for your account. Please enter this code:</p>
                    <div style="display:inline-block; padding:12px 28px; background:#f0fdf4; border:2px solid #22c55e; border-radius:12px; font-size:32px; font-weight:900; letter-spacing:4px; color:#15803d; font-family:monospace;">
                      ${codeVal}
                    </div>
                    <p style="font-size:12px; color:#9ca3af; margin-top:20px;">For account security, do not share this code with anyone.</p>
                  </div>`
                }];
                setEmails(fallbackEmailObj);
                return fallbackEmailObj;
              }
            }
          } catch (apiErr) {
            console.warn(`Tier 3 /api/otp/garena fallback error on ${candidateBase}:`, apiErr);
          }
        }

        throw new Error("No recent Garena emails found in recovery mailbox. Please make sure you triggered 'Send OTP' in Garena.");
      }
    } catch (err) {
      console.error("Client fetch linked emails error:", err);
      setErrorEmails(err.message || "Failed to load verification mailbox.");
    } finally {
      setLoadingEmails(false);
    }
  }, [linkedEmail, data.linkedGmail, data.linkedZoho, data.linkedImap, data.mailboxDisabled]);


  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Select countdown widget classes
  const getCountdownStyles = () => {
    if (isExpired) {
      return {
        bg: 'bg-rose-50 dark:bg-rose-950/20 border-rose-250 dark:border-rose-900/60',
        text: 'text-rose-800 dark:text-rose-400',
        label: 'Expired',
        value: '0 Days'
      };
    }
    if (isWarning) {
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60',
        text: 'text-amber-800 dark:text-amber-400',
        label: 'Expiring Soon',
        value: `${daysRemaining} Days`
      };
    }
    return {
      bg: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-250 dark:border-emerald-900/60',
      text: 'text-emerald-800 dark:text-emerald-400',
      label: 'Days Remaining',
      value: `${daysRemaining} Days`
    };
  };

  const countdownStyles = getCountdownStyles();

  const isSecurityLocked = (
    userDoc?.status === 'ContactSeller' || 
    userDoc?.status === 'Suspended' || 
    clientData?.status === 'ContactSeller' || 
    clientData?.status === 'Suspended'
  );

  if (isSecurityLocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black flex items-center justify-center p-4 sm:p-6 text-white font-sans select-none relative overflow-hidden">
        {/* Glowing Background Auras */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-rose-600/15 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-amber-600/10 rounded-full blur-[140px] pointer-events-none" />

        <div className="relative z-10 max-w-lg w-full bg-gray-900/90 border-2 border-rose-500/40 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(244,63,94,0.25)] text-center space-y-6 animate-scale-up">
          
          {/* Animated Lock Shield Badge */}
          <div className="relative mx-auto w-20 h-20">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-rose-600 via-red-500 to-amber-500 flex items-center justify-center text-white shadow-2xl shadow-rose-500/40 border border-rose-400/50 animate-bounce-subtle">
              <ShieldAlert className="w-10 h-10 stroke-[2.5]" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-5 w-5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-5 w-5 bg-rose-500 border-2 border-gray-900 text-[10px] font-black text-white items-center justify-center">!</span>
            </span>
          </div>

          {/* Headline & Reason */}
          <div className="space-y-2">
            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-500/20 text-rose-300 border border-rose-500/40">
              🚨 SECURITY HOLD: CONTACT TO SELLER IMMEDIATELY
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
              Contact To Seller Immediately
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-gray-300 leading-relaxed max-w-md mx-auto">
              Your account access has been placed on security hold. Please connect with the official seller desk immediately to verify and unlock your account.
            </p>
          </div>

          {/* Incident Dossier Card */}
          <div className="bg-gray-950/80 border border-gray-800 rounded-2xl p-4 text-left space-y-2 font-mono text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-gray-800 text-[11px] font-sans">
              <span className="text-gray-400 font-bold uppercase tracking-wider">Reference Case ID</span>
              <span className="text-rose-400 font-black">CASE-{(currentUser.uid || '8921').substring(0, 8).toUpperCase()}-SEC</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div>
                <span className="text-gray-500 text-[10px] uppercase font-bold block">Account Holder</span>
                <span className="text-gray-200 font-bold">{userDoc?.name || currentUser.displayName || 'Client'}</span>
              </div>
              <div>
                <span className="text-gray-500 text-[10px] uppercase font-bold block">Mobile / ID</span>
                <span className="text-gray-200 font-bold">{userDoc?.mobile || userDoc?.usedLicenseKey || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500 text-[10px] uppercase font-bold block">Client Email</span>
                <span className="text-gray-200 font-bold truncate block">{currentUser.email}</span>
              </div>
              <div>
                <span className="text-gray-500 text-[10px] uppercase font-bold block">Action Status</span>
                <span className="text-amber-400 font-black">Resolution Required</span>
              </div>
            </div>

            {/* Pinned Dispute Flag (If Admin Pinned Incident) */}
            {(userDoc?.disputeInfo?.isPinned || clientData?.disputeInfo?.isPinned) && (
              <div className="mt-2 pt-2 border-t border-rose-500/30 bg-rose-950/40 p-2.5 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-rose-400 flex items-center gap-1">
                    <span>📌 Incident Report Flag</span>
                  </span>
                  {(userDoc?.disputeInfo?.disputeAmount || clientData?.disputeInfo?.disputeAmount) && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-black font-mono">
                      Claim: ₹{userDoc?.disputeInfo?.disputeAmount || clientData?.disputeInfo?.disputeAmount}
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-semibold text-gray-200 leading-snug">
                  "{userDoc?.disputeInfo?.reportReason || clientData?.disputeInfo?.reportReason || 'Active dispute or chargeback complaint lodged against this transaction.'}"
                </p>
                <span className="text-[9px] text-gray-400 block font-mono">
                  Filed: {new Date(userDoc?.disputeInfo?.reportedAt || clientData?.disputeInfo?.reportedAt || Date.now()).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
          </div>

          {/* Action Resolution Buttons */}
          <div className="space-y-3 pt-1">
            <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">
              ⚡ Choose a channel to resolve & unlock:
            </p>

            {/* Telegram Contact Button */}
            <a
              href="https://t.me/alexccseller"
              target="_blank"
              rel="noreferrer"
              className="w-full py-3.5 px-5 bg-sky-500 hover:bg-sky-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>✈️ Contact Seller On Telegram</span>
            </a>

            {/* WhatsApp Contact Button */}
            <a
              href="https://wa.me/"
              target="_blank"
              rel="noreferrer"
              className="w-full py-3.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>💬 Contact Seller On WhatsApp</span>
            </a>
          </div>

          {/* Live Chat & Sign Out Footers */}
          <div className="pt-2 flex items-center justify-center gap-4 text-xs font-bold text-gray-400">
            <button
              onClick={() => window.location.reload()}
              className="hover:text-white transition-colors cursor-pointer"
            >
              🔄 Refresh Status
            </button>
            <span>•</span>
            <button
              onClick={async () => {
                await auth.signOut();
                window.location.href = '/login';
              }}
              className="text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
            >
              🚪 Sign Out
            </button>
          </div>
        </div>

        {/* Real-time Support Chat Widget is available right on this locked screen */}
        <SupportChatWidget />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
      {/* Mandatory Terms Acceptance Overlay */}
      {showTermsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none animate-fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl shadow-2xl p-6 md:p-8 space-y-6 text-gray-800 dark:text-gray-250 animate-scale-up text-left">
            <div className="flex items-center gap-3 text-indigo-650 dark:text-indigo-400 border-b border-gray-100 dark:border-gray-850 pb-4">
              <ShieldAlert className="w-6 h-6 text-indigo-650 shrink-0" />
              <h3 className="text-lg font-black tracking-tight text-gray-950 dark:text-white uppercase">
                Service Verification
              </h3>
            </div>
            
            <div className="font-sans text-xs leading-relaxed text-left max-h-72 overflow-y-auto pr-1.5 border-b border-gray-100 dark:border-gray-800 pb-4 space-y-3 text-gray-600 dark:text-gray-300">
              <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 font-semibold text-indigo-900 dark:text-indigo-200 text-xs">
                <p className="font-extrabold text-indigo-700 dark:text-indigo-400 mb-1">
                  💡 Important Pre-Checkout &amp; Service Agreement
                </p>
                <p>
                  By accessing or initiating transactions, you agree to our Service Terms. All rented credentials (e.g. Free Fire IDs) are provided for temporary access during specified lease hours.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
                <span className="font-extrabold uppercase">Pricing &amp; Operational Fee Disclosure:</span> Every transaction includes an integrated operational platform commission of ₹500 to ₹2000 (depending on account tier) covering credential verification, security stream monitoring, and system uptime.
              </div>

              <div className="space-y-1.5 text-[11px]">
                <p><strong>1. Digital Goods Non-Refundable Policy:</strong> Delivery of digital OTP tokens or login details completes performance immediately. Payments are non-refundable.</p>
                <p><strong>2. Account Security &amp; Binding:</strong> Users must adhere to publisher security guidelines. Password modifications, security tampering, or unauthorized multi-IP logins during the 15-day binding window are strictly restricted.</p>
                <p><strong>3. Support &amp; Grievances:</strong> For inquiries or assistance, reach out via portal chat or Grievance Officer: <span className="font-bold text-indigo-600 dark:text-indigo-400">Coming Soon (support@domain.com)</span>.</p>
              </div>

              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                To review full terms, policies, and operational rules, please read the public 
                <a href="/terms-and-conditions" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 font-bold underline ml-1 hover:text-indigo-700">
                  Terms &amp; Conditions page
                </a>.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input 
                  type="checkbox"
                  checked={termsCheckbox}
                  onChange={(e) => setTermsCheckbox(e.target.checked)}
                  disabled={termsLoading}
                  className="mt-1 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer"
                />
                <span className="text-xs font-bold text-gray-755 dark:text-gray-300 leading-tight">
                  I have read and agree to all Terms &amp; Conditions
                </span>
              </label>

              <button
                type="button"
                onClick={handleAcceptTerms}
                disabled={!termsCheckbox || termsLoading}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl shadow-lg shadow-indigo-650/20 hover:shadow-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
              >
                {termsLoading && <Loader className="w-4 h-4 animate-spin" />}
                <span>Continue</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collapsible Sidebar */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Primary Content View */}
      <div className="flex-1 lg:pl-72 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} title="My Dashboard" />

        {isImpersonating && (
          <div className="bg-amber-500 text-white px-6 py-3 font-bold text-xs uppercase flex items-center justify-between shadow-md z-30 shrink-0">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4.5 h-4.5 text-white animate-pulse" />
              <span>You are currently viewing this dashboard as client: <strong className="underline">{clientData?.name}</strong> (UID: {clientData?.uid})</span>
            </div>
            <button
              onClick={() => {
                stopImpersonating();
                navigate('/admin/premium-dashboard');
              }}
              className="bg-white text-amber-700 px-3 py-1.5 rounded-lg font-black hover:bg-amber-50 transition-colors uppercase cursor-pointer"
            >
              Stop Impersonation
            </button>
          </div>
        )}

        <main className="flex-1 p-6 lg:p-8 space-y-8 overflow-y-auto">
          {/* T&C Compliance Badge & Rules Trigger Drawer Button */}
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full">
            {clientData?.termsAccepted && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-400 text-xs font-bold w-full sm:w-fit animate-fade-in shrink-0">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>You have accepted the Terms & Conditions</span>
              </div>
            )}
            <button
              onClick={() => setRulesDrawerOpen(true)}
              className="flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-xs font-black cursor-pointer transition-all shadow-md shadow-indigo-650/20 active:scale-98 w-full sm:w-auto uppercase tracking-wide"
            >
              <FileText className="w-4 h-4 text-indigo-200" />
              <span>📜 View Official Rules & Terms</span>
            </button>
          </div>

          {/* Alarm Banner if Expired or Warn */}
          {isExpired && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-3.5 animate-fade-in">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-rose-800 dark:text-rose-400 text-sm">License Expired</h4>
                <p className="text-xs text-rose-600 dark:text-rose-450 mt-1 font-semibold">
                  Your subscription access is currently inactive. Please reach out to the administration to renew your services.
                </p>
              </div>
            </div>
          )}

          {isWarning && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-3.5 animate-fade-in">
              <AlertTriangle className="w-5 h-5 text-amber-550 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-amber-800 dark:text-amber-400 text-sm">Action Required: Expiring Soon</h4>
                <p className="text-xs text-amber-600 dark:text-amber-450 mt-1 font-semibold">
                  Your product license expires in less than 7 days. Coordinate with the admin to prevent any service interruptions.
                </p>
              </div>
            </div>
          )}

          {/* Core Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

            {/* Paid Card */}
            <div className="p-6 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-bold text-gray-555 dark:text-gray-400 uppercase tracking-wider block">
                  Amount Paid
                </span>
                <span className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  ₹{Number(data.amountPaid || 0).toFixed(2)}
                </span>
              </div>
              <CreditCard className="w-10 h-10 text-emerald-550 dark:text-emerald-400" />
            </div>

            {/* Balance Card */}
            <div className="p-6 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-bold text-gray-555 dark:text-gray-400 uppercase tracking-wider block">
                  Remaining Balance
                </span>
                <span className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  ₹{Number(data.remainingBalance || 0).toFixed(2)}
                </span>
              </div>
              <DollarSign className="w-10 h-10 text-indigo-650 dark:text-indigo-400" />
            </div>

            {/* Commission Due Card */}
            <div className="p-6 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-bold text-gray-555 dark:text-gray-400 uppercase tracking-wider block">
                  Commission Due
                </span>
                <span className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  ₹{Number(data.commission || 0).toFixed(2)}
                </span>
              </div>
              <DollarSign className="w-10 h-10 text-amber-550 dark:text-amber-400" />
            </div>

            {/* Commission Paid Card */}
            <div className="p-6 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-bold text-gray-555 dark:text-gray-400 uppercase tracking-wider block">
                  Commission Paid
                </span>
                <span className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  ₹{Number(data.commissionPaid || 0).toFixed(2)}
                </span>
              </div>
              <DollarSign className="w-10 h-10 text-emerald-550 dark:text-emerald-400" />
            </div>
          </div>

          <div className="flex flex-col xl:grid xl:grid-cols-3 gap-8 items-start">
            {/* 1. Help & Video Tutorials Card (order-1 on mobile, 1 col span on desktop) */}
            <div className="w-full xl:col-span-1 order-1 xl:order-none bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-855 pb-3">
                <Video className="w-5 h-5 text-indigo-655 dark:text-indigo-400 shrink-0" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Help & Setup Tutorials</h3>
              </div>

              <div className="space-y-6">
                {/* Tutorial 1: How to Create a New Gmail */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-gray-900 dark:text-white leading-normal flex items-center justify-between">
                    <span>How to Create a New Gmail</span>
                    <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-250/30 dark:border-indigo-900/30 px-2 py-0.5 rounded-full uppercase tracking-wider scale-90">
                      Gmail Guide
                    </span>
                  </h4>
                  <a
                    href="https://youtu.be/bHc4ADHCxDY?si=wlpa0Fgi5QvAj1lH"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative block w-full aspect-video rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm transition-all hover:border-indigo-500/50 hover:shadow-lg"
                  >
                    <img 
                      src="https://img.youtube.com/vi/bHc4ADHCxDY/hqdefault.jpg" 
                      alt="Gmail Setup Tutorial" 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 flex items-center justify-center transition-all">
                      <div className="w-12 h-12 bg-white/90 dark:bg-gray-900/90 text-indigo-650 dark:text-indigo-400 rounded-full flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-all border border-white/20">
                        <Play className="w-6 h-6 fill-current translate-x-0.5" />
                      </div>
                    </div>
                  </a>
                </div>

                {/* Tutorial 2: How to Login & Get Access to ID */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-gray-900 dark:text-white leading-normal flex items-center justify-between">
                    <span>How to Login &amp; Get Access of ID</span>
                    <span className="text-[10px] font-extrabold text-rose-700 bg-rose-50 dark:bg-rose-955/40 border border-rose-250/30 dark:border-rose-900/30 px-2 py-0.5 rounded-full uppercase tracking-wider scale-90">
                      Login Guide
                    </span>
                  </h4>
                  <a
                    href="https://youtu.be/2zPeBePxqXI?si=UByMC8LcHpRyXd89"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative block w-full aspect-video rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm transition-all hover:border-rose-500/50 hover:shadow-lg"
                  >
                    <img 
                      src="https://img.youtube.com/vi/2zPeBePxqXI/hqdefault.jpg" 
                      alt="How to Login Tutorial" 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 flex items-center justify-center transition-all">
                      <div className="w-12 h-12 bg-white/90 dark:bg-gray-900/90 text-rose-655 dark:text-rose-455 rounded-full flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-all border border-white/20">
                        <Play className="w-6 h-6 fill-current translate-x-0.5" />
                      </div>
                    </div>
                  </a>
                </div>
              </div>
            </div>

            {/* 2. Garena Verification Mailbox Card (order-2 on mobile, 2 col span on desktop) */}
            <div className="w-full xl:col-span-2 order-2 xl:order-none bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-850 pb-3">
                <div className="flex items-center gap-2">
                  <Inbox className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Garena Verification Mailbox
                  </h3>
                </div>
                {!canRequestOtp && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 font-mono animate-pulse">
                    <Clock className="w-3.5 h-3.5" /> 48h Lock: {cooldownText || "Active"}
                  </span>
                )}
              </div>

              {linkedEmail && (
                <p className="text-xs font-semibold text-gray-555 dark:text-gray-400 bg-indigo-50/50 dark:bg-indigo-950/20 px-3.5 py-2 border border-indigo-150 dark:border-indigo-900/60 rounded-xl leading-normal animate-fade-in">
                  🔒 Your ID recovery email is: <span className="font-extrabold text-indigo-650 dark:text-indigo-400">{linkedEmail}</span>
                </p>
              )}

              {data.mailboxDisabled ? (
                <div className="p-5 bg-rose-50 dark:bg-rose-955/10 border border-rose-150 dark:border-rose-900/40 rounded-2xl flex items-start gap-3.5 animate-fade-in">
                  <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black text-rose-800 dark:text-rose-455 uppercase tracking-wide">OTP'S SYSTEM SUSPENDED</h4>
                    <p className="text-xs text-rose-600 dark:text-rose-455 mt-1 font-semibold leading-normal">
                      OTP access for your recovery mailbox has been temporarily disabled by the system administrator.
                    </p>
                    {data.mailboxDisabledReason && (
                      <p className="text-xs text-rose-750 dark:text-rose-400 mt-2.5 font-bold bg-rose-100/50 dark:bg-rose-955/20 p-2.5 rounded-xl border border-rose-200/40 dark:border-rose-900/30">
                        ⚠️ Cause: {data.mailboxDisabledReason}
                      </p>
                    )}
                  </div>
                </div>
              ) : isRefreshingOtp ? (
                /* Secure OTP Scanning State */
                <div className="py-10 flex flex-col items-center justify-center text-center space-y-6 animate-pulse">
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-4 border-indigo-650/20 border-t-indigo-600 animate-spin"></div>
                    <Inbox className="w-10 h-10 text-indigo-600 dark:text-indigo-400 animate-bounce" />
                  </div>
                  <div className="space-y-3 w-full max-w-xs mx-auto">
                    <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest">
                      Scanning Garena Streams ({Math.min(100, Math.round(refreshProgress))}%)
                    </h4>
                    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden border border-gray-205 dark:border-gray-700/80">
                      <div 
                        className="bg-indigo-600 h-full rounded-full transition-all duration-300" 
                        style={{ width: `${Math.min(100, Math.round(refreshProgress))}%` }}
                      ></div>
                    </div>
                    <p className="text-[10px] text-gray-455 dark:text-gray-500 font-mono italic">
                      {refreshProgress < 25 && "Establishing secure socket tunnel..."}
                      {refreshProgress >= 25 && refreshProgress < 60 && "Accessing mailbox sandbox..."}
                      {refreshProgress >= 60 && refreshProgress < 90 && "Filtering Garena incoming streams..."}
                      {refreshProgress >= 90 && "Decrypting security payload..."}
                    </p>
                  </div>
                </div>
              ) : showingScanResults && emails.length > 0 ? (
                /* Display 2-3 scanned emails */
                <div className="space-y-4 animate-fade-in">
                  <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/50 rounded-2xl flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">Scanned Emails (Last 3 Items)</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-wider">Temporarily Visible</span>
                  </div>
                  <div className="space-y-3">
                    {emails.slice(0, 3).map((email, idx) => {
                      const decodedBody = email.payload ? getEmailBodyText(email.payload) : (email.body || "");
                      const displaySnippet = cleanSnippet(email.snippet, decodedBody);
                      const detectedOtp = extractOTP(email.subject, decodedBody, email.snippet);
                      return (
                        <div key={email.id || idx} className="p-4 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-2xl space-y-3.5 shadow-sm text-left flex flex-col">
                          {/* Extracted OTP Highlight Badge */}
                          {detectedOtp && (
                            <div className="p-3 bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center justify-between gap-3 animate-fade-in">
                              <div>
                                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block">
                                  ⚡ Garena Verification Code
                                </span>
                                <span className="text-2xl font-black font-mono tracking-widest text-emerald-700 dark:text-emerald-300 select-all block">
                                  {detectedOtp}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(detectedOtp);
                                  showToast(`Copied OTP ${detectedOtp} to clipboard!`, "success");
                                }}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all shrink-0 cursor-pointer"
                              >
                                Copy OTP
                              </button>
                            </div>
                          )}

                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[10px] font-black text-gray-555 dark:text-gray-400 uppercase tracking-wider block">Sender</span>
                              <span className="text-xs font-bold text-gray-850 dark:text-gray-200 truncate block max-w-xs">{email.from}</span>
                            </div>
                            <span className="text-[9.5px] text-gray-400 dark:text-gray-500 font-bold">{email.date ? new Date(email.date).toLocaleTimeString() : ''}</span>
                          </div>
                          
                          <div className="pt-1.5 border-t border-gray-200/50 dark:border-gray-700/50">
                            <span className="text-[10px] font-black text-gray-555 dark:text-gray-400 uppercase tracking-wider block">Subject</span>
                            <span className="text-xs font-bold text-gray-900 dark:text-white block leading-relaxed">{email.subject}</span>
                          </div>

                          {/* Decoded Full Email HTML Body Rendering */}
                          <div className="pt-2 border-t border-gray-200/50 dark:border-gray-700/50 flex-1">
                            <span className="text-[10px] font-black text-gray-555 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Secure Message Body</span>
                            <div className="w-full h-80 bg-white rounded-xl overflow-hidden border border-gray-200 dark:border-gray-750/30 shadow-inner">
                              {decodedBody.includes('<html') || decodedBody.includes('<div') || decodedBody.includes('<table') ? (
                                <iframe
                                  title={`Secure client email frame ${email.id || idx}`}
                                  srcDoc={decodedBody}
                                  className="w-full h-full border-none bg-white"
                                  sandbox="allow-same-origin"
                                />
                              ) : (
                                <pre className="w-full h-full p-4 overflow-y-auto whitespace-pre-wrap font-sans text-xs text-gray-800 leading-relaxed font-semibold bg-white">
                                  {decodedBody || displaySnippet}
                                </pre>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowingScanResults(false);
                      setLatestOtpToShow(null);
                    }}
                    className="w-full py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Minimize Email View
                  </button>
                </div>
              ) : showingScanResults && emails.length === 0 ? (
                /* No emails found display */
                <div className="py-10 text-center flex flex-col items-center justify-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-955/20 flex items-center justify-center border border-amber-250 dark:border-amber-900/40 text-amber-600 dark:text-amber-400">
                    <ShieldAlert className="w-8 h-8" />
                  </div>
                  <div className="space-y-1.5 max-w-sm">
                    <h4 className="text-sm font-black text-amber-805 dark:text-amber-400 uppercase tracking-widest">No Emails Detected</h4>
                    <p className="text-xs text-gray-550 dark:text-gray-400 font-semibold leading-relaxed">
                      We scanned your Garena stream but couldn't find any recent verification emails. Ensure you triggered the OTP from the game before scanning.
                    </p>
                  </div>
                  <div className="w-full max-w-xs pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowingScanResults(false);
                        setEmails([]);
                        setLatestOtpToShow(null);
                        if (currentUser?.uid) {
                          localStorage.removeItem(`mailbox_cache_${currentUser.uid}`);
                        }
                      }}
                      className="w-full py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Close &amp; Lock Sandbox
                    </button>
                  </div>
                </div>
              ) : !canRequestOtp || ((data.otpUsed || (data.otpScanCount || 0) >= 1) && !data.extraScanGranted) ? (
                /* 48-Hour Locked Sandbox state (Unified TG + Web Console Sync) */
                <div className="py-10 text-center flex flex-col items-center justify-center space-y-4 animate-fade-in">
                  <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-955/20 flex items-center justify-center border border-amber-250 dark:border-amber-900/40 text-amber-600 dark:text-amber-400">
                    <ShieldAlert className="w-8 h-8" />
                  </div>
                  <div className="space-y-1.5 max-w-sm">
                    <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">🔒 1-Time OTP Scan Completed</h4>
                    <p className="text-xs text-gray-550 dark:text-gray-400 font-semibold leading-relaxed">
                      Your 1-time Garena OTP scan for this license key has been completed (via Telegram Bot or Web console). The recovery mailbox has been unlinked &amp; locked for security.
                    </p>
                    <div className="pt-2">
                      <span className="text-[10px] font-black text-gray-455 uppercase tracking-widest block mb-1">
                        Access returns in:
                      </span>
                      <span className="inline-block px-4 py-2 bg-amber-50/50 dark:bg-amber-955/10 border border-amber-200/50 dark:border-amber-900/35 rounded-xl font-mono text-xs font-black text-amber-700 dark:text-amber-400">
                        {cooldownText || "1/1 Scan Used (Completed)"}
                      </span>
                    </div>

                    {emails.length > 0 && (
                      <div className="pt-3">
                        <button
                          type="button"
                          onClick={() => setShowingScanResults(true)}
                          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center gap-2"
                        >
                          <Mail className="w-4 h-4" />
                          <span>Show Scanned Garena Email</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : !linkedEmail ? (
                <div className="py-6 text-center space-y-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">No Linked Verification Mailbox</p>
                  <p className="text-xs text-gray-455 dark:text-gray-500 leading-normal max-w-md mx-auto">
                    Please contact your system administrator to assign a secure auditor mailbox to your profile.
                  </p>
                </div>
              ) : (
                /* Ready to Scan State */
                <div className="py-10 text-center flex flex-col items-center justify-center space-y-5">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50 text-indigo-650 dark:text-indigo-400 shadow-inner">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <div className="space-y-1.5 max-w-sm">
                    <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">Garena Verification Scanner</h4>
                    {userDoc?.extraScanGranted === true && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-955/25 border border-amber-250 dark:border-amber-900/60 rounded-xl text-[11px] font-bold text-amber-800 dark:text-amber-300 leading-normal animate-fade-in flex items-center justify-center gap-2">
                        <Zap className="w-4 h-4 text-amber-550 dark:text-amber-400 shrink-0 animate-bounce" />
                        <span>⚡ Administrator has granted you 1 extra scan! Cooldown is bypassed.</span>
                      </div>
                    )}
                    <p className="text-xs text-gray-550 dark:text-gray-455 font-semibold leading-relaxed">
                      Click the button below to scan your assigned recovery mailbox for the latest Garena verification code.
                    </p>
                    <p className="text-[10px] text-rose-500 font-bold">
                      ⚠️ Note: You can only perform this scan once every 48 hours. Ensure you have triggered the OTP from the game before scanning.
                    </p>
                  </div>
                  <button
                    onClick={handleStartOtpScan}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-650/20 hover:shadow-xl transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4 animate-spin-slow" />
                    <span>Request Latest OTP Code (Scan Mailbox)</span>
                  </button>
                </div>
              )}
            </div>

            {/* 3. Game Binding Status Card (order-3 on mobile, 2 col span on desktop) */}
            <div className="w-full xl:col-span-2 order-3 xl:order-none bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6 animate-fade-in">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-855 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-650 dark:text-indigo-400" />
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Game Binding Status
                  </h3>
                </div>
                {data.bindingStatus === 'pending' && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400">
                    Binding in Progress
                  </span>
                )}
                {data.bindingStatus === 'completed' && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400">
                    Fully Bound
                  </span>
                )}
                {(!data.bindingStatus || data.bindingStatus === 'none') && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-855 text-gray-550 dark:text-gray-400">
                    No Active Binding
                  </span>
                )}
              </div>

              {data.bindingStatus === 'pending' && bindingTimeLeft && (
                <div className="space-y-6">
                  {/* Countdown Ticker */}
                  <div className="grid grid-cols-4 gap-2.5 max-w-md mx-auto text-center">
                    <div className="bg-gray-50 dark:bg-gray-855/50 border border-gray-150 dark:border-gray-800/80 p-3 rounded-2xl">
                      <span className="block text-2xl font-black text-indigo-650 dark:text-indigo-400">{String(bindingTimeLeft.days).padStart(2, '0')}</span>
                      <span className="text-[10px] font-bold text-gray-455 dark:text-gray-500 uppercase tracking-wider">Days</span>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-855/50 border border-gray-150 dark:border-gray-800/80 p-3 rounded-2xl">
                      <span className="block text-2xl font-black text-indigo-650 dark:text-indigo-400">{String(bindingTimeLeft.hours).padStart(2, '0')}</span>
                      <span className="text-[10px] font-bold text-gray-455 dark:text-gray-500 uppercase tracking-wider">Hours</span>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-855/50 border border-gray-150 dark:border-gray-800/80 p-3 rounded-2xl">
                      <span className="block text-2xl font-black text-indigo-650 dark:text-indigo-400">{String(bindingTimeLeft.minutes).padStart(2, '0')}</span>
                      <span className="text-[10px] font-bold text-gray-455 dark:text-gray-500 uppercase tracking-wider">Mins</span>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-855/50 border border-gray-150 dark:border-gray-800/80 p-3 rounded-2xl">
                      <span className="block text-2xl font-black text-rose-500 dark:text-rose-400 animate-pulse">{String(bindingTimeLeft.seconds).padStart(2, '0')}</span>
                      <span className="text-[10px] font-bold text-gray-455 dark:text-gray-500 uppercase tracking-wider">Secs</span>
                    </div>
                  </div>

                  {/* Binding Email Display */}
                  {data.bindingEmail && (
                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-50/50 dark:bg-gray-855/40 py-2 px-4 rounded-xl border border-gray-150 dark:border-gray-800/80 w-fit mx-auto mt-2">
                      <Mail className="w-4 h-4 text-indigo-650 dark:text-indigo-400 shrink-0" />
                      <span>Binding Email: <span className="font-extrabold text-indigo-700 dark:text-indigo-400">{data.bindingEmail}</span></span>
                    </div>
                  )}

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-gray-555 dark:text-gray-400">
                      <span>Binding Progress</span>
                      <span>{Math.round(bindingPercent)}%</span>
                    </div>
                    <div className="h-3 w-full bg-gray-100 dark:bg-gray-850 rounded-full overflow-hidden border border-gray-200/50 dark:border-gray-700/50 p-[2px]">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-400 via-indigo-500 to-indigo-600 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${bindingPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-555 font-bold uppercase tracking-wider">
                      <span>Day 0</span>
                      <span>Day 15 (Fully Bound)</span>
                    </div>
                  </div>

                  <p className="text-xs text-center text-gray-550 dark:text-gray-400 font-semibold leading-relaxed max-w-lg mx-auto bg-gray-50 dark:bg-gray-855/30 p-3.5 border border-gray-150 dark:border-gray-800/60 rounded-xl">
                    💡 <strong>Note:</strong> Garena's official recovery email binding takes exactly 15 days to propagate. Please avoid making other recovery requests during this period to prevent timer reset.
                  </p>
                </div>
              )}

              {data.bindingStatus === 'completed' && (
                <div className="py-6 text-center space-y-4 animate-fade-in">
                  <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-450 rounded-full flex items-center justify-center mx-auto border border-emerald-150 dark:border-emerald-900/60 shadow-inner">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-extrabold text-gray-900 dark:text-white text-base">Binding Completed Successfully!</h4>
                    <p className="text-xs text-gray-555 dark:text-gray-400 leading-normal max-w-md mx-auto">
                      Your game account recovery email is now fully bound. You have full access and security lock features enabled.
                    </p>
                    {data.bindingEmail && (
                      <div className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-450 bg-emerald-50/50 dark:bg-emerald-950/20 py-1.5 px-4 rounded-xl border border-emerald-100 dark:border-emerald-900/40 w-fit mx-auto mt-2">
                        <Mail className="w-4 h-4 shrink-0" />
                        <span>Bound Email: <span className="font-extrabold">{data.bindingEmail}</span></span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(!data.bindingStatus || data.bindingStatus === 'none') && (
                <div className="py-8 text-center space-y-2 text-gray-450 dark:text-gray-500 animate-fade-in">
                  <Clock className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-700" />
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">No Binding Process Active</p>
                  <p className="text-xs text-gray-455 dark:text-gray-500 max-w-sm mx-auto leading-normal">
                    The game account recovery email binding has not been started yet. Contact the administration if you believe this is an error.
                  </p>
                </div>
              )}
            </div>

            {/* 4. Security Compliance Card (order-4 on mobile, 1 col span on desktop) */}
            <div className="w-full xl:col-span-1 order-4 xl:order-none bg-white dark:bg-gray-900 border border-rose-105 dark:border-rose-955/20 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-850 pb-3 text-rose-600 dark:text-rose-455">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Security Compliance</h3>
              </div>
              <p className="text-xs text-gray-450 dark:text-gray-400 font-medium leading-relaxed">
                Automated threat compliance monitors client sessions. Click below to simulate a security trigger event (unauthorized logins check).
              </p>
              <button
                onClick={async () => {
                  if (window.confirm("Simulate automated security rule trigger? This will update your profile state in Firestore and auto-expire the active session.")) {
                    try {
                      await suspendOwnAccount(
                        data.uid, 
                        "Suspicious activity detected (System Auto-Triggered)", 
                        "Our system flagged multiple concurrent active sessions from different geo-locations. The license has been automatically expired for credentials sharing prevention."
                      );
                    } catch (err) {
                      console.error(err);
                      alert("Simulation trigger failed. Please check Firestore security rules update permission.");
                    }
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-rose-50 dark:bg-rose-955/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-455 hover:text-rose-800 dark:hover:text-rose-350 text-xs font-bold rounded-xl transition-all"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Trigger Auto-Suspension</span>
              </button>
            </div>

            {/* 5. Admin Announcements Card (order-5 on mobile, 1 col span on desktop) */}
            <div className="w-full xl:col-span-1 order-5 xl:order-none bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-850 pb-3">
                <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Admin Announcements</h3>
              </div>
              
              {data.notes ? (
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                  {data.notes}
                </p>
              ) : (
                <div className="text-center py-8 text-gray-400 dark:text-gray-555 text-sm font-semibold">
                  No notifications from the administrator at this time.
                </div>
              )}
            </div>

            {/* 6. Code of Conduct & Support Rules Card (order-6 on mobile, 1 col span on desktop) */}
            <div className="w-full xl:col-span-1 order-6 xl:order-none bg-white dark:bg-gray-900 border-2 border-amber-500/30 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-850 pb-3 text-amber-600 dark:text-amber-455">
                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">Code of Conduct / नियम</h3>
              </div>
              <div className="space-y-3.5 text-xs text-gray-600 dark:text-gray-350 leading-relaxed font-semibold">
                
                {/* Rule 1 */}
                <div className="space-y-0.5">
                  <p className="text-indigo-650 dark:text-indigo-400 font-extrabold uppercase text-[10px]">
                    English: Patience & Support Window
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    If any specific process time has been communicated by the seller, you must wait patiently. Abusive behavior, spamming queries, or threat gestures will result in an <strong>immediate permanent suspension</strong> of services with <strong>no refund</strong>.
                  </p>
                </div>

                {/* Rule 1 (Hindi) */}
                <div className="space-y-0.5 border-t border-gray-100 dark:border-gray-850 pt-2">
                  <p className="text-amber-700 dark:text-amber-455 font-extrabold uppercase text-[10px]">
                    Hindi: धैर्य और सहायता नियम
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    यदि सेलर द्वारा किसी प्रक्रिया के लिए समय दिया गया है, तो कृपया धैर्यपूर्वक प्रतीक्षा करें। अभद्र व्यवहार करना, बार-बार स्पैम करना, या धमकी देना आपके लाइसेंस को <strong>बिना किसी रिफंड के तुरंत सस्पेंड</strong> कर देगा।
                  </p>
                </div>

                {/* Rule 2 */}
                <div className="space-y-0.5 border-t border-gray-100 dark:border-gray-850 pt-2 bg-rose-500/5 p-2 rounded-xl border border-rose-500/10 text-rose-800 dark:text-rose-400">
                  <div className="flex items-center gap-1.5 font-black uppercase text-[10px]">
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    <span>⚠️ Warning / चेतावनी</span>
                  </div>
                  <p className="text-[11px] leading-normal font-bold">
                    English: Clicking the "Trigger Auto-Suspension" button maliciously/accidentally will suspend your account instantly. No claims will be entertained.
                    <br />
                    Hindi: "Trigger Auto-Suspension" बटन को गलती से भी दबाने पर आपका अकाउंट तुरंत ब्लॉक हो जाएगा। इसके बाद कोई सुनवाई नहीं होगी।
                  </p>
                </div>

              </div>
            </div>
          </div>
        </main>
      </div>
      <SupportChatWidget />

      {/* Premium Full Garena Email & Verification Modal */}
      {latestOtpToShow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-gray-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 my-auto flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-150 dark:border-gray-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center font-bold">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider">
                    Official Garena Email
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold">
                    Complete verification email received from Garena
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLatestOtpToShow(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                title="Close viewer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* If OTP was detected: Big glowing green OTP display */}
            {scannedEmailDetails?.detectedCode && (
              <div className="p-4 bg-emerald-500/10 dark:bg-emerald-500/15 border-2 border-emerald-500/40 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in shrink-0">
                <div>
                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block">
                    ⚡ Garena Verification Code
                  </span>
                  <span className="text-3xl sm:text-4xl font-mono font-black tracking-widest text-emerald-700 dark:text-emerald-300 select-all block py-0.5">
                    {scannedEmailDetails.detectedCode}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    navigator.clipboard.writeText(scannedEmailDetails.detectedCode);
                    const btn = e.currentTarget;
                    const orig = btn.innerText;
                    btn.innerText = "Copied!";
                    setTimeout(() => { btn.innerText = orig; }, 2000);
                    showToast(`Copied OTP ${scannedEmailDetails.detectedCode}!`, "success");
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all shrink-0 cursor-pointer"
                >
                  Copy Verification Code
                </button>
              </div>
            )}

            {/* If NO OTP detected or email only: informative banner */}
            {(!scannedEmailDetails?.detectedCode && scannedEmailDetails) && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2 shrink-0">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Verification code not auto-detected. Please read the full official email body below to find your code or link.</span>
              </div>
            )}

            {/* Email Metadata Card: Sender, Subject, Date */}
            {scannedEmailDetails ? (
              <div className="p-3.5 bg-gray-50 dark:bg-gray-850/80 border border-gray-200/80 dark:border-gray-800 rounded-2xl space-y-1 text-left text-xs shrink-0">
                <div className="flex justify-between items-start gap-2">
                  <div className="truncate">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">From:</span>
                    <span className="ml-1.5 font-bold text-gray-900 dark:text-gray-100">{scannedEmailDetails.from}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono shrink-0 whitespace-nowrap">
                    {scannedEmailDetails.date ? new Date(scannedEmailDetails.date).toLocaleString() : ''}
                  </span>
                </div>
                <div className="truncate">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Subject:</span>
                  <span className="ml-1.5 font-bold text-gray-900 dark:text-white">{scannedEmailDetails.subject}</span>
                </div>
              </div>
            ) : latestOtpToShow === 'NO_OTP_FOUND' ? (
              <div className="p-6 bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl text-center space-y-2">
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300">No Emails Found in Mailbox</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  We checked your recovery mailbox ({linkedEmail}) but didn't find any recent incoming emails. Please confirm you clicked "Send OTP" in Garena.
                </p>
              </div>
            ) : null}

            {/* Full Decoded Email Body Rendering */}
            {scannedEmailDetails && (
              <div className="flex-1 min-h-[280px] max-h-[460px] w-full bg-white rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-750 shadow-inner flex flex-col">
                <div className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between text-[10px] font-bold text-gray-500">
                  <span>FULL EMAIL BODY</span>
                  <span>OFFICIAL GARENA CONTENT</span>
                </div>
                <div className="flex-1 w-full h-full min-h-0">
                  {scannedEmailDetails.body && (scannedEmailDetails.body.includes('<html') || scannedEmailDetails.body.includes('<div') || scannedEmailDetails.body.includes('<table') || scannedEmailDetails.body.includes('<p') || scannedEmailDetails.body.includes('<body')) ? (
                    <iframe
                      title="Garena Full Email Preview"
                      srcDoc={scannedEmailDetails.body}
                      className="w-full h-full min-h-[260px] border-none bg-white"
                      sandbox="allow-same-origin"
                    />
                  ) : (
                    <pre className="w-full h-full min-h-[260px] p-4 overflow-y-auto whitespace-pre-wrap font-sans text-xs text-gray-800 dark:text-gray-800 leading-relaxed font-semibold bg-white text-left">
                      {scannedEmailDetails.body || scannedEmailDetails.snippet || "No additional text content found in email."}
                    </pre>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="pt-2 flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setLatestOtpToShow(null)}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-800 dark:text-gray-200 font-bold text-xs rounded-xl uppercase tracking-wider transition-all cursor-pointer"
              >
                Close (Keep Email on Dashboard)
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Premium Instagram ID Prompt Modal (New and Old Users) */}
      {showInstaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in font-sans select-none">
          <div className="relative w-full max-w-md bg-gradient-to-b from-gray-900 via-gray-950 to-black border-2 border-pink-500/40 rounded-3xl p-6 sm:p-7 shadow-[0_0_50px_rgba(236,72,153,0.3)] space-y-5 overflow-hidden text-white">
            
            {/* Ambient Pink/Purple Glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-pink-600/30 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-600/30 rounded-full blur-3xl pointer-events-none" />

            {/* Modal Header */}
            <div className="relative z-10 flex flex-col items-center text-center space-y-3">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-pink-500/30 animate-bounce-subtle">
                  <Camera className="w-8 h-8" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-pink-500 border-2 border-black" />
                </span>
              </div>

              <div className="space-y-1">
                <span className="inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-pink-500/20 text-pink-300 border border-pink-400/30 shadow-inner">
                  ✨ PRIORITY ESCROW & VIP REWARDS
                </span>
                <h3 className="text-xl font-black uppercase tracking-tight text-white">
                  Enter Your Instagram ID
                </h3>
                <p className="text-xs font-semibold text-gray-300 max-w-xs mx-auto leading-relaxed">
                  Link your Instagram profile for instant support verification, proof deliveries, and exclusive VIP access.
                </p>
              </div>
            </div>

            {/* Input Form */}
            <form onSubmit={handleSaveInstagram} className="relative z-10 space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Instagram Username or Profile Link
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <span className="text-sm font-black bg-gradient-to-r from-amber-400 via-rose-500 to-purple-500 bg-clip-text text-transparent">📸</span>
                  </div>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Username ya profile link daalein (e.g. shivam_ff ya https://instagram.com/...)"
                    value={instaInput}
                    onChange={(e) => setInstaInput(e.target.value)}
                    className="w-full pl-9 pr-4 py-3 bg-gray-900/90 border border-pink-500/30 focus:border-pink-500 rounded-2xl text-xs font-bold text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500/30 tracking-wide"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  type="submit"
                  disabled={savingInsta || !instaInput.trim()}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-600 to-purple-600 hover:from-rose-600 hover:to-purple-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-pink-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {savingInsta ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 stroke-[3]" />
                  )}
                  <span>{savingInsta ? "Linking..." : "Save & Link Instagram"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSkipInstagram}
                  className="w-full py-2.5 text-[11px] font-black uppercase tracking-wider text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
                >
                  Maybe Later
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Slide-out Rules Drawer Panel */}
      {rulesDrawerOpen && (
        <>
          {/* Overlay backdrop */}
          <div 
            onClick={() => setRulesDrawerOpen(false)}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md transition-opacity duration-300"
          />
          {/* Drawer body */}
          <aside className="fixed top-0 bottom-0 right-0 z-[101] flex flex-col w-full sm:w-[420px] max-w-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl p-6 font-sans text-left overflow-y-auto space-y-6 animate-slide-in-right">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-955/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight text-gray-900 dark:text-white">
                    Rules & regulations
                  </h3>
                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-450 uppercase flex items-center gap-1 mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> Approved & Signed by User
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setRulesDrawerOpen(false)}
                className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Rules Text Content */}
            <div className="space-y-4 text-xs leading-relaxed text-gray-600 dark:text-gray-300 font-medium">
              
              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-955/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                <p className="font-extrabold uppercase text-[10px] text-indigo-700 dark:text-indigo-400 mb-1">
                  1. Nature of Lease / Rental
                </p>
                <p className="text-[11px]">
                  All credentials, IDs, and mailboxes are leased temporarily for designative lease hours and do not imply permanent ownership. Password modifications, security tampering, VK link alterations, VK/Google/Facebook binding compromises are prohibited.
                </p>
              </div>

              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-955/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                <p className="font-extrabold uppercase text-[10px] text-indigo-700 dark:text-indigo-400 mb-1">
                  2. Rental-to-Permanent Conversion
                </p>
                <p className="text-[11px]">
                  Every account must be rented first, with temporary access removed after ~2 days. Permanent purchase is optional thereafter, with rental payment deducted from final balance. Balance must be cleared in full before transfer.
                </p>
              </div>

              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-955/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                <p className="font-extrabold uppercase text-[10px] text-indigo-700 dark:text-indigo-400 mb-1">
                  3. Garena 15-Day Binding Rules
                </p>
                <p className="text-[11px]">
                  A mandatory 15-day binding period applies, during which Garena's official recovery email binding takes place. IP transitions (logging in from multiple concurrent locations) or account inventory tampering is strictly banned during this period.
                </p>
              </div>

              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-955/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                <p className="font-extrabold uppercase text-[10px] text-indigo-700 dark:text-indigo-400 mb-1">
                  4. Non-Refundable Nature
                </p>
                <p className="text-[11px]">
                  All payments are absolute, final, and non-refundable. Once OTP is shared or credentials delivered, no refunds can be initiated under any technical or external factor.
                </p>
              </div>

              <div className="p-3.5 bg-rose-50/70 dark:bg-rose-955/10 rounded-xl border-2 border-rose-500/30 text-rose-800 dark:text-rose-400 animate-pulse">
                <div className="flex items-center gap-1.5 font-black uppercase text-[10px] text-rose-700 dark:text-rose-400 mb-1">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  <span>5. ⚠️ Auto-Suspension Trigger Rule</span>
                </div>
                <p className="text-[11px] font-bold leading-relaxed">
                  PLEASE NOTE: Clicking the "Trigger Auto-Suspension" button in the Security Compliance section will immediately flag your profile state in Firestore as suspicious activity. THIS ACTION WILL INSTANTLY SUSPEND YOUR ACCOUNT, REVOKE ALL ACTIVE LEASES, AND EXPIRE YOUR LOGINS. DO NOT click it unless you explicitly want to block your session.
                </p>
              </div>

            </div>

            {/* Footer Sign-off */}
            <div className="bg-gray-50 dark:bg-gray-850/60 p-4 rounded-2xl border border-gray-150 dark:border-gray-800 text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase text-center">
              Signed and Agreed on Onboarding
            </div>

          </aside>
        </>
      )}
    </div>
  );
}
