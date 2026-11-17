import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthContext } from './AuthContext';

export const HostelModeContext = createContext();

// TEMPORARY UNIVERSITY DEMONSTRATION CONFIGURATION:
// Set to true to make Hostel Mode accessible 24 hours a day, every day.
// Set to false to restore the original time-based restriction.
export const HOSTEL_MODE_24_7 = true;

// ORIGINAL TIME RESTRICTION CONFIGURATION:
// Production cutoff: 20 (8:00 PM)
// Testing cutoff: 14 (2:00 PM)
// When HOSTEL_MODE_24_7 is set to false, this hour is used.
export const HOSTEL_MODE_START_HOUR = 14; 

export const HostelModeProvider = ({ children }) => {
  const { user } = useContext(AuthContext);

  // Time check helper: returns true 24/7 when HOSTEL_MODE_24_7 is true,
  // or checks whether browser local time is at or after HOSTEL_MODE_START_HOUR.
  const checkTimeEligibility = () => {
    if (HOSTEL_MODE_24_7) {
      return true;
    }
    const now = new Date();
    const hours = now.getHours();
    return hours >= HOSTEL_MODE_START_HOUR;
  };

  const [isEligible, setIsEligible] = useState(() => checkTimeEligibility());
  const [hostelMode, setHostelMode] = useState(() => {
    const eligible = checkTimeEligibility();
    if (!eligible) return false;
    const saved = localStorage.getItem('campuskart_hostel_mode');
    return saved === 'true';
  });

  const checkAndSyncEligibility = useCallback(() => {
    const eligible = checkTimeEligibility();
    setIsEligible(eligible);

    if (!eligible) {
      // Force effective state to OFF and restore light theme
      setHostelMode(false);
      localStorage.setItem('campuskart_hostel_mode', 'false');
    }
  }, []);

  // Recheck eligibility on mount, window focus, visibility change, and clock tick
  useEffect(() => {
    checkAndSyncEligibility();

    const handleFocus = () => checkAndSyncEligibility();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkAndSyncEligibility();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    // Interval to detect crossing the 8:00 PM boundary in real-time
    const interval = setInterval(() => {
      checkAndSyncEligibility();
    }, 1000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [checkAndSyncEligibility]);

  // Sync theme class to documentElement and body
  useEffect(() => {
    const isNight = isEligible && hostelMode;
    if (isNight) {
      document.documentElement.classList.add('night-mode');
      document.body.classList.add('night-mode');
    } else {
      document.documentElement.classList.remove('night-mode');
      document.body.classList.remove('night-mode');
    }
  }, [isEligible, hostelMode]);

  // Turn off Hostel Mode if user logs out
  useEffect(() => {
    if (!user) {
      setHostelMode(false);
      localStorage.setItem('campuskart_hostel_mode', 'false');
    }
  }, [user]);

  const toggleHostelMode = () => {
    if (!isEligible) {
      return;
    }
    setHostelMode(prev => {
      const next = !prev;
      localStorage.setItem('campuskart_hostel_mode', next ? 'true' : 'false');
      return next;
    });
  };

  const formattedStartHour = HOSTEL_MODE_START_HOUR > 12 
    ? `${HOSTEL_MODE_START_HOUR - 12} PM` 
    : `${HOSTEL_MODE_START_HOUR} ${HOSTEL_MODE_START_HOUR === 12 ? 'PM' : 'AM'}`;

  const availabilityMessage = isEligible
    ? 'Hostel Mode is available.'
    : `Hostel Mode is available after ${formattedStartHour}.`;

  return (
    <HostelModeContext.Provider
      value={{
        hostelMode: isEligible ? hostelMode : false,
        isEligible,
        toggleHostelMode,
        availabilityMessage,
        startHour: HOSTEL_MODE_START_HOUR,
        userHostel: user?.hostel || null
      }}
    >
      {children}
    </HostelModeContext.Provider>
  );
};

export const useHostelMode = () => {
  const context = useContext(HostelModeContext);
  if (!context) {
    throw new Error('useHostelMode must be used within a HostelModeProvider');
  }
  return context;
};
