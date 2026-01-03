/**
 * Discovery Module Error Classes
 *
 * Structured error handling across discovery layers:
 * - DiscoveryRepositoryError: Database operations
 * - DiscoveryServiceError: Business logic
 * - DiscoveryWorkerError: Background job processing
 */

/**
 * Error codes for discovery operations
 */
export enum DiscoveryErrorCode {
  // Validation errors
  INVALID_URL = 'INVALID_URL',
  DOMAIN_MISMATCH = 'DOMAIN_MISMATCH',
  INVALID_INPUT = 'INVALID_INPUT',

  // Resource errors
  USAGE_LIMIT_EXCEEDED = 'USAGE_LIMIT_EXCEEDED',
  DISCOVERY_NOT_FOUND = 'DISCOVERY_NOT_FOUND',
  PAGE_NOT_FOUND = 'PAGE_NOT_FOUND',

  // State errors
  DISCOVERY_ALREADY_RUNNING = 'DISCOVERY_ALREADY_RUNNING',
  DISCOVERY_CANCELLED = 'DISCOVERY_CANCELLED',
  PAGE_ALREADY_EXISTS = 'PAGE_ALREADY_EXISTS',

  // Operation errors
  SITEMAP_FETCH_FAILED = 'SITEMAP_FETCH_FAILED',
  NAVIGATION_EXTRACTION_FAILED = 'NAVIGATION_EXTRACTION_FAILED',
  TIMEOUT = 'TIMEOUT',

  // Generic errors
  CREATE_FAILED = 'CREATE_FAILED',
  UPDATE_FAILED = 'UPDATE_FAILED',
  DELETE_FAILED = 'DELETE_FAILED',
  GET_FAILED = 'GET_FAILED',
  LIST_FAILED = 'LIST_FAILED',
}

/**
 * Optional error details
 */
export interface ErrorDetails {
  [key: string]: unknown;
}

/**
 * Discovery Repository Error
 *
 * Thrown by repository layer for database operation failures.
 * Maps database errors to application-level error codes.
 */
export class DiscoveryRepositoryError extends Error {
  public readonly code: string;
  public readonly details?: ErrorDetails;
  public readonly cause?: Error | undefined;

  constructor(
    message: string,
    code: DiscoveryErrorCode | string,
    options?: {
      details?: ErrorDetails;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'DiscoveryRepositoryError';
    this.code = code;
    this.details = options?.details;
    this.cause = options?.cause;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DiscoveryRepositoryError);
    }
  }
}

/**
 * Discovery Service Error
 *
 * Thrown by service layer for business logic failures.
 * Orchestrates repository operations and external services.
 */
export class DiscoveryServiceError extends Error {
  public readonly code: string;
  public readonly details?: ErrorDetails;
  public readonly cause?: Error | undefined;

  constructor(
    message: string,
    code: DiscoveryErrorCode | string,
    options?: {
      details?: ErrorDetails;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'DiscoveryServiceError';
    this.code = code;
    this.details = options?.details;
    this.cause = options?.cause;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DiscoveryServiceError);
    }
  }
}

/**
 * Discovery Worker Error
 *
 * Thrown by worker layer for background job processing failures.
 * Handles crawling, sitemap parsing, and page discovery operations.
 */
export class DiscoveryWorkerError extends Error {
  public readonly code: string;
  public readonly details?: ErrorDetails;
  public readonly cause?: Error | undefined;

  constructor(
    message: string,
    code: DiscoveryErrorCode | string,
    options?: {
      details?: ErrorDetails;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'DiscoveryWorkerError';
    this.code = code;
    this.details = options?.details;
    this.cause = options?.cause;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DiscoveryWorkerError);
    }
  }
}
