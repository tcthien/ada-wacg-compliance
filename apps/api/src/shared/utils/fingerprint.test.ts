import { describe, it, expect } from 'vitest';
import type { FastifyRequest } from 'fastify';
import {
  generateFingerprint,
  validateFingerprintFormat,
  compareFingerprintFingerprints,
  getFingerprintComponents,
} from './fingerprint.js';

/**
 * Create mock Fastify request with headers
 */
function createMockRequest(headers: Record<string, string>): FastifyRequest {
  return {
    headers,
  } as FastifyRequest;
}

describe('generateFingerprint', () => {
  it('should generate a 16-character hexadecimal fingerprint', () => {
    const request = createMockRequest({
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'accept-language': 'en-US,en;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
    });

    const fingerprint = generateFingerprint(request);

    expect(fingerprint).toHaveLength(16);
    expect(fingerprint).toMatch(/^[a-f0-9]{16}$/);
  });

  it('should generate the same fingerprint for identical headers', () => {
    const headers = {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'accept-language': 'en-US,en;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
    };

    const request1 = createMockRequest(headers);
    const request2 = createMockRequest(headers);

    const fingerprint1 = generateFingerprint(request1);
    const fingerprint2 = generateFingerprint(request2);

    expect(fingerprint1).toBe(fingerprint2);
  });

  it('should generate different fingerprints for different user-agents', () => {
    const request1 = createMockRequest({
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'accept-language': 'en-US,en;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
    });

    const request2 = createMockRequest({
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      'accept-language': 'en-US,en;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
    });

    const fingerprint1 = generateFingerprint(request1);
    const fingerprint2 = generateFingerprint(request2);

    expect(fingerprint1).not.toBe(fingerprint2);
  });

  it('should generate different fingerprints for different accept-language', () => {
    const request1 = createMockRequest({
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'accept-language': 'en-US,en;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
    });

    const request2 = createMockRequest({
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'accept-language': 'fr-FR,fr;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
    });

    const fingerprint1 = generateFingerprint(request1);
    const fingerprint2 = generateFingerprint(request2);

    expect(fingerprint1).not.toBe(fingerprint2);
  });

  it('should handle missing headers gracefully', () => {
    const request = createMockRequest({});

    const fingerprint = generateFingerprint(request);

    expect(fingerprint).toHaveLength(16);
    expect(fingerprint).toMatch(/^[a-f0-9]{16}$/);
  });

  it('should generate "unknown" fingerprint when all headers are missing', () => {
    const request1 = createMockRequest({});
    const request2 = createMockRequest({});

    const fingerprint1 = generateFingerprint(request1);
    const fingerprint2 = generateFingerprint(request2);

    // When all headers are missing, both should generate the same fingerprint
    expect(fingerprint1).toBe(fingerprint2);
  });
});

describe('validateFingerprintFormat', () => {
  it('should validate correct fingerprint format', () => {
    const validFingerprint = 'a1b2c3d4e5f6a7b8';
    expect(validateFingerprintFormat(validFingerprint)).toBe(true);
  });

  it('should reject fingerprints that are too short', () => {
    const shortFingerprint = 'a1b2c3d4';
    expect(validateFingerprintFormat(shortFingerprint)).toBe(false);
  });

  it('should reject fingerprints that are too long', () => {
    const longFingerprint = 'a1b2c3d4e5f6a7b8c9d0';
    expect(validateFingerprintFormat(longFingerprint)).toBe(false);
  });

  it('should reject fingerprints with uppercase letters', () => {
    const uppercaseFingerprint = 'A1B2C3D4E5F6A7B8';
    expect(validateFingerprintFormat(uppercaseFingerprint)).toBe(false);
  });

  it('should reject fingerprints with invalid characters', () => {
    const invalidFingerprint = 'g1h2i3j4k5l6m7n8';
    expect(validateFingerprintFormat(invalidFingerprint)).toBe(false);
  });

  it('should reject empty string', () => {
    expect(validateFingerprintFormat('')).toBe(false);
  });
});

describe('compareFingerprintFingerprints', () => {
  it('should return true for identical fingerprints', () => {
    const fingerprint1 = 'a1b2c3d4e5f6a7b8';
    const fingerprint2 = 'a1b2c3d4e5f6a7b8';

    expect(compareFingerprintFingerprints(fingerprint1, fingerprint2)).toBe(true);
  });

  it('should return false for different fingerprints', () => {
    const fingerprint1 = 'a1b2c3d4e5f6a7b8';
    const fingerprint2 = 'b2c3d4e5f6a7b8c9';

    expect(compareFingerprintFingerprints(fingerprint1, fingerprint2)).toBe(false);
  });

  it('should be case-insensitive', () => {
    const fingerprint1 = 'a1b2c3d4e5f6a7b8';
    const fingerprint2 = 'A1B2C3D4E5F6A7B8';

    expect(compareFingerprintFingerprints(fingerprint1, fingerprint2)).toBe(true);
  });
});

describe('getFingerprintComponents', () => {
  it('should return all fingerprint components', () => {
    const request = createMockRequest({
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'accept-language': 'en-US,en;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
    });

    const components = getFingerprintComponents(request);

    expect(components).toHaveProperty('userAgent');
    expect(components).toHaveProperty('acceptLanguage');
    expect(components).toHaveProperty('acceptEncoding');
    expect(components).toHaveProperty('fingerprint');

    expect(components.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    expect(components.acceptLanguage).toBe('en-US,en;q=0.9');
    expect(components.acceptEncoding).toBe('gzip, deflate, br');
    expect(components.fingerprint).toMatch(/^[a-f0-9]{16}$/);
  });

  it('should return "unknown" for missing headers', () => {
    const request = createMockRequest({});

    const components = getFingerprintComponents(request);

    expect(components.userAgent).toBe('unknown');
    expect(components.acceptLanguage).toBe('unknown');
    expect(components.acceptEncoding).toBe('unknown');
    expect(components.fingerprint).toMatch(/^[a-f0-9]{16}$/);
  });

  it('should include partial headers when some are missing', () => {
    const request = createMockRequest({
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    });

    const components = getFingerprintComponents(request);

    expect(components.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    expect(components.acceptLanguage).toBe('unknown');
    expect(components.acceptEncoding).toBe('unknown');
  });
});
