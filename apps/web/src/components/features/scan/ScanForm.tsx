'use client';

/**
 * Scan Form Component
 * Main form for submitting URLs for accessibility scanning
 * Features:
 * - URL validation with proper input type
 * - Optional email for async results notification
 * - WCAG level selection (A, AA, AAA)
 * - Google reCAPTCHA v3 integration
 * - GDPR-compliant email consent
 */

import { useState, FormEvent, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { executeRecaptcha } from '@/lib/recaptcha';
import { EmailConsentCheckbox } from '../privacy/EmailConsentCheckbox';
import { AiEnhancementSection } from '../ai/AiEnhancementSection';
import { WcagLevelSelector } from './WcagLevelSelector';
import { BatchUrlTable, type BatchUrl } from '../batch/BatchUrlTable';
import { cn } from '@/lib/utils';
import { useAnalytics } from '@/hooks/useAnalytics';

interface DiscoveredPage {
  id: string;
  url: string;
  title?: string;
  depth?: number;
}

interface DiscoveryData {
  discoveryId: string;
  homepageUrl: string;
  pages: DiscoveredPage[];
}

interface ScanFormProps {
  onScanStarted?: (scanId: string) => void;
  onScanSuccess?: () => void;
  className?: string;
  initialUrls?: string[];
}

export function ScanForm({ onScanStarted, onScanSuccess, className, initialUrls }: ScanFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { track } = useAnalytics();
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [emailConsent, setEmailConsent] = useState(false);
  const [wcagLevel, setWcagLevel] = useState<'A' | 'AA' | 'AAA'>('AA');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingMessage, setSubmittingMessage] = useState<string>('Starting Scan...');
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [funnelSessionId, setFunnelSessionId] = useState<string>('');
  const urlEnteredTracked = useRef(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Detect ?ai=1 query parameter for AI pre-selection
  const aiPreSelected = searchParams?.get('ai') === '1';
  const [aiEnabled, setAiEnabled] = useState(aiPreSelected);
  const [isEmailRequired, setIsEmailRequired] = useState(false);

  // Batch mode state
  const [batchUrls, setBatchUrls] = useState<BatchUrl[]>([]);
  const [isBatchMode, setIsBatchMode] = useState(false);

  // Get or create funnel session ID from sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storageKey = 'analytics:funnelSessionId';
    let sessionId = sessionStorage.getItem(storageKey);

    if (!sessionId) {
      // Generate a new funnel session ID
      sessionId = `funnel_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      sessionStorage.setItem(storageKey, sessionId);
    }

    setFunnelSessionId(sessionId);
  }, []);

  // Track form viewed on mount
  useEffect(() => {
    if (!funnelSessionId) return;

    track('funnel_scan_form_viewed', {
      timestamp: new Date().toISOString(),
      sessionId: funnelSessionId,
      funnel_session_id: funnelSessionId,
    });
  }, [funnelSessionId, track]);

  // Load batch URLs from sessionStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = sessionStorage.getItem('discovery:selectedPages');
      if (stored) {
        const data = JSON.parse(stored);
        if (data.pages && Array.isArray(data.pages) && data.pages.length > 0) {
          const urls: BatchUrl[] = data.pages.map((page: DiscoveredPage) => ({
            id: page.id,
            url: page.url,
            title: page.title,
          }));
          setBatchUrls(urls);
          setIsBatchMode(true);
        }
      }
    } catch (err) {
      console.error('Failed to load batch URLs from sessionStorage:', err);
    }
  }, []);

  // Pre-fill URL when initialUrls is provided (legacy support)
  useEffect(() => {
    if (initialUrls && initialUrls.length > 0 && !isBatchMode) {
      // For now, use the first URL (or could join multiple URLs)
      // In the future, this could be expanded to support multiple URLs
      setUrl(initialUrls.join('\n'));
    }
  }, [initialUrls, isBatchMode]);

  // Focus email input when AI is pre-selected
  useEffect(() => {
    if (aiPreSelected && emailInputRef.current) {
      // Delay focus to ensure component is fully mounted
      const timer = setTimeout(() => {
        emailInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [aiPreSelected]);

  // Handle URL input blur to track URL entered
  const handleUrlBlur = () => {
    if (!url.trim() || urlEnteredTracked.current || !funnelSessionId) return;

    urlEnteredTracked.current = true;
    track('funnel_scan_url_entered', {
      timestamp: new Date().toISOString(),
      sessionId: funnelSessionId,
      funnel_session_id: funnelSessionId,
    });
  };

  // Handle AI enhancement email requirement callback
  const handleSetEmailRequired = (required: boolean) => {
    setIsEmailRequired(required);
  };

  // Handle removing a single URL from batch
  const handleRemoveUrl = (id: string) => {
    const updatedUrls = batchUrls.filter((url) => url.id !== id);
    setBatchUrls(updatedUrls);

    // Update sessionStorage
    if (typeof window !== 'undefined') {
      if (updatedUrls.length === 0) {
        // FR-4.10: Revert to single URL mode when all URLs removed
        sessionStorage.removeItem('discovery:selectedPages');
        setIsBatchMode(false);
        setUrl('');
      } else {
        try {
          const stored = sessionStorage.getItem('discovery:selectedPages');
          if (stored) {
            const data = JSON.parse(stored);
            data.pages = updatedUrls.map((url) => ({
              id: url.id,
              url: url.url,
              title: url.title,
            }));
            data.timestamp = Date.now();
            sessionStorage.setItem('discovery:selectedPages', JSON.stringify(data));
          }
        } catch (err) {
          console.error('Failed to update sessionStorage:', err);
        }
      }
    }
  };

  // Handle clearing all batch URLs
  const handleClearAll = () => {
    setBatchUrls([]);
    setIsBatchMode(false);
    setUrl('');

    // Clear sessionStorage (FR-4.10)
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('discovery:selectedPages');
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setCanRetry(false);
    setIsSubmitting(true);

    try {
      // Check for discovered pages in sessionStorage
      let discoveryData: DiscoveryData | null = null;
      if (typeof window !== 'undefined') {
        try {
          const stored = sessionStorage.getItem('discovery:selectedPages');
          if (stored) {
            discoveryData = JSON.parse(stored) as DiscoveryData;
          }
        } catch (err) {
          console.error('Failed to parse discovery data:', err);
        }
      }

      // Validate URL input based on mode
      // In batch mode, URLs come from batchUrls state (loaded from sessionStorage)
      // In single mode, URLs come from the url input field
      if (isBatchMode) {
        // Batch mode validation
        if (batchUrls.length === 0) {
          throw new Error('Please select at least one URL to scan');
        }
      } else {
        // Single URL mode validation
        if (!url.trim()) {
          throw new Error('Please enter a URL');
        }
      }

      // Parse URLs - handle both single URL and multi-line URLs from discovery
      // For batch mode, this is used as fallback but primary source is discoveryData
      const urlLines = url
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      // Only validate urlLines in single mode
      if (!isBatchMode && urlLines.length === 0) {
        throw new Error('Please enter a URL');
      }

      // Validate email requirement for AI-enhanced scans
      if (isEmailRequired && !email.trim()) {
        throw new Error('Email is required for AI-enhanced scans');
      }

      // Validate email consent if email provided
      if (email && !emailConsent) {
        throw new Error('Please consent to receiving results via email');
      }

      // Update message - getting reCAPTCHA token
      setSubmittingMessage('Validating...');

      // Get reCAPTCHA token
      const recaptchaToken = await executeRecaptcha('scan');

      // Determine if this should be a batch scan
      const shouldUseBatch = discoveryData && discoveryData.pages.length > 0;

      // Determine URL count for analytics
      const urlCount = shouldUseBatch && discoveryData
        ? discoveryData.pages.length
        : urlLines.length;

      // Track scan initiation
      track('scan_initiated', {
        wcag_level: wcagLevel,
        scan_type: shouldUseBatch ? 'batch' : 'single',
        url_count: urlCount,
        timestamp: new Date().toISOString(),
        sessionId: funnelSessionId,
      });

      // Track funnel scan submitted
      track('funnel_scan_submitted', {
        timestamp: new Date().toISOString(),
        sessionId: funnelSessionId,
        funnel_session_id: funnelSessionId,
      });

      // Optimistic navigation: Store pending scan data and navigate immediately
      // The /scan/creating page will handle the actual API call
      if (shouldUseBatch && discoveryData) {
        // Batch scan flow - store pending data
        const urls = discoveryData.pages.map(page => page.url);
        const homepageUrl = discoveryData.homepageUrl;

        // Build page titles map
        const pageTitles: Record<string, string> = {};
        discoveryData.pages.forEach(page => {
          if (page.title) {
            pageTitles[page.url] = page.title;
          }
        });

        // Store pending scan data for the creating page
        const pendingScanData = {
          type: 'batch' as const,
          urls,
          wcagLevel,
          recaptchaToken,
          discoveryId: discoveryData.discoveryId,
          pageTitles,
          homepageUrl,
          timestamp: Date.now(),
          email: emailConsent && email.trim() ? email.trim() : undefined,
          aiEnabled: aiEnabled || undefined,
        };

        sessionStorage.setItem('pendingScanData', JSON.stringify(pendingScanData));

        // Clear discovery data from sessionStorage (FR-5.3)
        sessionStorage.removeItem('discovery:selectedPages');
        sessionStorage.removeItem('discovery:homepageUrl');

        // Reset batch mode state (FR-5.3)
        setBatchUrls([]);
        setIsBatchMode(false);

        // Notify parent of success
        onScanSuccess?.();

        // Navigate immediately to creating page
        router.push('/scan/creating');
      } else {
        // Single scan flow - validate and store URL
        const firstUrl = urlLines[0];
        if (!firstUrl) {
          throw new Error('Please enter a URL');
        }
        let validatedUrl: string;

        try {
          const urlObj = new URL(firstUrl);
          if (!['http:', 'https:'].includes(urlObj.protocol)) {
            throw new Error('URL must use HTTP or HTTPS protocol');
          }
          validatedUrl = urlObj.href;
        } catch {
          throw new Error('Please enter a valid URL (e.g., https://example.com)');
        }

        // Store pending scan data for the creating page
        const pendingScanData = {
          type: 'single' as const,
          url: validatedUrl,
          wcagLevel,
          recaptchaToken,
          email: emailConsent && email.trim() ? email.trim() : undefined,
          aiEnabled: aiEnabled || undefined,
          timestamp: Date.now(),
        };

        sessionStorage.setItem('pendingScanData', JSON.stringify(pendingScanData));

        // Clear discovery data from sessionStorage (FR-5.3)
        sessionStorage.removeItem('discovery:selectedPages');
        sessionStorage.removeItem('discovery:homepageUrl');

        // Reset batch mode state (FR-5.3)
        setBatchUrls([]);
        setIsBatchMode(false);

        // Notify parent of success
        onScanSuccess?.();

        // Navigate immediately to creating page
        router.push('/scan/creating');
      }
    } catch (err) {
      let errorMessage = 'Failed to start scan';

      if (err instanceof Error) {
        errorMessage = err.message;

        // Handle quota depleted error (409) gracefully
        if (errorMessage.includes('409') || errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('depleted')) {
          errorMessage = 'AI campaign quota depleted. Your scan will continue with standard analysis only.';

          // If this was an AI-enabled scan, retry without AI
          if (aiEnabled) {
            setAiEnabled(false);
            setError('AI quota depleted - retrying with standard scan...');
            setCanRetry(false);

            // Auto-retry after brief delay
            setTimeout(() => {
              const form = e.target as HTMLFormElement;
              form.requestSubmit();
            }, 1000);
            return;
          }
        }
      }

      setError(errorMessage);
      setCanRetry(true);
      console.error('Scan submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('space-y-6', className)}
      noValidate
    >
      {/* URL Input - Batch Mode or Single Mode */}
      <div>
        <label
          htmlFor="url"
          className="block text-sm font-medium text-foreground mb-2"
        >
          Website URL{isBatchMode ? 's' : ''}
          <span className="text-red-600 ml-1" aria-label="required">
            *
          </span>
        </label>
        {isBatchMode ? (
          // Batch mode: Display BatchUrlTable
          <BatchUrlTable
            urls={batchUrls}
            onRemove={handleRemoveUrl}
            onClearAll={handleClearAll}
            initialDisplayCount={3}
          />
        ) : (
          // Single URL mode: Display input field
          <input
            type="url"
            id="url"
            name="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={handleUrlBlur}
            placeholder="https://example.com"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            className={cn(
              'w-full px-4 py-2 border rounded-lg',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors'
            )}
            required
            disabled={isSubmitting}
            aria-required="true"
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? 'url-error' : undefined}
          />
        )}
      </div>

      {/* WCAG Level Selector */}
      <WcagLevelSelector
        value={wcagLevel}
        onChange={setWcagLevel}
        disabled={isSubmitting}
        showHelp={true}
      />

      {/* AI Enhancement Section */}
      <AiEnhancementSection
        enabled={aiEnabled}
        onEnabledChange={setAiEnabled}
        onEmailRequired={handleSetEmailRequired}
        preSelected={aiPreSelected}
      />

      {/* Email Input (Optional or Required based on AI) */}
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-foreground mb-2"
        >
          Email{' '}
          {isEmailRequired ? (
            <span className="text-red-600 ml-1" aria-label="required">
              *
            </span>
          ) : (
            <span className="text-muted-foreground">(optional)</span>
          )}
        </label>
        <input
          ref={emailInputRef}
          type="email"
          id="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          className={cn(
            'w-full px-4 py-2 border rounded-lg',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors'
          )}
          disabled={isSubmitting}
          required={isEmailRequired}
          aria-required={isEmailRequired ? 'true' : 'false'}
          aria-describedby="email-description"
        />
        <p id="email-description" className="text-xs text-muted-foreground mt-1">
          {isEmailRequired
            ? 'Required for AI-enhanced scans - results delivered within 24 hours'
            : 'Receive results via email for scans longer than 30 seconds'}
        </p>
        {email && (
          <EmailConsentCheckbox
            checked={emailConsent}
            onChange={setEmailConsent}
          />
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div
          id="url-error"
          role="alert"
          className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg"
        >
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <p className="text-red-700 text-sm font-medium mb-2">{error}</p>
              {canRetry && initialUrls && initialUrls.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-red-600 text-sm">
                    Your discovered pages are still saved. You can:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={cn(
                        'px-3 py-1.5 text-sm font-medium',
                        'bg-red-600 text-white rounded-lg',
                        'hover:bg-red-700 transition-colors',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                    >
                      Retry with Same Selection
                    </button>
                    <a
                      href="/discovery?returnUrl=/"
                      className={cn(
                        'px-3 py-1.5 text-sm font-medium',
                        'bg-white text-red-600 border border-red-300 rounded-lg',
                        'hover:bg-red-50 transition-colors'
                      )}
                    >
                      Modify Selection
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className={cn(
          'w-full py-3 px-4 rounded-lg font-medium',
          'bg-blue-600 text-white',
          'hover:bg-blue-700 active:bg-blue-800',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors'
        )}
        aria-live="polite"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {submittingMessage}
          </span>
        ) : isBatchMode ? (
          `Scan ${batchUrls.length} Page${batchUrls.length === 1 ? '' : 's'}`
        ) : (
          'Scan Website'
        )}
      </button>

      {/* reCAPTCHA Disclaimer */}
      <p className="text-xs text-muted-foreground text-center">
        This site is protected by reCAPTCHA and the Google{' '}
        <a
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          Privacy Policy
        </a>{' '}
        and{' '}
        <a
          href="https://policies.google.com/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          Terms of Service
        </a>{' '}
        apply.
      </p>
    </form>
  );
}
