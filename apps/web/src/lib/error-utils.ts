/**
 * Error classification and message utilities for customer-facing error handling
 *
 * @module error-utils
 * @see .claude/specs/customer-ui-ux-improvement/design.md - Section: Enhanced ErrorBoundary Approach
 */

/**
 * Error type classification for contextual error handling
 */
export type ErrorType = 'network' | 'timeout' | 'server' | 'unknown';

/**
 * Error message structure for user-facing error displays
 */
export interface ErrorMessage {
  title: string;
  description: string;
  action: string;
}

/**
 * Classifies an error into a specific type for contextual error handling
 *
 * @param error - The error object to classify
 * @returns The classified error type
 *
 * @example
 * ```typescript
 * try {
 *   await fetch('https://api.example.com');
 * } catch (error) {
 *   const errorType = classifyError(error as Error);
 *   // errorType might be 'network', 'timeout', 'server', or 'unknown'
 * }
 * ```
 */
export function classifyError(error: Error): ErrorType {
  // Network/fetch errors
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return 'network';
  }

  // Timeout and abort errors
  if (
    error.message.includes('timeout') ||
    error.message.includes('aborted') ||
    error.name === 'TimeoutError' ||
    error.name === 'AbortError'
  ) {
    return 'timeout';
  }

  // Server errors (5xx)
  if (
    error.message.includes('500') ||
    error.message.includes('502') ||
    error.message.includes('503') ||
    error.message.includes('504') ||
    error.message.toLowerCase().includes('internal server error') ||
    error.message.toLowerCase().includes('bad gateway') ||
    error.message.toLowerCase().includes('service unavailable') ||
    error.message.toLowerCase().includes('gateway timeout')
  ) {
    return 'server';
  }

  // Default to unknown for unclassified errors
  return 'unknown';
}

/**
 * Get user-friendly error message based on error type
 *
 * @param type - The classified error type
 * @returns User-friendly error message with title, description, and action label
 *
 * @example
 * ```typescript
 * const errorType = classifyError(error);
 * const { title, description, action } = getErrorMessage(errorType);
 * ```
 */
export function getErrorMessage(type: ErrorType): ErrorMessage {
  const messages: Record<ErrorType, ErrorMessage> = {
    network: {
      title: 'Connection Error',
      description: 'Please check your internet connection and try again.',
      action: 'Retry',
    },
    timeout: {
      title: 'Request Timeout',
      description: 'The server is taking too long to respond.',
      action: 'Try Again',
    },
    server: {
      title: 'Server Error',
      description: 'Something went wrong on our end. Please try again later.',
      action: 'Retry',
    },
    unknown: {
      title: 'Something Went Wrong',
      description: 'An unexpected error occurred.',
      action: 'Retry',
    },
  };

  return messages[type];
}

/**
 * Classify error and get appropriate message in a single call
 *
 * @param error - The error object to classify
 * @returns User-friendly error message with classified type
 *
 * @example
 * ```typescript
 * try {
 *   await performScan();
 * } catch (error) {
 *   const { type, message } = classifyAndGetMessage(error as Error);
 *   showErrorDialog(message.title, message.description);
 * }
 * ```
 */
export function classifyAndGetMessage(error: Error): {
  type: ErrorType;
  message: ErrorMessage;
} {
  const type = classifyError(error);
  const message = getErrorMessage(type);
  return { type, message };
}
