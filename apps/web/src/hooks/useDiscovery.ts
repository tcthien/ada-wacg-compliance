/**
 * useDiscovery Hook
 *
 * Manages website skeleton discovery state, polling, manual URL operations,
 * and session persistence for page selection.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  discoveryApi,
  type DiscoveryWithPages,
  type CreateDiscoveryInput,
  type CacheMetadata,
  type AddUrlResponse,
  type AddUrlsResponse,
  type DiscoveryStatus,
  isTerminalStatus,
} from '@/lib/discovery-api';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Discovery state returned by the hook
 */
export interface DiscoveryState {
  /** Discovery data with pages */
  discovery: DiscoveryWithPages | null;
  /** Whether initial load or operation is in progress */
  isLoading: boolean;
  /** Whether an operation is in progress (create, add URL, etc.) */
  isOperating: boolean;
  /** Error message if any */
  error: string | null;
  /** Cache metadata if result was cached */
  cacheMetadata: CacheMetadata | null;
  /** Currently selected page IDs */
  selectedPageIds: Set<string>;
}

/**
 * Options for useDiscovery hook
 */
export interface UseDiscoveryOptions {
  /** Polling interval in ms (default: 2000) */
  pollInterval?: number;
  /** Whether to enable polling (default: true) */
  enablePolling?: boolean;
  /** Callback when discovery status changes */
  onStatusChange?: (status: DiscoveryStatus) => void;
  /** Callback when discovery completes */
  onComplete?: (discovery: DiscoveryWithPages) => void;
  /** Callback when discovery fails */
  onError?: (error: string) => void;
}

/**
 * Return type for useDiscovery hook
 */
