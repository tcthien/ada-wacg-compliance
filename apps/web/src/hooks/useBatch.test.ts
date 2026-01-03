/**
 * Tests for useBatch hook
 *
 * Tests polling behavior, terminal state handling, cancel function,
 * and error scenarios for batch scan status polling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useBatch } from './useBatch';
import * as batchApi from '@/lib/batch-api';

// Mock the batch-api module
vi.mock('@/lib/batch-api', () => ({
  batchApi: {
    getStatus: vi.fn(),
    cancel: vi.fn(),
  },
}));

describe('useBatch', () => {
  const mockBatchId = 'batch_test123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMockBatchResponse = (
    status: batchApi.BatchStatus,
    overrides = {}
  ): batchApi.BatchStatusResponse => ({
    id: mockBatchId,
    status,
    homepageUrl: 'https://example.com',
    wcagLevel: 'AA',
    totalUrls: 10,
    completedCount: 5,
    failedCount: 0,
    progress: 50,
    scans: [],
    createdAt: '2024-01-01T00:00:00Z',
    completedAt: null,
    cancelledAt: null,
    ...overrides,
  });

  describe('initial fetch and polling', () => {
    it('should start polling on mount', async () => {
      const mockResponse = createMockBatchResponse('RUNNING');
      vi.mocked(batchApi.batchApi.getStatus).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useBatch(mockBatchId));

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(batchApi.batchApi.getStatus).toHaveBeenCalledWith(mockBatchId);
      expect(result.current.batch).toEqual({
        id: mockResponse.id,
        status: mockResponse.status,
        homepageUrl: mockResponse.homepageUrl,
        wcagLevel: mockResponse.wcagLevel,
        totalUrls: mockResponse.totalUrls,
        completedCount: mockResponse.completedCount,
        failedCount: mockResponse.failedCount,
        progress: mockResponse.progress,
        scans: mockResponse.scans,
        createdAt: mockResponse.createdAt,
        completedAt: mockResponse.completedAt,
        cancelledAt: mockResponse.cancelledAt,
      });
      expect(result.current.error).toBe(null);
    });

    it('should poll at specified interval', async () => {
      const mockResponse = createMockBatchResponse('RUNNING');
      vi.mocked(batchApi.batchApi.getStatus).mockResolvedValue(mockResponse);

      const pollInterval = 1000;
      renderHook(() => useBatch(mockBatchId, { pollInterval }));

      // Wait for initial fetch
      await waitFor(() => {
        expect(batchApi.batchApi.getStatus).toHaveBeenCalledTimes(1);
      });

      // Wait for next poll
      await waitFor(
        () => {
          expect(batchApi.batchApi.getStatus).toHaveBeenCalledTimes(2);
        },
        { timeout: 2000 }
      );

      // Wait for one more poll
      await waitFor(
        () => {
          expect(batchApi.batchApi.getStatus).toHaveBeenCalledTimes(3);
        },
        { timeout: 2000 }
      );
    });

    it('should use default poll interval of 2000ms', async () => {
      const mockResponse = createMockBatchResponse('RUNNING');
      vi.mocked(batchApi.batchApi.getStatus).mockResolvedValue(mockResponse);

      renderHook(() => useBatch(mockBatchId));

      // Initial fetch
      await waitFor(() => {
        expect(batchApi.batchApi.getStatus).toHaveBeenCalledTimes(1);
      });

      // Wait for next poll (should happen at ~2000ms)
      await waitFor(
        () => {
          expect(batchApi.batchApi.getStatus).toHaveBeenCalledTimes(2);
        },
        { timeout: 3000 }
      );
    });
  });

  describe('terminal state handling', () => {
    it('should stop polling when status is COMPLETED', async () => {
      const mockResponse = createMockBatchResponse('COMPLETED', {
        completedCount: 10,
        progress: 100,
        completedAt: '2024-01-01T01:00:00Z',
      });
      vi.mocked(batchApi.batchApi.getStatus).mockResolvedValue(mockResponse);

      renderHook(() => useBatch(mockBatchId, { pollInterval: 1000 }));

      // Wait for initial fetch
      await waitFor(() => {
        expect(batchApi.batchApi.getStatus).toHaveBeenCalledTimes(1);
      });

      // Wait 2 seconds - should NOT poll again
      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(batchApi.batchApi.getStatus).toHaveBeenCalledTimes(1);
    });

    it('should stop polling when status is FAILED', async () => {
      const mockResponse = createMockBatchResponse('FAILED');
      vi.mocked(batchApi.batchApi.getStatus).mockResolvedValue(mockResponse);

      renderHook(() => useBatch(mockBatchId, { pollInterval: 1000 }));

      await waitFor(() => {
        expect(batchApi.batchApi.getStatus).toHaveBeenCalledTimes(1);
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(batchApi.batchApi.getStatus).toHaveBeenCalledTimes(1);
    });

    it('should stop polling when status is CANCELLED', async () => {
      const mockResponse = createMockBatchResponse('CANCELLED', {
        cancelledAt: '2024-01-01T00:30:00Z',
      });
      vi.mocked(batchApi.batchApi.getStatus).mockResolvedValue(mockResponse);

      renderHook(() => useBatch(mockBatchId, { pollInterval: 1000 }));

      await waitFor(() => {
        expect(batchApi.batchApi.getStatus).toHaveBeenCalledTimes(1);
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(batchApi.batchApi.getStatus).toHaveBeenCalledTimes(1);
    });

    it('should stop polling when status is STALE', async () => {
      const mockResponse = createMockBatchResponse('STALE');
      vi.mocked(batchApi.batchApi.getStatus).mockResolvedValue(mockResponse);

      renderHook(() => useBatch(mockBatchId, { pollInterval: 1000 }));

      await waitFor(() => {
        expect(batchApi.batchApi.getStatus).toHaveBeenCalledTimes(1);
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(batchApi.batchApi.getStatus).toHaveBeenCalledTimes(1);
    });

    it('should continue polling for PENDING status', async () => {
      const mockResponse = createMockBatchResponse('PENDING', {
        completedCount: 0,
        progress: 0,
      });
      vi.mocked(batchApi.batchApi.getStatus).mockResolvedValue(mockResponse);

      renderHook(() => useBatch(mockBatchId, { pollInterval: 1000 }));

      await waitFor(() => {
        expect(batchApi.batchApi.getStatus).toHaveBeenCalledTimes(1);
      });

      await waitFor(
        () => {
          expect(batchApi.batchApi.getStatus).toHaveBeenCalledTimes(2);
        },
        { timeout: 2000 }
      );
    });

    it('should continue polling for RUNNING status', async () => {
      const mockResponse = createMockBatchResponse('RUNNING');
      vi.mocked(batchApi.batchApi.getStatus).mockResolvedValue(mockResponse);

      renderHook(() => useBatch(mockBatchId, { pollInterval: 1000 }));

      await waitFor(() => {
        expect(batchApi.batchApi.getStatus).toHaveBeenCalledTimes(1);
      });

      await waitFor(
        () => {
          expect(batchApi.batchApi.getStatus).toHaveBeenCalledTimes(2);
        },
        { timeout: 2000 }
      );
    });
  });

  describe('cancel function', () => {
    it('should call batchApi.cancel with correct batchId', async () => {
      const mockRunningResponse = createMockBatchResponse('RUNNING');
      const mockCancelledResponse = createMockBatchResponse('CANCELLED', {
        cancelledAt: '2024-01-01T00:30:00Z',
      });

      vi.mocked(batchApi.batchApi.getStatus)
        .mockResolvedValueOnce(mockRunningResponse)
        .mockResolvedValueOnce(mockCancelledResponse);
      vi.mocked(batchApi.batchApi.cancel).mockResolvedValue(undefined);

      const { result } = renderHook(() => useBatch(mockBatchId));

      await waitFor(() => {
        expect(result.current.batch).not.toBeNull();
      });

      // Call cancel
      await act(async () => {
        await result.current.cancel();
      });

      expect(batchApi.batchApi.cancel).toHaveBeenCalledWith(mockBatchId);
      expect(batchApi.batchApi.cancel).toHaveBeenCalledTimes(1);
    });

    it('should fetch updated status after cancellation', async () => {
      const mockRunningResponse = createMockBatchResponse('RUNNING');
      const mockCancelledResponse = createMockBatchResponse('CANCELLED', {
        cancelledAt: '2024-01-01T00:30:00Z',
      });

      vi.mocked(batchApi.batchApi.getStatus)
        .mockResolvedValueOnce(mockRunningResponse)
        .mockResolvedValueOnce(mockCancelledResponse);
      vi.mocked(batchApi.batchApi.cancel).mockResolvedValue(undefined);

      const { result } = renderHook(() => useBatch(mockBatchId));

      await waitFor(() => {
        expect(result.current.batch?.status).toBe('RUNNING');
      });

      const initialCallCount = vi.mocked(batchApi.batchApi.getStatus).mock
        .calls.length;

      await act(async () => {
        await result.current.cancel();
      });

      await waitFor(() => {
        expect(result.current.batch?.status).toBe('CANCELLED');
      });

      expect(batchApi.batchApi.getStatus).toHaveBeenCalledTimes(
        initialCallCount + 1
      );
    });

    it('should re-throw error when cancel fails', async () => {
      const mockResponse = createMockBatchResponse('RUNNING');
      const cancelError = new Error('Cancel failed');

      vi.mocked(batchApi.batchApi.getStatus).mockResolvedValue(mockResponse);
      vi.mocked(batchApi.batchApi.cancel).mockRejectedValue(cancelError);

      const { result } = renderHook(() => useBatch(mockBatchId));

      await waitFor(() => {
        expect(result.current.batch).not.toBeNull();
      });

      // Try to cancel and expect it to fail
      let caughtError;
      try {
        await act(async () => {
          await result.current.cancel();
        });
      } catch (err) {
        caughtError = err;
      }

      // Verify the error was thrown so UI can handle it
      expect(caughtError).toBeDefined();
      expect((caughtError as Error).message).toBe('Cancel failed');
    });
  });

  describe('error handling', () => {
    it('should handle API errors during fetch', async () => {
      const error = new Error('Network error');
      vi.mocked(batchApi.batchApi.getStatus).mockRejectedValue(error);

      const { result } = renderHook(() => useBatch(mockBatchId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.batch).toBe(null);
    });

    it('should handle non-Error exceptions', async () => {
      vi.mocked(batchApi.batchApi.getStatus).mockRejectedValue(
        'String error'
      );

      const { result } = renderHook(() => useBatch(mockBatchId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to fetch batch status');
    });

    it('should clear error on successful fetch', async () => {
      const error = new Error('Network error');
      const mockResponse = createMockBatchResponse('RUNNING');

      vi.mocked(batchApi.batchApi.getStatus)
        .mockRejectedValueOnce(error)
        .mockResolvedValue(mockResponse);

      const { result } = renderHook(() =>
        useBatch(mockBatchId, { pollInterval: 1000 })
      );

      // Wait for error state
      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });

      // Wait for successful fetch from next poll
      await waitFor(
        () => {
          expect(result.current.error).toBe(null);
        },
        { timeout: 2000 }
      );

      expect(result.current.batch).not.toBeNull();
    });

    it('should continue polling even after errors', async () => {
      const error = new Error('Temporary error');
      const mockResponse = createMockBatchResponse('RUNNING');

      vi.mocked(batchApi.batchApi.getStatus)
        .mockRejectedValueOnce(error)
        .mockResolvedValue(mockResponse);

      renderHook(() => useBatch(mockBatchId, { pollInterval: 1000 }));

      // Wait for initial error
      await waitFor(() => {
        expect(batchApi.batchApi.getStatus).toHaveBeenCalledTimes(1);
      });

      // Wait for next poll
      await waitFor(
        () => {
          expect(batchApi.batchApi.getStatus).toHaveBeenCalledTimes(2);
        },
        { timeout: 2000 }
      );
    });
  });

  describe('cleanup on unmount', () => {
    it('should stop polling on unmount', async () => {
      const mockResponse = createMockBatchResponse('RUNNING');
      vi.mocked(batchApi.batchApi.getStatus).mockResolvedValue(mockResponse);

      const { unmount } = renderHook(() =>
        useBatch(mockBatchId, { pollInterval: 1000 })
      );

      await waitFor(() => {
        expect(batchApi.batchApi.getStatus).toHaveBeenCalledTimes(1);
      });

      const callCountBeforeUnmount = vi.mocked(batchApi.batchApi.getStatus)
        .mock.calls.length;

      // Unmount the hook
      unmount();

      // Wait 2 seconds - should NOT poll
      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(batchApi.batchApi.getStatus).toHaveBeenCalledTimes(
        callCountBeforeUnmount
      );
    });
  });

  describe('refetch function', () => {
    it('should allow manual refetch', async () => {
      const mockResponse = createMockBatchResponse('RUNNING');
      vi.mocked(batchApi.batchApi.getStatus).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useBatch(mockBatchId));

      await waitFor(() => {
        expect(batchApi.batchApi.getStatus).toHaveBeenCalledTimes(1);
      });

      const initialCallCount = vi.mocked(batchApi.batchApi.getStatus).mock
        .calls.length;

      // Manually trigger refetch
      await act(async () => {
        await result.current.refetch();
      });

      expect(batchApi.batchApi.getStatus).toHaveBeenCalledTimes(
        initialCallCount + 1
      );
    });

    it('should update state on manual refetch', async () => {
      const mockRunningResponse = createMockBatchResponse('RUNNING', {
        progress: 30,
      });
      const mockUpdatedResponse = createMockBatchResponse('RUNNING', {
        progress: 60,
      });

      vi.mocked(batchApi.batchApi.getStatus)
        .mockResolvedValueOnce(mockRunningResponse)
        .mockResolvedValueOnce(mockUpdatedResponse);

      const { result } = renderHook(() => useBatch(mockBatchId));

      await waitFor(() => {
        expect(result.current.batch?.progress).toBe(30);
      });

      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.batch?.progress).toBe(60);
      });
    });
  });

  describe('loading state', () => {
    it('should set loading to false after initial fetch completes', async () => {
      const mockResponse = createMockBatchResponse('RUNNING');
      vi.mocked(batchApi.batchApi.getStatus).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useBatch(mockBatchId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should set loading to false after fetch error', async () => {
      const error = new Error('Network error');
      vi.mocked(batchApi.batchApi.getStatus).mockRejectedValue(error);

      const { result } = renderHook(() => useBatch(mockBatchId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('status transitions', () => {
    it('should handle transition from RUNNING to COMPLETED', async () => {
      const mockRunningResponse = createMockBatchResponse('RUNNING', {
        progress: 50,
        completedCount: 5,
      });
      const mockCompletedResponse = createMockBatchResponse('COMPLETED', {
        progress: 100,
        completedCount: 10,
        completedAt: '2024-01-01T01:00:00Z',
      });

      vi.mocked(batchApi.batchApi.getStatus)
        .mockResolvedValueOnce(mockRunningResponse)
        .mockResolvedValueOnce(mockCompletedResponse);

      const { result } = renderHook(() =>
        useBatch(mockBatchId, { pollInterval: 1000 })
      );

      // Wait for initial RUNNING state
      await waitFor(() => {
        expect(result.current.batch?.status).toBe('RUNNING');
        expect(result.current.batch?.progress).toBe(50);
      });

      // Wait for COMPLETED state from next poll
      await waitFor(
        () => {
          expect(result.current.batch?.status).toBe('COMPLETED');
        },
        { timeout: 2000 }
      );

      expect(result.current.batch?.progress).toBe(100);
      expect(result.current.batch?.completedAt).toBe(
        '2024-01-01T01:00:00Z'
      );

      // Verify polling stopped - wait and check no more calls
      const callCount = vi.mocked(batchApi.batchApi.getStatus).mock.calls
        .length;
      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(batchApi.batchApi.getStatus).toHaveBeenCalledTimes(callCount);
    });
  });
});
