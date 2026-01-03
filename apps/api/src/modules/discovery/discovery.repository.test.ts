/**
 * Discovery Repository Tests
 *
 * Unit tests for discovery repository data access layer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DiscoveryStatus, PageSource } from '@prisma/client';

// Mock dependencies before imports
vi.mock('../../config/database.js');

// Now safe to import
import {
  create,
  findById,
  findByIdWithPages,
  updateStatus,
  findBySessionId,
  addPages,
  addPage,
  removePage,
  findPageByUrl,
  getMonthKey,
  getMonthlyUsage,
  getOrCreateUsage,
  incrementUsage,
} from './discovery.repository.js';
import { getPrismaClient } from '../../config/database.js';
import { DiscoveryRepositoryError, DiscoveryErrorCode } from './discovery.errors.js';

describe('Discovery Repository', () => {
  let mockPrismaClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup Prisma mock
    mockPrismaClient = {
      discovery: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      discoveredPage: {
        createMany: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
        findFirst: vi.fn(),
      },
      discoveryUsage: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
      },
    };
    vi.mocked(getPrismaClient).mockReturnValue(mockPrismaClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // DISCOVERY CRUD OPERATIONS
  // ============================================================================

  describe('create', () => {
    const validInput = {
      homepageUrl: 'https://example.com',
      sessionId: 'session-123',
      mode: 'AUTO' as const,
      maxPages: 10,
      maxDepth: 1,
    };

    const mockDiscovery = {
      id: 'discovery-123',
      homepageUrl: 'https://example.com',
      sessionId: 'session-123',
      mode: 'AUTO',
      maxPages: 10,
      maxDepth: 1,
      status: 'PENDING',
      phase: null,
      partialResults: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
      errorMessage: null,
      errorCode: null,
    };

    it('should create discovery with correct defaults', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discovery.create).mockResolvedValue(mockDiscovery);

      // Act
      const result = await create(validInput);

      // Assert
      expect(result).toEqual(mockDiscovery);
      expect(mockPrismaClient.discovery.create).toHaveBeenCalledWith({
        data: {
          homepageUrl: 'https://example.com',
          sessionId: 'session-123',
          mode: 'AUTO',
          maxPages: 10,
          maxDepth: 1,
          status: 'PENDING',
          phase: null,
          partialResults: false,
        },
      });
    });

    it('should apply default values when optional fields are missing', async () => {
      // Arrange
      const minimalInput = {
        homepageUrl: 'https://example.com',
      };
      const expectedDefaults = {
        ...mockDiscovery,
        sessionId: null,
        mode: 'AUTO',
        maxPages: 10,
        maxDepth: 1,
      };
      vi.mocked(mockPrismaClient.discovery.create).mockResolvedValue(expectedDefaults);

      // Act
      await create(minimalInput);

      // Assert
      expect(mockPrismaClient.discovery.create).toHaveBeenCalledWith({
        data: {
          homepageUrl: 'https://example.com',
          sessionId: null,
          mode: 'AUTO',
          maxPages: 10,
          maxDepth: 1,
          status: 'PENDING',
          phase: null,
          partialResults: false,
        },
      });
    });

    it('should throw INVALID_INPUT error when homepageUrl is missing', async () => {
      // Act & Assert
      await expect(create({} as any)).rejects.toThrow(DiscoveryRepositoryError);
      await expect(create({} as any)).rejects.toMatchObject({
        code: DiscoveryErrorCode.INVALID_INPUT,
        message: 'Homepage URL is required and must be a string',
      });
    });

    it('should throw INVALID_INPUT error when homepageUrl is not a string', async () => {
      // Act & Assert
      await expect(create({ homepageUrl: 123 } as any)).rejects.toThrow(
        DiscoveryRepositoryError
      );
      await expect(create({ homepageUrl: 123 } as any)).rejects.toMatchObject({
        code: DiscoveryErrorCode.INVALID_INPUT,
      });
    });

    it('should throw CREATE_FAILED error when database operation fails', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      vi.mocked(mockPrismaClient.discovery.create).mockRejectedValue(dbError);

      // Act & Assert
      await expect(create(validInput)).rejects.toThrow(DiscoveryRepositoryError);
      await expect(create(validInput)).rejects.toMatchObject({
        code: DiscoveryErrorCode.CREATE_FAILED,
        message: 'Failed to create discovery',
      });
    });
  });

  describe('findById', () => {
    const mockDiscovery = {
      id: 'discovery-123',
      homepageUrl: 'https://example.com',
      sessionId: 'session-123',
      mode: 'AUTO',
      status: 'COMPLETED',
      createdAt: new Date(),
    };

    it('should return discovery when found', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discovery.findUnique).mockResolvedValue(mockDiscovery);

      // Act
      const result = await findById('discovery-123');

      // Assert
      expect(result).toEqual(mockDiscovery);
      expect(mockPrismaClient.discovery.findUnique).toHaveBeenCalledWith({
        where: { id: 'discovery-123' },
      });
    });

    it('should return null when discovery not found', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discovery.findUnique).mockResolvedValue(null);

      // Act
      const result = await findById('non-existent-id');

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when id is empty string', async () => {
      // Act
      const result = await findById('');

      // Assert
      expect(result).toBeNull();
      expect(mockPrismaClient.discovery.findUnique).not.toHaveBeenCalled();
    });

    it('should return null when id is not a string', async () => {
      // Act
      const result = await findById(null as any);

      // Assert
      expect(result).toBeNull();
      expect(mockPrismaClient.discovery.findUnique).not.toHaveBeenCalled();
    });

    it('should throw GET_FAILED error when database operation fails', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      vi.mocked(mockPrismaClient.discovery.findUnique).mockRejectedValue(dbError);

      // Act & Assert
      await expect(findById('discovery-123')).rejects.toThrow(DiscoveryRepositoryError);
      await expect(findById('discovery-123')).rejects.toMatchObject({
        code: DiscoveryErrorCode.GET_FAILED,
      });
    });
  });

  describe('findByIdWithPages', () => {
    const mockDiscoveryWithPages = {
      id: 'discovery-123',
      homepageUrl: 'https://example.com',
      sessionId: 'session-123',
      mode: 'AUTO',
      status: 'COMPLETED',
      pages: [
        {
          id: 'page-1',
          discoveryId: 'discovery-123',
          url: 'https://example.com',
          title: 'Home',
          source: 'SITEMAP',
          depth: 0,
          createdAt: new Date(),
        },
        {
          id: 'page-2',
          discoveryId: 'discovery-123',
          url: 'https://example.com/about',
          title: 'About',
          source: 'SITEMAP',
          depth: 1,
          createdAt: new Date(),
        },
      ],
    };

    it('should return discovery with pages relation included', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discovery.findUnique).mockResolvedValue(
        mockDiscoveryWithPages
      );

      // Act
      const result = await findByIdWithPages('discovery-123');

      // Assert
      expect(result).toEqual(mockDiscoveryWithPages);
      expect(result?.pages).toHaveLength(2);
      expect(mockPrismaClient.discovery.findUnique).toHaveBeenCalledWith({
        where: { id: 'discovery-123' },
        include: {
          pages: {
            orderBy: {
              depth: 'asc',
            },
          },
        },
      });
    });

    it('should return null when discovery not found', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discovery.findUnique).mockResolvedValue(null);

      // Act
      const result = await findByIdWithPages('non-existent-id');

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when id is invalid', async () => {
      // Act
      const result = await findByIdWithPages('');

      // Assert
      expect(result).toBeNull();
      expect(mockPrismaClient.discovery.findUnique).not.toHaveBeenCalled();
    });

    it('should throw GET_FAILED error when database operation fails', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      vi.mocked(mockPrismaClient.discovery.findUnique).mockRejectedValue(dbError);

      // Act & Assert
      await expect(findByIdWithPages('discovery-123')).rejects.toThrow(
        DiscoveryRepositoryError
      );
      await expect(findByIdWithPages('discovery-123')).rejects.toMatchObject({
        code: DiscoveryErrorCode.GET_FAILED,
      });
    });
  });

  describe('updateStatus', () => {
    const existingDiscovery = {
      id: 'discovery-123',
      status: 'PENDING',
    };

    const updatedDiscovery = {
      id: 'discovery-123',
      homepageUrl: 'https://example.com',
      status: 'RUNNING',
      updatedAt: new Date(),
    };

    it('should update status successfully', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discovery.findUnique).mockResolvedValue(
        existingDiscovery
      );
      vi.mocked(mockPrismaClient.discovery.update).mockResolvedValue(updatedDiscovery);

      // Act
      const result = await updateStatus('discovery-123', 'RUNNING' as DiscoveryStatus);

      // Assert
      expect(result).toEqual(updatedDiscovery);
      expect(mockPrismaClient.discovery.update).toHaveBeenCalledWith({
        where: { id: 'discovery-123' },
        data: { status: 'RUNNING' },
      });
    });

    it('should set completedAt for COMPLETED status', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discovery.findUnique).mockResolvedValue(
        existingDiscovery
      );
      vi.mocked(mockPrismaClient.discovery.update).mockResolvedValue({
        ...updatedDiscovery,
        status: 'COMPLETED',
        completedAt: new Date(),
      });

      // Act
      await updateStatus('discovery-123', 'COMPLETED' as DiscoveryStatus);

      // Assert
      expect(mockPrismaClient.discovery.update).toHaveBeenCalledWith({
        where: { id: 'discovery-123' },
        data: {
          status: 'COMPLETED',
          completedAt: expect.any(Date),
        },
      });
    });

    it('should set completedAt for FAILED status', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discovery.findUnique).mockResolvedValue(
        existingDiscovery
      );
      vi.mocked(mockPrismaClient.discovery.update).mockResolvedValue({
        ...updatedDiscovery,
        status: 'FAILED',
        completedAt: new Date(),
      });

      // Act
      await updateStatus('discovery-123', 'FAILED' as DiscoveryStatus);

      // Assert
      expect(mockPrismaClient.discovery.update).toHaveBeenCalledWith({
        where: { id: 'discovery-123' },
        data: {
          status: 'FAILED',
          completedAt: expect.any(Date),
        },
      });
    });

    it('should set completedAt for CANCELLED status', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discovery.findUnique).mockResolvedValue(
        existingDiscovery
      );
      vi.mocked(mockPrismaClient.discovery.update).mockResolvedValue({
        ...updatedDiscovery,
        status: 'CANCELLED',
        completedAt: new Date(),
      });

      // Act
      await updateStatus('discovery-123', 'CANCELLED' as DiscoveryStatus);

      // Assert
      expect(mockPrismaClient.discovery.update).toHaveBeenCalledWith({
        where: { id: 'discovery-123' },
        data: {
          status: 'CANCELLED',
          completedAt: expect.any(Date),
        },
      });
    });

    it('should set error details for FAILED status with error', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discovery.findUnique).mockResolvedValue(
        existingDiscovery
      );
      vi.mocked(mockPrismaClient.discovery.update).mockResolvedValue({
        ...updatedDiscovery,
        status: 'FAILED',
        errorMessage: 'Connection timeout',
        errorCode: 'TIMEOUT',
      });

      // Act
      await updateStatus('discovery-123', 'FAILED' as DiscoveryStatus, {
        message: 'Connection timeout',
        code: 'TIMEOUT',
      });

      // Assert
      expect(mockPrismaClient.discovery.update).toHaveBeenCalledWith({
        where: { id: 'discovery-123' },
        data: {
          status: 'FAILED',
          errorMessage: 'Connection timeout',
          errorCode: 'TIMEOUT',
          completedAt: expect.any(Date),
        },
      });
    });

    it('should throw DISCOVERY_NOT_FOUND when discovery does not exist', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discovery.findUnique).mockResolvedValue(null);

      // Act & Assert
      await expect(
        updateStatus('non-existent-id', 'RUNNING' as DiscoveryStatus)
      ).rejects.toThrow(DiscoveryRepositoryError);
      await expect(
        updateStatus('non-existent-id', 'RUNNING' as DiscoveryStatus)
      ).rejects.toMatchObject({
        code: DiscoveryErrorCode.DISCOVERY_NOT_FOUND,
      });
    });

    it('should throw INVALID_INPUT when id is missing', async () => {
      // Act & Assert
      await expect(updateStatus('', 'RUNNING' as DiscoveryStatus)).rejects.toThrow(
        DiscoveryRepositoryError
      );
      await expect(updateStatus('', 'RUNNING' as DiscoveryStatus)).rejects.toMatchObject({
        code: DiscoveryErrorCode.INVALID_INPUT,
      });
    });

    it('should throw INVALID_INPUT when status is missing', async () => {
      // Act & Assert
      await expect(updateStatus('discovery-123', null as any)).rejects.toThrow(
        DiscoveryRepositoryError
      );
      await expect(updateStatus('discovery-123', null as any)).rejects.toMatchObject({
        code: DiscoveryErrorCode.INVALID_INPUT,
      });
    });

    it('should throw UPDATE_FAILED when database operation fails', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discovery.findUnique).mockResolvedValue(
        existingDiscovery
      );
      const dbError = new Error('Database connection failed');
      vi.mocked(mockPrismaClient.discovery.update).mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        updateStatus('discovery-123', 'RUNNING' as DiscoveryStatus)
      ).rejects.toThrow(DiscoveryRepositoryError);
      await expect(
        updateStatus('discovery-123', 'RUNNING' as DiscoveryStatus)
      ).rejects.toMatchObject({
        code: DiscoveryErrorCode.UPDATE_FAILED,
      });
    });
  });

  describe('findBySessionId', () => {
    const mockDiscoveries = [
      {
        id: 'discovery-1',
        sessionId: 'session-123',
        homepageUrl: 'https://example1.com',
        createdAt: new Date('2025-01-15'),
      },
      {
        id: 'discovery-2',
        sessionId: 'session-123',
        homepageUrl: 'https://example2.com',
        createdAt: new Date('2025-01-10'),
      },
    ];

    it('should return discoveries ordered by creation date (newest first)', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discovery.findMany).mockResolvedValue(mockDiscoveries);

      // Act
      const result = await findBySessionId('session-123');

      // Assert
      expect(result).toEqual(mockDiscoveries);
      expect(mockPrismaClient.discovery.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-123' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no discoveries found', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discovery.findMany).mockResolvedValue([]);

      // Act
      const result = await findBySessionId('session-123');

      // Assert
      expect(result).toEqual([]);
    });

    it('should throw INVALID_INPUT when sessionId is missing', async () => {
      // Act & Assert
      await expect(findBySessionId('')).rejects.toThrow(DiscoveryRepositoryError);
      await expect(findBySessionId('')).rejects.toMatchObject({
        code: DiscoveryErrorCode.INVALID_INPUT,
      });
    });

    it('should throw LIST_FAILED when database operation fails', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      vi.mocked(mockPrismaClient.discovery.findMany).mockRejectedValue(dbError);

      // Act & Assert
      await expect(findBySessionId('session-123')).rejects.toThrow(
        DiscoveryRepositoryError
      );
      await expect(findBySessionId('session-123')).rejects.toMatchObject({
        code: DiscoveryErrorCode.LIST_FAILED,
      });
    });
  });

  // ============================================================================
  // PAGE OPERATIONS
  // ============================================================================

  describe('addPages', () => {
    const validPages = [
      {
        url: 'https://example.com',
        title: 'Home',
        source: 'SITEMAP' as PageSource,
        depth: 0,
        httpStatus: 200,
        contentType: 'text/html',
      },
      {
        url: 'https://example.com/about',
        title: 'About',
        source: 'SITEMAP' as PageSource,
        depth: 1,
      },
    ];

    it('should batch insert pages successfully', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discoveredPage.createMany).mockResolvedValue({
        count: 2,
      });

      // Act
      const result = await addPages('discovery-123', validPages);

      // Assert
      expect(result).toBe(2);
      expect(mockPrismaClient.discoveredPage.createMany).toHaveBeenCalledWith({
        data: [
          {
            discoveryId: 'discovery-123',
            url: 'https://example.com',
            title: 'Home',
            source: 'SITEMAP',
            depth: 0,
            httpStatus: 200,
            contentType: 'text/html',
          },
          {
            discoveryId: 'discovery-123',
            url: 'https://example.com/about',
            title: 'About',
            source: 'SITEMAP',
            depth: 1,
            httpStatus: null,
            contentType: null,
          },
        ],
        skipDuplicates: true,
      });
    });

    it('should skip duplicates during batch insert', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discoveredPage.createMany).mockResolvedValue({
        count: 1, // Only 1 inserted, 1 skipped
      });

      // Act
      const result = await addPages('discovery-123', validPages);

      // Assert
      expect(result).toBe(1);
      expect(mockPrismaClient.discoveredPage.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skipDuplicates: true,
        })
      );
    });

    it('should throw INVALID_INPUT when discoveryId is missing', async () => {
      // Act & Assert
      await expect(addPages('', validPages)).rejects.toThrow(DiscoveryRepositoryError);
      await expect(addPages('', validPages)).rejects.toMatchObject({
        code: DiscoveryErrorCode.INVALID_INPUT,
      });
    });

    it('should throw INVALID_INPUT when pages array is empty', async () => {
      // Act & Assert
      await expect(addPages('discovery-123', [])).rejects.toThrow(
        DiscoveryRepositoryError
      );
      await expect(addPages('discovery-123', [])).rejects.toMatchObject({
        code: DiscoveryErrorCode.INVALID_INPUT,
      });
    });

    it('should throw INVALID_INPUT when page URL is missing', async () => {
      // Arrange
      const invalidPages = [{ url: '', source: 'SITEMAP' as PageSource, depth: 0 }];

      // Act & Assert
      await expect(addPages('discovery-123', invalidPages)).rejects.toThrow(
        DiscoveryRepositoryError
      );
      await expect(addPages('discovery-123', invalidPages)).rejects.toMatchObject({
        code: DiscoveryErrorCode.INVALID_INPUT,
        message: 'Each page must have a valid URL',
      });
    });

    it('should throw INVALID_INPUT when page source is missing', async () => {
      // Arrange
      const invalidPages = [{ url: 'https://example.com', source: null as any, depth: 0 }];

      // Act & Assert
      await expect(addPages('discovery-123', invalidPages)).rejects.toThrow(
        DiscoveryRepositoryError
      );
      await expect(addPages('discovery-123', invalidPages)).rejects.toMatchObject({
        code: DiscoveryErrorCode.INVALID_INPUT,
        message: 'Each page must have a source',
      });
    });

    it('should throw INVALID_INPUT when page depth is missing', async () => {
      // Arrange
      const invalidPages = [
        { url: 'https://example.com', source: 'SITEMAP' as PageSource, depth: null as any },
      ];

      // Act & Assert
      await expect(addPages('discovery-123', invalidPages)).rejects.toThrow(
        DiscoveryRepositoryError
      );
      await expect(addPages('discovery-123', invalidPages)).rejects.toMatchObject({
        code: DiscoveryErrorCode.INVALID_INPUT,
        message: 'Each page must have a valid depth',
      });
    });

    it('should throw UPDATE_FAILED when database operation fails', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      vi.mocked(mockPrismaClient.discoveredPage.createMany).mockRejectedValue(dbError);

      // Act & Assert
      await expect(addPages('discovery-123', validPages)).rejects.toThrow(
        DiscoveryRepositoryError
      );
      await expect(addPages('discovery-123', validPages)).rejects.toMatchObject({
        code: DiscoveryErrorCode.UPDATE_FAILED,
      });
    });
  });

  describe('addPage', () => {
    const validPage = {
      url: 'https://example.com/contact',
      title: 'Contact Us',
      source: 'MANUAL' as PageSource,
      depth: 1,
    };

    const mockCreatedPage = {
      id: 'page-123',
      discoveryId: 'discovery-123',
      url: 'https://example.com/contact',
      title: 'Contact Us',
      source: 'MANUAL',
      depth: 1,
      httpStatus: null,
      contentType: null,
      createdAt: new Date(),
    };

    it('should create page successfully when not duplicate', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discoveredPage.findFirst).mockResolvedValue(null);
      vi.mocked(mockPrismaClient.discoveredPage.create).mockResolvedValue(mockCreatedPage);

      // Act
      const result = await addPage('discovery-123', validPage);

      // Assert
      expect(result).toEqual(mockCreatedPage);
      expect(mockPrismaClient.discoveredPage.create).toHaveBeenCalledWith({
        data: {
          discoveryId: 'discovery-123',
          url: 'https://example.com/contact',
          title: 'Contact Us',
          source: 'MANUAL',
          depth: 1,
        },
      });
    });

    it('should return null when page URL already exists (duplicate detection)', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discoveredPage.findFirst).mockResolvedValue(
        mockCreatedPage
      );

      // Act
      const result = await addPage('discovery-123', validPage);

      // Assert
      expect(result).toBeNull();
      expect(mockPrismaClient.discoveredPage.create).not.toHaveBeenCalled();
    });

    it('should throw INVALID_INPUT when discoveryId is missing', async () => {
      // Act & Assert
      await expect(addPage('', validPage)).rejects.toThrow(DiscoveryRepositoryError);
      await expect(addPage('', validPage)).rejects.toMatchObject({
        code: DiscoveryErrorCode.INVALID_INPUT,
      });
    });

    it('should throw INVALID_INPUT when page URL is missing', async () => {
      // Arrange
      const invalidPage = { ...validPage, url: '' };

      // Act & Assert
      await expect(addPage('discovery-123', invalidPage)).rejects.toThrow(
        DiscoveryRepositoryError
      );
      await expect(addPage('discovery-123', invalidPage)).rejects.toMatchObject({
        code: DiscoveryErrorCode.INVALID_INPUT,
        message: 'Page URL is required and must be a string',
      });
    });

    it('should throw INVALID_INPUT when page source is missing', async () => {
      // Arrange
      const invalidPage = { ...validPage, source: null as any };

      // Act & Assert
      await expect(addPage('discovery-123', invalidPage)).rejects.toThrow(
        DiscoveryRepositoryError
      );
      await expect(addPage('discovery-123', invalidPage)).rejects.toMatchObject({
        code: DiscoveryErrorCode.INVALID_INPUT,
        message: 'Page source is required',
      });
    });

    it('should throw INVALID_INPUT when page depth is missing', async () => {
      // Arrange
      const invalidPage = { ...validPage, depth: null as any };

      // Act & Assert
      await expect(addPage('discovery-123', invalidPage)).rejects.toThrow(
        DiscoveryRepositoryError
      );
      await expect(addPage('discovery-123', invalidPage)).rejects.toMatchObject({
        code: DiscoveryErrorCode.INVALID_INPUT,
        message: 'Page depth is required and must be a number',
      });
    });

    it('should throw UPDATE_FAILED when database operation fails', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discoveredPage.findFirst).mockResolvedValue(null);
      const dbError = new Error('Database connection failed');
      vi.mocked(mockPrismaClient.discoveredPage.create).mockRejectedValue(dbError);

      // Act & Assert
      await expect(addPage('discovery-123', validPage)).rejects.toThrow(
        DiscoveryRepositoryError
      );
      await expect(addPage('discovery-123', validPage)).rejects.toMatchObject({
        code: DiscoveryErrorCode.UPDATE_FAILED,
      });
    });
  });

  describe('removePage', () => {
    const mockPage = {
      id: 'page-123',
    };

    it('should delete page and return true when page exists and belongs to discovery', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discoveredPage.findFirst).mockResolvedValue(mockPage);
      vi.mocked(mockPrismaClient.discoveredPage.delete).mockResolvedValue({} as any);

      // Act
      const result = await removePage('discovery-123', 'page-123');

      // Assert
      expect(result).toBe(true);
      expect(mockPrismaClient.discoveredPage.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'page-123',
          discoveryId: 'discovery-123',
        },
        select: { id: true },
      });
      expect(mockPrismaClient.discoveredPage.delete).toHaveBeenCalledWith({
        where: { id: 'page-123' },
      });
    });

    it('should return false when page not found', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discoveredPage.findFirst).mockResolvedValue(null);

      // Act
      const result = await removePage('discovery-123', 'page-123');

      // Assert
      expect(result).toBe(false);
      expect(mockPrismaClient.discoveredPage.delete).not.toHaveBeenCalled();
    });

    it('should return false when page belongs to different discovery (ownership verification)', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discoveredPage.findFirst).mockResolvedValue(null);

      // Act
      const result = await removePage('discovery-123', 'page-456');

      // Assert
      expect(result).toBe(false);
      expect(mockPrismaClient.discoveredPage.delete).not.toHaveBeenCalled();
    });

    it('should throw INVALID_INPUT when discoveryId is missing', async () => {
      // Act & Assert
      await expect(removePage('', 'page-123')).rejects.toThrow(DiscoveryRepositoryError);
      await expect(removePage('', 'page-123')).rejects.toMatchObject({
        code: DiscoveryErrorCode.INVALID_INPUT,
      });
    });

    it('should throw INVALID_INPUT when pageId is missing', async () => {
      // Act & Assert
      await expect(removePage('discovery-123', '')).rejects.toThrow(
        DiscoveryRepositoryError
      );
      await expect(removePage('discovery-123', '')).rejects.toMatchObject({
        code: DiscoveryErrorCode.INVALID_INPUT,
      });
    });

    it('should throw UPDATE_FAILED when database operation fails', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discoveredPage.findFirst).mockResolvedValue(mockPage);
      const dbError = new Error('Database connection failed');
      vi.mocked(mockPrismaClient.discoveredPage.delete).mockRejectedValue(dbError);

      // Act & Assert
      await expect(removePage('discovery-123', 'page-123')).rejects.toThrow(
        DiscoveryRepositoryError
      );
      await expect(removePage('discovery-123', 'page-123')).rejects.toMatchObject({
        code: DiscoveryErrorCode.UPDATE_FAILED,
      });
    });
  });

  describe('findPageByUrl', () => {
    const mockPage = {
      id: 'page-123',
      discoveryId: 'discovery-123',
      url: 'https://example.com/about',
      title: 'About',
      source: 'SITEMAP',
      depth: 1,
      createdAt: new Date(),
    };

    it('should return page when found', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discoveredPage.findFirst).mockResolvedValue(mockPage);

      // Act
      const result = await findPageByUrl('discovery-123', 'https://example.com/about');

      // Assert
      expect(result).toEqual(mockPage);
      expect(mockPrismaClient.discoveredPage.findFirst).toHaveBeenCalledWith({
        where: {
          discoveryId: 'discovery-123',
          url: 'https://example.com/about',
        },
      });
    });

    it('should return null when page not found', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discoveredPage.findFirst).mockResolvedValue(null);

      // Act
      const result = await findPageByUrl('discovery-123', 'https://example.com/nonexistent');

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when discoveryId is invalid', async () => {
      // Act
      const result = await findPageByUrl('', 'https://example.com/about');

      // Assert
      expect(result).toBeNull();
      expect(mockPrismaClient.discoveredPage.findFirst).not.toHaveBeenCalled();
    });

    it('should return null when url is invalid', async () => {
      // Act
      const result = await findPageByUrl('discovery-123', '');

      // Assert
      expect(result).toBeNull();
      expect(mockPrismaClient.discoveredPage.findFirst).not.toHaveBeenCalled();
    });

    it('should throw GET_FAILED when database operation fails', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      vi.mocked(mockPrismaClient.discoveredPage.findFirst).mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        findPageByUrl('discovery-123', 'https://example.com/about')
      ).rejects.toThrow(DiscoveryRepositoryError);
      await expect(
        findPageByUrl('discovery-123', 'https://example.com/about')
      ).rejects.toMatchObject({
        code: DiscoveryErrorCode.GET_FAILED,
      });
    });
  });

  // ============================================================================
  // USAGE TRACKING OPERATIONS
  // ============================================================================

  describe('getMonthKey', () => {
    it('should return first day of month at midnight UTC', () => {
      // Arrange
      const inputDate = new Date('2025-01-15T14:30:45.123Z');

      // Act
      const result = getMonthKey(inputDate);

      // Assert
      expect(result.toISOString()).toBe('2025-01-01T00:00:00.000Z');
    });

    it('should handle first day of month', () => {
      // Arrange
      const inputDate = new Date('2025-01-01T00:00:00.000Z');

      // Act
      const result = getMonthKey(inputDate);

      // Assert
      expect(result.toISOString()).toBe('2025-01-01T00:00:00.000Z');
    });

    it('should handle last day of month', () => {
      // Arrange
      const inputDate = new Date('2025-01-31T23:59:59.999Z');

      // Act
      const result = getMonthKey(inputDate);

      // Assert
      expect(result.toISOString()).toBe('2025-01-01T00:00:00.000Z');
    });

    it('should handle different months correctly', () => {
      // Arrange & Act
      const jan = getMonthKey(new Date('2025-01-15'));
      const feb = getMonthKey(new Date('2025-02-15'));
      const dec = getMonthKey(new Date('2025-12-15'));

      // Assert
      expect(jan.toISOString()).toBe('2025-01-01T00:00:00.000Z');
      expect(feb.toISOString()).toBe('2025-02-01T00:00:00.000Z');
      expect(dec.toISOString()).toBe('2025-12-01T00:00:00.000Z');
    });
  });

  describe('getMonthlyUsage', () => {
    const mockUsage = {
      id: 'usage-123',
      customerId: 'customer-123',
      guestSessionId: null,
      month: new Date('2025-01-01T00:00:00.000Z'),
      discoveryCount: 2,
      pagesDiscovered: 15,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should find usage record by customerId', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discoveryUsage.findUnique).mockResolvedValue(mockUsage);

      // Act
      const result = await getMonthlyUsage(
        { customerId: 'customer-123' },
        new Date('2025-01-15')
      );

      // Assert
      expect(result).toEqual(mockUsage);
      expect(mockPrismaClient.discoveryUsage.findUnique).toHaveBeenCalledWith({
        where: {
          customerId_month: {
            customerId: 'customer-123',
            month: new Date('2025-01-01T00:00:00.000Z'),
          },
        },
      });
    });

    it('should find usage record by guestSessionId', async () => {
      // Arrange
      const guestUsage = { ...mockUsage, customerId: null, guestSessionId: 'session-456' };
      vi.mocked(mockPrismaClient.discoveryUsage.findUnique).mockResolvedValue(guestUsage);

      // Act
      const result = await getMonthlyUsage(
        { guestSessionId: 'session-456' },
        new Date('2025-01-15')
      );

      // Assert
      expect(result).toEqual(guestUsage);
      expect(mockPrismaClient.discoveryUsage.findUnique).toHaveBeenCalledWith({
        where: {
          guestSessionId_month: {
            guestSessionId: 'session-456',
            month: new Date('2025-01-01T00:00:00.000Z'),
          },
        },
      });
    });

    it('should return null when usage record not found', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discoveryUsage.findUnique).mockResolvedValue(null);

      // Act
      const result = await getMonthlyUsage(
        { customerId: 'customer-123' },
        new Date('2025-01-15')
      );

      // Assert
      expect(result).toBeNull();
    });

    it('should normalize month to first day of month', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discoveryUsage.findUnique).mockResolvedValue(mockUsage);

      // Act
      await getMonthlyUsage({ customerId: 'customer-123' }, new Date('2025-01-25T15:30:45Z'));

      // Assert
      expect(mockPrismaClient.discoveryUsage.findUnique).toHaveBeenCalledWith({
        where: {
          customerId_month: {
            customerId: 'customer-123',
            month: new Date('2025-01-01T00:00:00.000Z'),
          },
        },
      });
    });

    it('should throw INVALID_INPUT when neither customerId nor guestSessionId provided', async () => {
      // Act & Assert
      await expect(getMonthlyUsage({}, new Date())).rejects.toThrow(
        DiscoveryRepositoryError
      );
      await expect(getMonthlyUsage({}, new Date())).rejects.toMatchObject({
        code: DiscoveryErrorCode.INVALID_INPUT,
        message: 'Either customerId or guestSessionId must be provided',
      });
    });

    it('should throw INVALID_INPUT when both customerId and guestSessionId provided', async () => {
      // Act & Assert
      await expect(
        getMonthlyUsage(
          { customerId: 'customer-123', guestSessionId: 'session-456' },
          new Date()
        )
      ).rejects.toThrow(DiscoveryRepositoryError);
      await expect(
        getMonthlyUsage(
          { customerId: 'customer-123', guestSessionId: 'session-456' },
          new Date()
        )
      ).rejects.toMatchObject({
        code: DiscoveryErrorCode.INVALID_INPUT,
        message: 'Only one of customerId or guestSessionId should be provided',
      });
    });

    it('should throw GET_FAILED when database operation fails', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      vi.mocked(mockPrismaClient.discoveryUsage.findUnique).mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        getMonthlyUsage({ customerId: 'customer-123' }, new Date())
      ).rejects.toThrow(DiscoveryRepositoryError);
      await expect(
        getMonthlyUsage({ customerId: 'customer-123' }, new Date())
      ).rejects.toMatchObject({
        code: DiscoveryErrorCode.GET_FAILED,
      });
    });

    it('should handle month boundary correctly (different months have separate records)', async () => {
      // Arrange
      const jan = new Date('2025-01-15');
      const feb = new Date('2025-02-15');

      vi.mocked(mockPrismaClient.discoveryUsage.findUnique)
        .mockResolvedValueOnce(mockUsage)
        .mockResolvedValueOnce({ ...mockUsage, month: new Date('2025-02-01T00:00:00.000Z') });

      // Act
      await getMonthlyUsage({ customerId: 'customer-123' }, jan);
      await getMonthlyUsage({ customerId: 'customer-123' }, feb);

      // Assert
      expect(mockPrismaClient.discoveryUsage.findUnique).toHaveBeenNthCalledWith(1, {
        where: {
          customerId_month: {
            customerId: 'customer-123',
            month: new Date('2025-01-01T00:00:00.000Z'),
          },
        },
      });
      expect(mockPrismaClient.discoveryUsage.findUnique).toHaveBeenNthCalledWith(2, {
        where: {
          customerId_month: {
            customerId: 'customer-123',
            month: new Date('2025-02-01T00:00:00.000Z'),
          },
        },
      });
    });
  });

  describe('getOrCreateUsage', () => {
    const mockUsage = {
      id: 'usage-123',
      customerId: 'customer-123',
      guestSessionId: null,
      month: new Date('2025-01-01T00:00:00.000Z'),
      discoveryCount: 0,
      pagesDiscovered: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should create usage record if not exists', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discoveryUsage.upsert).mockResolvedValue(mockUsage);

      // Act
      const result = await getOrCreateUsage(
        { customerId: 'customer-123' },
        new Date('2025-01-15')
      );

      // Assert
      expect(result).toEqual(mockUsage);
      expect(mockPrismaClient.discoveryUsage.upsert).toHaveBeenCalledWith({
        where: {
          customerId_month: {
            customerId: 'customer-123',
            month: new Date('2025-01-01T00:00:00.000Z'),
          },
        },
        create: {
          month: new Date('2025-01-01T00:00:00.000Z'),
          discoveryCount: 0,
          pagesDiscovered: 0,
          customerId: 'customer-123',
        },
        update: {},
      });
    });

    it('should return existing usage record if already exists', async () => {
      // Arrange
      const existingUsage = { ...mockUsage, discoveryCount: 2 };
      vi.mocked(mockPrismaClient.discoveryUsage.upsert).mockResolvedValue(existingUsage);

      // Act
      const result = await getOrCreateUsage(
        { customerId: 'customer-123' },
        new Date('2025-01-15')
      );

      // Assert
      expect(result).toEqual(existingUsage);
    });

    it('should handle guestSessionId correctly', async () => {
      // Arrange
      const guestUsage = { ...mockUsage, customerId: null, guestSessionId: 'session-456' };
      vi.mocked(mockPrismaClient.discoveryUsage.upsert).mockResolvedValue(guestUsage);

      // Act
      const result = await getOrCreateUsage(
        { guestSessionId: 'session-456' },
        new Date('2025-01-15')
      );

      // Assert
      expect(result).toEqual(guestUsage);
      expect(mockPrismaClient.discoveryUsage.upsert).toHaveBeenCalledWith({
        where: {
          guestSessionId_month: {
            guestSessionId: 'session-456',
            month: new Date('2025-01-01T00:00:00.000Z'),
          },
        },
        create: {
          month: new Date('2025-01-01T00:00:00.000Z'),
          discoveryCount: 0,
          pagesDiscovered: 0,
          guestSessionId: 'session-456',
        },
        update: {},
      });
    });

    it('should throw INVALID_INPUT when neither customerId nor guestSessionId provided', async () => {
      // Act & Assert
      await expect(getOrCreateUsage({}, new Date())).rejects.toThrow(
        DiscoveryRepositoryError
      );
      await expect(getOrCreateUsage({}, new Date())).rejects.toMatchObject({
        code: DiscoveryErrorCode.INVALID_INPUT,
      });
    });

    it('should throw CREATE_FAILED when database operation fails', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      vi.mocked(mockPrismaClient.discoveryUsage.upsert).mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        getOrCreateUsage({ customerId: 'customer-123' }, new Date())
      ).rejects.toThrow(DiscoveryRepositoryError);
      await expect(
        getOrCreateUsage({ customerId: 'customer-123' }, new Date())
      ).rejects.toMatchObject({
        code: DiscoveryErrorCode.CREATE_FAILED,
      });
    });
  });

  describe('incrementUsage', () => {
    const mockUsage = {
      id: 'usage-123',
      customerId: 'customer-123',
      guestSessionId: null,
      month: new Date('2025-01-01T00:00:00.000Z'),
      discoveryCount: 1,
      pagesDiscovered: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should atomically increment discoveryCount', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discoveryUsage.upsert).mockResolvedValue({
        ...mockUsage,
        discoveryCount: 0,
      });
      vi.mocked(mockPrismaClient.discoveryUsage.update).mockResolvedValue(mockUsage);

      // Act
      const result = await incrementUsage(
        { customerId: 'customer-123' },
        new Date('2025-01-15')
      );

      // Assert
      expect(result).toEqual(mockUsage);
      expect(result.discoveryCount).toBe(1);
      expect(mockPrismaClient.discoveryUsage.update).toHaveBeenCalledWith({
        where: {
          customerId_month: {
            customerId: 'customer-123',
            month: new Date('2025-01-01T00:00:00.000Z'),
          },
        },
        data: {
          discoveryCount: {
            increment: 1,
          },
        },
      });
    });

    it('should create usage record before incrementing if not exists', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discoveryUsage.upsert).mockResolvedValue({
        ...mockUsage,
        discoveryCount: 0,
      });
      vi.mocked(mockPrismaClient.discoveryUsage.update).mockResolvedValue(mockUsage);

      // Act
      await incrementUsage({ customerId: 'customer-123' }, new Date('2025-01-15'));

      // Assert - should call getOrCreateUsage (upsert) first
      expect(mockPrismaClient.discoveryUsage.upsert).toHaveBeenCalled();
      expect(mockPrismaClient.discoveryUsage.update).toHaveBeenCalled();
    });

    it('should handle guestSessionId correctly', async () => {
      // Arrange
      const guestUsage = { ...mockUsage, customerId: null, guestSessionId: 'session-456' };
      vi.mocked(mockPrismaClient.discoveryUsage.upsert).mockResolvedValue({
        ...guestUsage,
        discoveryCount: 0,
      });
      vi.mocked(mockPrismaClient.discoveryUsage.update).mockResolvedValue(guestUsage);

      // Act
      const result = await incrementUsage(
        { guestSessionId: 'session-456' },
        new Date('2025-01-15')
      );

      // Assert
      expect(result).toEqual(guestUsage);
      expect(mockPrismaClient.discoveryUsage.update).toHaveBeenCalledWith({
        where: {
          guestSessionId_month: {
            guestSessionId: 'session-456',
            month: new Date('2025-01-01T00:00:00.000Z'),
          },
        },
        data: {
          discoveryCount: {
            increment: 1,
          },
        },
      });
    });

    it('should throw INVALID_INPUT when neither customerId nor guestSessionId provided', async () => {
      // Act & Assert
      await expect(incrementUsage({}, new Date())).rejects.toThrow(
        DiscoveryRepositoryError
      );
      await expect(incrementUsage({}, new Date())).rejects.toMatchObject({
        code: DiscoveryErrorCode.INVALID_INPUT,
      });
    });

    it('should throw UPDATE_FAILED when database operation fails', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.discoveryUsage.upsert).mockResolvedValue(mockUsage);
      const dbError = new Error('Database connection failed');
      vi.mocked(mockPrismaClient.discoveryUsage.update).mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        incrementUsage({ customerId: 'customer-123' }, new Date())
      ).rejects.toThrow(DiscoveryRepositoryError);
      await expect(
        incrementUsage({ customerId: 'customer-123' }, new Date())
      ).rejects.toMatchObject({
        code: DiscoveryErrorCode.UPDATE_FAILED,
      });
    });

    it('should handle month boundary correctly (different months increment separately)', async () => {
      // Arrange
      const janUsage = {
        ...mockUsage,
        month: new Date('2025-01-01T00:00:00.000Z'),
        discoveryCount: 1,
      };
      const febUsage = {
        ...mockUsage,
        month: new Date('2025-02-01T00:00:00.000Z'),
        discoveryCount: 1,
      };

      vi.mocked(mockPrismaClient.discoveryUsage.upsert)
        .mockResolvedValueOnce({ ...janUsage, discoveryCount: 0 })
        .mockResolvedValueOnce({ ...febUsage, discoveryCount: 0 });

      vi.mocked(mockPrismaClient.discoveryUsage.update)
        .mockResolvedValueOnce(janUsage)
        .mockResolvedValueOnce(febUsage);

      // Act
      const janResult = await incrementUsage(
        { customerId: 'customer-123' },
        new Date('2025-01-15')
      );
      const febResult = await incrementUsage(
        { customerId: 'customer-123' },
        new Date('2025-02-15')
      );

      // Assert - each month should have separate increment
      expect(janResult.month.toISOString()).toBe('2025-01-01T00:00:00.000Z');
      expect(febResult.month.toISOString()).toBe('2025-02-01T00:00:00.000Z');
      expect(mockPrismaClient.discoveryUsage.update).toHaveBeenCalledTimes(2);
    });
  });
});
