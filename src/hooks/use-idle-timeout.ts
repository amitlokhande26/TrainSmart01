import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface UseIdleTimeoutOptions {
  timeoutMinutes?: number;
  warningMinutes?: number;
  enabled?: boolean;
}

export function useIdleTimeout(options: UseIdleTimeoutOptions = {}) {
  const {
    timeoutMinutes = 5,
    warningMinutes = 1,
    enabled = true
  } = options;

  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(warningMinutes * 60);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const warningRef = useRef<NodeJS.Timeout>();
  const countdownRef = useRef<NodeJS.Timeout>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Session Expired",
        description: "You have been logged out due to inactivity.",
        variant: "destructive",
      });
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Error during auto-logout:', error);
    }
  }, [navigate, toast]);

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const startCountdown = useCallback(() => {
    setSecondsRemaining(warningMinutes * 60);
    
    countdownRef.current = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [warningMinutes]);

  const showIdleWarning = useCallback(() => {
    setShowWarning(true);
    startCountdown();
    
    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, warningMinutes * 60 * 1000);
  }, [handleLogout, warningMinutes, startCountdown]);

  const resetTimer = useCallback(() => {
    if (!enabled) return;

    setShowWarning(false);
    clearAllTimers();

    // Set warning timer (fires before actual logout)
    warningRef.current = setTimeout(() => {
      showIdleWarning();
    }, (timeoutMinutes - warningMinutes) * 60 * 1000);
  }, [enabled, timeoutMinutes, warningMinutes, showIdleWarning, clearAllTimers]);

  const stayLoggedIn = useCallback(() => {
    setShowWarning(false);
    clearAllTimers();
    resetTimer();
    toast({
      title: "Session Extended",
      description: "Your session has been extended.",
    });
  }, [resetTimer, clearAllTimers, toast]);

  useEffect(() => {
    if (!enabled) return;

    // Events that indicate user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    // Only reset on actual user interaction, not just any mouse movement
    let lastReset = Date.now();
    const handleActivity = () => {
      // Throttle resets to once per minute to avoid excessive timer resets
      if (Date.now() - lastReset > 60000) {
        lastReset = Date.now();
        resetTimer();
      }
    };

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Start initial timer
    resetTimer();

    // Cleanup
    return () => {
      clearAllTimers();
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [enabled, resetTimer, clearAllTimers]);

  return {
    showWarning,
    secondsRemaining,
    stayLoggedIn,
    resetTimer
  };
}

