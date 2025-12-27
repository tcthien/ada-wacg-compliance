/**
 * API request/response types for ADAShield
 */

import type { Scan, ScanStatus, WcagLevel } from './scan.types.js';
import type { Issue, IssueSummary } from './issue.types.js';
import type { Report, ReportFormat, ReportGenerationOptions } from './report.types.js';
import type { GuestSession } from './session.types.js';

/**
 * Standard API error response
 */
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Standard API success response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

// ==================== Guest Session API ====================

/**
 * POST /api/guest-session - Create guest session
 */
export interface CreateGuestSessionRequest {
  fingerprint: string;
}

export interface CreateGuestSessionResponse {
  session: GuestSession;
}

// ==================== Scan API ====================

/**
 * POST /api/scans - Create new scan
 */
export interface CreateScanRequest {
  url: string;
  email: string;
  wcagLevel: WcagLevel;
  guestSessionId?: string;
}

export interface CreateScanResponse {
  scan: Scan;
}

/**
 * GET /api/scans/:scanId - Get scan details
 */
export interface GetScanResponse {
  scan: Scan;
  issues?: Issue[];
  issueSummary?: IssueSummary;
  reports?: Report[];
}

/**
 * GET /api/scans/:scanId/status - Get scan status
 */
export interface GetScanStatusResponse {
  scanId: string;
  status: ScanStatus;
  progress?: number; // 0-100 percentage
  durationMs?: number;
  errorMessage?: string;
  completedAt?: string;
}

/**
 * GET /api/scans - List scans (with pagination)
 */
export interface ListScansRequest {
  page?: number;
  limit?: number;
  status?: ScanStatus;
  guestSessionId?: string;
  userId?: string;
}

export interface ListScansResponse {
  scans: Scan[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ==================== Report API ====================

/**
 * POST /api/scans/:scanId/reports - Generate report
 */
export interface GenerateReportRequest {
  format: ReportFormat;
  options?: ReportGenerationOptions;
}

export interface GenerateReportResponse {
  report: Report;
}

/**
 * GET /api/reports/:reportId - Get report details
 */
export interface GetReportResponse {
  report: Report;
}

/**
 * GET /api/reports/:reportId/download - Download report (returns file)
 */
// No request/response types needed - returns file directly

// ==================== Issues API ====================

/**
 * GET /api/scans/:scanId/issues - Get issues for a scan
 */
export interface GetScanIssuesRequest {
  impact?: string[]; // Filter by impact levels
  wcagCriteria?: string[]; // Filter by WCAG criteria
  page?: number;
  limit?: number;
}

export interface GetScanIssuesResponse {
  issues: Issue[];
  summary: IssueSummary;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * GET /api/issues/:issueId - Get issue details
 */
export interface GetIssueResponse {
  issue: Issue;
}

// ==================== Rate Limiting ====================

/**
 * Rate limit headers included in API responses
 */
export interface RateLimitHeaders {
  'X-RateLimit-Limit': string; // Max requests per window
  'X-RateLimit-Remaining': string; // Remaining requests
  'X-RateLimit-Reset': string; // Unix timestamp when limit resets
}

/**
 * Rate limit error response (HTTP 429)
 */
export interface RateLimitError extends ApiError {
  error: {
    code: 'RATE_LIMIT_EXCEEDED';
    message: string;
    details: {
      retryAfter: number; // Seconds until retry allowed
      limit: number;
      window: string; // e.g., "1 hour", "1 day"
    };
  };
}
