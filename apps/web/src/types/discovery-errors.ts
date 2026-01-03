/**
 * Discovery Error Types
 *
 * Typed error handling for the Discovery Flow V2 redesign.
 * Supports both Sitemap and Manual URL input methods.
 */

/**
 * Union type representing all possible discovery error scenarios
 */
export type DiscoveryErrorType =
  // Sitemap-related errors
  | 'INVALID_SITEMAP_URL'
  | 'SITEMAP_FETCH_FAILED'
  | 'SITEMAP_PARSE_FAILED'
  | 'NO_URLS_IN_SITEMAP'
  // Manual URL errors
  | 'MANUAL_URL_INVALID'
  | 'MANUAL_URL_LIMIT_EXCEEDED'
  // Selection errors
  | 'NO_URLS_SELECTED'
  // System errors
  | 'SESSION_STORAGE_FULL'
  | 'API_TIMEOUT'
  // Generic errors
  | 'UNKNOWN_ERROR';

/**
 * Discovery error interface with type-safe error handling
 */
export interface DiscoveryError {
  /**
   * Type of discovery error that occurred
   */
  type: DiscoveryErrorType;

  /**
   * User-friendly error message
   */
  message: string;

  /**
   * Whether the operation can be retried
   */
  retryable: boolean;

  /**
   * Optional technical details for debugging
   */
  details?: string;
}

/**
 * Type guard to check if an error is a DiscoveryError
 */
export function isDiscoveryError(error: unknown): error is DiscoveryError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    'message' in error &&
    'retryable' in error
  );
}

/**
 * Factory function to create standardized discovery errors
 */
export function createDiscoveryError(
  type: DiscoveryErrorType,
  message: string,
  retryable: boolean,
  details?: string
): DiscoveryError {
  return {
    type,
    message,
    retryable,
    details,
  };
}
