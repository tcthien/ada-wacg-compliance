/**
 * Report-related types for ADAShield
 */

/**
 * Supported report output formats
 */
export type ReportFormat = 'PDF' | 'JSON';

/**
 * Report entity for scan results
 */
export interface Report {
  /** Unique identifier for the report */
  id: string;

  /** Associated scan ID */
  scanId: string;

  /** Format of the generated report */
  format: ReportFormat;

  /** Storage key/path for the report file */
  storageKey: string;

  /** Public URL to access the report */
  storageUrl: string;

  /** File size in bytes */
  fileSizeBytes: number;

  /** Timestamp when report was created */
  createdAt: Date;

  /** Timestamp when report expires and will be deleted */
  expiresAt: Date;
}

/**
 * Input data for creating a new report
 */
export interface CreateReportInput {
  scanId: string;
  format: ReportFormat;
  storageKey: string;
  storageUrl: string;
  fileSizeBytes: number;
  expiresAt: Date;
}

/**
 * Options for report generation
 */
export interface ReportGenerationOptions {
  /** Target format for the report */
  format: ReportFormat;

  /** Include detailed issue information */
  includeDetails?: boolean;

  /** Include HTML snippets in the report */
  includeSnippets?: boolean;

  /** Include remediation guidance */
  includeRemediation?: boolean;

  /** Custom expiration duration in days (default: 30) */
  expirationDays?: number;
}

/**
 * Report metadata for listing/searching
 */
export interface ReportMetadata {
  id: string;
  scanId: string;
  format: ReportFormat;
  fileSizeBytes: number;
  createdAt: Date;
  expiresAt: Date;
  isExpired: boolean;
}
