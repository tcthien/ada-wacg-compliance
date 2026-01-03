'use client';

import { useId } from 'react';

/**
 * Props for ManualUrlEntryEnhanced component
 */
export interface ManualUrlEntryEnhancedProps {
  /** Current textarea value */
  value: string;
  /** Callback when textarea value changes */
  onChange: (text: string) => void;
  /** Callback when form is submitted */
  onSubmit: () => void;
  /** Error message to display */
  error?: string;
  /** Current number of URLs parsed */
  urlCount: number;
  /** Maximum number of URLs allowed */
  maxUrls: number;
  /** Disabled state */
  disabled?: boolean;
  /** Loading state */
  isLoading?: boolean;
}

/**
 * ManualUrlEntryEnhanced component
 *
 * Enhanced manual URL entry component for Discovery Flow V2.
 * Supports multiple URL input formats:
 * - Multi-line format (one URL per line)
 * - Semicolon-separated format (single line)
 *
 * Features:
 * - Shows URL count and max limit (e.g., "5 / 50 URLs")
 * - Displays helper text about supported formats
 * - Shows warning when approaching or exceeding limit
 * - Validates against FR-1.3, FR-1.4, FR-1.5, FR-1.8
 *
 * @example
 * ```tsx
 * <ManualUrlEntryEnhanced
 *   value={urlText}
 *   onChange={setUrlText}
 *   onSubmit={handleSubmit}
 *   urlCount={5}
 *   maxUrls={50}
 * />
 * ```
 */
export function ManualUrlEntryEnhanced({
  value,
  onChange,
  onSubmit,
  error,
  urlCount,
  maxUrls,
  disabled = false,
  isLoading = false,
}: ManualUrlEntryEnhancedProps) {
  const textareaId = useId();
  const errorId = useId();
  const helpTextId = useId();

  /**
   * Handle textarea change
   */
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  /**
   * Handle form submission
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!disabled && !isLoading && value.trim()) {
      onSubmit();
    }
  };

  /**
   * Handle Enter key submission (Ctrl+Enter or Cmd+Enter)
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!disabled && !isLoading && value.trim()) {
        onSubmit();
      }
    }
  };

  // Determine URL count status
  const isNearLimit = urlCount >= maxUrls * 0.8; // 80% of max
  const isAtLimit = urlCount >= maxUrls;
  const isOverLimit = urlCount > maxUrls;

  // Calculate percentage for visual indicator
  const percentage = Math.min((urlCount / maxUrls) * 100, 100);

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Label and URL counter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
        <label
          htmlFor={textareaId}
          className="block text-sm font-medium text-gray-700"
        >
          Enter URLs
        </label>

        <div
          className={`text-sm font-medium ${
            isOverLimit
              ? 'text-red-600'
              : isAtLimit
                ? 'text-orange-600'
                : isNearLimit
                  ? 'text-yellow-600'
                  : 'text-gray-600'
          }`}
          role="status"
          aria-live="polite"
        >
          {urlCount} / {maxUrls} URLs
          {isOverLimit && (
            <span className="ml-1 text-xs">(limit exceeded)</span>
          )}
          {isAtLimit && !isOverLimit && (
            <span className="ml-1 text-xs">(at limit)</span>
          )}
        </div>
      </div>

      {/* Visual progress bar */}
      <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            isOverLimit
              ? 'bg-red-500'
              : isAtLimit
                ? 'bg-orange-500'
                : isNearLimit
                  ? 'bg-yellow-500'
                  : 'bg-blue-500'
          }`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={urlCount}
          aria-valuemin={0}
          aria-valuemax={maxUrls}
          aria-label="URL count progress"
        />
      </div>

      {/* Textarea input */}
      <textarea
        id={textareaId}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled || isLoading}
        placeholder={`Enter URLs in one of these formats:

Multi-line (one URL per line):
https://example.com
https://example.com/about
https://example.com/contact

Semicolon-separated:
https://example.com;https://example.com/about;https://example.com/contact`}
        aria-describedby={`${helpTextId}${error ? ` ${errorId}` : ''}`}
        aria-invalid={!!error}
        rows={8}
        className={`
          w-full px-3 py-2 text-sm font-mono
          border rounded-md shadow-sm
          placeholder:text-gray-400 placeholder:font-sans
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
          ${error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'}
        `}
      />

      {/* Error message */}
      {error && (
        <div
          id={errorId}
          className="flex items-start gap-2 text-sm text-red-600"
          role="alert"
        >
          <svg
            className="w-4 h-4 mt-0.5 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Warning message when approaching limit */}
      {isNearLimit && !isOverLimit && !error && (
        <div className="flex items-start gap-2 text-sm text-yellow-700 bg-yellow-50 px-3 py-2 rounded-md">
          <svg
            className="w-4 h-4 mt-0.5 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>
            Approaching the maximum limit of {maxUrls} URLs. Currently at{' '}
            {urlCount} URLs.
          </span>
        </div>
      )}

      {/* Help text */}
      <div
        id={helpTextId}
        className="space-y-2 text-xs text-gray-600"
      >
        <div className="flex items-start gap-2">
          <svg
            className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <p className="font-medium mb-1">Supported formats:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                <strong>Multi-line:</strong> One URL per line
              </li>
              <li>
                <strong>Semicolon-separated:</strong> URLs separated by
                semicolons (;)
              </li>
            </ul>
          </div>
        </div>

        <p className="text-gray-500 italic">
          Tip: Press Ctrl+Enter (Cmd+Enter on Mac) to submit
        </p>
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={disabled || isLoading || !value.trim() || isOverLimit}
        className={`
          w-full sm:w-auto inline-flex items-center justify-center
          px-4 py-3 sm:py-2 text-base sm:text-sm font-medium rounded-md
          transition-colors duration-200
          ${
            disabled || isLoading || !value.trim() || isOverLimit
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
            Processing...
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
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Parse URLs {urlCount > 0 && `(${urlCount})`}
          </>
        )}
      </button>
    </form>
  );
}
