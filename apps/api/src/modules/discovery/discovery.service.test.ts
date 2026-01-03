/**
 * Discovery Service Tests
 *
 * Unit tests for discovery business logic layer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DiscoveryStatus, DiscoveryMode } from '@prisma/client';

// Mock dependencies before imports
vi.mock('../../config/database.js');
vi.mock('../../config/redis.js');
vi.mock('./discovery.repository.js');
vi.mock('../../shared/queue/queue.service.js');
vi.mock('../../shared/utils/url-validator.js');

// Now safe to import
import {
  createDiscovery,
  checkUsageLimit,
  addManualUrl,
  addManualUrls,
  getCachedDiscovery,
  cacheDiscoveryResult,
  verifyCacheIntegrity,
  isSameDomain,
  MVP_LIMITS,
} from './discovery.service.js';
import { getPrismaClient } from '../../config/database.js';
import { getRedisClient } from '../../config/redis.js';
import * as discoveryRepository from './discovery.repository.js';
import { validateUrl } from '../../shared/utils/url-validator.js';
import { DiscoveryServiceError, DiscoveryErrorCode } from './discovery.errors.js';
import type {
  Discovery,
  DiscoveryWithPages,
  DiscoveredPage,
} from './discovery.types.js';

describe('Discovery Service', () => {
  let mockPrismaClient: any;
  let mockRedisClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup Prisma mock
    mockPrismaClient = {
      discovery: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      discoveredPage: {
        findFirst: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
    };
    vi.mocked(getPrismaClient).mockReturnValue(mockPrismaClient);

    // Setup Redis mock
    mockRedisClient = {
      get: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
      ttl: vi.fn(),
    };
    vi.mocked(getRedisClient).mockReturnValue(mockRedisClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // CREATE DISCOVERY TESTS
  // ============================================================================

  describe('createDiscovery', () => {
    const validSessionId = 'session-123';
    const validHomepageUrl = 'https://example.com';
    const normalizedUrl = 'https://example.com/';
    const monthKey = new Date('2025-12-01T00:00:00.000Z');

    beforeEach(() => {
      // Mock getMonthKey to return consistent month key
      vi.mocked(discoveryRepository.getMonthKey).mockReturnValue(monthKey);
    });

    const mockDiscovery: Discovery = {
      id: 'discovery-123',
      sessionId: validSessionId,
      homepageUrl: normalizedUrl,
      mode: 'AUTO' as DiscoveryMode,
      status: 'PENDING' as DiscoveryStatus,
      phase: null,
      maxPages: 10,
      maxDepth: 1,
      partialResults: false,
      createdAt: new Date('2025-12-28T10:00:00.000Z'),
      updatedAt: new Date('2025-12-28T10:00:00.000Z'),
      completedAt: null,
      errorMessage: null,
      errorCode: null,
    };

    it('should create discovery with valid input', async () => {
      // Arrange - usage limit check (2 used, 1 remaining)
      vi.mocked(discoveryRepository.getMonthlyUsage).mockResolvedValue({
        id: 'usage-123',
        guestSessionId: validSessionId,
        monthKey,
        discoveryCount: 2,
        createdAt: new Date('2025-12-28T10:00:00.000Z'),
        updatedAt: new Date('2025-12-28T10:00:00.000Z'),
      });

      // Arrange - URL validation
      vi.mocked(validateUrl).mockResolvedValue({
        isValid: true,
        normalizedUrl,
      });

      // Arrange - repository create
      vi.mocked(discoveryRepository.create).mockResolvedValue(mockDiscovery);

      // Arrange - increment usage (non-critical, can fail silently)
      vi.mocked(discoveryRepository.incrementUsage).mockResolvedValue({
        id: 'usage-123',
        guestSessionId: validSessionId,
        monthKey: new Date('2025-12-01'),
        discoveryCount: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Arrange - Redis cache (non-critical)
      mockRedisClient.setex.mockResolvedValue('OK');

      // Act
      const result = await createDiscovery(validSessionId, {
        homepageUrl: validHomepageUrl,
        mode: 'AUTO',
        maxPages: 10,
        maxDepth: 1,
      });

      // Assert
      expect(result).toEqual(mockDiscovery);

      // Verify URL validation was called
      expect(validateUrl).toHaveBeenCalledWith(validHomepageUrl);

      // Verify repository create was called with normalized URL
      expect(discoveryRepository.create).toHaveBeenCalledWith({
        homepageUrl: normalizedUrl,
        sessionId: validSessionId,
        mode: 'AUTO',
        maxPages: 10,
        maxDepth: 1,
      });

      // Verify usage was incremented
      expect(discoveryRepository.incrementUsage).toHaveBeenCalledWith(
        { guestSessionId: validSessionId },
        expect.any(Date)
      );

      // Verify cache was set
      expect(mockRedisClient.setex).toHaveBeenCalled();
    });

    it('should fail when usage limit exceeded', async () => {
      // Arrange - usage limit check (3 used, 0 remaining)
      vi.mocked(discoveryRepository.getMonthlyUsage).mockResolvedValue({
        id: 'usage-123',
        guestSessionId: validSessionId,
        monthKey,
        discoveryCount: 3, // At limit
        createdAt: new Date('2025-12-28T10:00:00.000Z'),
        updatedAt: new Date('2025-12-28T10:00:00.000Z'),
      });

      // Act & Assert
      await expect(
        createDiscovery(validSessionId, {
          homepageUrl: validHomepageUrl,
          mode: 'AUTO',
        })
      ).rejects.toThrow(DiscoveryServiceError);

      await expect(
        createDiscovery(validSessionId, {
          homepageUrl: validHomepageUrl,
          mode: 'AUTO',
        })
      ).rejects.toMatchObject({
        code: DiscoveryErrorCode.USAGE_LIMIT_EXCEEDED,
      });

      // Should not create discovery or validate URL
      expect(validateUrl).not.toHaveBeenCalled();
      expect(discoveryRepository.create).not.toHaveBeenCalled();
    });

    it('should increment usage after creation', async () => {
      // Arrange
      vi.mocked(discoveryRepository.getMonthlyUsage).mockResolvedValue({
        id: 'usage-123',
        guestSessionId: validSessionId,
        monthKey,
        discoveryCount: 0,
        createdAt: new Date('2025-12-28T10:00:00.000Z'),
        updatedAt: new Date('2025-12-28T10:00:00.000Z'),
      });

      vi.mocked(validateUrl).mockResolvedValue({
        isValid: true,
        normalizedUrl,
      });

      vi.mocked(discoveryRepository.create).mockResolvedValue(mockDiscovery);

      vi.mocked(discoveryRepository.incrementUsage).mockResolvedValue({
        id: 'usage-123',
        guestSessionId: validSessionId,
        monthKey: new Date('2025-12-01'),
        discoveryCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockRedisClient.setex.mockResolvedValue('OK');

      // Act
      await createDiscovery(validSessionId, {
        homepageUrl: validHomepageUrl,
        mode: 'AUTO',
      });

      // Assert - verify usage was incremented AFTER creation
      expect(discoveryRepository.incrementUsage).toHaveBeenCalledWith(
        { guestSessionId: validSessionId },
        expect.any(Date)
      );

      // Verify incrementUsage was called after create
      const createCallOrder = vi.mocked(discoveryRepository.create).mock.invocationCallOrder[0];
      const incrementCallOrder = vi.mocked(discoveryRepository.incrementUsage).mock.invocationCallOrder[0];
      expect(incrementCallOrder).toBeGreaterThan(createCallOrder!);
    });

    it('should reject invalid URL', async () => {
      // Arrange
      vi.mocked(discoveryRepository.getMonthlyUsage).mockResolvedValue({
        id: 'usage-123',
        guestSessionId: validSessionId,
        monthKey,
        discoveryCount: 0,
        createdAt: new Date('2025-12-28T10:00:00.000Z'),
        updatedAt: new Date('2025-12-28T10:00:00.000Z'),
      });

      vi.mocked(validateUrl).mockResolvedValue({
        isValid: false,
        error: 'Invalid URL format',
      });

      // Act & Assert
      await expect(
        createDiscovery(validSessionId, {
          homepageUrl: 'not-a-url',
          mode: 'AUTO',
        })
      ).rejects.toThrow(DiscoveryServiceError);

      await expect(
        createDiscovery(validSessionId, {
          homepageUrl: 'not-a-url',
          mode: 'AUTO',
        })
      ).rejects.toMatchObject({
        code: DiscoveryErrorCode.INVALID_URL,
        message: 'Invalid URL format',
      });

      // Should not create discovery
      expect(discoveryRepository.create).not.toHaveBeenCalled();
    });

    it('should handle cache errors gracefully', async () => {
      // Arrange
      vi.mocked(discoveryRepository.getMonthlyUsage).mockResolvedValue({
        id: 'usage-123',
        guestSessionId: validSessionId,
        monthKey,
        discoveryCount: 0,
        createdAt: new Date('2025-12-28T10:00:00.000Z'),
        updatedAt: new Date('2025-12-28T10:00:00.000Z'),
      });

      vi.mocked(validateUrl).mockResolvedValue({
        isValid: true,
        normalizedUrl,
      });

      vi.mocked(discoveryRepository.create).mockResolvedValue(mockDiscovery);

      // Cache fails but should not affect result
      mockRedisClient.setex.mockRejectedValue(new Error('Redis connection error'));

      // Act - should succeed despite cache error
      const result = await createDiscovery(validSessionId, {
        homepageUrl: validHomepageUrl,
        mode: 'AUTO',
      });

      // Assert
      expect(result).toEqual(mockDiscovery);
    });
  });

  // ============================================================================
  // MANUAL URL OPERATIONS TESTS
  // ============================================================================

  describe('addManualUrl', () => {
    const discoveryId = 'discovery-123';
    const homepageUrl = 'https://example.com';
    const validUrl = 'https://example.com/contact';
    const normalizedUrl = 'https://example.com/contact/';

    const mockDiscovery: Discovery = {
      id: discoveryId,
      sessionId: 'session-123',
      homepageUrl,
      mode: 'AUTO' as DiscoveryMode,
      status: 'RUNNING' as DiscoveryStatus,
      phase: null,
      maxPages: 10,
      maxDepth: 1,
      partialResults: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
      errorMessage: null,
      errorCode: null,
    };

    const mockPage: DiscoveredPage = {
      id: 'page-123',
      discoveryId,
      url: normalizedUrl,
      title: null,
      source: 'MANUAL',
      depth: 0,
      httpStatus: null,
      contentType: null,
      createdAt: new Date(),
    };

    it('should validate same domain', async () => {
      // Arrange
      vi.mocked(discoveryRepository.findById).mockResolvedValue(mockDiscovery);

      vi.mocked(validateUrl).mockResolvedValue({
        isValid: true,
        normalizedUrl,
      });

      vi.mocked(discoveryRepository.findPageByUrl).mockResolvedValue(null);
      vi.mocked(discoveryRepository.addPage).mockResolvedValue(mockPage);
      mockRedisClient.del.mockResolvedValue(1);

      // Act
      const result = await addManualUrl(discoveryId, validUrl);

      // Assert
      expect(result.success).toBe(true);
      expect(result.page).toEqual(mockPage);
      expect(result.message).toBe('URL added successfully');
    });

    it('should reject different domain', async () => {
      // Arrange
      const differentDomainUrl = 'https://other-site.com/page';
      vi.mocked(discoveryRepository.findById).mockResolvedValue(mockDiscovery);

      vi.mocked(validateUrl).mockResolvedValue({
        isValid: true,
        normalizedUrl: differentDomainUrl,
      });

      // Act
      const result = await addManualUrl(discoveryId, differentDomainUrl);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('URL must be from the same domain as homepage');

      // Should not add page
      expect(discoveryRepository.addPage).not.toHaveBeenCalled();
    });

    it('should detect duplicates', async () => {
      // Arrange
      vi.mocked(discoveryRepository.findById).mockResolvedValue(mockDiscovery);

      vi.mocked(validateUrl).mockResolvedValue({
        isValid: true,
        normalizedUrl,
      });

      // Page already exists
      vi.mocked(discoveryRepository.findPageByUrl).mockResolvedValue(mockPage);

      // Act
      const result = await addManualUrl(discoveryId, validUrl);

      // Assert
      expect(result.success).toBe(false);
      expect(result.page).toEqual(mockPage);
      expect(result.message).toBe('URL already exists in discovery');

      // Should not add page
      expect(discoveryRepository.addPage).not.toHaveBeenCalled();
    });

    it('should handle www prefix normalization', async () => {
      // Test that www.example.com matches example.com
      const result1 = isSameDomain('https://example.com', 'https://www.example.com/page');
      expect(result1).toBe(true);

      const result2 = isSameDomain('https://www.example.com', 'https://example.com/page');
      expect(result2).toBe(true);
    });
  });

  describe('addManualUrls', () => {
    const discoveryId = 'discovery-123';
    const homepageUrl = 'https://example.com';

    const mockDiscovery: Discovery = {
      id: discoveryId,
      sessionId: 'session-123',
      homepageUrl,
      mode: 'AUTO' as DiscoveryMode,
      status: 'RUNNING' as DiscoveryStatus,
      phase: null,
      maxPages: 10,
      maxDepth: 1,
      partialResults: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
      errorMessage: null,
      errorCode: null,
    };

    it('should handle partial success', async () => {
      // Arrange
      const urls = [
        'https://example.com/contact',  // Valid
        'https://other.com/page',       // Different domain
        'https://example.com/about',    // Valid
      ];

      vi.mocked(discoveryRepository.findById).mockResolvedValue(mockDiscovery);

      // Mock URL validation
      vi.mocked(validateUrl)
        .mockResolvedValueOnce({
          isValid: true,
          normalizedUrl: 'https://example.com/contact/',
        })
        .mockResolvedValueOnce({
          isValid: true,
          normalizedUrl: 'https://other.com/page/',
        })
        .mockResolvedValueOnce({
          isValid: true,
          normalizedUrl: 'https://example.com/about/',
        });

      // Mock page checks (none exist)
      vi.mocked(discoveryRepository.findPageByUrl).mockResolvedValue(null);

      // Mock page additions
      vi.mocked(discoveryRepository.addPage)
        .mockResolvedValueOnce({
          id: 'page-1',
          discoveryId,
          url: 'https://example.com/contact/',
          title: null,
          source: 'MANUAL',
          depth: 0,
          httpStatus: null,
          contentType: null,
          createdAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'page-2',
          discoveryId,
          url: 'https://example.com/about/',
          title: null,
          source: 'MANUAL',
          depth: 0,
          httpStatus: null,
          contentType: null,
          createdAt: new Date(),
        });

      mockRedisClient.del.mockResolvedValue(1);

      // Act
      const results = await addManualUrls(discoveryId, urls);

      // Assert
      expect(results).toHaveLength(3);

      // First URL - success
      expect(results[0]!.success).toBe(true);
      expect(results[0]!.page?.url).toBe('https://example.com/contact/');

      // Second URL - different domain failure
      expect(results[1]!.success).toBe(false);
      expect(results[1]!.message).toBe('URL must be from the same domain as homepage');

      // Third URL - success
      expect(results[2]!.success).toBe(true);
      expect(results[2]!.page?.url).toBe('https://example.com/about/');

      // Verify only 2 pages were added
      expect(discoveryRepository.addPage).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // CACHING TESTS
  // ============================================================================

  describe('getCachedDiscovery', () => {
    const discoveryId = 'discovery-123';

    it('should return cached data', async () => {
      // Arrange
      const cachedData = {
        discovery: {
          id: discoveryId,
          sessionId: 'session-123',
          homepageUrl: 'https://example.com',
          mode: 'AUTO',
          status: 'COMPLETED',
          phase: null,
          maxPages: 10,
          maxDepth: 1,
          partialResults: false,
          createdAt: '2025-12-28T10:00:00.000Z',
          updatedAt: '2025-12-28T10:00:00.000Z',
          completedAt: '2025-12-28T11:00:00.000Z',
          errorMessage: null,
          errorCode: null,
        },
        pages: [
          {
            id: 'page-1',
            discoveryId,
            url: 'https://example.com',
            title: 'Homepage',
            source: 'MANUAL',
            depth: 0,
            httpStatus: 200,
            contentType: 'text/html',
            createdAt: '2025-12-28T10:00:00.000Z',
          },
        ],
        cachedAt: '2025-12-28T10:00:00.000Z',
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedData));

      // Act
      const result = await getCachedDiscovery(discoveryId);

      // Assert
      expect(result).not.toBeNull();
      expect(result!.id).toBe(discoveryId);
      expect(result!.pages).toHaveLength(1);
      expect(result!.createdAt).toBeInstanceOf(Date);
      expect(result!.pages[0]!.createdAt).toBeInstanceOf(Date);

      expect(mockRedisClient.get).toHaveBeenCalledWith(`discovery:${discoveryId}:result`);
    });

    it('should return null on cache miss', async () => {
      // Arrange
      mockRedisClient.get.mockResolvedValue(null);

      // Act
      const result = await getCachedDiscovery(discoveryId);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle corrupted cache data', async () => {
      // Arrange
      mockRedisClient.get.mockResolvedValue('invalid-json{');

      // Act
      const result = await getCachedDiscovery(discoveryId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('cacheDiscoveryResult', () => {
    const mockDiscoveryWithPages: DiscoveryWithPages = {
      id: 'discovery-123',
      sessionId: 'session-123',
      homepageUrl: 'https://example.com',
      mode: 'AUTO' as DiscoveryMode,
      status: 'COMPLETED' as DiscoveryStatus,
      phase: null,
      maxPages: 10,
      maxDepth: 1,
      partialResults: false,
      createdAt: new Date('2025-12-28T10:00:00.000Z'),
      updatedAt: new Date('2025-12-28T10:00:00.000Z'),
      completedAt: new Date('2025-12-28T11:00:00.000Z'),
      errorMessage: null,
      errorCode: null,
      pages: [
        {
          id: 'page-1',
          discoveryId: 'discovery-123',
          url: 'https://example.com',
          title: 'Homepage',
          source: 'MANUAL',
          depth: 0,
          httpStatus: 200,
          contentType: 'text/html',
          createdAt: new Date('2025-12-28T10:00:00.000Z'),
        },
      ],
    };

    it('should only cache completed discoveries', async () => {
      // Arrange
      mockRedisClient.setex.mockResolvedValue('OK');

      // Act
      const result = await cacheDiscoveryResult(mockDiscoveryWithPages);

      // Assert
      expect(result).toBe(true);
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'discovery:discovery-123:result',
        86400, // 24 hours in seconds
        expect.any(String)
      );

      // Verify cached data structure
      const cachedData = JSON.parse(mockRedisClient.setex.mock.calls[0]![2] as string);
      expect(cachedData).toHaveProperty('discovery');
      expect(cachedData).toHaveProperty('pages');
      expect(cachedData).toHaveProperty('cachedAt');
      expect(cachedData.pages).toHaveLength(1);
    });

    it('should skip caching for pending discoveries', async () => {
      // Arrange
      const pendingDiscovery = {
        ...mockDiscoveryWithPages,
        status: 'PENDING' as DiscoveryStatus,
      };

      // Act
      const result = await cacheDiscoveryResult(pendingDiscovery);

      // Assert
      expect(result).toBe(false);
      expect(mockRedisClient.setex).not.toHaveBeenCalled();
    });

    it('should handle cache write errors gracefully', async () => {
      // Arrange
      mockRedisClient.setex.mockRejectedValue(new Error('Redis write error'));

      // Act
      const result = await cacheDiscoveryResult(mockDiscoveryWithPages);

      // Assert - should return false but not throw
      expect(result).toBe(false);
    });
  });

  describe('verifyCacheIntegrity', () => {
    const discoveryId = 'discovery-123';

    it('should detect corrupted cache', async () => {
      // Arrange
      const corruptedData = {
        discovery: {
          // Missing required fields
          id: discoveryId,
        },
        pages: [],
      };

      mockRedisClient.del.mockResolvedValue(1);

      // Act
      const result = await verifyCacheIntegrity(corruptedData, discoveryId);

      // Assert
      expect(result).toBeNull();

      // Should delete corrupted cache
      expect(mockRedisClient.del).toHaveBeenCalledWith(`discovery:${discoveryId}:status`);
      expect(mockRedisClient.del).toHaveBeenCalledWith(`discovery:${discoveryId}:result`);
    });

    it('should validate ID matches', async () => {
      // Arrange
      const mismatchedData = {
        discovery: {
          id: 'different-id',
          homepageUrl: 'https://example.com',
          status: 'COMPLETED',
          createdAt: '2025-12-28T10:00:00.000Z',
          updatedAt: '2025-12-28T10:00:00.000Z',
        },
        pages: [],
      };

      mockRedisClient.del.mockResolvedValue(1);

      // Act
      const result = await verifyCacheIntegrity(mismatchedData, discoveryId);

      // Assert
      expect(result).toBeNull();

      // Should delete corrupted cache
      expect(mockRedisClient.del).toHaveBeenCalled();
    });

    it('should accept valid cache data', async () => {
      // Arrange
      const validData = {
        discovery: {
          id: discoveryId,
          sessionId: 'session-123',
          homepageUrl: 'https://example.com',
          mode: 'AUTO',
          status: 'COMPLETED',
          phase: null,
          maxPages: 10,
          maxDepth: 1,
          partialResults: false,
          createdAt: '2025-12-28T10:00:00.000Z',
          updatedAt: '2025-12-28T10:00:00.000Z',
          completedAt: '2025-12-28T11:00:00.000Z',
          errorMessage: null,
          errorCode: null,
        },
        pages: [
          {
            id: 'page-1',
            discoveryId,
            url: 'https://example.com',
            title: 'Homepage',
            source: 'MANUAL',
            depth: 0,
            httpStatus: 200,
            contentType: 'text/html',
            createdAt: '2025-12-28T10:00:00.000Z',
          },
        ],
        cachedAt: '2025-12-28T10:00:00.000Z',
      };

      // Act
      const result = await verifyCacheIntegrity(validData, discoveryId);

      // Assert
      expect(result).not.toBeNull();
      expect(result!.id).toBe(discoveryId);
      expect(result!.pages).toHaveLength(1);

      // Should NOT delete cache
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // USAGE LIMIT TESTS
  // ============================================================================

  describe('checkUsageLimit', () => {
    const sessionId = 'session-123';
    const monthKey = new Date('2025-12-01T00:00:00.000Z');

    beforeEach(() => {
      // Mock getMonthKey to return consistent month key
      vi.mocked(discoveryRepository.getMonthKey).mockReturnValue(monthKey);
    });

    it('should allow when under limit', async () => {
      // Arrange - 1 discovery used, 2 remaining
      vi.mocked(discoveryRepository.getMonthlyUsage).mockResolvedValue({
        id: 'usage-123',
        guestSessionId: sessionId,
        monthKey,
        discoveryCount: 1,
        createdAt: new Date('2025-12-28T10:00:00.000Z'),
        updatedAt: new Date('2025-12-28T10:00:00.000Z'),
      });

      // Act
      const result = await checkUsageLimit(sessionId);

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
      expect(result.limit).toBe(MVP_LIMITS.discoveriesPerMonth);
      expect(result.message).toContain('2 discoveries remaining');
    });

    it('should deny when at limit', async () => {
      // Arrange - 3 discoveries used, 0 remaining
      vi.mocked(discoveryRepository.getMonthlyUsage).mockResolvedValue({
        id: 'usage-123',
        guestSessionId: sessionId,
        monthKey,
        discoveryCount: 3,
        createdAt: new Date('2025-12-28T10:00:00.000Z'),
        updatedAt: new Date('2025-12-28T10:00:00.000Z'),
      });

      // Act
      const result = await checkUsageLimit(sessionId);

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.limit).toBe(MVP_LIMITS.discoveriesPerMonth);
      expect(result.message).toContain('Discovery limit reached');
      expect(result.resetDate).toBeInstanceOf(Date);
    });

    it('should handle first usage (no existing record)', async () => {
      // Arrange - no usage record exists
      vi.mocked(discoveryRepository.getMonthlyUsage).mockResolvedValue(null);

      // Act
      const result = await checkUsageLimit(sessionId);

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(3);
      expect(result.limit).toBe(MVP_LIMITS.discoveriesPerMonth);
    });

    it('should calculate reset date correctly', async () => {
      // Arrange
      vi.mocked(discoveryRepository.getMonthlyUsage).mockResolvedValue({
        id: 'usage-123',
        guestSessionId: sessionId,
        monthKey,
        discoveryCount: 3,
        createdAt: new Date('2025-12-28T10:00:00.000Z'),
        updatedAt: new Date('2025-12-28T10:00:00.000Z'),
      });

      // Act
      const result = await checkUsageLimit(sessionId);

      // Assert - reset date should be first day of next month
      expect(result.resetDate.getFullYear()).toBe(2026);
      expect(result.resetDate.getMonth()).toBe(0); // January (0-indexed)
      expect(result.resetDate.getDate()).toBe(1);
    });
  });
});
