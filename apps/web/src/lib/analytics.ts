/**
 * Core Analytics DataLayer Functions
 *
 * Provides type-safe interface for Google Tag Manager (GTM) and dataLayer
 * integration with comprehensive error handling and debug support.
 *
 * Features:
 * - Safe dataLayer initialization
 * - Type-safe event pushing
 * - Error handling with debug logging
 * - Environment-aware configuration
 */

import { env } from './env';
import type { DataLayerEvent } from './analytics.types';

/**
 * Initialize the dataLayer array on the window object
 * Must be called before GTM container loads to ensure dataLayer exists
 *
 * @returns true if dataLayer was initialized or already exists, false if skipped
 */
export function initializeDataLayer(): boolean {
  // Skip initialization if analytics is disabled
  if (!env.analyticsEnabled) {
    if (env.analyticsDebug) {
      console.info('[Analytics] Analytics disabled, skipping dataLayer initialization');
    }
    return false;
  }

  // Skip initialization if GTM container ID is not configured
  if (!env.gtmId) {
    if (env.analyticsDebug) {
      console.info('[Analytics] GTM container ID not configured, skipping dataLayer initialization');
    }
    return false;
  }

  // Check if running in browser environment
  if (typeof window === 'undefined') {
    if (env.analyticsDebug) {
      console.warn('[Analytics] Cannot initialize dataLayer in non-browser environment');
    }
    return false;
  }

  // Initialize dataLayer if it doesn't exist
  if (!window.dataLayer) {
    window.dataLayer = [];
    if (env.analyticsDebug) {
      console.info('[Analytics] dataLayer initialized');
    }
  } else if (env.analyticsDebug) {
    console.info('[Analytics] dataLayer already exists');
  }

  return true;
}

/**
 * Push an event to the GTM dataLayer with type safety
 *
 * @param event - Typed event object to push to dataLayer
 * @returns true if event was pushed successfully, false otherwise
 *
 * @example
 * ```typescript
 * pushToDataLayer({
 *   event: 'scan_initiated',
 *   timestamp: new Date().toISOString(),
 *   sessionId: 'abc123',
 *   wcag_level: 'AA',
 *   scan_type: 'single',
 *   url_count: 1
 * });
 * ```
 */
export function pushToDataLayer(event: DataLayerEvent): boolean {
  // Skip if analytics is disabled
  if (!env.analyticsEnabled) {
    if (env.analyticsDebug) {
      console.info('[Analytics] Analytics disabled, skipping event:', event.event);
    }
    return false;
  }

  // Skip if GTM container ID is not configured
  if (!env.gtmId) {
    if (env.analyticsDebug) {
      console.info('[Analytics] GTM not configured, skipping event:', event.event);
    }
    return false;
  }

  // Check if running in browser environment
  if (typeof window === 'undefined') {
    if (env.analyticsDebug) {
      console.warn('[Analytics] Cannot push event in non-browser environment:', event.event);
    }
    return false;
  }

  // Initialize dataLayer if it doesn't exist
  if (!window.dataLayer) {
    if (env.analyticsDebug) {
      console.warn('[Analytics] dataLayer not initialized, initializing now');
    }
    initializeDataLayer();
  }

  try {
    // Push event to dataLayer
    window.dataLayer.push(event);

    if (env.analyticsDebug) {
      console.info('[Analytics] Event pushed to dataLayer:', event);
    }

    return true;
  } catch (error) {
    if (env.analyticsDebug) {
      console.error('[Analytics] Failed to push event to dataLayer:', error, event);
    }
    return false;
  }
}

/**
 * Safe wrapper for analytics operations with error handling
 * Prevents analytics errors from breaking application functionality
 *
 * @param operation - Async operation to execute safely
 * @param fallback - Fallback value to return if operation fails
 * @param context - Context description for error logging (debug mode only)
 * @returns Result of operation or fallback value if operation fails
 *
 * @example
 * ```typescript
 * const result = await safeAnalyticsCall(
 *   async () => pushToDataLayer(event),
 *   false,
 *   'push scan_initiated event'
 * );
 * ```
 */
export async function safeAnalyticsCall<T>(
  operation: () => Promise<T> | T,
  fallback: T,
  context?: string
): Promise<T> {
  try {
    const result = await operation();
    return result;
  } catch (error) {
    // Only log errors in debug mode to avoid console spam in production
    if (env.analyticsDebug) {
      const contextMsg = context ? ` (${context})` : '';
      console.error(`[Analytics] Operation failed${contextMsg}:`, error);
    }
    return fallback;
  }
}

/**
 * Sanitize URL by removing query parameters and hash fragments
 * Prevents PII leakage through URL parameters
 *
 * @param url - URL to sanitize
 * @returns Sanitized URL with only protocol, host, and path, or empty string if invalid
 *
 * @example
 * ```typescript
 * sanitizeUrl('https://example.com/page?email=user@example.com#section')
 * // Returns: 'https://example.com/page'
 *
 * sanitizeUrl('invalid-url')
 * // Returns: ''
 * ```
 */
export function sanitizeUrl(url: string): string {
  // Handle empty or invalid input
  if (!url || typeof url !== 'string') {
    return '';
  }

  try {
    // Parse URL to extract components
    const urlObj = new URL(url);

    // Reconstruct URL with only protocol, host, and pathname
    // This removes query parameters and hash fragments
    return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
  } catch (error) {
    // Invalid URL format - return empty string
    if (env.analyticsDebug) {
      console.warn('[Analytics] Invalid URL for sanitization:', url);
    }
    return '';
  }
}

/**
 * Sanitize error message by removing email patterns and URLs with query strings
 * Prevents PII leakage through error messages
 *
 * @param message - Error message to sanitize
 * @returns Sanitized error message with PII removed
 *
 * @example
 * ```typescript
 * sanitizeError('User user@example.com failed to access https://example.com/api?token=secret')
 * // Returns: 'User [EMAIL_REMOVED] failed to access [URL_REMOVED]'
 *
 * sanitizeError('')
 * // Returns: ''
 * ```
 */
export function sanitizeError(message: string): string {
  // Handle empty or invalid input
  if (!message || typeof message !== 'string') {
    return '';
  }

  let sanitized = message;

  // Remove email addresses (RFC 5322 simplified pattern)
  // Matches: user@example.com, user.name+tag@example.co.uk
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  sanitized = sanitized.replace(emailPattern, '[EMAIL_REMOVED]');

  // Remove URLs with query strings (potential PII in parameters)
  // Matches: http://example.com?query, https://example.com/path?query=value
  const urlWithQueryPattern = /https?:\/\/[^\s]+\?[^\s]*/g;
  sanitized = sanitized.replace(urlWithQueryPattern, '[URL_REMOVED]');

  return sanitized;
}
