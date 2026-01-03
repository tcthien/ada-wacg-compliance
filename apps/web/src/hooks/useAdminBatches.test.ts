/**
 * Tests for useAdminBatches hook
 *
 * Tests data fetching, filtering, pagination, error handling,
 * and refetch functionality for admin batch list.
 *
 * Requirements: 1.1, 1.3, 1.4 (Hook validation with filters and pagination)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAdminBatches, type BatchListFilters } from './useAdminBatches';
import * as adminApiModule from '@/lib/admin-api';

// Mock the admin-api module
vi.mock('@/lib/admin-api', () => ({
  adminApi: {
    batches: {
      list: vi.fn(),
    },
  },
}));

describe('useAdminBatches', () => {
  const mockAdminApi = adminApiModule.adminApi as {
    batches: {
      list: ReturnType<typeof vi.fn>;
    };
  };

  const createMockBatchListResponse = (
    overrides?: Partial<adminApiModule.AdminBatchListResponse>
  ): adminApiModule.AdminBatchListResponse => ({
    batches: [
      {
        id: 'batch-1',
        homepageUrl: 'https://example.com',
        totalUrls: 10,
        completedCount: 8,
        failedCount: 2,
        status: 'COMPLETED',
        wcagLevel: 'AA',
        totalIssues: 25,
        criticalCount: 5,
        seriousCount: 10,
        moderateCount: 7,
        minorCount: 3,
        sessionId: 'session-1',
        createdAt: '2024-01-01T00:00:00Z',
        completedAt: '2024-01-01T01:00:00Z',
      },
      {
        id: 'batch-2',
        homepageUrl: 'https://test.com',
        totalUrls: 5,
        completedCount: 5,
        failedCount: 0,
        status: 'COMPLETED',
        wcagLevel: 'A',
        totalIssues: 12,
        criticalCount: 2,
        seriousCount: 5,
        moderateCount: 3,
        minorCount: 2,
        sessionId: null,
        createdAt: '2024-01-02T00:00:00Z',
        completedAt: '2024-01-02T00:30:00Z',
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    },
    summary: {
      totalBatches: 2,
      totalUrls: 15,
      aggregateIssues: {
        totalIssues: 37,
        criticalCount: 7,
        seriousCount: 15,
        moderateCount: 10,
        minorCount: 5,
        passedChecks: 100,
      },
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial fetch', () => {
    it('should fetch batches on mount', async () => {
      const mockResponse = createMockBatchListResponse();
      mockAdminApi.batches.list.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAdminBatches());

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      // Wait for fetch to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockAdminApi.batches.list).toHaveBeenCalledTimes(1);
      expect(result.current.batches).toEqual(mockResponse.batches);
      expect(result.current.error).toBeNull();
    });

    it('should use default filter values', async () => {
      const mockResponse = createMockBatchListResponse();
      mockAdminApi.batches.list.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAdminBatches());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Check default filter values
      expect(result.current.filters).toEqual({
        page: 1,
        pageSize: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      // Verify API was called with default filters
      expect(mockAdminApi.batches.list).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        status: undefined,
        sessionId: undefined,
        startDate: undefined,
        endDate: undefined,
      });
    });

    it('should use initial filters when provided', async () => {
      const mockResponse = createMockBatchListResponse();
      mockAdminApi.batches.list.mockResolvedValue(mockResponse);

      const initialFilters: BatchListFilters = {
        status: 'RUNNING',
        page: 2,
        pageSize: 50,
      };

      const { result } = renderHook(() => useAdminBatches(initialFilters));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.filters.status).toBe('RUNNING');
      expect(result.current.filters.page).toBe(2);
      expect(result.current.filters.pageSize).toBe(50);
    });
  });

  describe('pagination', () => {
    it('should return pagination metadata', async () => {
      const mockResponse = createMockBatchListResponse({
        pagination: {
          page: 1,
          limit: 20,
          total: 50,
          totalPages: 3,
        },
      });
      mockAdminApi.batches.list.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAdminBatches());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 50,
        totalPages: 3,
      });
    });

    it('should refetch when page changes', async () => {
      const page1Response = createMockBatchListResponse({
        batches: [
          {
            id: 'batch-1',
            homepageUrl: 'https://page1.com',
            totalUrls: 5,
            completedCount: 5,
            failedCount: 0,
            status: 'COMPLETED',
            wcagLevel: 'AA',
            totalIssues: 10,
            criticalCount: 1,
            seriousCount: 2,
            moderateCount: 3,
            minorCount: 4,
            sessionId: null,
            createdAt: '2024-01-01T00:00:00Z',
            completedAt: '2024-01-01T01:00:00Z',
          },
        ],
        pagination: { page: 1, limit: 20, total: 40, totalPages: 2 },
      });

      const page2Response = createMockBatchListResponse({
        batches: [
          {
            id: 'batch-21',
            homepageUrl: 'https://page2.com',
            totalUrls: 3,
            completedCount: 3,
            failedCount: 0,
            status: 'COMPLETED',
            wcagLevel: 'A',
            totalIssues: 5,
            criticalCount: 0,
            seriousCount: 1,
            moderateCount: 2,
            minorCount: 2,
            sessionId: null,
            createdAt: '2024-01-02T00:00:00Z',
            completedAt: '2024-01-02T00:30:00Z',
          },
        ],
        pagination: { page: 2, limit: 20, total: 40, totalPages: 2 },
      });

      mockAdminApi.batches.list
        .mockResolvedValueOnce(page1Response)
        .mockResolvedValueOnce(page2Response);

      const { result } = renderHook(() => useAdminBatches());

      await waitFor(() => {
        expect(result.current.batches[0].id).toBe('batch-1');
      });

      // Change page
      act(() => {
        result.current.setFilters({ ...result.current.filters, page: 2 });
      });

      await waitFor(() => {
        expect(result.current.batches[0].id).toBe('batch-21');
      });

      expect(result.current.pagination.page).toBe(2);
      expect(mockAdminApi.batches.list).toHaveBeenCalledTimes(2);
    });

    it('should handle page size changes', async () => {
      const mockResponse = createMockBatchListResponse();
      mockAdminApi.batches.list.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAdminBatches());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Change page size
      act(() => {
        result.current.setFilters({ ...result.current.filters, pageSize: 50 });
      });

      await waitFor(() => {
        expect(mockAdminApi.batches.list).toHaveBeenCalledTimes(2);
      });

      // Verify API was called with new page size
      expect(mockAdminApi.batches.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ pageSize: 50 })
      );
    });
  });

  describe('filtering', () => {
    it('should filter by status', async () => {
      const mockResponse = createMockBatchListResponse({
        batches: [
          {
            id: 'running-batch',
            homepageUrl: 'https://running.com',
            totalUrls: 10,
            completedCount: 3,
            failedCount: 0,
            status: 'RUNNING',
            wcagLevel: 'AA',
            totalIssues: 5,
            criticalCount: 1,
            seriousCount: 2,
            moderateCount: 1,
            minorCount: 1,
            sessionId: null,
            createdAt: '2024-01-01T00:00:00Z',
            completedAt: null,
          },
        ],
      });
      mockAdminApi.batches.list.mockResolvedValue(mockResponse);

      const { result } = renderHook(() =>
        useAdminBatches({ status: 'RUNNING' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockAdminApi.batches.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'RUNNING' })
      );
      expect(result.current.batches[0].status).toBe('RUNNING');
    });

    it('should filter by date range', async () => {
      const mockResponse = createMockBatchListResponse();
      mockAdminApi.batches.list.mockResolvedValue(mockResponse);

      const startDate = '2024-01-01T00:00:00Z';
      const endDate = '2024-01-31T23:59:59Z';

      const { result } = renderHook(() =>
        useAdminBatches({ startDate, endDate })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockAdminApi.batches.list).toHaveBeenCalledWith(
        expect.objectContaining({ startDate, endDate })
      );
    });

    it('should filter by sessionId', async () => {
      const mockResponse = createMockBatchListResponse();
      mockAdminApi.batches.list.mockResolvedValue(mockResponse);

      const { result } = renderHook(() =>
        useAdminBatches({ sessionId: 'session-123' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockAdminApi.batches.list).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'session-123' })
      );
    });

    it('should update filters and refetch', async () => {
      const allBatchesResponse = createMockBatchListResponse();
      const filteredResponse = createMockBatchListResponse({
        batches: [
          {
            id: 'failed-batch',
            homepageUrl: 'https://failed.com',
            totalUrls: 5,
            completedCount: 2,
            failedCount: 3,
            status: 'FAILED',
            wcagLevel: 'AA',
            totalIssues: 0,
            criticalCount: 0,
            seriousCount: 0,
            moderateCount: 0,
            minorCount: 0,
            sessionId: null,
            createdAt: '2024-01-01T00:00:00Z',
            completedAt: null,
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      mockAdminApi.batches.list
        .mockResolvedValueOnce(allBatchesResponse)
        .mockResolvedValueOnce(filteredResponse);

      const { result } = renderHook(() => useAdminBatches());

      await waitFor(() => {
        expect(result.current.batches.length).toBe(2);
      });

      // Apply filter
      act(() => {
        result.current.setFilters({ ...result.current.filters, status: 'FAILED' });
      });

      await waitFor(() => {
        expect(result.current.batches.length).toBe(1);
        expect(result.current.batches[0].status).toBe('FAILED');
      });
    });

    it('should support sorting', async () => {
      const mockResponse = createMockBatchListResponse();
      mockAdminApi.batches.list.mockResolvedValue(mockResponse);

      const { result } = renderHook(() =>
        useAdminBatches({ sortBy: 'totalUrls', sortOrder: 'asc' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockAdminApi.batches.list).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'totalUrls',
          sortOrder: 'asc',
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle API errors', async () => {
      const error = new Error('Network error');
      mockAdminApi.batches.list.mockRejectedValue(error);

      const { result } = renderHook(() => useAdminBatches());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.batches).toEqual([]);
    });

    it('should handle non-Error exceptions', async () => {
      mockAdminApi.batches.list.mockRejectedValue('String error');

      const { result } = renderHook(() => useAdminBatches());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to load batches');
    });

    it('should reset pagination on error', async () => {
      mockAdminApi.batches.list.mockRejectedValue(new Error('API error'));

      const { result } = renderHook(() =>
        useAdminBatches({ page: 3, pageSize: 50 })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.pagination).toEqual({
        page: 3,
        limit: 50,
        total: 0,
        totalPages: 0,
      });
    });

    it('should clear error on successful refetch', async () => {
      const error = new Error('Temporary error');
      const mockResponse = createMockBatchListResponse();

      mockAdminApi.batches.list
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useAdminBatches());

      // Wait for error state
      await waitFor(() => {
        expect(result.current.error).toBe('Temporary error');
      });

      // Trigger refetch
      act(() => {
        result.current.refetch();
      });

      // Wait for successful fetch
      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });

      expect(result.current.batches.length).toBe(2);
    });
  });

  describe('refetch', () => {
    it('should allow manual refetch', async () => {
      const mockResponse = createMockBatchListResponse();
      mockAdminApi.batches.list.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAdminBatches());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockAdminApi.batches.list).toHaveBeenCalledTimes(1);

      // Trigger refetch
      act(() => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(mockAdminApi.batches.list).toHaveBeenCalledTimes(2);
      });
    });

    it('should update data on refetch', async () => {
      const initialResponse = createMockBatchListResponse({
        batches: [
          {
            id: 'batch-1',
            homepageUrl: 'https://initial.com',
            totalUrls: 5,
            completedCount: 5,
            failedCount: 0,
            status: 'COMPLETED',
            wcagLevel: 'AA',
            totalIssues: 10,
            criticalCount: 1,
            seriousCount: 2,
            moderateCount: 3,
            minorCount: 4,
            sessionId: null,
            createdAt: '2024-01-01T00:00:00Z',
            completedAt: '2024-01-01T01:00:00Z',
          },
        ],
      });

      const updatedResponse = createMockBatchListResponse({
        batches: [
          {
            id: 'batch-1',
            homepageUrl: 'https://initial.com',
            totalUrls: 5,
            completedCount: 5,
            failedCount: 0,
            status: 'COMPLETED',
            wcagLevel: 'AA',
            totalIssues: 15, // Updated
            criticalCount: 2,
            seriousCount: 3,
            moderateCount: 5,
            minorCount: 5,
            sessionId: null,
            createdAt: '2024-01-01T00:00:00Z',
            completedAt: '2024-01-01T01:00:00Z',
          },
          {
            id: 'batch-2', // New batch
            homepageUrl: 'https://new.com',
            totalUrls: 3,
            completedCount: 3,
            failedCount: 0,
            status: 'COMPLETED',
            wcagLevel: 'A',
            totalIssues: 5,
            criticalCount: 0,
            seriousCount: 1,
            moderateCount: 2,
            minorCount: 2,
            sessionId: null,
            createdAt: '2024-01-02T00:00:00Z',
            completedAt: '2024-01-02T00:30:00Z',
          },
        ],
      });

      mockAdminApi.batches.list
        .mockResolvedValueOnce(initialResponse)
        .mockResolvedValueOnce(updatedResponse);

      const { result } = renderHook(() => useAdminBatches());

      await waitFor(() => {
        expect(result.current.batches.length).toBe(1);
      });

      // Trigger refetch
      act(() => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.batches.length).toBe(2);
      });

      expect(result.current.batches[0].totalIssues).toBe(15);
    });
  });

  describe('loading state', () => {
    it('should set loading true initially', () => {
      mockAdminApi.batches.list.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => useAdminBatches());

      expect(result.current.isLoading).toBe(true);
    });

    it('should set loading false after successful fetch', async () => {
      const mockResponse = createMockBatchListResponse();
      mockAdminApi.batches.list.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAdminBatches());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should set loading false after failed fetch', async () => {
      mockAdminApi.batches.list.mockRejectedValue(new Error('API error'));

      const { result } = renderHook(() => useAdminBatches());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('filter state management', () => {
    it('should preserve other filters when updating one filter', async () => {
      const mockResponse = createMockBatchListResponse();
      mockAdminApi.batches.list.mockResolvedValue(mockResponse);

      const { result } = renderHook(() =>
        useAdminBatches({
          status: 'COMPLETED',
          sortBy: 'totalUrls',
          page: 1,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Update just the page
      act(() => {
        result.current.setFilters({ ...result.current.filters, page: 2 });
      });

      // Verify other filters are preserved
      expect(result.current.filters.status).toBe('COMPLETED');
      expect(result.current.filters.sortBy).toBe('totalUrls');
      expect(result.current.filters.page).toBe(2);
    });

    it('should allow clearing filters', async () => {
      const mockResponse = createMockBatchListResponse();
      mockAdminApi.batches.list.mockResolvedValue(mockResponse);

      const { result } = renderHook(() =>
        useAdminBatches({ status: 'FAILED' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Get current call count before clearing filters
      const callsBefore = mockAdminApi.batches.list.mock.calls.length;

      // Clear status filter
      act(() => {
        const { status, ...rest } = result.current.filters;
        result.current.setFilters({ ...rest, status: undefined });
      });

      // Should have made at least one additional call after clearing filters
      await waitFor(() => {
        expect(mockAdminApi.batches.list.mock.calls.length).toBeGreaterThan(callsBefore);
      });

      expect(result.current.filters.status).toBeUndefined();
    });
  });
});
