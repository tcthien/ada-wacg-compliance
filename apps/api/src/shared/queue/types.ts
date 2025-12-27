/**
 * Queue Job Type Definitions
 *
 * TypeScript interfaces for all job types used in BullMQ queues.
 * Ensures type safety for job data across the application.
 */

/**
 * WCAG compliance levels
 */
export type WCAGLevel = 'A' | 'AA' | 'AAA';

/**
 * Report output formats
 */
export type ReportFormat = 'PDF' | 'JSON';

/**
 * Scan job data
 * Used for running accessibility scans on URLs
 */
export interface ScanJobData {
  /** Unique scan identifier */
  scanId: string;
  /** URL to scan */
  url: string;
  /** WCAG compliance level to test against */
  wcagLevel: WCAGLevel;
  /** Optional user ID for authenticated scans */
  userId?: string;
  /** Optional session ID for guest scans */
  sessionId?: string;
}

/**
 * Report generation job data
 * Used for generating PDF/JSON reports from scan results
 */
export interface ReportJobData {
  /** Scan identifier to generate report for */
  scanId: string;
  /** Output format */
  format: ReportFormat;
  /** Optional custom report title */
  title?: string;
  /** Optional recipient email address */
  emailTo?: string;
}

/**
 * Email notification job data
 * Used for sending transactional emails
 */
export interface EmailJobData {
  /** Recipient email address */
  to: string;
  /** Email template name */
  template: string;
  /** Template data for rendering */
  data: Record<string, unknown>;
  /** Optional subject override */
  subject?: string;
  /** Optional sender override */
  from?: string;
}

/**
 * Common job metadata
 */
export interface JobMetadata {
  /** Job creation timestamp */
  createdAt: number;
  /** Source that created the job (api, worker, system) */
  source: string;
  /** Optional correlation ID for tracking */
  correlationId?: string;
}

/**
 * Job options with metadata
 */
export interface JobOptionsWithMetadata {
  /** Job priority (higher = more urgent) */
  priority?: number;
  /** Delay before job starts (milliseconds) */
  delay?: number;
  /** Job timeout (milliseconds) */
  timeout?: number;
  /** Number of retry attempts */
  attempts?: number;
  /** Backoff strategy for retries */
  backoff?: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
  /** Remove job on completion */
  removeOnComplete?: boolean | number;
  /** Remove job on failure */
  removeOnFail?: boolean | number;
  /** Job metadata */
  metadata?: JobMetadata;
}
