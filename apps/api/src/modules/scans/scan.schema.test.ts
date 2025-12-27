import { describe, it, expect } from 'vitest';
import {
  WcagLevelSchema,
  ScanStatusSchema,
  IssueImpactSchema,
  CreateScanRequestSchema,
  ScanResponseSchema,
  ScanStatusResponseSchema,
  ScanIdParamSchema,
} from './scan.schema.js';

describe('Scan Schemas', () => {
  describe('WcagLevelSchema', () => {
    it('should validate valid WCAG levels', () => {
      expect(WcagLevelSchema.parse('A')).toBe('A');
      expect(WcagLevelSchema.parse('AA')).toBe('AA');
      expect(WcagLevelSchema.parse('AAA')).toBe('AAA');
    });

    it('should reject invalid WCAG levels', () => {
      expect(() => WcagLevelSchema.parse('B')).toThrow();
      expect(() => WcagLevelSchema.parse('AAAA')).toThrow();
      expect(() => WcagLevelSchema.parse('a')).toThrow();
    });

    it('should use default value', () => {
      const schema = WcagLevelSchema.default('AA');
      expect(schema.parse(undefined)).toBe('AA');
    });
  });

  describe('ScanStatusSchema', () => {
    it('should validate valid scan statuses', () => {
      expect(ScanStatusSchema.parse('PENDING')).toBe('PENDING');
      expect(ScanStatusSchema.parse('RUNNING')).toBe('RUNNING');
      expect(ScanStatusSchema.parse('COMPLETED')).toBe('COMPLETED');
      expect(ScanStatusSchema.parse('FAILED')).toBe('FAILED');
    });

    it('should reject invalid scan statuses', () => {
      expect(() => ScanStatusSchema.parse('INVALID')).toThrow();
      expect(() => ScanStatusSchema.parse('pending')).toThrow();
    });
  });

  describe('IssueImpactSchema', () => {
    it('should validate valid impact levels', () => {
      expect(IssueImpactSchema.parse('CRITICAL')).toBe('CRITICAL');
      expect(IssueImpactSchema.parse('SERIOUS')).toBe('SERIOUS');
      expect(IssueImpactSchema.parse('MODERATE')).toBe('MODERATE');
      expect(IssueImpactSchema.parse('MINOR')).toBe('MINOR');
    });

    it('should reject invalid impact levels', () => {
      expect(() => IssueImpactSchema.parse('HIGH')).toThrow();
      expect(() => IssueImpactSchema.parse('critical')).toThrow();
    });
  });

  describe('CreateScanRequestSchema', () => {
    it('should validate valid scan request', () => {
      const validRequest = {
        url: 'https://example.com',
        email: 'test@example.com',
        wcagLevel: 'AA',
        recaptchaToken: 'token123',
      };

      const result = CreateScanRequestSchema.parse(validRequest);
      expect(result.url).toBe('https://example.com');
      expect(result.email).toBe('test@example.com');
      expect(result.wcagLevel).toBe('AA');
      expect(result.recaptchaToken).toBe('token123');
    });

    it('should normalize URL by trimming whitespace', () => {
      const request = {
        url: '  https://example.com  ',
        recaptchaToken: 'token123',
      };

      const result = CreateScanRequestSchema.parse(request);
      expect(result.url).toBe('https://example.com');
    });

    it('should normalize email by trimming and lowercasing', () => {
      const request = {
        url: 'https://example.com',
        email: '  TEST@Example.COM  ',
        recaptchaToken: 'token123',
      };

      const result = CreateScanRequestSchema.parse(request);
      expect(result.email).toBe('test@example.com');
    });

    it('should use default WCAG level AA', () => {
      const request = {
        url: 'https://example.com',
        recaptchaToken: 'token123',
      };

      const result = CreateScanRequestSchema.parse(request);
      expect(result.wcagLevel).toBe('AA');
    });

    it('should reject invalid URLs', () => {
      const invalidRequest = {
        url: 'not-a-url',
        recaptchaToken: 'token123',
      };

      expect(() => CreateScanRequestSchema.parse(invalidRequest)).toThrow(
        'Invalid URL format',
      );
    });

    it('should reject non-HTTP/HTTPS protocols', () => {
      const request = {
        url: 'ftp://example.com',
        recaptchaToken: 'token123',
      };

      expect(() => CreateScanRequestSchema.parse(request)).toThrow(
        'URL must use HTTP or HTTPS protocol',
      );
    });

    it('should reject invalid email format', () => {
      const request = {
        url: 'https://example.com',
        email: 'not-an-email',
        recaptchaToken: 'token123',
      };

      expect(() => CreateScanRequestSchema.parse(request)).toThrow(
        'Invalid email format',
      );
    });

    it('should require recaptchaToken', () => {
      const request = {
        url: 'https://example.com',
        email: 'test@example.com',
      };

      expect(() => CreateScanRequestSchema.parse(request)).toThrow(
        'reCAPTCHA token is required',
      );
    });

    it('should allow HTTP URLs', () => {
      const request = {
        url: 'http://example.com',
        recaptchaToken: 'token123',
      };

      const result = CreateScanRequestSchema.parse(request);
      expect(result.url).toBe('http://example.com');
    });

    it('should allow optional email', () => {
      const request = {
        url: 'https://example.com',
        recaptchaToken: 'token123',
      };

      const result = CreateScanRequestSchema.parse(request);
      expect(result.email).toBeUndefined();
    });
  });

  describe('ScanResponseSchema', () => {
    it('should validate valid scan response', () => {
      const validResponse = {
        id: 'scan_abc123',
        guestSessionId: 'session_xyz789',
        userId: null,
        url: 'https://example.com',
        email: 'test@example.com',
        status: 'PENDING',
        wcagLevel: 'AA',
        durationMs: null,
        errorMessage: null,
        createdAt: new Date(),
        completedAt: null,
      };

      const result = ScanResponseSchema.parse(validResponse);
      expect(result.id).toBe('scan_abc123');
      expect(result.status).toBe('PENDING');
    });

    it('should validate completed scan with duration', () => {
      const completedResponse = {
        id: 'scan_abc123',
        guestSessionId: null,
        userId: 'user_123',
        url: 'https://example.com',
        email: 'test@example.com',
        status: 'COMPLETED',
        wcagLevel: 'AA',
        durationMs: 5000,
        errorMessage: null,
        createdAt: new Date(),
        completedAt: new Date(),
      };

      const result = ScanResponseSchema.parse(completedResponse);
      expect(result.status).toBe('COMPLETED');
      expect(result.durationMs).toBe(5000);
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('should validate failed scan with error message', () => {
      const failedResponse = {
        id: 'scan_abc123',
        guestSessionId: 'session_xyz789',
        userId: null,
        url: 'https://example.com',
        email: 'test@example.com',
        status: 'FAILED',
        wcagLevel: 'AA',
        durationMs: 1000,
        errorMessage: 'Connection timeout',
        createdAt: new Date(),
        completedAt: new Date(),
      };

      const result = ScanResponseSchema.parse(failedResponse);
      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toBe('Connection timeout');
    });
  });

  describe('ScanStatusResponseSchema', () => {
    it('should validate running scan with progress', () => {
      const statusResponse = {
        id: 'scan_abc123',
        status: 'RUNNING',
        progress: 45,
        errorMessage: null,
        createdAt: new Date(),
        completedAt: null,
      };

      const result = ScanStatusResponseSchema.parse(statusResponse);
      expect(result.status).toBe('RUNNING');
      expect(result.progress).toBe(45);
    });

    it('should validate completed scan with results URL', () => {
      const statusResponse = {
        id: 'scan_abc123',
        status: 'COMPLETED',
        errorMessage: null,
        createdAt: new Date(),
        completedAt: new Date(),
        resultsUrl: 'https://example.com/results/scan_abc123',
      };

      const result = ScanStatusResponseSchema.parse(statusResponse);
      expect(result.status).toBe('COMPLETED');
      expect(result.resultsUrl).toBe('https://example.com/results/scan_abc123');
    });

    it('should reject invalid progress values', () => {
      const invalidProgress = {
        id: 'scan_abc123',
        status: 'RUNNING',
        progress: 150,
        errorMessage: null,
        createdAt: new Date(),
        completedAt: null,
      };

      expect(() => ScanStatusResponseSchema.parse(invalidProgress)).toThrow();
    });
  });

  describe('ScanIdParamSchema', () => {
    it('should validate valid scan IDs', () => {
      expect(ScanIdParamSchema.parse({ id: 'scan_abc123' }).id).toBe(
        'scan_abc123',
      );
      expect(
        ScanIdParamSchema.parse({ id: 'scan_ABCdef123XYZ' }).id,
      ).toBe('scan_ABCdef123XYZ');
    });

    it('should reject invalid scan ID formats', () => {
      expect(() => ScanIdParamSchema.parse({ id: 'abc123' })).toThrow(
        'Invalid scan ID format',
      );
      expect(() => ScanIdParamSchema.parse({ id: 'scan_' })).toThrow(
        'Scan ID is too short',
      );
      expect(() => ScanIdParamSchema.parse({ id: 'scan_abc-123' })).toThrow(
        'Invalid scan ID format',
      );
    });
  });
});
