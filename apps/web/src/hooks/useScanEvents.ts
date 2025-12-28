import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api, ScanStatus } from '@/lib/api';
import type { ScanEvent, GetEventsOptions } from '@/types/scan-event';

/**
 * Hook options for useScanEvents
 */
interface UseScanEventsOptions {
  /** Polling interval in milliseconds (default: 2000) */
  pollInterval?: number;
  /** Whether the current user is an admin (default: false) */
  isAdmin?: boolean;
  /** Additional options for the API call */
  apiOptions?: Omit<GetEventsOptions, 'since'>;
}

/**
 * Hook return type for useScanEvents
 */
interface UseScanEventsReturn {
  /** Accumulated scan events */
  events: ScanEvent[];
  /** Loading state (true only on initial load) */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Manually trigger a refetch */
  refetch: () => Promise<void>;
}

/**
 * Custom hook to manage scan event polling with React
 *
 * Features:
 * - Polls for new events every 2-3 seconds while scan is active
 * - Stops polling when scan is COMPLETED or FAILED
 * - Uses 'since' parameter to only fetch new events
 * - Accumulates events (doesn't replace, appends new ones)
 * - Filters out adminOnly events if isAdmin is false
 * - Efficient: only re-renders when new events arrive
 *
 * @param scanId - The scan ID to fetch events for
 * @param scanStatus - Current status of the scan (to control polling)
 * @param options - Configuration options
 * @returns Hook state and methods
 *
 * @example
 * ```tsx
 * const { events, isLoading, error, refetch } = useScanEvents(
 *   scanId,
 *   scanStatus,
 *   { pollInterval: 2000, isAdmin: false }
 * );
 * ```
 */
export function useScanEvents(
  scanId: string,
  scanStatus: ScanStatus,
  options: UseScanEventsOptions = {}
): UseScanEventsReturn {
  // Extract options with stable defaults using useMemo to prevent infinite loops
  // The apiOptions object reference would change on every render if we used
  // destructuring with a default value directly
  const { pollInterval = 2000, isAdmin = false } = options;
  const apiOptions = useMemo(
    () => options.apiOptions ?? {},
    // Only recreate if the actual apiOptions object content changes
    // Using JSON.stringify for deep comparison of the options object
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(options.apiOptions)]
  );

  // State management
  const [events, setEvents] = useState<ScanEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs to track polling and last timestamp
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTimestampRef = useRef<string | null>(null);
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  /**
   * Fetch events from API
   * Uses 'since' parameter to only get new events after last timestamp
   */
  const fetchEvents = useCallback(async () => {
    // Don't fetch if component is unmounted
    if (!isMountedRef.current) return;

    try {
      // Build API options with 'since' parameter
      const requestOptions: GetEventsOptions = {
        ...apiOptions,
        ...(lastTimestampRef.current && { since: lastTimestampRef.current }),
      };

      const response = await api.scans.getEvents(scanId, requestOptions);

      // Don't update state if component unmounted during fetch
      if (!isMountedRef.current) return;

      // Filter out admin-only events if user is not an admin
      const filteredEvents = isAdmin
        ? response.events
        : response.events.filter((event) => !event.adminOnly);

      // Only update state if we have new events
      if (filteredEvents.length > 0) {
        setEvents((prevEvents) => {
          // Accumulate new events (append to existing)
          const newEvents = [...prevEvents, ...filteredEvents];

          // Sort by createdAt to ensure chronological order
          // (API should already send in order, but this ensures consistency)
          return newEvents.sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });

        // Update last timestamp for next poll
        if (response.lastTimestamp) {
          lastTimestampRef.current = response.lastTimestamp;
        }
      }

      setError(null);
    } catch (err) {
      // Don't update state if component unmounted
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [scanId, isAdmin, apiOptions]);

  /**
   * Helper to determine if scan is in a terminal state (no more events expected)
   */
  const isTerminalStatus = scanStatus === 'COMPLETED' || scanStatus === 'FAILED';

  /**
   * Effect: Initialize state and do initial fetch when scanId changes
   * This only runs when scanId changes, not on every scanStatus change
   */
  useEffect(() => {
    // Mark as mounted
    isMountedRef.current = true;

    // Reset state when scanId changes
    setEvents([]);
    setIsLoading(true);
    setError(null);
    lastTimestampRef.current = null;

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Initial fetch for the new scanId
    fetchEvents();

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // Only depend on scanId for initialization, not fetchEvents
    // fetchEvents is stable enough due to useMemo on apiOptions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanId]);

  /**
   * Effect: Manage polling based on scan status
   * Start polling when scan is active, stop when terminal
   */
  useEffect(() => {
    // Clear any existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Only set up polling if scan is active (PENDING or RUNNING)
    // Do NOT poll if scan is in terminal state (COMPLETED or FAILED)
    if (!isTerminalStatus && isMountedRef.current) {
      intervalRef.current = setInterval(fetchEvents, pollInterval);
    }

    // Cleanup interval when status changes or unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [scanStatus, isTerminalStatus, pollInterval, fetchEvents]);

  return {
    events,
    isLoading,
    error,
    refetch: fetchEvents,
  };
}
