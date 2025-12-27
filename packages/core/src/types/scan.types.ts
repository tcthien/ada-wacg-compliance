/**
 * Scan-related types for ADAShield
 */

/**
 * Status of a WCAG compliance scan
 */
export type ScanStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

/**
 * WCAG conformance levels
 */
export type WcagLevel = 'A' | 'AA' | 'AAA';

/**
 * Core scan entity
 */
export interface Scan {
  /** Unique identifier for the scan */
  id: string;

  /** Associated guest session ID (nullable for authenticated users) */
  guestSessionId: string | null;

  /** User ID if authenticated (nullable for guest scans) */
  userId: string | null;

  /** URL being scanned */
  url: string;

  /** Email for report delivery */
  email: string;

  /** Current status of the scan */
  status: ScanStatus;

  /** Target WCAG conformance level */
  wcagLevel: WcagLevel;

  /** Scan execution duration in milliseconds (null until completed) */
  durationMs: number | null;

  /** Error message if scan failed */
  errorMessage: string | null;

  /** Timestamp when scan was created */
  createdAt: Date;

  /** Timestamp when scan completed (null if not completed) */
  completedAt: Date | null;
}

/**
 * Input data for creating a new scan
 */
export interface CreateScanInput {
  url: string;
  email: string;
  wcagLevel: WcagLevel;
  guestSessionId?: string;
  userId?: string;
}

/**
 * Input data for updating scan status
 */
export interface UpdateScanInput {
  status?: ScanStatus;
  durationMs?: number;
  errorMessage?: string;
  completedAt?: Date;
}
