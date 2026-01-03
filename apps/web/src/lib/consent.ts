/**
 * Consent Storage Utilities
 *
 * Provides utilities for managing user consent preferences in localStorage.
 * Handles consent state persistence with SSR safety and graceful error handling.
 *
 * Features:
 * - SSR-safe localStorage access
 * - Graceful JSON parse error handling
 * - Default consent fallback
 * - Type-safe consent operations
 *
 * Related: CookieConsent component (apps/web/src/components/features/privacy/CookieConsent.tsx)
 */

import type { ConsentStatus } from './analytics.types';
import { CONSENT_STORAGE_KEY, DEFAULT_CONSENT } from './analytics.constants';

// ============================================================================
// CONSENT STORAGE OPERATIONS
// ============================================================================

/**
 * Get current consent status from localStorage
 *
 * Returns stored consent preferences or default consent if:
 * - No consent stored yet
 * - JSON parse error occurs
 * - Running in SSR context (no window)
 *
 * @returns ConsentStatus object with user preferences
 *
 * @example
 * ```typescript
 * const consent = getConsent();
 * if (consent.analytics) {
 *   // Enable analytics tracking
 * }
 * ```
 */
export function getConsent(): ConsentStatus {
  // SSR safety check
  if (typeof window === 'undefined') {
    return DEFAULT_CONSENT;
  }

  try {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);

    // Return default if no consent stored
    if (!stored) {
      return DEFAULT_CONSENT;
    }

    // Parse and return stored consent
    const parsed = JSON.parse(stored) as ConsentStatus;
    return parsed;
  } catch (error) {
    // Gracefully handle JSON parse errors
    console.warn('Failed to parse consent from localStorage:', error);
    return DEFAULT_CONSENT;
  }
}

/**
 * Save consent status to localStorage
 *
 * Persists user consent preferences for future visits.
 * Safe to call in SSR context (no-op if window is undefined).
 *
 * @param status - ConsentStatus object to persist
 *
 * @example
 * ```typescript
 * setConsent({
 *   essential: true,
 *   analytics: true,
 *   marketing: false,
 *   timestamp: new Date().toISOString(),
 *   version: '1.0'
 * });
 * ```
 */
export function setConsent(status: ConsentStatus): void {
  // SSR safety check
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const serialized = JSON.stringify(status);
    localStorage.setItem(CONSENT_STORAGE_KEY, serialized);
  } catch (error) {
    // Gracefully handle storage errors (quota exceeded, privacy mode, etc.)
    console.error('Failed to save consent to localStorage:', error);
  }
}

// ============================================================================
// COOKIE MANAGEMENT
// ============================================================================

/**
 * Clear all Google Analytics cookies
 *
 * Removes all GA cookies from document.cookie when consent is declined.
 * Handles both Universal Analytics (_ga, _gid, _gat) and GA4 (_ga_*) cookies.
 *
 * Cookie domains attempted:
 * - Current domain
 * - Parent domain (e.g., .example.com)
 * - Root domain (e.g., .com)
 *
 * Safe to call in SSR context (no-op if document is undefined).
 *
 * @example
 * ```typescript
 * // When user declines analytics consent
 * clearAnalyticsCookies();
 * ```
 */
export function clearAnalyticsCookies(): void {
  // SSR safety check
  if (typeof document === 'undefined') {
    return;
  }

  // List of GA cookie patterns to remove
  const gaCookiePatterns = ['_ga', '_gid', '_gat'];

  // Get all cookies
  const cookies = document.cookie.split(';');

  cookies.forEach((cookie) => {
    const firstPart = cookie.split('=')[0];
    if (!firstPart) return;
    const cookieName = firstPart.trim();

    // Check if cookie matches GA patterns or is a GA4 measurement cookie (_ga_*)
    const isGACookie =
      gaCookiePatterns.some((pattern) => cookieName.startsWith(pattern)) ||
      cookieName.startsWith('_ga_');

    if (isGACookie) {
      // Delete cookie for multiple domain levels to ensure removal
      const domains = [
        '', // Current domain
        `.${window.location.hostname}`, // Explicit current domain
        `.${window.location.hostname.split('.').slice(-2).join('.')}`, // Parent domain
      ];

      domains.forEach((domain) => {
        // Set cookie with past expiration date to delete it
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; ${
          domain ? `domain=${domain};` : ''
        }`;
      });
    }
  });
}

// ============================================================================
// BACKWARD COMPATIBILITY
// ============================================================================

/**
 * Migrate old consent format to new format
 *
 * Converts legacy 'cookieConsent' localStorage key (string: 'accepted'|'declined')
 * to new CONSENT_STORAGE_KEY format (ConsentStatus object).
 *
 * Migration mapping:
 * - 'accepted' → analytics: true
 * - 'declined' → analytics: false
 *
 * After successful migration:
 * - Old key is removed from localStorage
 * - New format is saved with current timestamp
 *
 * Safe to call in SSR context (no-op if window is undefined).
 * Idempotent - safe to call multiple times.
 *
 * @example
 * ```typescript
 * // Call once during app initialization
 * migrateOldConsent();
 * ```
 */
export function migrateOldConsent(): void {
  // SSR safety check
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const OLD_CONSENT_KEY = 'cookieConsent';
    const oldConsent = localStorage.getItem(OLD_CONSENT_KEY);

    // No migration needed if old key doesn't exist
    if (!oldConsent) {
      return;
    }

    // Check if new format already exists (avoid overwriting)
    const existingConsent = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (existingConsent) {
      // New format exists, just clean up old key
      localStorage.removeItem(OLD_CONSENT_KEY);
      return;
    }

    // Convert old format to new format
    const analyticsConsent = oldConsent === 'accepted';

    const newConsent: ConsentStatus = {
      essential: true, // Essential cookies always enabled
      analytics: analyticsConsent,
      marketing: false, // Default to false for marketing
      timestamp: new Date().toISOString(),
      version: '1.0',
    };

    // Save new format
    setConsent(newConsent);

    // Clean up old key
    localStorage.removeItem(OLD_CONSENT_KEY);

    console.info('Migrated old consent format to new format');
  } catch (error) {
    // Gracefully handle migration errors
    console.error('Failed to migrate old consent format:', error);
  }
}
