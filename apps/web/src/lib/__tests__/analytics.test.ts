/**
 * Unit tests for analytics dataLayer functions
 *
 * Tests:
 * - initializeDataLayer() creates window.dataLayer array
 * - pushToDataLayer() adds events correctly
 * - safeAnalyticsCall() catches errors and returns fallback
 * - sanitizeUrl() removes query params and hash
 * - sanitizeError() removes PII from error messages
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DataLayerEvent } from '../analytics.types';

// Mock the env module before importing analytics
vi.mock('../env', () => ({
  env: {
    apiUrl: 'http://localhost:3080',
    recaptchaSiteKey: '',
    gtmId: 'GTM-TEST123',
    gaMeasurementId: 'G-TEST123',
    analyticsEnabled: true,
    analyticsDebug: false,
  },
}));

// Import functions to test
import {
  initializeDataLayer,
  pushToDataLayer,
  safeAnalyticsCall,
  sanitizeUrl,
  sanitizeError,
} from '../analytics';

describe('analytics', () => {
  // Store console spies
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Mock console methods
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Setup window.dataLayer - ensure clean state
    if (typeof window !== 'undefined') {
      // @ts-expect-error - Deleting window.dataLayer for clean test state
      delete window.dataLayer;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();

    // Cleanup window if needed
    if (typeof window !== 'undefined') {
      // @ts-expect-error - Deleting window.dataLayer for cleanup
      delete window.dataLayer;
    }
  });

  describe('initializeDataLayer', () => {
    it('should create window.dataLayer array if it does not exist', () => {
      // Ensure dataLayer doesn't exist
      expect(window.dataLayer).toBeUndefined();

      const result = initializeDataLayer();

      expect(result).toBe(true);
      expect(window.dataLayer).toBeDefined();
      expect(Array.isArray(window.dataLayer)).toBe(true);
      expect(window.dataLayer.length).toBe(0);
    });

    it('should return true if dataLayer already exists', () => {
      // Pre-populate dataLayer
      window.dataLayer = [{ event: 'existing_event' }];

      const result = initializeDataLayer();

      expect(result).toBe(true);
      expect(window.dataLayer).toBeDefined();
      expect(window.dataLayer.length).toBe(1);
    });
  });

  describe('pushToDataLayer', () => {
    const mockEvent: DataLayerEvent = {
      event: 'scan_initiated',
      timestamp: '2024-01-01T00:00:00Z',
      sessionId: 'session-123',
      wcag_level: 'AA',
      scan_type: 'single',
      url_count: 1,
    };

    beforeEach(() => {
      // Initialize dataLayer for these tests
      window.dataLayer = [];
    });

    it('should push event to dataLayer successfully', () => {
      const result = pushToDataLayer(mockEvent);

      expect(result).toBe(true);
      expect(window.dataLayer.length).toBe(1);
      expect(window.dataLayer[0]).toEqual(mockEvent);
    });

    it('should push multiple events to dataLayer', () => {
      const event1 = { ...mockEvent };
      const event2 = { ...mockEvent, event: 'scan_completed' };

      pushToDataLayer(event1);
      pushToDataLayer(event2);

      expect(window.dataLayer.length).toBe(2);
      expect(window.dataLayer[0]).toEqual(event1);
      expect(window.dataLayer[1]).toEqual(event2);
    });

    it('should initialize dataLayer if it does not exist', () => {
      // @ts-expect-error - Deleting window.dataLayer for test
      delete window.dataLayer;

      const result = pushToDataLayer(mockEvent);

      expect(result).toBe(true);
      expect(window.dataLayer).toBeDefined();
      expect(window.dataLayer.length).toBe(1);
    });

    it('should return false and log error if push operation fails', () => {
      // Mock dataLayer to throw error on push
      window.dataLayer = {
        push: vi.fn(() => {
          throw new Error('Push failed');
        }),
      } as unknown as DataLayerEvent[];

      const result = pushToDataLayer(mockEvent);

      expect(result).toBe(false);
    });
  });

  describe('safeAnalyticsCall', () => {
    it('should return operation result on success', async () => {
      const operation = vi.fn(async () => 'success');

      const result = await safeAnalyticsCall(operation, 'fallback');

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should return operation result for synchronous operations', async () => {
      const operation = vi.fn(() => 42);

      const result = await safeAnalyticsCall(operation, 0);

      expect(result).toBe(42);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should return fallback value if operation throws error', async () => {
      const operation = vi.fn(async () => {
        throw new Error('Operation failed');
      });

      const result = await safeAnalyticsCall(operation, 'fallback');

      expect(result).toBe('fallback');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should return fallback value for synchronous operation errors', async () => {
      const operation = vi.fn(() => {
        throw new Error('Sync error');
      });

      const result = await safeAnalyticsCall(operation, 'fallback');

      expect(result).toBe('fallback');
    });

    it('should handle boolean return values', async () => {
      const successOperation = vi.fn(async () => true);
      const failOperation = vi.fn(async () => {
        throw new Error('Failed');
      });

      const successResult = await safeAnalyticsCall(successOperation, false);
      const failResult = await safeAnalyticsCall(failOperation, false);

      expect(successResult).toBe(true);
      expect(failResult).toBe(false);
    });

    it('should handle complex object return values', async () => {
      const mockResult = { success: true, data: { id: 123 } };
      const operation = vi.fn(async () => mockResult);

      const result = await safeAnalyticsCall(operation, { success: false });

      expect(result).toEqual(mockResult);
    });
  });

  describe('sanitizeUrl', () => {
    it('should remove query parameters from URL', () => {
      const url = 'https://example.com/page?email=user@example.com&token=secret';
      const result = sanitizeUrl(url);

      expect(result).toBe('https://example.com/page');
    });

    it('should remove hash fragments from URL', () => {
      const url = 'https://example.com/page#section-with-pii';
      const result = sanitizeUrl(url);

      expect(result).toBe('https://example.com/page');
    });

    it('should remove both query parameters and hash', () => {
      const url = 'https://example.com/page?id=123#section';
      const result = sanitizeUrl(url);

      expect(result).toBe('https://example.com/page');
    });

    it('should preserve protocol, host, and pathname', () => {
      const url = 'https://example.com:8080/path/to/page';
      const result = sanitizeUrl(url);

      expect(result).toBe('https://example.com:8080/path/to/page');
    });

    it('should handle URLs without query or hash', () => {
      const url = 'https://example.com/page';
      const result = sanitizeUrl(url);

      expect(result).toBe('https://example.com/page');
    });

    it('should handle root URLs', () => {
      const url = 'https://example.com/';
      const result = sanitizeUrl(url);

      expect(result).toBe('https://example.com/');
    });

    it('should return empty string for invalid URLs', () => {
      const invalidUrl = 'not-a-valid-url';
      const result = sanitizeUrl(invalidUrl);

      expect(result).toBe('');
    });

    it('should return empty string for empty input', () => {
      const result = sanitizeUrl('');

      expect(result).toBe('');
    });

    it('should return empty string for non-string input', () => {
      // @ts-expect-error - Testing invalid input
      const result1 = sanitizeUrl(null);
      // @ts-expect-error - Testing invalid input
      const result2 = sanitizeUrl(undefined);
      // @ts-expect-error - Testing invalid input
      const result3 = sanitizeUrl(123);

      expect(result1).toBe('');
      expect(result2).toBe('');
      expect(result3).toBe('');
    });

    it('should handle URLs with multiple query parameters', () => {
      const url = 'https://example.com/page?a=1&b=2&c=3';
      const result = sanitizeUrl(url);

      expect(result).toBe('https://example.com/page');
    });

    it('should handle URLs with encoded characters', () => {
      const url = 'https://example.com/page?email=user%40example.com';
      const result = sanitizeUrl(url);

      expect(result).toBe('https://example.com/page');
    });
  });

  describe('sanitizeError', () => {
    it('should remove email addresses from error message', () => {
      const message = 'User user@example.com failed to access resource';
      const result = sanitizeError(message);

      expect(result).toBe('User [EMAIL_REMOVED] failed to access resource');
    });

    it('should remove multiple email addresses', () => {
      const message = 'Users user1@example.com and user2@test.org failed';
      const result = sanitizeError(message);

      expect(result).toBe('Users [EMAIL_REMOVED] and [EMAIL_REMOVED] failed');
    });

    it('should remove URLs with query parameters', () => {
      const message = 'Failed to fetch https://api.example.com/data?token=secret123';
      const result = sanitizeError(message);

      expect(result).toBe('Failed to fetch [URL_REMOVED]');
    });

    it('should remove both email addresses and URLs', () => {
      const message = 'User user@example.com failed to access https://example.com/api?token=secret';
      const result = sanitizeError(message);

      expect(result).toBe('User [EMAIL_REMOVED] failed to access [URL_REMOVED]');
    });

    it('should preserve URLs without query parameters', () => {
      const message = 'Failed to fetch https://example.com/api';
      const result = sanitizeError(message);

      expect(result).toBe('Failed to fetch https://example.com/api');
    });

    it('should handle error messages without PII', () => {
      const message = 'Network request failed';
      const result = sanitizeError(message);

      expect(result).toBe('Network request failed');
    });

    it('should return empty string for empty input', () => {
      const result = sanitizeError('');

      expect(result).toBe('');
    });

    it('should return empty string for non-string input', () => {
      // @ts-expect-error - Testing invalid input
      const result1 = sanitizeError(null);
      // @ts-expect-error - Testing invalid input
      const result2 = sanitizeError(undefined);
      // @ts-expect-error - Testing invalid input
      const result3 = sanitizeError(123);

      expect(result1).toBe('');
      expect(result2).toBe('');
      expect(result3).toBe('');
    });

    it('should handle complex email formats', () => {
      const message = 'Error for user.name+tag@example.co.uk';
      const result = sanitizeError(message);

      expect(result).toBe('Error for [EMAIL_REMOVED]');
    });

    it('should handle multiple URLs with query parameters', () => {
      const message = 'Fetched https://api1.com?key=1 then https://api2.com?key=2';
      const result = sanitizeError(message);

      expect(result).toBe('Fetched [URL_REMOVED] then [URL_REMOVED]');
    });

    it('should handle HTTP and HTTPS URLs', () => {
      const message = 'HTTP: http://example.com?q=test HTTPS: https://example.com?q=test';
      const result = sanitizeError(message);

      expect(result).toBe('HTTP: [URL_REMOVED] HTTPS: [URL_REMOVED]');
    });

    it('should handle mixed PII patterns', () => {
      const message = 'User admin@site.com accessed https://api.example.com?token=abc123&email=test@test.com at 10:00';
      const result = sanitizeError(message);

      expect(result).toBe('User [EMAIL_REMOVED] accessed [URL_REMOVED] at 10:00');
    });
  });
});
