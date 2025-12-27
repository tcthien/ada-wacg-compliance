import { z } from 'zod';
import type {
  WcagLevel,
  ScanStatus,
  IssueImpact,
  Scan,
} from '@adashield/core';
import {
  CreateScanRequestSchema,
  ScanResponseSchema,
  ScanStatusResponseSchema,
  ScanIdParamSchema,
  WcagLevelSchema,
  ScanStatusSchema,
  IssueImpactSchema,
} from './scan.schema.js';

/**
 * Type inference from Zod schemas
 * These types are automatically derived from the Zod validation schemas
 * to ensure runtime validation matches compile-time types
 */

/**
 * Request body for creating a new scan
 *
 * @property url - Target URL to scan (HTTP/HTTPS only)
 * @property email - Optional email for report delivery
 * @property wcagLevel - WCAG conformance level (A, AA, AAA)
 * @property recaptchaToken - reCAPTCHA v3 token for spam prevention
 *
 * @example
 * ```ts
 * const request: CreateScanRequest = {
 *   url: 'https://example.com',
 *   email: 'user@example.com',
 *   wcagLevel: 'AA',
 *   recaptchaToken: 'abc123...'
 * };
 * ```
 */
export type CreateScanRequest = z.infer<typeof CreateScanRequestSchema>;

/**
 * Response body for scan creation
 *
 * Contains the complete scan entity with all metadata.
 * Status will be PENDING immediately after creation.
 *
 * @example
 * ```ts
 * const response: ScanResponse = {
 *   id: 'scan_abc123',
 *   guestSessionId: 'session_xyz789',
 *   userId: null,
 *   url: 'https://example.com',
 *   email: 'user@example.com',
 *   status: 'PENDING',
 *   wcagLevel: 'AA',
 *   durationMs: null,
 *   errorMessage: null,
 *   createdAt: new Date(),
 *   completedAt: null
 * };
 * ```
 */
export type ScanResponse = z.infer<typeof ScanResponseSchema>;

/**
 * Response body for scan status checks
 *
 * Lightweight response for polling scan progress.
 * Contains only essential status information without full scan details.
 *
 * @example
 * ```ts
 * const status: ScanStatusResponse = {
 *   id: 'scan_abc123',
 *   status: 'RUNNING',
 *   progress: 45,
 *   errorMessage: null,
 *   createdAt: new Date(),
 *   completedAt: null,
 *   resultsUrl: undefined
 * };
 * ```
 */
export type ScanStatusResponse = z.infer<typeof ScanStatusResponseSchema>;

/**
 * Route parameter for scan ID
 *
 * Validates scan ID format in route parameters.
 * ID must start with 'scan_' prefix.
 *
 * @example
 * ```ts
 * const params: ScanIdParam = {
 *   id: 'scan_abc123def456'
 * };
 * ```
 */
export type ScanIdParam = z.infer<typeof ScanIdParamSchema>;

/**
 * WCAG conformance level type (inferred from schema)
 *
 * Re-exported for convenience, matches the core WcagLevel type
 */
export type WcagLevelType = z.infer<typeof WcagLevelSchema>;

/**
 * Scan status type (inferred from schema)
 *
 * Re-exported for convenience, matches the core ScanStatus type
 */
export type ScanStatusType = z.infer<typeof ScanStatusSchema>;

/**
 * Issue impact/severity type (inferred from schema)
 *
 * Re-exported for convenience, matches the core IssueImpact type
 */
export type IssueImpactType = z.infer<typeof IssueImpactSchema>;

/**
 * Type guard to check if a value is a valid WCAG level
 *
 * @param value - Value to check
 * @returns True if value is a valid WCAG level
 *
 * @example
 * ```ts
 * if (isWcagLevel(input)) {
 *   // TypeScript knows input is 'A' | 'AA' | 'AAA'
 *   console.log(`Valid WCAG level: ${input}`);
 * }
 * ```
 */
export function isWcagLevel(value: unknown): value is WcagLevel {
  return (
    typeof value === 'string' &&
    (value === 'A' || value === 'AA' || value === 'AAA')
  );
}

/**
 * Type guard to check if a value is a valid scan status
 *
 * @param value - Value to check
 * @returns True if value is a valid scan status
 *
 * @example
 * ```ts
 * if (isScanStatus(input)) {
 *   // TypeScript knows input is a valid ScanStatus
 *   console.log(`Valid status: ${input}`);
 * }
 * ```
 */
export function isScanStatus(value: unknown): value is ScanStatus {
  return (
    typeof value === 'string' &&
    (value === 'PENDING' ||
      value === 'RUNNING' ||
      value === 'COMPLETED' ||
      value === 'FAILED')
  );
}

/**
 * Type guard to check if a value is a valid issue impact level
 *
 * @param value - Value to check
 * @returns True if value is a valid issue impact
 *
 * @example
 * ```ts
 * if (isIssueImpact(input)) {
 *   // TypeScript knows input is a valid IssueImpact
 *   console.log(`Valid impact: ${input}`);
 * }
 * ```
 */
export function isIssueImpact(value: unknown): value is IssueImpact {
  return (
    typeof value === 'string' &&
    (value === 'CRITICAL' ||
      value === 'SERIOUS' ||
      value === 'MODERATE' ||
      value === 'MINOR')
  );
}

/**
 * Helper type for scan creation input
 *
 * Combines CreateScanRequest with optional session/user context.
 * Used internally by the scan service.
 */
export interface CreateScanInput extends CreateScanRequest {
  /** Guest session ID if creating as guest */
  guestSessionId?: string;
  /** User ID if creating as authenticated user */
  userId?: string;
}

/**
 * Helper type for scan update operations
 *
 * Partial update data for modifying scan status and metadata.
 * Used internally by the scan service.
 */
export interface UpdateScanInput {
  /** New status for the scan */
  status?: ScanStatus;
  /** Scan duration in milliseconds */
  durationMs?: number;
  /** Error message if scan failed */
  errorMessage?: string;
  /** Completion timestamp */
  completedAt?: Date;
}

/**
 * Re-export core scan type for convenience
 */
export type { Scan };
