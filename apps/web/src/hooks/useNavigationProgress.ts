import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const LOADING_THRESHOLD_MS = 200;

interface NavigationProgressState {
  isNavigating: boolean;
}

export function useNavigationProgress() {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const thresholdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousPathnameRef = useRef<string>(pathname);
  const isNavigatingRef = useRef<boolean>(false);

  const startNavigation = useCallback(() => {
    // Clear any existing timer
    if (thresholdTimerRef.current) {
      clearTimeout(thresholdTimerRef.current);
    }

    // Set flag immediately
    isNavigatingRef.current = true;

    // Show loading indicator after threshold (200ms)
    thresholdTimerRef.current = setTimeout(() => {
      setIsNavigating(true);
      thresholdTimerRef.current = null;
    }, LOADING_THRESHOLD_MS);
  }, []);

  const endNavigation = useCallback(() => {
    // Clear flag
    isNavigatingRef.current = false;

    // Clear threshold timer if navigation completes before threshold
    if (thresholdTimerRef.current) {
      clearTimeout(thresholdTimerRef.current);
      thresholdTimerRef.current = null;
    }

    // Remove loading indicator immediately
    setIsNavigating(false);
  }, []);

  useEffect(() => {
    // Detect pathname change (navigation completed)
    if (previousPathnameRef.current !== pathname) {
      // Navigation has completed
      endNavigation();
      previousPathnameRef.current = pathname;
    }

    // Cleanup on unmount
    return () => {
      if (thresholdTimerRef.current) {
        clearTimeout(thresholdTimerRef.current);
      }
    };
  }, [pathname, endNavigation]);

  return {
    isNavigating,
    startNavigation,
    endNavigation,
  };
}
