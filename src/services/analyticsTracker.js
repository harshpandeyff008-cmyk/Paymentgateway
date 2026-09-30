/**
 * Advanced Client-Side Analytics Tracker
 * Captures privacy-conscious traffic telemetry, session durations, device heuristics, and conversion events.
 */
import { 
  recordPageViewInFirestore, 
  recordEventInFirestore, 
  recordLiveHeartbeatInFirestore 
} from '../firebase/firestore';

// Unique persistent Visitor ID (stored across visits)
export function getVisitorId() {
  let vid = localStorage.getItem('ff_visitor_id');
  if (!vid) {
    vid = 'vid_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
    try {
      localStorage.setItem('ff_visitor_id', vid);
    } catch (e) {
      console.warn("Storage not available for visitor ID:", e);
    }
  }
  return vid;
}

// Session ID (persists only for current tab session)
export function getSessionId() {
  let sid = sessionStorage.getItem('ff_session_id');
  if (!sid) {
    sid = 'sid_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
    try {
      sessionStorage.setItem('ff_session_id', sid);
    } catch (e) {
      console.warn("Storage not available for session ID:", e);
    }
  }
  return sid;
}

// Device detection heuristics
export function detectDevice() {
  const ua = navigator.userAgent || '';
  if (/tablet|ipad|playbook|silk/i.test(ua) || (navigator.maxTouchPoints > 1 && window.innerWidth >= 768 && window.innerWidth <= 1024)) {
    return 'Tablet';
  }
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua) || window.innerWidth < 768) {
    return 'Mobile';
  }
  return 'Desktop';
}

// Operating system detection
export function detectOS() {
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'Android';
  if (/iPad|iPhone|iPod/.test(ua)) return 'iOS';
  if (/windows/i.test(ua)) return 'Windows';
  if (/macintosh|mac os x/i.test(ua)) return 'macOS';
  if (/linux/i.test(ua)) return 'Linux';
  if (/cros/i.test(ua)) return 'ChromeOS';
  return 'Other';
}

// Browser detection
export function detectBrowser() {
  const ua = navigator.userAgent || '';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/edg/i.test(ua)) return 'Edge';
  if (/chrome|crios/i.test(ua) && !/edg|opr|brave/i.test(ua)) return 'Chrome';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua) && !/chrome|crios|android/i.test(ua)) return 'Safari';
  if (/samsungbrowser/i.test(ua)) return 'Samsung Internet';
  return 'Other';
}

// Infer approximate country & region from timezone
export function inferLocationFromTimezone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.includes('Kolkata') || tz.includes('Calcutta') || tz === 'Asia/Colombo') {
      return { country: 'India', region: 'India' };
    }
    if (tz.includes('Dhaka')) return { country: 'Bangladesh', region: 'Dhaka' };
    if (tz.includes('Karachi')) return { country: 'Pakistan', region: 'Karachi' };
    if (tz.includes('Kathmandu')) return { country: 'Nepal', region: 'Kathmandu' };
    if (tz.includes('Dubai') || tz.includes('Muscat')) return { country: 'UAE', region: 'Middle East' };
    if (tz.includes('New_York') || tz.includes('Los_Angeles') || tz.includes('Chicago')) return { country: 'United States', region: 'North America' };
    if (tz.includes('London')) return { country: 'United Kingdom', region: 'Europe' };
    if (tz.includes('Singapore')) return { country: 'Singapore', region: 'Southeast Asia' };
    if (tz.includes('Jakarta')) return { country: 'Indonesia', region: 'Southeast Asia' };
    if (tz.includes('Bangkok')) return { country: 'Thailand', region: 'Southeast Asia' };
    if (tz.includes('Riyadh')) return { country: 'Saudi Arabia', region: 'Middle East' };
    if (tz.includes('Berlin') || tz.includes('Paris') || tz.includes('Rome') || tz.includes('Madrid')) return { country: 'European Union', region: 'Europe' };
    
    // Fallback based on timezone prefix
    if (tz.startsWith('Asia/')) return { country: 'Asia', region: tz.replace('Asia/', '') };
    if (tz.startsWith('America/')) return { country: 'Americas', region: tz.replace('America/', '') };
    if (tz.startsWith('Europe/')) return { country: 'Europe', region: tz.replace('Europe/', '') };
    if (tz.startsWith('Africa/')) return { country: 'Africa', region: tz.replace('Africa/', '') };
    return { country: 'International', region: tz || 'Unknown' };
  } catch (e) {
    return { country: 'India', region: 'India' };
  }
}

