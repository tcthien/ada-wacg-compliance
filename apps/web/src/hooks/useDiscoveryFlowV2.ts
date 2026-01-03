import { useRouter } from 'next/navigation';
import { useDiscoveryFlowV2Store } from '@/stores/discovery-flow-v2-store';
import type { FlowStep } from '@/stores/discovery-flow-v2-store';
import { discoveryApi, isTerminalStatus } from '@/lib/discovery-api';
import type { DiscoveryStatus } from '@/lib/discovery-api.types';
import { validateUrl, generateId, parseManualUrls } from '@/lib/url-utils';
import type { ParsedUrl } from '@/lib/url-utils';
import { createDiscoveryError } from '@/types/discovery-errors';
import { useAnalytics } from './useAnalytics';
import { useRef } from 'react';

/**
 * Generate analytics session ID for tracking user flow
 */
const generateSessionId = () => `discovery-v2-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Discovery Flow V2 Hook
 *
 * Business logic layer for the 3-step discovery flow redesign.
 * Wraps the Zustand store and provides navigation helpers.
 *
 * Features:
 * - Step navigation with validation (US-6)
 * - Router integration for flow completion
 * - Store state access and actions
 * - Sitemap fetching with polling (US-1, NFR-1.1)
 * - Manual URL parsing and validation (US-2)
 * - Selection submission to sessionStorage (FR-5.1)
 *
 * Step Flow:
 * 1. Input → Select (when URLs are parsed via sitemap or manual)
 * 2. Select → Preview (when URLs are selected)
 * 3. Preview → Batch creation (navigates to home page)
 *
 * Usage:
 * ```tsx
 * const {
 *   currentStep,
 *   inputMethod,
 *   setInputMethod,
 *   goBack,
 *   goToPreview,
 *   canProceedToSelect,
 *   canProceedToPreview,
 *   parseManual,
 *   fetchSitemap,
 *   submitSelection
 * } = useDiscoveryFlowV2();
 *
 * // Navigate between steps
 * if (canProceedToSelect()) {
 *   goToSelect();
 * }
 *
 * // Parse manual URLs
 * parseManual();
 *
 * // Fetch sitemap
 * await fetchSitemap('https://example.com/sitemap.xml');
 *
 * // Submit selection
 * submitSelection();
 *
 * // Go back in the flow
 * goBack();
 * ```
 */
export function useDiscoveryFlowV2() {
  const router = useRouter();
  const store = useDiscoveryFlowV2Store();
  const { track } = useAnalytics();

  // Generate and maintain a session ID for analytics tracking
  const sessionIdRef = useRef<string>(generateSessionId());

  /**
   * Navigate to the previous step in the flow
   * - From 'select' → 'input'
   * - From 'preview' → 'select'
   * - From 'input' → no-op (already at start)
   */
  const goBack = () => {
    const stepOrder: FlowStep[] = ['input', 'select', 'preview'];
    const currentIndex = stepOrder.indexOf(store.currentStep);

    if (currentIndex > 0) {
      const previousStep = stepOrder[currentIndex - 1];
      store.setCurrentStep(previousStep);
    }
  };

  /**
   * Navigate to the select step (from input)
   * Only allowed if URLs have been parsed
   */
  const goToSelect = () => {
    if (store.canProceedToSelect()) {
      store.setCurrentStep('select');
    }
  };

  /**
   * Navigate to the preview step (from select)
   * Only allowed if at least one URL is selected
   * Note: This is now handled by goToPreviewWithAnalytics
   */

  /**
   * Navigate to the input step
   * Can be called from any step for navigation freedom (US-6)
   */
  const goToInput = () => {
    store.setCurrentStep('input');
  };

  /**
   * Complete the flow and navigate to batch page
   * Called after batch scan is successfully created
   * @param batchId - ID of the created batch scan
   */
  const completeFlow = (batchId: string) => {
    // Clear flow state
    store.reset();

    // Navigate to batch page
    router.push(`/batch/${batchId}`);
  };

  /**
   * Parse manual URL input
   *
   * Features:
   * - Validates and normalizes URLs from manual input
   * - Supports semicolon-separated and multi-line formats
   * - Handles validation errors with appropriate DiscoveryError types
   * - Sets parsed URLs and navigates to select step on success
   *
   * Implements:
   * - US-2: Manual URL Entry
   *
   * @example
   * ```tsx
   * parseManual();
   * // On success, user is on the select step with parsed URLs
   * // On error, store.error contains validation errors
   * ```
   */
  const parseManual = (): void => {
    // Clear any existing errors
    store.setError(null);

    // Get manual input from store
    const input = store.manualInput;

    // Validate input is not empty
    if (!input || input.trim().length === 0) {
      const error = createDiscoveryError(
        'INVALID_MANUAL_INPUT',
        'Please enter at least one URL.',
        false,
        'Empty manual input'
      );
      store.setError(error);
      return;
    }

    // Parse and validate URLs
    const { validUrls, errors } = parseManualUrls(input);

    // Handle validation errors
    if (errors.length > 0) {
      // If there are NO valid URLs, show a generic error
      if (validUrls.length === 0) {
        const errorMessages = errors.map((e) => e.message).join(', ');
        const error = createDiscoveryError(
          'INVALID_MANUAL_INPUT',
          `No valid URLs found. ${errorMessages}`,
          true,
          `Validation errors: ${JSON.stringify(errors)}`
        );
        store.setError(error);
        return;
      }

      // If there are SOME valid URLs, show a warning about invalid ones
      const invalidCount = errors.length;
      const validCount = validUrls.length;
      const error = createDiscoveryError(
        'PARTIAL_VALIDATION_ERRORS',
        `${invalidCount} invalid URL(s) were skipped. ${validCount} valid URL(s) will be used.`,
        false,
        `Validation errors: ${JSON.stringify(errors)}`
      );
      store.setError(error);
    }

    // Success: Set parsed URLs and navigate to select step
    store.setParsedUrls(validUrls);
    store.setCurrentStep('select');

    // Track analytics event for manual URL parsing
    track('discovery_v2_method_selected', {
      method: 'manual',
      timestamp: new Date().toISOString(),
      sessionId: sessionIdRef.current,
    });

    track('discovery_v2_urls_parsed', {
      count: validUrls.length,
      method: 'manual',
      timestamp: new Date().toISOString(),
      sessionId: sessionIdRef.current,
    });
  };

  /**
   * Fetch and parse sitemap URLs
   *
   * Features:
   * - Validates sitemap URL format
   * - Calls discovery API to start sitemap parsing
   * - Polls for completion with exponential backoff (max 30 attempts)
   * - Converts discovered pages to ParsedUrl format
   * - Navigates to select step on success
   * - Handles errors with appropriate DiscoveryError types
   *
   * Implements:
   * - US-1: Sitemap URL Discovery
   * - NFR-1.1: Sitemap parsing within 10 seconds
   *
   * @param sitemapUrl - URL of the sitemap to fetch
   *
   * @example
   * ```tsx
   * try {
   *   await fetchSitemap('https://example.com/sitemap.xml');
   *   // On success, user is on the select step with parsed URLs
   * } catch (error) {
   *   // Error is stored in store.error
   * }
   * ```
   */
  const fetchSitemap = async (sitemapUrl: string): Promise<void> => {
    // Clear any existing errors
    store.setError(null);

    // Validate sitemap URL
    if (!validateUrl(sitemapUrl)) {
      const error = createDiscoveryError(
        'INVALID_SITEMAP_URL',
        'Please enter a valid sitemap URL (e.g., https://example.com/sitemap.xml)',
        false,
        `Invalid URL format: ${sitemapUrl}`
      );
      store.setError(error);
      return;
    }

    // Set loading state
    store.setLoading(true);

    try {
      // Step 1: Create discovery job
      // Note: MVP constraints limit maxPages to 10 and maxDepth must be >= 1
      const { discovery } = await discoveryApi.create({
        homepageUrl: sitemapUrl,
        mode: 'AUTO',
        maxPages: 10, // MVP limit: maximum 10 pages
        maxDepth: 1, // MVP limit: minimum 1 (API requires positive value)
      });

      // Step 2: Poll for completion with exponential backoff
      const pollDelay = async (attempt: number): Promise<void> => {
        // Exponential backoff: 500ms, 1s, 2s, 4s, 8s, then 10s max
        const baseDelay = 500;
        const maxDelay = 10000;
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        await new Promise((resolve) => setTimeout(resolve, delay));
      };

      const maxAttempts = 30; // Max 30 attempts (approx. 5 minutes total)
      let attempts = 0;
      let discoveryStatus: DiscoveryStatus = discovery.status;

      while (!isTerminalStatus(discoveryStatus) && attempts < maxAttempts) {
        // Wait before polling
        await pollDelay(attempts);
        attempts++;

        // Poll for status
        try {
          const { discovery: updatedDiscovery } = await discoveryApi.get(
            discovery.id,
            true // Force refresh from database
          );
          discoveryStatus = updatedDiscovery.status;

          // Check if completed successfully
          if (discoveryStatus === 'COMPLETED') {
            // Convert discovered pages to ParsedUrl format
            const parsedUrls: ParsedUrl[] = updatedDiscovery.pages.map(
              (page) => ({
                id: page.id,
                url: page.url,
                source: 'sitemap',
              })
            );

            // Validate we got some URLs
            if (parsedUrls.length === 0) {
              const error = createDiscoveryError(
                'NO_URLS_IN_SITEMAP',
                'No URLs found in the sitemap. Please check the sitemap URL and try again.',
                true,
                `Discovery completed but returned 0 pages`
              );
              store.setError(error);
              store.setLoading(false);
              return;
            }

            // Success: Set parsed URLs and navigate to select step
            store.setParsedUrls(parsedUrls);
            store.setLoading(false);
            store.setCurrentStep('select');

            // Track analytics event for sitemap URL parsing
            track('discovery_v2_method_selected', {
              method: 'sitemap',
              timestamp: new Date().toISOString(),
              sessionId: sessionIdRef.current,
            });

            track('discovery_v2_urls_parsed', {
              count: parsedUrls.length,
              method: 'sitemap',
              timestamp: new Date().toISOString(),
              sessionId: sessionIdRef.current,
            });

            return;
          }

          // Check if failed
          if (discoveryStatus === 'FAILED') {
            const errorMessage =
              updatedDiscovery.errorMessage ||
              'Failed to parse sitemap. Please check the URL and try again.';
            const error = createDiscoveryError(
              'SITEMAP_PARSE_FAILED',
              errorMessage,
              true,
              `Discovery failed with error: ${updatedDiscovery.errorCode || 'UNKNOWN'}`
            );
            store.setError(error);
            store.setLoading(false);
            return;
          }

          // Check if cancelled
          if (discoveryStatus === 'CANCELLED') {
            const error = createDiscoveryError(
              'SITEMAP_FETCH_FAILED',
              'Sitemap parsing was cancelled.',
              true,
              'Discovery was cancelled by user or system'
            );
            store.setError(error);
            store.setLoading(false);
            return;
          }
        } catch (pollError) {
          // Retry polling on network errors
          continue;
        }
      }

      // If we exit the loop, it means we hit max attempts (timeout)
      if (attempts >= maxAttempts) {
        const error = createDiscoveryError(
          'API_TIMEOUT',
          'Sitemap parsing is taking longer than expected. Please try again later.',
          true,
          `Polling timed out after ${maxAttempts} attempts`
        );
        store.setError(error);
        store.setLoading(false);
        return;
      }
    } catch (error) {
      // Handle API errors
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to fetch sitemap. Please try again.';

      const discoveryError = createDiscoveryError(
        'SITEMAP_FETCH_FAILED',
        errorMessage,
        true,
        error instanceof Error ? error.stack : undefined
      );

      store.setError(discoveryError);
      store.setLoading(false);
    }
  };

  /**
   * Wrapper for toggleSelection with analytics tracking
   */
  const toggleSelectionWithAnalytics = (id: string): void => {
    store.toggleSelection(id);

    // Track selection change event
    const selectedCount = store.selectedIds.has(id)
      ? store.selectedIds.size
      : store.selectedIds.size;

    track('discovery_v2_selection_changed', {
      selected: selectedCount,
      total: store.parsedUrls.length,
      timestamp: new Date().toISOString(),
      sessionId: sessionIdRef.current,
    });
  };

  /**
   * Wrapper for selectAll with analytics tracking
   */
  const selectAllWithAnalytics = (): void => {
    store.selectAll();

    // Track select all event
    track('discovery_v2_select_all_clicked', {
      timestamp: new Date().toISOString(),
      sessionId: sessionIdRef.current,
    });
    track('discovery_v2_selection_changed', {
      selected: store.parsedUrls.length,
      total: store.parsedUrls.length,
      timestamp: new Date().toISOString(),
      sessionId: sessionIdRef.current,
    });
  };

  /**
   * Wrapper for deselectAll with analytics tracking
   */
  const deselectAllWithAnalytics = (): void => {
    store.deselectAll();

    // Track deselect all event
    track('discovery_v2_deselect_all_clicked', {
      timestamp: new Date().toISOString(),
      sessionId: sessionIdRef.current,
    });
    track('discovery_v2_selection_changed', {
      selected: 0,
      total: store.parsedUrls.length,
      timestamp: new Date().toISOString(),
      sessionId: sessionIdRef.current,
    });
  };

  /**
   * Navigate to preview step with analytics tracking
   */
  const goToPreviewWithAnalytics = (): void => {
    if (store.canProceedToPreview()) {
      store.setCurrentStep('preview');

      // Track preview viewed event
      const selectedCount = store.selectedIds.size;
      track('discovery_v2_preview_viewed', {
        url_count: selectedCount,
        timestamp: new Date().toISOString(),
        sessionId: sessionIdRef.current,
      });
    }
  };

  /**
   * Submit selected URLs to sessionStorage
   *
   * Features:
   * - Saves selected URLs to sessionStorage in SelectedPagesStorage format
   * - Resets the discovery flow store
   * - Navigates to home page for batch creation
   *
   * Implements:
   * - FR-5.1: Persist discovery state in sessionStorage
   * - US-2: Manual URL Entry completion flow
   *
   * sessionStorage Format:
   * ```typescript
   * interface SelectedPagesStorage {
   *   homepageUrl?: string;
   *   pages: Array<{ id: string; url: string; title?: string }>;
   *   source: 'sitemap' | 'manual';
   *   timestamp: number;
   * }
   * ```
   *
   * @example
   * ```tsx
   * submitSelection();
   * // Selected URLs are saved to sessionStorage
   * // User is redirected to home page "/"
   * // Store is reset to initial state
   * ```
   */
  const submitSelection = (): void => {
    // Get selected URLs from store
    const selectedUrls = store.getSelectedUrls();

    // Validate that URLs are selected
    if (selectedUrls.length === 0) {
      const error = createDiscoveryError(
        'NO_URLS_SELECTED',
        'Please select at least one URL to continue.',
        false,
        'No URLs selected for submission'
      );
      store.setError(error);
      return;
    }

    // Derive homepageUrl from the first selected URL
    // This is used by ScanForm to display the domain being scanned
    const firstUrl = selectedUrls[0]?.url || '';
    let homepageUrl = firstUrl;
    try {
      const urlObj = new URL(firstUrl);
      homepageUrl = urlObj.origin; // e.g., "https://example.com"
    } catch {
      // If URL parsing fails, use the raw URL
      homepageUrl = firstUrl;
    }

    // Generate a unique discoveryId for this manual/sitemap selection
    // Format: "v2-{method}-{timestamp}" to distinguish from API-based discoveries
    const discoveryId = `v2-${store.inputMethod || 'manual'}-${Date.now()}`;

    // Prepare sessionStorage data with all required fields for ScanForm
    const selectedPagesStorage = {
      discoveryId,
      homepageUrl,
      pages: selectedUrls.map((url) => ({
        id: url.id,
        url: url.url,
        title: undefined, // No title available in V2 flow
      })),
      source: store.inputMethod || 'manual', // Use inputMethod from store
      timestamp: Date.now(),
    };

    // Save to sessionStorage
    try {
      sessionStorage.setItem(
        'discovery:selectedPages',
        JSON.stringify(selectedPagesStorage)
      );
    } catch (error) {
      const storageError = createDiscoveryError(
        'STORAGE_ERROR',
        'Failed to save selection. Please try again.',
        true,
        error instanceof Error ? error.message : 'Unknown storage error'
      );
      store.setError(storageError);
      return;
    }

    // Track analytics event for scan submission
    track('discovery_v2_scan_started', {
      url_count: selectedUrls.length,
      method: store.inputMethod || 'manual',
      timestamp: new Date().toISOString(),
      sessionId: sessionIdRef.current,
    });

    // Reset the store to clear all state
    store.reset();

    // Navigate to home page
    router.push('/');
  };

  return {
    // Store state
    currentStep: store.currentStep,
    inputMethod: store.inputMethod,
    sitemapUrl: store.sitemapUrl,
    manualInput: store.manualInput,
    parsedUrls: store.parsedUrls,
    selectedIds: store.selectedIds,
    isLoading: store.isLoading,
    isSubmitting: store.isSubmitting,
    error: store.error,

    // Store actions
    setInputMethod: store.setInputMethod,
    setSitemapUrl: store.setSitemapUrl,
    setManualInput: store.setManualInput,
    setParsedUrls: store.setParsedUrls,
    setSelectedIds: store.setSelectedIds,
    toggleSelection: toggleSelectionWithAnalytics, // Analytics-wrapped
    selectAll: selectAllWithAnalytics, // Analytics-wrapped
    deselectAll: deselectAllWithAnalytics, // Analytics-wrapped
    setLoading: store.setLoading,
    setSubmitting: store.setSubmitting,
    setError: store.setError,
    reset: store.reset,

    // Computed getters
    canProceedToSelect: store.canProceedToSelect,
    canProceedToPreview: store.canProceedToPreview,
    getSelectedUrls: store.getSelectedUrls,

    // Navigation helpers
    goBack,
    goToInput,
    goToSelect,
    goToPreview: goToPreviewWithAnalytics, // Analytics-wrapped
    completeFlow,

    // URL parsing and submission
    parseManual,
    fetchSitemap,
    submitSelection,
  };
}
