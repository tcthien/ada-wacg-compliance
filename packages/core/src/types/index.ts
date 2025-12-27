/**
 * Type definitions for ADAShield
 *
 * This module exports all type definitions used across the ADAShield platform.
 */

// Scan types
export type {
  Scan,
  ScanStatus,
  WcagLevel,
  CreateScanInput,
  UpdateScanInput,
} from './scan.types.js';

// Issue types
export type {
  Issue,
  IssueImpact,
  IssueNode,
  CreateIssueInput,
  IssueSummary,
} from './issue.types.js';

// Report types
export type {
  Report,
  ReportFormat,
  CreateReportInput,
  ReportGenerationOptions,
  ReportMetadata,
} from './report.types.js';

// Session types
export type {
  GuestSession,
  CreateGuestSessionInput,
  ValidateGuestSessionInput,
  GuestSessionValidation,
  GuestSessionMetadata,
} from './session.types.js';

// API types
export type {
  ApiError,
  ApiResponse,
  CreateGuestSessionRequest,
  CreateGuestSessionResponse,
  CreateScanRequest,
  CreateScanResponse,
  GetScanResponse,
  GetScanStatusResponse,
  ListScansRequest,
  ListScansResponse,
  GenerateReportRequest,
  GenerateReportResponse,
  GetReportResponse,
  GetScanIssuesRequest,
  GetScanIssuesResponse,
  GetIssueResponse,
  RateLimitHeaders,
  RateLimitError,
} from './api.types.js';