export interface UseDiscoveryReturn extends DiscoveryState {
  /** Create a new discovery job */
  createDiscovery: (input: CreateDiscoveryInput) => Promise<void>;
  /** Get discovery by ID */
  getDiscovery: (id: string, refresh?: boolean) => Promise<void>;
  /** Cancel running discovery */
  cancelDiscovery: () => Promise<void>;
  /** Add a single manual URL */
  addManualUrl: (url: string) => Promise<AddUrlResponse>;
  /** Add multiple manual URLs */
  addManualUrls: (urls: string[]) => Promise<AddUrlsResponse>;
  /** Remove a manual URL */
  removeManualUrl: (pageId: string) => Promise<void>;
  /** Toggle page selection */
  togglePageSelection: (pageId: string) => void;
  /** Select all pages */
  selectAllPages: () => void;
  /** Deselect all pages */
  deselectAllPages: () => void;
  /** Set selected page IDs */
  setSelectedPageIds: (ids: Set<string>) => void;
  /** Manually refetch discovery data */
  refetch: () => Promise<void>;
  /** Reset hook state */
  reset: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_POLL_INTERVAL = 2000;
const SELECTION_STORAGE_PREFIX = 'discovery:selection:';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get storage key for selection persistence
 */
function getSelectionStorageKey(discoveryId: string): string {
  return `${SELECTION_STORAGE_PREFIX}${discoveryId}`;
}

/**
 * Persist selection to sessionStorage
 */
function persistSelection(discoveryId: string, selectedIds: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getSelectionStorageKey(discoveryId);
    const value = JSON.stringify(Array.from(selectedIds));
    sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Load selection from sessionStorage
 */
function loadPersistedSelection(discoveryId: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const key = getSelectionStorageKey(discoveryId);
    const value = sessionStorage.getItem(key);
    if (value) {
      const ids = JSON.parse(value);
      if (Array.isArray(ids)) {
        return new Set(ids.filter((id) => typeof id === 'string'));
      }
    }
  } catch {
    // Ignore storage errors
  }
  return new Set();
}

/**
 * Clear persisted selection from sessionStorage
 */
function clearPersistedSelection(discoveryId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getSelectionStorageKey(discoveryId);
    sessionStorage.removeItem(key);
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Hook for managing website skeleton discovery
 *
 * @param initialDiscoveryId - Optional initial discovery ID to load
 * @param options - Hook options
 * @returns Discovery state and operations
 *
 * @example
 * ```tsx
 * const {
 *   discovery,
 *   isLoading,
 *   error,
 *   createDiscovery,
 *   addManualUrl,
 *   selectedPageIds,
 *   togglePageSelection
 * } = useDiscovery(undefined, {
 *   onComplete: (discovery) => console.log('Discovery complete!'),
 * });
 *
 * // Start a new discovery
 * await createDiscovery({ homepageUrl: 'https://example.com' });
 *
 * // Add a manual URL
 * await addManualUrl('https://example.com/about');
 *
 * // Select a page
 * togglePageSelection('page-id');
 * ```
 */
export function useDiscovery(
  initialDiscoveryId?: string,
  options: UseDiscoveryOptions = {}
): UseDiscoveryReturn {
  const {
    pollInterval = DEFAULT_POLL_INTERVAL,
    enablePolling = true,
    onStatusChange,
    onComplete,
    onError,
  } = options;

  // State
  const [discovery, setDiscovery] = useState<DiscoveryWithPages | null>(null);
  const [isLoading, setIsLoading] = useState(!!initialDiscoveryId);
  const [isOperating, setIsOperating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheMetadata, setCacheMetadata] = useState<CacheMetadata | null>(
    null
  );
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(
    new Set()
  );

  // Refs
  const discoveryIdRef = useRef<string | null>(initialDiscoveryId || null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousStatusRef = useRef<DiscoveryStatus | null>(null);

  // Store callbacks in refs to avoid dependency issues
  const onStatusChangeRef = useRef(onStatusChange);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  // Update refs when callbacks change
  onStatusChangeRef.current = onStatusChange;
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  // ============================================================================
  // POLLING MANAGEMENT
  // ============================================================================

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /**
   * Fetch discovery data
   */
  const fetchDiscovery = useCallback(
    async (id: string, refresh = false) => {
      try {
        const response = await discoveryApi.get(id, refresh);
        setDiscovery(response.discovery);
        setCacheMetadata(response.cacheMetadata || null);
        setError(null);

        // Handle status change callback (use ref to avoid dependency issues)
        if (
          onStatusChangeRef.current &&
          previousStatusRef.current !== response.discovery.status
        ) {
          onStatusChangeRef.current(response.discovery.status);
        }
        previousStatusRef.current = response.discovery.status;

        // Handle terminal states
        if (isTerminalStatus(response.discovery.status)) {
          stopPolling();

          if (response.discovery.status === 'COMPLETED') {
            onCompleteRef.current?.(response.discovery);
          } else if (response.discovery.status === 'FAILED') {
            onErrorRef.current?.(response.discovery.errorMessage || 'Discovery failed');
          }
        }

        return response;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to fetch discovery';
        setError(message);
        onErrorRef.current?.(message);
        throw err;
      }
    },
    [stopPolling]
  );

  /**
   * Start polling for discovery updates
   */
  const startPolling = useCallback(
    (id: string) => {
      if (!enablePolling) return;

      stopPolling();
      intervalRef.current = setInterval(() => {
        fetchDiscovery(id);
      }, pollInterval);
    },
    [enablePolling, pollInterval, fetchDiscovery, stopPolling]
  );

  // ============================================================================
  // DISCOVERY OPERATIONS
  // ============================================================================

  /**
   * Create a new discovery job
   */
  const createDiscovery = useCallback(
    async (input: CreateDiscoveryInput): Promise<void> => {
      setIsOperating(true);
      setError(null);

      try {
        const response = await discoveryApi.create(input);
        const newDiscovery = {
          ...response.discovery,
          pages: [],
        } as DiscoveryWithPages;

        setDiscovery(newDiscovery);
        setCacheMetadata(null);
        discoveryIdRef.current = response.discovery.id;
        previousStatusRef.current = response.discovery.status;

        // Clear any previous selection
        setSelectedPageIds(new Set());

        // Start polling for updates
        if (!isTerminalStatus(response.discovery.status)) {
          startPolling(response.discovery.id);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to create discovery';
        setError(message);
        onErrorRef.current?.(message);
        throw err;
      } finally {
        setIsOperating(false);
      }
    },
    [startPolling]
  );

  /**
   * Get discovery by ID
   */
  const getDiscovery = useCallback(
    async (id: string, refresh = false): Promise<void> => {
      setIsLoading(true);
      setError(null);
      discoveryIdRef.current = id;

      try {
        const response = await fetchDiscovery(id, refresh);

        // Load persisted selection
        const persistedSelection = loadPersistedSelection(id);
        // Filter to only include IDs that still exist in the discovery
        const validIds = new Set(response.discovery.pages.map((p) => p.id));
        const validSelection = new Set(
          Array.from(persistedSelection).filter((id) => validIds.has(id))
        );
        setSelectedPageIds(validSelection);

        // Start polling if not in terminal state
        if (!isTerminalStatus(response.discovery.status)) {
          startPolling(id);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [fetchDiscovery, startPolling]
  );

  /**
   * Cancel running discovery
   */
  const cancelDiscovery = useCallback(async (): Promise<void> => {
    if (!discoveryIdRef.current) {
      throw new Error('No discovery to cancel');
    }

    setIsOperating(true);
    setError(null);

    try {
      const response = await discoveryApi.cancel(discoveryIdRef.current);
      setDiscovery((prev) =>
        prev ? { ...prev, ...response.discovery } : null
      );
      stopPolling();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to cancel discovery';
      setError(message);
      throw err;
    } finally {
      setIsOperating(false);
    }
  }, [stopPolling]);

  /**
   * Manually refetch discovery data
   */
  const refetch = useCallback(async (): Promise<void> => {
    if (!discoveryIdRef.current) return;
    await fetchDiscovery(discoveryIdRef.current, true);
  }, [fetchDiscovery]);

  // ============================================================================
  // MANUAL URL OPERATIONS
  // ============================================================================

  /**
   * Add a single manual URL
   */
  const addManualUrl = useCallback(
    async (url: string): Promise<AddUrlResponse> => {
      if (!discoveryIdRef.current) {
        throw new Error('No discovery to add URL to');
      }

      setIsOperating(true);
      setError(null);

      try {
        const response = await discoveryApi.addUrl(discoveryIdRef.current, {
          url,
        });

        // If successful, add page to local state
        if (response.success && response.page) {
          setDiscovery((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              pages: [...prev.pages, response.page!],
            };
          });
        }

        return response;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to add URL';
        setError(message);
        throw err;
      } finally {
        setIsOperating(false);
      }
    },
    []
  );

  /**
   * Add multiple manual URLs
   */
  const addManualUrls = useCallback(
    async (urls: string[]): Promise<AddUrlsResponse> => {
      if (!discoveryIdRef.current) {
        throw new Error('No discovery to add URLs to');
      }

      setIsOperating(true);
      setError(null);

      try {
        const response = await discoveryApi.addUrls(discoveryIdRef.current, {
          urls,
        });

        // Add successful pages to local state
        const newPages = response.results
          .filter((r) => r.success && r.page)
          .map((r) => r.page!);

        if (newPages.length > 0) {
          setDiscovery((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              pages: [...prev.pages, ...newPages],
            };
          });
        }

        return response;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to add URLs';
        setError(message);
        throw err;
      } finally {
        setIsOperating(false);
      }
    },
    []
  );

  /**
   * Remove a manual URL
   */
  const removeManualUrl = useCallback(async (pageId: string): Promise<void> => {
    if (!discoveryIdRef.current) {
      throw new Error('No discovery to remove URL from');
    }

    setIsOperating(true);
    setError(null);

    try {
      await discoveryApi.removeUrl(discoveryIdRef.current, pageId);

      // Remove page from local state
      setDiscovery((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pages: prev.pages.filter((p) => p.id !== pageId),
        };
      });

      // Remove from selection
      setSelectedPageIds((prev) => {
        const next = new Set(prev);
        next.delete(pageId);
        return next;
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to remove URL';
      setError(message);
      throw err;
    } finally {
      setIsOperating(false);
    }
  }, []);

  // ============================================================================
  // SELECTION MANAGEMENT
  // ============================================================================

  /**
   * Toggle page selection
   */
  const togglePageSelection = useCallback((pageId: string) => {
    setSelectedPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  }, []);

  /**
   * Select all pages
   */
  const selectAllPages = useCallback(() => {
    if (!discovery) return;
    const allIds = new Set(discovery.pages.map((p) => p.id));
    setSelectedPageIds(allIds);
  }, [discovery]);

  /**
   * Deselect all pages
   */
  const deselectAllPages = useCallback(() => {
    setSelectedPageIds(new Set());
  }, []);

  /**
   * Reset hook state
   */
  const reset = useCallback(() => {
    stopPolling();
    if (discoveryIdRef.current) {
      clearPersistedSelection(discoveryIdRef.current);
    }
    setDiscovery(null);
    setIsLoading(false);
    setIsOperating(false);
    setError(null);
    setCacheMetadata(null);
    setSelectedPageIds(new Set());
    discoveryIdRef.current = null;
    previousStatusRef.current = null;
  }, [stopPolling]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  /**
   * Load initial discovery if ID provided
   */
  useEffect(() => {
    if (initialDiscoveryId) {
      getDiscovery(initialDiscoveryId);
    }

    return () => {
      stopPolling();
    };
  }, [initialDiscoveryId, getDiscovery, stopPolling]);

  /**
   * Persist selection changes
   */
  useEffect(() => {
    if (discoveryIdRef.current && selectedPageIds.size > 0) {
      persistSelection(discoveryIdRef.current, selectedPageIds);
    }
  }, [selectedPageIds]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // State
    discovery,
    isLoading,
    isOperating,
    error,
    cacheMetadata,
    selectedPageIds,

    // Discovery operations
    createDiscovery,
    getDiscovery,
    cancelDiscovery,
    refetch,
    reset,

    // Manual URL operations
    addManualUrl,
    addManualUrls,
    removeManualUrl,

    // Selection operations
    togglePageSelection,
    selectAllPages,
    deselectAllPages,
    setSelectedPageIds,
  };
}
