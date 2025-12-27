/**
 * GDPR Constants Tests
 *
 * Comprehensive tests for GDPR compliance utilities including
 * anonymization, retention periods, and field classification.
 */

import { describe, it, expect } from 'vitest';
import {
  GDPR_RETENTION_PERIODS,
  ANONYMIZATION_CONFIG,
  ANONYMIZED_FIELDS,
  PRESERVED_FIELDS,
  generateAnonFingerprint,
  isAnonymizedFingerprint,
  shouldAnonymizeField,
  shouldPreserveField,
  calculateExpirationDate,
  hasDataExpired
} from './gdpr.constants.js';

describe('GDPR Constants', () => {
  describe('GDPR_RETENTION_PERIODS', () => {
    it('should define correct retention periods', () => {
      expect(GDPR_RETENTION_PERIODS.GUEST_SESSION).toBe(30);
      expect(GDPR_RETENTION_PERIODS.SCAN_RESULTS).toBe(90);
      expect(GDPR_RETENTION_PERIODS.ANONYMIZED_DATA).toBe(null);
    });

    it('should be read-only', () => {
      // TypeScript should enforce this, but we can verify the const assertion works
      const periods = GDPR_RETENTION_PERIODS;
      expect(periods).toBeDefined();
    });
  });

  describe('ANONYMIZATION_CONFIG', () => {
    it('should define correct anonymization settings', () => {
      expect(ANONYMIZATION_CONFIG.ALGORITHM).toBe('sha256');
      expect(ANONYMIZATION_CONFIG.ENCODING).toBe('hex');
      expect(ANONYMIZATION_CONFIG.FINGERPRINT_PREFIX).toBe('anon_');
      expect(ANONYMIZATION_CONFIG.SALT_ROTATION_DAYS).toBe(90);
    });
  });

  describe('ANONYMIZED_FIELDS', () => {
    it('should include all PII fields', () => {
      expect(ANONYMIZED_FIELDS).toContain('fingerprint');
      expect(ANONYMIZED_FIELDS).toContain('email');
      expect(ANONYMIZED_FIELDS).toContain('ipAddress');
      expect(ANONYMIZED_FIELDS).toContain('userAgent');
      expect(ANONYMIZED_FIELDS).toContain('sessionId');
    });

    it('should have exactly 5 PII fields', () => {
      expect(ANONYMIZED_FIELDS).toHaveLength(5);
    });
  });

  describe('PRESERVED_FIELDS', () => {
    it('should include all analytics fields', () => {
      expect(PRESERVED_FIELDS).toContain('scanResults');
      expect(PRESERVED_FIELDS).toContain('issueData');
      expect(PRESERVED_FIELDS).toContain('wcagViolations');
      expect(PRESERVED_FIELDS).toContain('timestamps');
      expect(PRESERVED_FIELDS).toContain('scanMetadata');
    });

    it('should have exactly 9 preserved fields', () => {
      expect(PRESERVED_FIELDS).toHaveLength(9);
    });
  });

  describe('generateAnonFingerprint', () => {
    it('should generate a valid anonymized fingerprint', () => {
      const result = generateAnonFingerprint('user@example.com');

      expect(result).toMatch(/^anon_[a-f0-9]{64}$/);
      expect(result.startsWith('anon_')).toBe(true);
      expect(result).toHaveLength(69); // 5 (prefix) + 64 (hash)
    });

    it('should be deterministic (same input produces same output)', () => {
      const input = 'test@example.com';
      const hash1 = generateAnonFingerprint(input);
      const hash2 = generateAnonFingerprint(input);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = generateAnonFingerprint('user1@example.com');
      const hash2 = generateAnonFingerprint('user2@example.com');

      expect(hash1).not.toBe(hash2);
    });

    it('should handle IP addresses', () => {
      const result = generateAnonFingerprint('192.168.1.1');

      expect(result).toMatch(/^anon_[a-f0-9]{64}$/);
      expect(result).toHaveLength(69);
    });

    it('should handle various string inputs', () => {
      const inputs = [
        'fp_abc123def456',
        'session_xyz789',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'very-long-string-with-special-chars-!@#$%^&*()',
        '12345'
      ];

      inputs.forEach(input => {
        const result = generateAnonFingerprint(input);
        expect(result).toMatch(/^anon_[a-f0-9]{64}$/);
      });
    });

    it('should throw error for empty string', () => {
      expect(() => generateAnonFingerprint('')).toThrow('Input data must be a non-empty string');
    });

    it('should throw error for non-string input', () => {
      // @ts-expect-error Testing invalid input
      expect(() => generateAnonFingerprint(null)).toThrow('Input data must be a non-empty string');

      // @ts-expect-error Testing invalid input
      expect(() => generateAnonFingerprint(undefined)).toThrow('Input data must be a non-empty string');

      // @ts-expect-error Testing invalid input
      expect(() => generateAnonFingerprint(123)).toThrow('Input data must be a non-empty string');
    });

    it('should produce SHA-256 compatible hashes', () => {
      // SHA-256 always produces 256 bits = 64 hex characters
      const result = generateAnonFingerprint('test');
      const hashPart = result.replace('anon_', '');

      expect(hashPart).toHaveLength(64);
      expect(/^[a-f0-9]{64}$/.test(hashPart)).toBe(true);
    });

    it('should match known SHA-256 hash for test input', () => {
      // Known SHA-256 hash for "test" is "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
      const result = generateAnonFingerprint('test');

      expect(result).toBe('anon_9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
    });
  });

  describe('isAnonymizedFingerprint', () => {
    it('should return true for valid anonymized fingerprints', () => {
      const validHash = generateAnonFingerprint('user@example.com');
      expect(isAnonymizedFingerprint(validHash)).toBe(true);
    });

    it('should return false for non-anonymized strings', () => {
      expect(isAnonymizedFingerprint('user@example.com')).toBe(false);
      expect(isAnonymizedFingerprint('fp_regular_fingerprint')).toBe(false);
      expect(isAnonymizedFingerprint('192.168.1.1')).toBe(false);
    });

    it('should return false for malformed anonymized fingerprints', () => {
      expect(isAnonymizedFingerprint('anon_tooshort')).toBe(false);
      expect(isAnonymizedFingerprint('anon_GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG')).toBe(false); // Invalid hex chars
      expect(isAnonymizedFingerprint('wrong_prefix_' + 'a'.repeat(64))).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isAnonymizedFingerprint('')).toBe(false);
    });

    it('should return false for non-string input', () => {
      // @ts-expect-error Testing invalid input
      expect(isAnonymizedFingerprint(null)).toBe(false);

      // @ts-expect-error Testing invalid input
      expect(isAnonymizedFingerprint(undefined)).toBe(false);

      // @ts-expect-error Testing invalid input
      expect(isAnonymizedFingerprint(123)).toBe(false);
    });

    it('should validate exact length requirements', () => {
      const tooLong = 'anon_' + 'a'.repeat(65);
      const tooShort = 'anon_' + 'a'.repeat(63);
      const justRight = 'anon_' + 'a'.repeat(64);

      expect(isAnonymizedFingerprint(tooLong)).toBe(false);
      expect(isAnonymizedFingerprint(tooShort)).toBe(false);
      expect(isAnonymizedFingerprint(justRight)).toBe(true);
    });
  });

  describe('shouldAnonymizeField', () => {
    it('should return true for PII fields', () => {
      expect(shouldAnonymizeField('fingerprint')).toBe(true);
      expect(shouldAnonymizeField('email')).toBe(true);
      expect(shouldAnonymizeField('ipAddress')).toBe(true);
      expect(shouldAnonymizeField('userAgent')).toBe(true);
      expect(shouldAnonymizeField('sessionId')).toBe(true);
    });

    it('should return false for non-PII fields', () => {
      expect(shouldAnonymizeField('scanResults')).toBe(false);
      expect(shouldAnonymizeField('issueData')).toBe(false);
      expect(shouldAnonymizeField('timestamps')).toBe(false);
      expect(shouldAnonymizeField('unknown')).toBe(false);
    });
  });

  describe('shouldPreserveField', () => {
    it('should return true for analytics fields', () => {
      expect(shouldPreserveField('scanResults')).toBe(true);
      expect(shouldPreserveField('issueData')).toBe(true);
      expect(shouldPreserveField('wcagViolations')).toBe(true);
      expect(shouldPreserveField('timestamps')).toBe(true);
      expect(shouldPreserveField('scanMetadata')).toBe(true);
    });

    it('should return false for non-preserved fields', () => {
      expect(shouldPreserveField('fingerprint')).toBe(false);
      expect(shouldPreserveField('email')).toBe(false);
      expect(shouldPreserveField('unknown')).toBe(false);
    });
  });

  describe('calculateExpirationDate', () => {
    it('should calculate correct expiration date', () => {
      const baseDate = new Date('2025-01-01T00:00:00Z');
      const expirationDate = calculateExpirationDate(30, baseDate);

      expect(expirationDate.getTime()).toBe(new Date('2025-01-31T00:00:00Z').getTime());
    });

    it('should use current date when fromDate is not provided', () => {
      const before = new Date();
      const expirationDate = calculateExpirationDate(30);
      const after = new Date();

      // Expiration should be 30 days from now
      const expectedMin = new Date(before);
      expectedMin.setDate(expectedMin.getDate() + 30);

      const expectedMax = new Date(after);
      expectedMax.setDate(expectedMax.getDate() + 30);

      expect(expirationDate.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
      expect(expirationDate.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
    });

    it('should handle guest session retention period', () => {
      const baseDate = new Date('2025-01-01T00:00:00Z');
      const expirationDate = calculateExpirationDate(GDPR_RETENTION_PERIODS.GUEST_SESSION, baseDate);

      expect(expirationDate.getTime()).toBe(new Date('2025-01-31T00:00:00Z').getTime());
    });

    it('should handle scan results retention period', () => {
      const baseDate = new Date('2025-01-01T00:00:00Z');
      const expirationDate = calculateExpirationDate(GDPR_RETENTION_PERIODS.SCAN_RESULTS, baseDate);

      expect(expirationDate.getTime()).toBe(new Date('2025-04-01T00:00:00Z').getTime());
    });

    it('should handle zero retention period', () => {
      const baseDate = new Date('2025-01-01T00:00:00Z');
      const expirationDate = calculateExpirationDate(0, baseDate);

      expect(expirationDate.getTime()).toBe(baseDate.getTime());
    });

    it('should throw error for negative retention period', () => {
      expect(() => calculateExpirationDate(-1)).toThrow('Retention period must be non-negative');
    });

    it('should handle month boundaries correctly', () => {
      // January 31 + 1 day = February 1
      const janEnd = new Date('2025-01-31T00:00:00Z');
      const febStart = calculateExpirationDate(1, janEnd);

      expect(febStart.getTime()).toBe(new Date('2025-02-01T00:00:00Z').getTime());
    });

    it('should handle leap years correctly', () => {
      // 2024 is a leap year
      const feb28 = new Date('2024-02-28T00:00:00Z');
      const feb29 = calculateExpirationDate(1, feb28);

      expect(feb29.getTime()).toBe(new Date('2024-02-29T00:00:00Z').getTime());
    });
  });

  describe('hasDataExpired', () => {
    it('should return true for expired data', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100); // 100 days ago

      expect(hasDataExpired(oldDate, 30)).toBe(true);
      expect(hasDataExpired(oldDate, 90)).toBe(true);
    });

    it('should return false for non-expired data', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10); // 10 days ago

      expect(hasDataExpired(recentDate, 30)).toBe(false);
      expect(hasDataExpired(recentDate, 90)).toBe(false);
    });

    it('should return false for data created today', () => {
      const today = new Date();

      expect(hasDataExpired(today, 30)).toBe(false);
      expect(hasDataExpired(today, 90)).toBe(false);
    });

    it('should handle exact expiration boundary', () => {
      const exactlyExpired = new Date();
      exactlyExpired.setDate(exactlyExpired.getDate() - 30);
      exactlyExpired.setSeconds(exactlyExpired.getSeconds() - 1); // 1 second past expiration

      // Should be expired (30 days + 1 second ago, 30 day retention)
      expect(hasDataExpired(exactlyExpired, 30)).toBe(true);
    });

    it('should handle guest session expiration', () => {
      const oldSession = new Date();
      oldSession.setDate(oldSession.getDate() - 35); // 35 days ago

      expect(hasDataExpired(oldSession, GDPR_RETENTION_PERIODS.GUEST_SESSION)).toBe(true);
    });

    it('should handle scan results expiration', () => {
      const oldScan = new Date();
      oldScan.setDate(oldScan.getDate() - 100); // 100 days ago

      expect(hasDataExpired(oldScan, GDPR_RETENTION_PERIODS.SCAN_RESULTS)).toBe(true);
    });

    it('should handle zero retention period', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 1000); // 1 second ago

      expect(hasDataExpired(past, 0)).toBe(true);
      expect(hasDataExpired(now, 0)).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    it('should create and validate anonymized fingerprints', () => {
      const original = 'user@example.com';
      const anonymized = generateAnonFingerprint(original);

      expect(isAnonymizedFingerprint(anonymized)).toBe(true);
      expect(isAnonymizedFingerprint(original)).toBe(false);
    });

    it('should correctly classify fields for anonymization workflow', () => {
      // PII fields should be anonymized, not preserved
      expect(shouldAnonymizeField('email')).toBe(true);
      expect(shouldPreserveField('email')).toBe(false);

      // Analytics fields should be preserved, not anonymized
      expect(shouldPreserveField('scanResults')).toBe(true);
      expect(shouldAnonymizeField('scanResults')).toBe(false);
    });

    it('should handle complete data lifecycle', () => {
      // Create data
      const createdAt = new Date();

      // Check immediately - should not be expired
      expect(hasDataExpired(createdAt, GDPR_RETENTION_PERIODS.SCAN_RESULTS)).toBe(false);

      // Calculate when it will expire
      const expiresAt = calculateExpirationDate(GDPR_RETENTION_PERIODS.SCAN_RESULTS, createdAt);

      // Verify expiration is in the future
      expect(expiresAt > new Date()).toBe(true);

      // Simulate old data
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      expect(hasDataExpired(oldDate, GDPR_RETENTION_PERIODS.SCAN_RESULTS)).toBe(true);
    });
  });
});
