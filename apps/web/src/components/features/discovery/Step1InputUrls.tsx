'use client';

import { useCallback } from 'react';
import { InputMethodSelector, type InputMethod } from './InputMethodSelector';
import { SitemapUrlInput } from './SitemapUrlInput';
import { ManualUrlEntryEnhanced } from './ManualUrlEntryEnhanced';
import { useDiscoveryFlowV2 } from '@/hooks/useDiscoveryFlowV2';
import { parseManualUrls } from '@/lib/url-utils';

/**
 * Props for Step1InputUrls component
 */
export interface Step1InputUrlsProps {
  /** Callback when user continues to next step (not used in V2 - navigation handled by hook) */
  onContinue?: () => void;
  /** Loading state from parent (not used in V2 - loading handled by hook) */
  isLoading?: boolean;
}

/**
 * Maximum number of URLs allowed for manual entry
 * Implements FR-1.8: Validate manual entry limits
 */
const MAX_MANUAL_URLS = 50;

/**
 * Step1InputUrls - URL Input Container
 *
 * Container component for Step 1 of the Discovery Flow V2.
 * Orchestrates the URL input experience by composing:
 * - InputMethodSelector: Choose between sitemap and manual input
 * - SitemapUrlInput: Single URL input for sitemap location
 * - ManualUrlEntryEnhanced: Multi-URL textarea for manual entry
 *
 * Features:
 * - Method selection with visual feedback (FR-1.1)
 * - Sitemap URL input with validation (FR-1.2, US-1)
 * - Manual URL input with multi-format support (FR-1.3, US-2)
 * - Real-time URL counting and limit validation (FR-1.8)
 * - Error handling and user feedback
 * - Automatic navigation to Step 2 on successful parsing
 *
 * Implements:
 * - FR-1.1: Display two input method options
 * - FR-1.2: Sitemap URL input
 * - FR-1.3: Manual URL textarea
 * - FR-1.8: Manual entry limit validation
 * - US-1: Sitemap URL Discovery
 * - US-2: Manual URL Entry
 *
 * @example
 * ```tsx
 * <Step1InputUrls />
 * ```
 */
export function Step1InputUrls({
  onContinue,
  isLoading: parentLoading,
}: Step1InputUrlsProps) {
  const {
    inputMethod,
    sitemapUrl,
    manualInput,
    isLoading,
    error,
    setInputMethod,
    setSitemapUrl,
    setManualInput,
    setError,
    fetchSitemap,
    parseManual,
  } = useDiscoveryFlowV2();

  /**
   * Handle input method change
   * Clears errors when switching methods
   */
  const handleMethodChange = useCallback(
    (method: InputMethod) => {
      setInputMethod(method);
      setError(null);
    },
    [setInputMethod, setError]
  );

  /**
   * Handle sitemap URL change
   * Clears errors when typing
   */
  const handleSitemapUrlChange = useCallback(
    (url: string) => {
      setSitemapUrl(url);
      if (error) {
        setError(null);
      }
    },
    [setSitemapUrl, setError, error]
  );

  /**
   * Handle sitemap submit
   * Calls fetchSitemap from hook which handles:
   * - URL validation
   * - API call to create discovery job
   * - Polling for completion
   * - Navigation to Step 2 on success
   */
  const handleSitemapSubmit = useCallback(async () => {
    await fetchSitemap(sitemapUrl);
  }, [fetchSitemap, sitemapUrl]);

  /**
   * Handle manual input change
   * Clears errors when typing
   */
  const handleManualInputChange = useCallback(
    (text: string) => {
      setManualInput(text);
      if (error) {
        setError(null);
      }
    },
    [setManualInput, setError, error]
  );

  /**
   * Handle manual input submit
   * Calls parseManual from hook which handles:
   * - URL validation and parsing
   * - Error handling for invalid URLs
   * - Navigation to Step 2 on success
   */
  const handleManualSubmit = useCallback(() => {
    parseManual();
  }, [parseManual]);

  /**
   * Calculate current URL count for manual input
   * Used to show real-time feedback about URL limits
   */
  const currentUrlCount = manualInput
    ? parseManualUrls(manualInput).validUrls.length
    : 0;

  /**
   * Extract error message from error object
   * Handles both DiscoveryError types and generic Error types
   */
  const errorMessage = error?.userMessage || null;

  return (
    <div className="space-y-6">
      {/* Step header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Step 1: Enter URLs
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Choose how you want to provide URLs for accessibility scanning
        </p>
      </div>

      {/* Input method selector */}
      <InputMethodSelector
        value={inputMethod}
        onChange={handleMethodChange}
        disabled={isLoading}
      />

      {/* Conditional input based on selected method */}
      <div className="mt-6">
        {inputMethod === 'SITEMAP' ? (
          <SitemapUrlInput
            value={sitemapUrl}
            onChange={handleSitemapUrlChange}
            onSubmit={handleSitemapSubmit}
            error={errorMessage || undefined}
            isLoading={isLoading}
          />
        ) : (
          <ManualUrlEntryEnhanced
            value={manualInput}
            onChange={handleManualInputChange}
            onSubmit={handleManualSubmit}
            error={errorMessage || undefined}
            urlCount={currentUrlCount}
            maxUrls={MAX_MANUAL_URLS}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
}