// Clean and categorize referrer
export function parseReferrer(rawRef) {
  if (!rawRef || rawRef.trim() === '') return 'Direct';
  try {
    const url = new URL(rawRef);
    const host = url.hostname.toLowerCase();
    
    // Ignore internal navigation
    if (host === window.location.hostname) return 'Direct';
    
    if (host.includes('google.')) return 'Google Search';
    if (host.includes('t.me') || host.includes('telegram.')) return 'Telegram';
    if (host.includes('youtube.') || host.includes('youtu.be')) return 'YouTube';
    if (host.includes('instagram.')) return 'Instagram';
    if (host.includes('facebook.') || host.includes('fb.me')) return 'Facebook';
    if (host.includes('wa.me') || host.includes('whatsapp.')) return 'WhatsApp';
    if (host.includes('discord.')) return 'Discord';
    if (host.includes('twitter.') || host.includes('x.com')) return 'X (Twitter)';
    if (host.includes('bing.')) return 'Bing Search';
    if (host.includes('yahoo.')) return 'Yahoo';
    if (host.includes('reddit.')) return 'Reddit';
    return host.replace(/^www\./, '');
  } catch (e) {
    return 'Direct';
  }
}

// UTM parameter extractor
export function getUtmParams() {
  try {
    const params = new URLSearchParams(window.location.search);
    return {
      utmSource: params.get('utm_source') || '',
      utmMedium: params.get('utm_medium') || '',
      utmCampaign: params.get('utm_campaign') || '',
      utmTerm: params.get('utm_term') || '',
      utmContent: params.get('utm_content') || ''
    };
  } catch (e) {
    return {};
  }
}

let lastTrackedPath = null;
let pageStartTime = Date.now();

/**
 * Tracks a pageview event
 */
export async function trackPageView(pathname, customTitle = null) {
  const visitorId = getVisitorId();
  const sessionId = getSessionId();
  const device = detectDevice();
  const os = detectOS();
  const browser = detectBrowser();
  const locationInfo = inferLocationFromTimezone();
  const referrer = parseReferrer(document.referrer);
  const utm = getUtmParams();
  
  const pageTitle = customTitle || document.title || (pathname === '/' ? 'Store' : pathname);

  const payload = {
    visitorId,
    sessionId,
    path: pathname,
    title: pageTitle,
    device,
    os,
    browser,
    referrer: utm.utmSource ? `UTM: ${utm.utmSource}` : referrer,
    country: locationInfo.country,
    region: locationInfo.region,
    screen: `${window.screen.width}x${window.screen.height}`,
    language: navigator.language || 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
    timestamp: new Date().toISOString(),
    ...utm
  };

  lastTrackedPath = pathname;
  pageStartTime = Date.now();

  try {
    await recordPageViewInFirestore(payload);
  } catch (err) {
    console.debug("Analytics pageview recording skipped:", err?.message);
  }
}

/**
 * Tracks custom interactions and conversion events
 */
export async function trackEvent(eventName, eventData = {}) {
  const visitorId = getVisitorId();
  const sessionId = getSessionId();
  const device = detectDevice();
  const os = detectOS();
  const browser = detectBrowser();
  const currentPath = window.location.pathname;

  const payload = {
    visitorId,
    sessionId,
    eventName,
    path: currentPath,
    device,
    os,
    browser,
    metadata: eventData,
    timestamp: new Date().toISOString()
  };

  try {
    await recordEventInFirestore(payload);
  } catch (err) {
    console.debug("Analytics custom event recording skipped:", err?.message);
  }
}

/**
 * Heartbeat sender for live real-time visitor presence
 */
export async function sendHeartbeat(pathname) {
  const visitorId = getVisitorId();
  const sessionId = getSessionId();
  const device = detectDevice();
  const os = detectOS();
  const browser = detectBrowser();
  const locationInfo = inferLocationFromTimezone();

  const payload = {
    visitorId,
    sessionId,
    currentPath: pathname || window.location.pathname,
    device,
    os,
    browser,
    country: locationInfo.country,
    region: locationInfo.region,
    lastPing: Date.now()
  };

  try {
    await recordLiveHeartbeatInFirestore(payload);
  } catch (err) {
    console.debug("Analytics heartbeat skipped:", err?.message);
  }
}
