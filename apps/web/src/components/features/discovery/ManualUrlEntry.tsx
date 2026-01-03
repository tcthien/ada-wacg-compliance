'use client';

import { useState, useId, useCallback } from 'react';

/**
 * Props for ManualUrlEntry component
 */
export interface ManualUrlEntryProps {
  /** Base domain URL for validation */
  baseDomain: string;
  /** Callback when single URL is submitted */
  onAddUrl: (url: string) => Promise<void>;
  /** Callback when multiple URLs are submitted */
  onAddUrls: (urls: string[]) => Promise<void>;
  /** Whether URL addition is in progress */
  isLoading?: boolean;
  /** Maximum number of URLs allowed */
  maxUrls?: number;
  /** Disabled state */
  disabled?: boolean;
  /** Optional class name for styling */
  className?: string;
}

/**
 * URL validation result
 */
interface UrlValidation {
  url: string;
  valid: boolean;
  error?: string;
}

/**
 * Validate a single URL
 */
function validateUrl(url: string, baseDomain: string): UrlValidation {
  const trimmed = url.trim();

  if (!trimmed) {
    return { url: trimmed, valid: false, error: 'URL cannot be empty' };
  }

  try {
    const parsed = new URL(trimmed);
    const baseUrl = new URL(baseDomain);

    // Check protocol
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { url: trimmed, valid: false, error: 'URL must use HTTP or HTTPS' };
    }

    // Check same domain (with www normalization)
    const normalizedParsed = parsed.hostname.replace(/^www\./, '');
    const normalizedBase = baseUrl.hostname.replace(/^www\./, '');

    if (normalizedParsed !== normalizedBase) {
      return {
        url: trimmed,
        valid: false,
        error: `URL must be on the same domain (${baseUrl.hostname})`,
      };
    }

    return { url: trimmed, valid: true };
  } catch {
    return { url: trimmed, valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Parse and validate multiple URLs from text
 */
function parseUrls(text: string, baseDomain: string): UrlValidation[] {
  const lines = text
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((url) => validateUrl(url, baseDomain));
}

/**
 * ManualUrlEntry component
 *
 * Allows users to manually enter URLs to add to a discovery.
 * Supports single URL input and bulk paste mode for multiple URLs.
 * Validates URLs against the base domain and provides error feedback.
 *
 * @example
 * ```tsx
 * <ManualUrlEntry
 *   baseDomain="https://example.com"
 *   onAddUrl={async (url) => console.log('Adding:', url)}
 *   onAddUrls={async (urls) => console.log('Adding:', urls)}
 * />
 * ```
 */
export function ManualUrlEntry({
  baseDomain,
  onAddUrl,
  onAddUrls,
  isLoading = false,
  maxUrls = 50,
  disabled = false,
  className = '',
}: ManualUrlEntryProps) {
  const inputId = useId();
  const errorId = useId();

  const [inputValue, setInputValue] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<UrlValidation[]>(
    []
  );

  /**
   * Handle single URL input change
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setInputValue(value);
      setError(null);

      // Auto-detect bulk mode when pasting multiple lines
      if (!isBulkMode && value.includes('\n')) {
        setIsBulkMode(true);
      }

      // Validate as user types (debounced would be better for performance)
      if (isBulkMode && value.trim()) {
        const results = parseUrls(value, baseDomain);
        setValidationResults(results);
      } else {
        setValidationResults([]);
      }
    },
    [baseDomain, isBulkMode]
  );

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedValue = inputValue.trim();
    if (!trimmedValue) {
      setError('Please enter a URL');
      return;
    }

    if (isBulkMode) {
      // Bulk mode - multiple URLs
      const results = parseUrls(trimmedValue, baseDomain);
      const validUrls = results.filter((r) => r.valid).map((r) => r.url);
      const invalidCount = results.filter((r) => !r.valid).length;

      if (validUrls.length === 0) {
        setError('No valid URLs found. Please check the URLs and try again.');
        setValidationResults(results);
        return;
      }

      if (validUrls.length > maxUrls) {
        setError(`Maximum ${maxUrls} URLs allowed. Please reduce the number of URLs.`);
        return;
      }

      try {
        await onAddUrls(validUrls);
        setInputValue('');
        setValidationResults([]);
        if (invalidCount > 0) {
          setError(`Added ${validUrls.length} URLs. ${invalidCount} invalid URLs were skipped.`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add URLs');
      }
    } else {
      // Single URL mode
      const validation = validateUrl(trimmedValue, baseDomain);
      if (!validation.valid) {
        setError(validation.error || 'Invalid URL');
        return;
      }

      try {
        await onAddUrl(validation.url);
        setInputValue('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add URL');
      }
    }
  };

  /**
   * Toggle bulk mode
   */
  const toggleBulkMode = () => {
    setIsBulkMode(!isBulkMode);
    setValidationResults([]);
    setError(null);
  };

  const validCount = validationResults.filter((r) => r.valid).length;
  const invalidCount = validationResults.filter((r) => !r.valid).length;

  return (
    <form
      onSubmit={handleSubmit}
      className={`space-y-3 ${className}`}
    >
      {/* Label and mode toggle - responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700"
        >
          {isBulkMode ? 'Enter URLs (one per line)' : 'Enter URL'}
        </label>

        <button
          type="button"
          onClick={toggleBulkMode}
          disabled={disabled || isLoading}
          className="text-sm text-blue-600 hover:text-blue-700 focus:outline-none focus:underline disabled:text-gray-400 self-start sm:self-auto"
        >
          {isBulkMode ? 'Switch to single URL' : 'Add multiple URLs'}
        </button>
      </div>

      {/* Input field */}
      {isBulkMode ? (
        <textarea
          id={inputId}
          value={inputValue}
          onChange={handleInputChange}
          disabled={disabled || isLoading}
          placeholder={`https://${new URL(baseDomain).hostname}/page1\nhttps://${new URL(baseDomain).hostname}/page2\nhttps://${new URL(baseDomain).hostname}/page3`}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={!!error}
          rows={5}
          className={`
            w-full px-3 py-2 text-sm
            border rounded-md shadow-sm
            placeholder:text-gray-400
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-50 disabled:text-gray-500
            ${error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'}
          `}
        />
      ) : (
        <input
          type="url"
          id={inputId}
          value={inputValue}
          onChange={handleInputChange}
          disabled={disabled || isLoading}
          placeholder={`https://${new URL(baseDomain).hostname}/page`}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={!!error}
          className={`
            w-full px-3 py-2 text-sm
            border rounded-md shadow-sm
            placeholder:text-gray-400
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-50 disabled:text-gray-500
            ${error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'}
          `}
        />
      )}

      {/* Validation summary for bulk mode */}
      {isBulkMode && validationResults.length > 0 && (
        <div className="flex items-center gap-4 text-sm">
          {validCount > 0 && (
            <span className="text-green-600">
              <svg
                className="inline-block w-4 h-4 mr-1"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              {validCount} valid
            </span>
          )}
          {invalidCount > 0 && (
            <span className="text-red-600">
              <svg
                className="inline-block w-4 h-4 mr-1"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
              {invalidCount} invalid
            </span>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <p
          id={errorId}
          className="text-sm text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}

      {/* Submit button - full width on mobile */}
      <button
        type="submit"
        disabled={disabled || isLoading || !inputValue.trim()}
        className={`
          w-full sm:w-auto inline-flex items-center justify-center
          px-4 py-3 sm:py-2 text-base sm:text-sm font-medium rounded-md
          transition-colors duration-200
          ${
            disabled || isLoading || !inputValue.trim()
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
          }
        `}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin mr-2 h-4 w-4"
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Adding...
          </>
        ) : (
          <>
            <svg
              className="mr-2 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            {isBulkMode
              ? `Add ${validCount > 0 ? validCount : ''} URL${validCount !== 1 ? 's' : ''}`
              : 'Add URL'}
          </>
        )}
      </button>

      {/* Help text */}
      <p className="text-xs text-gray-500">
        URLs must be on the same domain as {new URL(baseDomain).hostname}
      </p>
    </form>
  );
}
