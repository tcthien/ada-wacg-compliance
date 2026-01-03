/**
 * Tests for useAdminBatchDetail hook
 *
 * Tests data fetching, actions (cancel, delete, retry, export),
 * and error handling.
 *
 * Requirements: 2.1, 3.1-3.6 (Batch detail view and admin actions)
 */

import React, { type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAdminBatchDetail } from './useAdminBatchDetail';
import * as adminApiModule from '@/lib/admin-api';

// Mock the admin-api module
vi.mock('@/lib/admin-api', () => ({
  adminApi: {
    batches: {
      get: vi.fn(),
      cancel: vi.fn(),
      delete: vi.fn(),
      retry: vi.fn(),
      export: vi.fn(),
    },
  },
}));

describe('useAdminBatchDetail', () => {
  const mockAdminApi = adminApiModule.adminApi as {
    batches: {
      get: ReturnType<typeof vi.fn>;
      cancel: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      retry: ReturnType<typeof vi.fn>;
      export: ReturnType<typeof vi.fn>;
    };
  };

  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const mockBatchId = 'batch-123';

  const createMockBatchDetail = (
    overrides?: Partial<adminApiModule.AdminBatchDetail>
  ): adminApiModule.AdminBatchDetail => ({
    batch: {
      id: mockBatchId,
      homepageUrl: 'https://example.com',
      wcagLevel: 'AA',
      status: 'COMPLETED',
      totalUrls: 10,
      completedCount: 8,
      failedCount: 2,
      totalIssues: 25,
      criticalCount: 5,
      seriousCount: 10,
      moderateCount: 7,
      minorCount: 3,
      createdAt: '2024-01-01T00:00:00Z',
      completedAt: '2024-01-01T01:00:00Z',
      cancelledAt: null,
      guestSessionId: 'session-1',
      userId: null,
    },
    scans: [
      {
        id: 'scan-1',
        url: 'https://example.com/page1',
        pageTitle: 'Page 1',
        status: 'COMPLETED',
        totalIssues: 10,
        criticalCount: 2,
        seriousCount: 4,
        moderateCount: 3,
        minorCount: 1,
        errorMessage: null,
        completedAt: '2024-01-01T00:30:00Z',
        createdAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'scan-2',
        url: 'https://example.com/page2',
        pageTitle: 'Page 2',
        status: 'FAILED',
        totalIssues: 0,
        criticalCount: 0,
        seriousCount: 0,
        moderateCount: 0,
        minorCount: 0,
        errorMessage: 'Timeout error',
        completedAt: null,
        createdAt: '2024-01-01T00:00:00Z',
      },
    ],
    aggregate: {
      totalIssues: 25,
      criticalCount: 5,
      seriousCount: 10,
      moderateCount: 7,
      minorCount: 3,
      passedChecks: 100,
    },
    topCriticalUrls: [
      {
        scanId: 'scan-1',
        url: 'https://example.com/page1',
        pageTitle: 'Page 1',
        criticalCount: 2,
      },
    ],
    sessionInfo: {
      id: 'session-1',
      fingerprint: 'abc123',
      createdAt: '2024-01-01T00:00:00Z',
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    queryClient.clear();
  });

  describe('data fetching', () => {
    it('should fetch batch details on mount', async () => {
      const mockDetail = createMockBatchDetail();
      mockAdminApi.batches.get.mockResolvedValue(mockDetail);

      const { result } = renderHook(() => useAdminBatchDetail(mockBatchId), {
        wrapper,
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockAdminApi.batches.get).toHaveBeenCalledWith(mockBatchId);
      expect(result.current.data).toEqual(mockDetail);
      expect(result.current.batch).toEqual(mockDetail.batch);
      expect(result.current.scans).toEqual(mockDetail.scans);
      expect(result.current.aggregate).toEqual(mockDetail.aggregate);
      expect(result.current.topCriticalUrls).toEqual(mockDetail.topCriticalUrls);
      expect(result.current.sessionInfo).toEqual(mockDetail.sessionInfo);
    });

    it('should not fetch if batchId is empty', async () => {
      const { result } = renderHook(() => useAdminBatchDetail(''), {
        wrapper,
      });

      // Give it time to potentially fetch
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockAdminApi.batches.get).not.toHaveBeenCalled();
      expect(result.current.data).toBeNull();
    });

    it('should return default values when no data', async () => {
      mockAdminApi.batches.get.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => useAdminBatchDetail(mockBatchId), {
        wrapper,
      });

      expect(result.current.data).toBeNull();
      expect(result.current.batch).toBeNull();
      expect(result.current.scans).toEqual([]);
      expect(result.current.aggregate).toBeNull();
      expect(result.current.topCriticalUrls).toEqual([]);
      expect(result.current.sessionInfo).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle API errors', async () => {
      const error = new Error('Batch not found');
      mockAdminApi.batches.get.mockRejectedValue(error);

      const { result } = renderHook(() => useAdminBatchDetail(mockBatchId), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Batch not found');
      expect(result.current.data).toBeNull();
    });
  });

  describe('cancel action', () => {
    it('should cancel batch successfully', async () => {
      const mockDetail = createMockBatchDetail({
        batch: {
          id: mockBatchId,
          homepageUrl: 'https://example.com',
          wcagLevel: 'AA',
          status: 'RUNNING',
          totalUrls: 10,
          completedCount: 3,
          failedCount: 0,
          totalIssues: 5,
          criticalCount: 1,
          seriousCount: 2,
          moderateCount: 1,
          minorCount: 1,
          createdAt: '2024-01-01T00:00:00Z',
          completedAt: null,
          cancelledAt: null,
          guestSessionId: null,
          userId: null,
        },
      });

      mockAdminApi.batches.get.mockResolvedValue(mockDetail);
      mockAdminApi.batches.cancel.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAdminBatchDetail(mockBatchId), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.batch?.status).toBe('RUNNING');
      });

      await act(async () => {
        await result.current.cancelBatch();
      });

      expect(mockAdminApi.batches.cancel).toHaveBeenCalledWith(mockBatchId);
    });

    it('should handle cancel error', async () => {
      const mockDetail = createMockBatchDetail({
        batch: {
          id: mockBatchId,
          homepageUrl: 'https://example.com',
          wcagLevel: 'AA',
          status: 'RUNNING',
          totalUrls: 10,
          completedCount: 3,
          failedCount: 0,
          totalIssues: 5,
          criticalCount: 1,
          seriousCount: 2,
          moderateCount: 1,
          minorCount: 1,
          createdAt: '2024-01-01T00:00:00Z',
          completedAt: null,
          cancelledAt: null,
          guestSessionId: null,
          userId: null,
        },
      });

      mockAdminApi.batches.get.mockResolvedValue(mockDetail);
      mockAdminApi.batches.cancel.mockRejectedValue(new Error('Cancel failed'));

      const { result } = renderHook(() => useAdminBatchDetail(mockBatchId), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let caughtError: Error | undefined;
      try {
        await act(async () => {
          await result.current.cancelBatch();
        });
      } catch (err) {
        caughtError = err as Error;
      }

      expect(caughtError?.message).toBe('Cancel failed');
    });

    it('should set isActionLoading during cancel', async () => {
      const mockDetail = createMockBatchDetail();
      mockAdminApi.batches.get.mockResolvedValue(mockDetail);

      let resolveCancel: () => void;
      mockAdminApi.batches.cancel.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveCancel = resolve;
          })
      );

      const { result } = renderHook(() => useAdminBatchDetail(mockBatchId), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isActionLoading).toBe(false);

      // Start cancel (don't await)
      let cancelPromise: Promise<void>;
      act(() => {
        cancelPromise = result.current.cancelBatch();
      });

      await waitFor(() => {
        expect(result.current.isActionLoading).toBe(true);
      });

      // Resolve cancel
      await act(async () => {
        resolveCancel!();
        await cancelPromise;
      });

      await waitFor(() => {
        expect(result.current.isActionLoading).toBe(false);
      });
    });
  });

  describe('delete action', () => {
    it('should delete batch successfully', async () => {
      const mockDetail = createMockBatchDetail();
      mockAdminApi.batches.get.mockResolvedValue(mockDetail);
      mockAdminApi.batches.delete.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAdminBatchDetail(mockBatchId), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.deleteBatch();
      });

      expect(mockAdminApi.batches.delete).toHaveBeenCalledWith(mockBatchId);
    });

    it('should handle delete error', async () => {
      const mockDetail = createMockBatchDetail();
      mockAdminApi.batches.get.mockResolvedValue(mockDetail);
      mockAdminApi.batches.delete.mockRejectedValue(
        new Error('Delete failed - insufficient permissions')
      );

      const { result } = renderHook(() => useAdminBatchDetail(mockBatchId), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let caughtError: Error | undefined;
      try {
        await act(async () => {
          await result.current.deleteBatch();
        });
      } catch (err) {
        caughtError = err as Error;
      }

      expect(caughtError?.message).toBe('Delete failed - insufficient permissions');
    });
  });

  describe('retry action', () => {
    it('should retry failed scans successfully', async () => {
      const mockDetail = createMockBatchDetail();
      mockAdminApi.batches.get.mockResolvedValue(mockDetail);
      mockAdminApi.batches.retry.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAdminBatchDetail(mockBatchId), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.retryFailed();
      });

      expect(mockAdminApi.batches.retry).toHaveBeenCalledWith(mockBatchId);
    });

    it('should handle retry error', async () => {
      const mockDetail = createMockBatchDetail();
      mockAdminApi.batches.get.mockResolvedValue(mockDetail);
      mockAdminApi.batches.retry.mockRejectedValue(new Error('Retry failed'));

      const { result } = renderHook(() => useAdminBatchDetail(mockBatchId), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let caughtError: Error | undefined;
      try {
        await act(async () => {
          await result.current.retryFailed();
        });
      } catch (err) {
        caughtError = err as Error;
      }

      expect(caughtError?.message).toBe('Retry failed');
    });
  });

  describe('export action', () => {
    it('should throw error for PDF export without calling API', async () => {
      const mockDetail = createMockBatchDetail();
      mockAdminApi.batches.get.mockResolvedValue(mockDetail);

      const { result } = renderHook(() => useAdminBatchDetail(mockBatchId), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let caughtError: Error | undefined;
      try {
        await act(async () => {
          await result.current.exportBatch('pdf');
        });
      } catch (err) {
        caughtError = err as Error;
      }

      expect(caughtError?.message).toContain('PDF export is not supported');
      expect(mockAdminApi.batches.export).not.toHaveBeenCalled();
    });

    it('should handle export error', async () => {
      const mockDetail = createMockBatchDetail();
      mockAdminApi.batches.get.mockResolvedValue(mockDetail);
      mockAdminApi.batches.export.mockRejectedValue(new Error('Export failed'));

      const { result } = renderHook(() => useAdminBatchDetail(mockBatchId), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let caughtError: Error | undefined;
      try {
        await act(async () => {
          await result.current.exportBatch('csv');
        });
      } catch (err) {
        caughtError = err as Error;
      }

      expect(caughtError?.message).toBe('Export failed');
    });
  });

  // Note: Auto-refresh behavior tests are skipped due to React Query's internal timers
  // not working well with vitest fake timers. The refetchInterval logic is tested
  // through integration tests with real timers in E2E tests.
});
