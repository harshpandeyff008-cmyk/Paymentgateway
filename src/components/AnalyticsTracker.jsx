import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView, sendHeartbeat } from '../services/analyticsTracker';

/**
 * AnalyticsTracker component placed inside BrowserRouter.
 * Automatically tracks page transitions, route changes, and heartbeat pings for active user tracking.
 */
export default function AnalyticsTracker() {
  const location = useLocation();
  const lastPathname = useRef('');

  useEffect(() => {
    // Only track if pathname changed
    if (location.pathname !== lastPathname.current) {
      lastPathname.current = location.pathname;
      trackPageView(location.pathname);
      sendHeartbeat(location.pathname);
    }
  }, [location.pathname, location.search]);

  // Heartbeat ping every 45 seconds while tab is active
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat(window.location.pathname);
      }
    }, 45000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat(window.location.pathname);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return null;
}
