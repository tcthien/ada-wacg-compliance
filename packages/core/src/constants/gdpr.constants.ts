/**
 * GDPR Compliance Constants
 *
 * Defines data retention periods, anonymization strategies, and GDPR-compliant
 * data handling utilities for the ADAShield scanner.
 *
 * Key Requirements:
 * - 30-day retention for guest sessions
 * - 90-day retention for scan results
 * - SHA-256 hashing for irreversible anonymization
 * - Preserve scan data for analytics while protecting PII
 */

import { createHash } from 'node:crypto';

/**
 * Data retention periods in days
 */
export const GDPR_RETENTION_PERIODS = {
  /** Guest session data retention (30 days) */
  GUEST_SESSION: 30,
  /** Scan results retention (90 days) */
  SCAN_RESULTS: 90,
  /** Anonymized data retention (indefinite for analytics) */
  ANONYMIZED_DATA: null as null
} as const;

/**
 * Anonymization configuration
 */
export const ANONYMIZATION_CONFIG = {
  /** Hashing algorithm for anonymization */
  ALGORITHM: 'sha256',
  /** Encoding format for hash output */
  ENCODING: 'hex',
  /** Prefix for anonymized fingerprints */
  FINGERPRINT_PREFIX: 'anon_',
  /** Salt rotation period in days (not implemented yet) */
  SALT_ROTATION_DAYS: 90
} as const;

/**
 * Fields that must be anonymized for GDPR compliance
 * These contain personally identifiable information (PII)
 */
export const ANONYMIZED_FIELDS = [
  'fingerprint',
  'email',
  'ipAddress',
  'userAgent',
  'sessionId'
] as const;

/**
 * Fields that are preserved during anonymization
 * These are essential for analytics and compliance reporting
 */
export const PRESERVED_FIELDS = [
  'scanResults',
  'issueData',
  'wcagViolations',
  'timestamps',
  'scanMetadata',
  'targetUrl',
  'scanDuration',
  'issueCount',
  'severityBreakdown'
] as const;

/**
 * Type for fields that must be anonymized
 */
export type AnonymizedField = typeof ANONYMIZED_FIELDS[number];

/**
 * Type for fields preserved during anonymization
 */
export type PreservedField = typeof PRESERVED_FIELDS[number];

/**
 * Generate an anonymized fingerprint using SHA-256 hashing
 *
 * This function creates an irreversible one-way hash of the input data,
 * suitable for GDPR-compliant data anonymization. The hash is deterministic
 * (same input always produces the same hash) but irreversible (cannot
 * recover the original data from the hash).
 *
 * @param data - The data to anonymize (e.g., email, IP address, fingerprint)
 * @returns Anonymized hash with prefix (e.g., "anon_a1b2c3...")
 *
 * @example
 * ```typescript
 * const anonEmail = generateAnonFingerprint('user@example.com');
 * // Returns: "anon_5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8"
 *
 * const anonIP = generateAnonFingerprint('192.168.1.1');
 * // Returns: "anon_c775e7b757ede630cd0aa1113bd102661ab38829ca52a6422ab782862f268646"
 * ```
 */
export function generateAnonFingerprint(data: string): string {
  if (!data || typeof data !== 'string') {
    throw new Error('Input data must be a non-empty string');
  }

  // Create SHA-256 hash
  const hash = createHash(ANONYMIZATION_CONFIG.ALGORITHM)
    .update(data)
    .digest(ANONYMIZATION_CONFIG.ENCODING);

  // Return with prefix for easy identification
  return `${ANONYMIZATION_CONFIG.FINGERPRINT_PREFIX}${hash}`;
}

/**
 * Validate if a string is an anonymized fingerprint
 *
 * @param fingerprint - The fingerprint to validate
 * @returns True if the fingerprint is anonymized
 *
 * @example
 * ```typescript
 * isAnonymizedFingerprint('anon_abc123...') // true
 * isAnonymizedFingerprint('user@example.com') // false
 * ```
 */
export function isAnonymizedFingerprint(fingerprint: string): boolean {
  if (!fingerprint || typeof fingerprint !== 'string') {
    return false;
  }

  // Check for prefix and SHA-256 hex length (64 characters)
  const expectedLength = ANONYMIZATION_CONFIG.FINGERPRINT_PREFIX.length + 64;
  return (
    fingerprint.startsWith(ANONYMIZATION_CONFIG.FINGERPRINT_PREFIX) &&
    fingerprint.length === expectedLength &&
    /^anon_[a-f0-9]{64}$/.test(fingerprint)
  );
}

/**
 * Check if a field should be anonymized
 *
 * @param fieldName - The field name to check
 * @returns True if the field should be anonymized
 */
export function shouldAnonymizeField(fieldName: string): boolean {
  return ANONYMIZED_FIELDS.includes(fieldName as AnonymizedField);
}

/**
 * Check if a field should be preserved during anonymization
 *
 * @param fieldName - The field name to check
 * @returns True if the field should be preserved
 */
export function shouldPreserveField(fieldName: string): boolean {
  return PRESERVED_FIELDS.includes(fieldName as PreservedField);
}

/**
 * Calculate the expiration date for data based on retention period
 *
 * @param retentionDays - Number of days to retain the data
 * @param fromDate - Starting date (defaults to now)
 * @returns Expiration date
 *
 * @example
 * ```typescript
 * const guestExpiry = calculateExpirationDate(GDPR_RETENTION_PERIODS.GUEST_SESSION);
 * const scanExpiry = calculateExpirationDate(GDPR_RETENTION_PERIODS.SCAN_RESULTS);
 * ```
 */
export function calculateExpirationDate(
  retentionDays: number,
  fromDate: Date = new Date()
): Date {
  if (retentionDays < 0) {
    throw new Error('Retention period must be non-negative');
  }

  const expirationDate = new Date(fromDate);
  expirationDate.setDate(expirationDate.getDate() + retentionDays);
  return expirationDate;
}

/**
 * Check if data has expired based on retention policy
 *
 * @param createdAt - When the data was created
 * @param retentionDays - Number of days to retain the data
 * @returns True if the data has expired
 *
 * @example
 * ```typescript
 * const isExpired = hasDataExpired(
 *   scanCreatedDate,
 *   GDPR_RETENTION_PERIODS.SCAN_RESULTS
 * );
 * ```
 */
export function hasDataExpired(createdAt: Date, retentionDays: number): boolean {
  const expirationDate = calculateExpirationDate(retentionDays, createdAt);
  return new Date() > expirationDate;
}
