/**
 * Cache Integrity and Expiration Tests
 *
 * Tests for Task 4.5: Cache integrity verification and expiration handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  verifyCacheIntegrity,
  getCacheMetadata,
  shouldRefreshCache,
} from './discovery.service.js';
import type { DiscoveryWithPages } from './discovery.types.js';

describe('Discovery Service - Cache Integrity', () => {
  describe('verifyCacheIntegrity', () => {
    it('should return null for invalid type', async () => {
      const result = await verifyCacheIntegrity(null, 'discovery-123');
      expect(result).toBeNull();
    });

    it('should return null for missing discovery field', async () => {
      const cached = {
        pages: [],
        cachedAt: new Date().toISOString(),
      };
      const result = await verifyCacheIntegrity(cached, 'discovery-123');
      expect(result).toBeNull();
    });

    it('should return null for missing pages field', async () => {
      const cached = {
        discovery: {
          id: 'discovery-123',
          homepageUrl: 'https://example.com',
          status: 'COMPLETED',
        },
        cachedAt: new Date().toISOString(),
      };
      const result = await verifyCacheIntegrity(cached, 'discovery-123');
      expect(result).toBeNull();
    });

    it('should return null for ID mismatch', async () => {
      const cached = {
        discovery: {
          id: 'discovery-wrong',
          homepageUrl: 'https://example.com',
          status: 'COMPLETED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        pages: [],
        cachedAt: new Date().toISOString(),
      };
      const result = await verifyCacheIntegrity(cached, 'discovery-123');
      expect(result).toBeNull();
    });

    it('should return valid DiscoveryWithPages for correct data', async () => {
      const now = new Date();
      const cached = {
        discovery: {
          id: 'discovery-123',
          homepageUrl: 'https://example.com',
          status: 'COMPLETED',
          sessionId: 'session-123',
          mode: 'AUTO',
          maxPages: 10,
          maxDepth: 1,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          completedAt: now.toISOString(),
        },
        pages: [
          {
            id: 'page-1',
            discoveryId: 'discovery-123',
            url: 'https://example.com',
            source: 'CRAWLER',
            depth: 0,
            createdAt: now.toISOString(),
          },
        ],
        cachedAt: now.toISOString(),
      };

      const result = await verifyCacheIntegrity(cached, 'discovery-123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('discovery-123');
      expect(result?.pages).toHaveLength(1);
      expect(result?.createdAt).toBeInstanceOf(Date);
      expect(result?.pages[0].createdAt).toBeInstanceOf(Date);
    });

    it('should handle missing completedAt field', async () => {
      const now = new Date();
      const cached = {
        discovery: {
          id: 'discovery-123',
          homepageUrl: 'https://example.com',
          status: 'PENDING',
          sessionId: 'session-123',
          mode: 'AUTO',
          maxPages: 10,
          maxDepth: 1,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          completedAt: null,
        },
        pages: [],
        cachedAt: now.toISOString(),
      };

      const result = await verifyCacheIntegrity(cached, 'discovery-123');

      expect(result).not.toBeNull();
      expect(result?.completedAt).toBeNull();
    });
  });

  describe('shouldRefreshCache', () => {
    it('should return false for fresh cache (<20 hours)', () => {
      const cachedAt = new Date(Date.now() - 10 * 60 * 60 * 1000); // 10 hours ago
      const result = shouldRefreshCache(cachedAt);
      expect(result).toBe(false);
    });

    it('should return true for stale cache (>20 hours)', () => {
      const cachedAt = new Date(Date.now() - 21 * 60 * 60 * 1000); // 21 hours ago
      const result = shouldRefreshCache(cachedAt);
      expect(result).toBe(true);
    });

    it('should return false for cache at exactly 20 hours', () => {
      const cachedAt = new Date(Date.now() - 20 * 60 * 60 * 1000); // 20 hours ago
      const result = shouldRefreshCache(cachedAt);
      expect(result).toBe(false);
    });

    it('should return true for cache at 20 hours + 1 second', () => {
      const cachedAt = new Date(Date.now() - (20 * 60 * 60 + 1) * 1000); // 20h 1s ago
      const result = shouldRefreshCache(cachedAt);
      expect(result).toBe(true);
    });

    it('should return false for very fresh cache (1 hour)', () => {
      const cachedAt = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago
      const result = shouldRefreshCache(cachedAt);
      expect(result).toBe(false);
    });

    it('should return true for old cache (23 hours)', () => {
      const cachedAt = new Date(Date.now() - 23 * 60 * 60 * 1000); // 23 hours ago
      const result = shouldRefreshCache(cachedAt);
      expect(result).toBe(true);
    });
  });
});
