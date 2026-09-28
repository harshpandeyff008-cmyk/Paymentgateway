import { useEffect, useRef } from 'react';
import { logoutUser } from '../firebase/auth';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

/**
 * Hook to automatically log out users after a specified period of inactivity.
 * Default timeout is 15 minutes (900,000 milliseconds).
 */
export const useIdleTimer = (timeoutMs = 900000) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const timerRef = useRef(null);

  useEffect(() => {
    if (!currentUser) return;

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(handleIdle, timeoutMs);
    };

    const handleIdle = async () => {
      try {
        await logoutUser();
        showToast("You have been signed out due to inactivity.", "warning");
      } catch (error) {
        console.error("Auto-logout error:", error);
      }
    };

    // Events to track user activity
    const events = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'];

    // Initialize timer
    resetTimer();

    // Add event listeners
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    // Cleanup event listeners and timers on unmount or user change
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [currentUser, timeoutMs, showToast]);
};
