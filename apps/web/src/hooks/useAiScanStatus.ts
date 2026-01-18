import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import type { AiScanStatus } from '@/lib/api';

/**
 * Hook options for useAiScanStatus
 */
interface UseAiScanStatusOptions {
  /** Initial polling interval in milliseconds (default: 30000 - 30s) */
  initialInterval?: number;
  /** Maximum polling interval in milliseconds (default: 120000 - 2min) */
  maxInterval?: number;
  /** Backoff multiplier (default: 1.5) */
  backoffMultiplier?: number;
  /** Maximum number of retries on network error (default: 3) */
  maxRetries?: number;
  /** Delay between retries in milliseconds (default: 5000 - 5s) */
  retryDelay?: number;
}

/**
 * Hook return type for useAiScanStatus
 */
interface UseAiScanStatusReturn {
  /** AI processing status data */
  aiStatus: AiScanStatus | null;
  /** AI-generated insights data (placeholder for future enhancement) */
  aiData: any | null;
  /** Loading state (true only on initial load) */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Whether polling is currently active */
  isPolling: boolean;
  /** Manually stop polling */
  stopPolling: () => void;
  /** Manually trigger a refetch */
  refetch: () => Promise<void>;
}

/**
 * Custom hook to manage AI scan status polling with exponential backoff
 *
 * Features:
 * - Polls for AI processing status with exponential backoff (30s initial, 2min max)
 * - Stops polling when AI status is 'completed' or 'failed'
 * - Handles network errors with retry logic (3 retries, 5s delay)
 * - Automatically manages polling lifecycle based on scan completion
 * - Efficient: only re-renders when status changes
 *
 * @param scanId - The scan ID to fetch AI status for
 * @param options - Configuration options
 * @returns Hook state and methods
 *
 * @example
 * ```tsx
 * const { aiStatus, aiData, isPolling, stopPolling } = useAiScanStatus(
 *   scanId,
 *   { initialInterval: 30000, maxInterval: 120000 }
 * );
 * ```
 */
export function useAiScanStatus(
  scanId: string,
  options: UseAiScanStatusOptions = {}
): UseAiScanStatusReturn {
  // Extract options with defaults
  const {
    initialInterval = 30000, // 30 seconds
    maxInterval = 120000, // 2 minutes
    backoffMultiplier = 1.5,
    maxRetries = 3,
    retryDelay = 5000, // 5 seconds
  } = options;

  // State management
  const [aiStatus, setAiStatus] = useState<AiScanStatus | null>(null);
  const [aiData] = useState<any | null>(null); // Placeholder for future AI data
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  // Refs for polling management
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentIntervalRef = useRef<number>(initialInterval);
  const retryCountRef = useRef<number>(0);
  const isMountedRef = useRef(true);
  const isPollingRef = useRef(true); // Use ref to avoid dependency loop
  const fetchAiStatusRef = useRef<() => Promise<void>>(); // Ref for stable fetch function

  /**
   * Helper to determine if AI processing is in a terminal state
   */
  const isTerminalStatus = useCallback((status: AiScanStatus | null): boolean => {
    if (!status) return false;
    return status.status === 'COMPLETED' || status.status === 'FAILED';
  }, []);

  /**
   * Stop polling manually
   */
  const stopPolling = useCallback(() => {
    isPollingRef.current = false; // Update ref immediately
    setIsPolling(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  /**
   * Calculate next polling interval with exponential backoff
   */
  const getNextInterval = useCallback((): number => {
    const nextInterval = Math.min(
      currentIntervalRef.current * backoffMultiplier,
      maxInterval
    );
    currentIntervalRef.current = nextInterval;
    return nextInterval;
  }, [backoffMultiplier, maxInterval]);

  /**
   * Reset polling interval to initial value
   */
  const resetInterval = useCallback(() => {
    currentIntervalRef.current = initialInterval;
  }, [initialInterval]);

  /**
   * Fetch AI status from API with retry logic
   */
  const fetchAiStatus = useCallback(async (): Promise<void> => {
    // Don't fetch if component is unmounted or polling is stopped
    // Use ref to avoid dependency loop with isPolling state
    if (!isMountedRef.current || !isPollingRef.current) return;

    try {
      const response = await api.aiCampaign.getAiStatus(scanId);

      // Don't update state if component unmounted during fetch
      if (!isMountedRef.current) return;

      setAiStatus(response);
      setError(null);
      setIsLoading(false);

      // Reset retry count on successful fetch
      retryCountRef.current = 0;

      // Stop polling if AI processing is complete or failed
      if (isTerminalStatus(response)) {
        stopPolling();
        return;
      }

      // Schedule next poll with exponential backoff
      const nextInterval = getNextInterval();
      timeoutRef.current = setTimeout(() => fetchAiStatusRef.current?.(), nextInterval);
    } catch (err) {
      // Don't update state if component unmounted
      if (!isMountedRef.current) return;

      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch AI status';

      // Retry logic for network errors
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current += 1;

        // Set error but don't stop loading state during retries
        setError(`${errorMessage} (Retry ${retryCountRef.current}/${maxRetries})`);

        // Retry after delay
        timeoutRef.current = setTimeout(() => fetchAiStatusRef.current?.(), retryDelay);
      } else {
        // Max retries exceeded, stop polling
        setError(errorMessage);
        setIsLoading(false);
        stopPolling();
      }
    }
  // Note: isPolling removed from deps - using isPollingRef instead to avoid dependency loop
  }, [scanId, isTerminalStatus, stopPolling, getNextInterval, maxRetries, retryDelay]);

  // Keep ref updated for stable access in effect
  fetchAiStatusRef.current = fetchAiStatus;

  /**
   * Manual refetch function
   */
  const refetch = useCallback(async (): Promise<void> => {
    if (!isMountedRef.current) return;

    setIsLoading(true);
    setError(null);
    retryCountRef.current = 0;
    resetInterval();

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Restart polling
    isPollingRef.current = true;
    setIsPolling(true);
    await fetchAiStatusRef.current?.();
  }, [resetInterval]);

  /**
   * Effect: Initialize and manage polling lifecycle
   * Only depends on scanId to avoid re-initialization when callbacks change
   */
  useEffect(() => {
    // Mark as mounted
    isMountedRef.current = true;

    // Reset state when scanId changes
    setAiStatus(null);
    setIsLoading(true);
    setError(null);
    isPollingRef.current = true;
    setIsPolling(true);
    retryCountRef.current = 0;
    currentIntervalRef.current = initialInterval;

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Start initial fetch using ref for stable access
    fetchAiStatusRef.current?.();

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      isPollingRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
    // Only re-run when scanId changes, not when callbacks change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanId]);

  return {
    aiStatus,
    aiData,
    isLoading,
    error,
    isPolling,
    stopPolling,
    refetch,
  };
}
