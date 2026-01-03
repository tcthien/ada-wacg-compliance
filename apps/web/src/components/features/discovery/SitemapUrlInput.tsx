'use client';

import { useId, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/**
 * Props for SitemapUrlInput component
 */
export interface SitemapUrlInputProps {
  /** Current sitemap URL value */
  value: string;
  /** Callback when URL value changes */
  onChange: (url: string) => void;
  /** Callback when form is submitted */
  onSubmit: () => void;
  /** Validation error message */
  error?: string;
  /** Loading state */
  isLoading: boolean;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * SitemapUrlInput component
 *
 * Single URL input field for sitemap location entry.
 * Validates URL format and provides error feedback.
 * Supports Enter key submission.
 *
 * Used in Discovery Flow V2 when user selects "Sitemap" method.
 *
 * @example
 * ```tsx
 * <SitemapUrlInput
 *   value={sitemapUrl}
 *   onChange={setSitemapUrl}
 *   onSubmit={handleSubmit}
 *   error={validationError}
 *   isLoading={isSubmitting}
 * />
 * ```
 */
export function SitemapUrlInput({
  value,
  onChange,
  onSubmit,
  error,
  isLoading,
  disabled = false,
}: SitemapUrlInputProps) {
  const inputId = useId();
  const errorId = useId();

  /**
   * Handle input change
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!disabled && !isLoading && value.trim()) {
        onSubmit();
      }
    },
    [disabled, isLoading, value, onSubmit]
  );

  /**
   * Handle Enter key press on input
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !disabled && !isLoading && value.trim()) {
        e.preventDefault();
        onSubmit();
      }
    },
    [disabled, isLoading, value, onSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Label */}
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-gray-700"
      >
        Sitemap URL
      </label>

      {/* Input field */}
      <div className="space-y-2">
        <Input
          id={inputId}
          type="url"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={disabled || isLoading}
          placeholder="https://example.com/sitemap.xml"
          aria-describedby={error ? errorId : undefined}
          aria-invalid={!!error}
          className={error ? 'border-red-300 focus-visible:ring-red-500' : ''}
        />

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
      </div>

      {/* Submit button */}
      <Button
        type="submit"
        disabled={disabled || isLoading || !value.trim()}
        loading={isLoading}
        className="w-full sm:w-auto"
      >
        {isLoading ? 'Loading Sitemap...' : 'Load Sitemap'}
      </Button>

      {/* Help text */}
      <p className="text-xs text-gray-500">
        Enter the URL of your XML sitemap file (e.g., sitemap.xml or sitemap_index.xml)
      </p>
    </form>
  );
}
