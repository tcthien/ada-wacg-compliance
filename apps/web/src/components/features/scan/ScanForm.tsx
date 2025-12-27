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

import { useState, FormEvent } from 'react';
import { api } from '@/lib/api';
import { executeRecaptcha } from '@/lib/recaptcha';
import { EmailConsentCheckbox } from '../privacy/EmailConsentCheckbox';
import { cn } from '@/lib/utils';

interface ScanFormProps {
  onScanStarted?: (scanId: string) => void;
  className?: string;
}

export function ScanForm({ onScanStarted, className }: ScanFormProps) {
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [emailConsent, setEmailConsent] = useState(false);
  const [wcagLevel, setWcagLevel] = useState<'A' | 'AA' | 'AAA'>('AA');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Validate URL
      if (!url.trim()) {
        throw new Error('Please enter a URL');
      }

      // Validate URL format
      try {
        const urlObj = new URL(url.trim());
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          throw new Error('URL must use HTTP or HTTPS protocol');
        }
      } catch {
        throw new Error('Please enter a valid URL (e.g., https://example.com)');
      }

      // Validate email consent if email provided
      if (email && !emailConsent) {
        throw new Error('Please consent to receiving results via email');
      }

      // Get reCAPTCHA token
      const recaptchaToken = await executeRecaptcha('scan');

      // Build request payload
      const requestData: {
        url: string;
        wcagLevel: 'A' | 'AA' | 'AAA';
        recaptchaToken: string;
        email?: string;
      } = {
        url: url.trim(),
        wcagLevel,
        recaptchaToken,
      };

      // Only include email if consent is given and email is provided
      if (emailConsent && email.trim()) {
        requestData.email = email.trim();
      }

      // Submit scan
      const result = await api.scans.create(requestData);

      onScanStarted?.(result.scanId);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to start scan';
      setError(errorMessage);
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
      {/* URL Input */}
      <div>
        <label
          htmlFor="url"
          className="block text-sm font-medium text-foreground mb-2"
        >
          Website URL
          <span className="text-red-600 ml-1" aria-label="required">
            *
          </span>
        </label>
        <input
          type="url"
          id="url"
          name="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
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
      </div>

      {/* WCAG Level Selector */}
      <div>
        <fieldset>
          <legend className="block text-sm font-medium text-foreground mb-2">
            WCAG Conformance Level
          </legend>
          <div className="flex gap-4" role="radiogroup">
            {(['A', 'AA', 'AAA'] as const).map((level) => (
              <label
                key={level}
                className={cn(
                  'flex items-center gap-2 cursor-pointer',
                  'px-3 py-2 rounded-lg border transition-colors',
                  wcagLevel === level
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:border-gray-400',
                  isSubmitting && 'opacity-50 cursor-not-allowed'
                )}
              >
                <input
                  type="radio"
                  name="wcagLevel"
                  value={level}
                  checked={wcagLevel === level}
                  onChange={() => setWcagLevel(level)}
                  className="text-blue-600 focus:ring-2 focus:ring-blue-500"
                  disabled={isSubmitting}
                />
                <span className="font-medium">Level {level}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Level AA is recommended for most websites (legal compliance standard)
          </p>
        </fieldset>
      </div>

      {/* Email Input (Optional) */}
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-foreground mb-2"
        >
          Email <span className="text-muted-foreground">(optional)</span>
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className={cn(
            'w-full px-4 py-2 border rounded-lg',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors'
          )}
          disabled={isSubmitting}
          aria-describedby="email-description"
        />
        <p id="email-description" className="text-xs text-muted-foreground mt-1">
          Receive results via email for scans longer than 30 seconds
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
          className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
        >
          {error}
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
            Starting Scan...
          </span>
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
