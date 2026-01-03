/**
 * AI Campaign Error Classes
 *
 * Structured error handling for AI Early Bird campaign operations.
 * Follows established error pattern from scan.repository.ts and discovery.errors.ts.
 */

/**
 * Error codes for AI campaign operations
 */
export enum AiCampaignErrorCode {
  // Resource errors
  CAMPAIGN_NOT_FOUND = 'CAMPAIGN_NOT_FOUND',
  CAMPAIGN_INACTIVE = 'CAMPAIGN_INACTIVE',
  QUOTA_DEPLETED = 'QUOTA_DEPLETED',

  // CSV validation errors
  INVALID_CSV = 'INVALID_CSV',

  // Scan-related errors
  SCAN_NOT_FOUND = 'SCAN_NOT_FOUND',
  SCAN_NOT_AI_ENABLED = 'SCAN_NOT_AI_ENABLED',

  // Operation errors
  IMPORT_FAILED = 'IMPORT_FAILED',
}

/**
 * Optional error details for additional context
 */
export interface AiCampaignErrorDetails {
  [key: string]: unknown;
}

/**
 * AI Campaign Error
 *
 * Custom error class for AI campaign operations with error code and HTTP status mapping.
 * Provides structured error handling with optional details and cause tracking.
 */
export class AiCampaignError extends Error {
  public readonly code: AiCampaignErrorCode;
  public readonly httpStatus: number;
  public readonly details?: AiCampaignErrorDetails;
  public readonly cause?: Error | undefined;

  constructor(
    message: string,
    code: AiCampaignErrorCode,
    options?: {
      details?: AiCampaignErrorDetails;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'AiCampaignError';
    this.code = code;
    this.httpStatus = this.getHttpStatus(code);
    this.details = options?.details;
    this.cause = options?.cause;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AiCampaignError);
    }
  }

  /**
   * Map error codes to HTTP status codes
   */
  private getHttpStatus(code: AiCampaignErrorCode): number {
    const statusMap: Record<AiCampaignErrorCode, number> = {
      [AiCampaignErrorCode.CAMPAIGN_NOT_FOUND]: 404,
      [AiCampaignErrorCode.CAMPAIGN_INACTIVE]: 409,
      [AiCampaignErrorCode.QUOTA_DEPLETED]: 409,
      [AiCampaignErrorCode.INVALID_CSV]: 400,
      [AiCampaignErrorCode.SCAN_NOT_FOUND]: 404,
      [AiCampaignErrorCode.SCAN_NOT_AI_ENABLED]: 400,
      [AiCampaignErrorCode.IMPORT_FAILED]: 500,
    };

    return statusMap[code] ?? 500;
  }
}
