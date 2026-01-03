/**
 * Tests for useAiScanStatus hook
 *
 * Tests polling behavior with exponential backoff, terminal state handling,
 * retry logic, and error scenarios for AI scan status polling.
 *
 * Requirements: REQ-2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAiScanStatus } from './useAiScanStatus';
import { api, type AiScanStatus } from '@/lib/api';

// Mock the api module
vi.mock('@/lib/api', () => ({
  api: {
    aiCampaign: {
      getAiStatus: vi.fn(),
    },
  },
}));

describe('useAiScanStatus', () => {
  const mockScanId = 'scan_test123';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const createMockAiStatus = (
    status: AiScanStatus['status'],
    overrides: Partial<AiScanStatus> = {}
  ): AiScanStatus => ({
    scanId: mockScanId,
    aiEnabled: true,
    status,
    summary: null,
    remediationPlan: null,
    processedAt: null,
    metrics: null,
    ...overrides,
  });

  describe('initial fetch', () => {
    it('should start in loading state', async () => {
      const mockStatus = createMockAiStatus('PENDING');
      vi.mocked(api.aiCampaign.getAiStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useAiScanStatus(mockScanId));

      expect(result.current.isLoading).toBe(true);
      expect(result.current.aiStatus).toBeNull();

      await act(async () => {
        await vi.runAllTimersAsync();
      });
    });

    it('should fetch and return AI status', async () => {
      const mockStatus = createMockAiStatus('PENDING');
      vi.mocked(api.aiCampaign.getAiStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useAiScanStatus(mockScanId));

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.aiStatus).toEqual(mockStatus);
      expect(result.current.error).toBeNull();
      expect(api.aiCampaign.getAiStatus).toHaveBeenCalledWith(mockScanId);
    });
  });

  describe('polling behavior', () => {
    it('should poll at initial interval for PENDING status', async () => {
      const mockStatus = createMockAiStatus('PENDING');
      vi.mocked(api.aiCampaign.getAiStatus).mockResolvedValue(mockStatus);

      renderHook(() => useAiScanStatus(mockScanId, { initialInterval: 1000 }));

      // Initial fetch
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(api.aiCampaign.getAiStatus).toHaveBeenCalledTimes(1);

      // Advance to next poll
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(api.aiCampaign.getAiStatus).toHaveBeenCalledTimes(2);
    });

    it('should poll for PROCESSING status', async () => {
      const mockStatus = createMockAiStatus('PROCESSING');
      vi.mocked(api.aiCampaign.getAiStatus).mockResolvedValue(mockStatus);

      renderHook(() => useAiScanStatus(mockScanId, { initialInterval: 1000 }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(api.aiCampaign.getAiStatus).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(api.aiCampaign.getAiStatus).toHaveBeenCalledTimes(2);
    });

    it('should apply exponential backoff', async () => {
      const mockStatus = createMockAiStatus('PENDING');
      vi.mocked(api.aiCampaign.getAiStatus).mockResolvedValue(mockStatus);

      renderHook(() =>
        useAiScanStatus(mockScanId, {
          initialInterval: 1000,
          backoffMultiplier: 2,
          maxInterval: 10000,
        })
      );

      // Initial fetch
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(api.aiCampaign.getAiStatus).toHaveBeenCalledTimes(1);

      // First poll at 1000ms (initial interval)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(api.aiCampaign.getAiStatus).toHaveBeenCalledTimes(2);

      // Next poll at 2000ms (1000 * 2)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(api.aiCampaign.getAiStatus).toHaveBeenCalledTimes(3);

      // Next poll at 4000ms (2000 * 2)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4000);
      });
      expect(api.aiCampaign.getAiStatus).toHaveBeenCalledTimes(4);
    });

    it('should not exceed max interval', async () => {
      const mockStatus = createMockAiStatus('PENDING');
      vi.mocked(api.aiCampaign.getAiStatus).mockResolvedValue(mockStatus);

      renderHook(() =>
        useAiScanStatus(mockScanId, {
          initialInterval: 5000,
          backoffMultiplier: 2,
          maxInterval: 8000,
        })
      );

      // Initial fetch
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(api.aiCampaign.getAiStatus).toHaveBeenCalledTimes(1);

      // First poll at 5000ms
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(api.aiCampaign.getAiStatus).toHaveBeenCalledTimes(2);

      // Next poll should be capped at 8000ms (not 10000ms)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(8000);
      });
      expect(api.aiCampaign.getAiStatus).toHaveBeenCalledTimes(3);
    });
  });

  describe('terminal state handling', () => {
    it('should stop polling when status is COMPLETED', async () => {
      const mockStatus = createMockAiStatus('COMPLETED', {
        summary: 'Analysis complete',
        processedAt: '2025-01-01T12:00:00Z',
      });
      vi.mocked(api.aiCampaign.getAiStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(() =>
        useAiScanStatus(mockScanId, { initialInterval: 1000 })
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(api.aiCampaign.getAiStatus).toHaveBeenCalledTimes(1);

      await waitFor(() => {
        expect(result.current.isPolling).toBe(false);
      });

      // Wait additional time - should not poll
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(api.aiCampaign.getAiStatus).toHaveBeenCalledTimes(1);
    });

    it('should stop polling when status is FAILED', async () => {
      const mockStatus = createMockAiStatus('FAILED');
      vi.mocked(api.aiCampaign.getAiStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(() =>
        useAiScanStatus(mockScanId, { initialInterval: 1000 })
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(api.aiCampaign.getAiStatus).toHaveBeenCalledTimes(1);

      await waitFor(() => {
        expect(result.current.isPolling).toBe(false);
      });

      // Wait additional time - should not poll
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(api.aiCampaign.getAiStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe('manual control', () => {
    it('should allow manual polling stop', async () => {
      const mockStatus = createMockAiStatus('PENDING');
      vi.mocked(api.aiCampaign.getAiStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(() =>
        useAiScanStatus(mockScanId, { initialInterval: 1000 })
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(result.current.isPolling).toBe(true);

      // Stop polling manually
      act(() => {
        result.current.stopPolling();
      });

      expect(result.current.isPolling).toBe(false);

      // Wait - should not poll again
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(api.aiCampaign.getAiStatus).toHaveBeenCalledTimes(1);
    });

    it('should allow manual refetch', async () => {
      const mockStatus = createMockAiStatus('PENDING');
      vi.mocked(api.aiCampaign.getAiStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(() =>
        useAiScanStatus(mockScanId, { initialInterval: 1000 })
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(api.aiCampaign.getAiStatus).toHaveBeenCalledTimes(1);

      // Manually refetch
      await act(async () => {
        await result.current.refetch();
      });

      expect(api.aiCampaign.getAiStatus).toHaveBeenCalledTimes(2);
    });

    it('should reset interval on manual refetch', async () => {
      const mockStatus = createMockAiStatus('PENDING');
      vi.mocked(api.aiCampaign.getAiStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(() =>
        useAiScanStatus(mockScanId, {
          initialInterval: 1000,
          backoffMultiplier: 2,
          maxInterval: 10000,
        })
      );

      // Initial fetch
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // Let backoff increase
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000); // 2nd fetch
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000); // 3rd fetch
      });

      expect(api.aiCampaign.getAiStatus).toHaveBeenCalledTimes(3);

      // Manual refetch resets interval
      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.isPolling).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle API errors', async () => {
      const error = new Error('Network error');
      vi.mocked(api.aiCampaign.getAiStatus).mockRejectedValue(error);

      const { result } = renderHook(() =>
        useAiScanStatus(mockScanId, { maxRetries: 0 })
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.isPolling).toBe(false);
    });

    it('should retry on error up to maxRetries', async () => {
      const error = new Error('Temporary error');
      vi.mocked(api.aiCampaign.getAiStatus).mockRejectedValue(error);

      const { result } = renderHook(() =>
        useAiScanStatus(mockScanId, {
          maxRetries: 3,
          retryDelay: 1000,
        })
      );

      // Initial fetch fails
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(api.aiCampaign.getAiStatus).toHaveBeenCalledTimes(1);

      // First retry
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(api.aiCampaign.getAiStatus).toHaveBeenCalledTimes(2);

      // Second retry
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(api.aiCampaign.getAiStatus).toHaveBeenCalledTimes(3);

      // Third retry
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(api.aiCampaign.getAiStatus).toHaveBeenCalledTimes(4);

      // Should stop after max retries
      await waitFor(() => {
        expect(result.current.isPolling).toBe(false);
      });
    });

    it('should show retry count in error message', async () => {
      const error = new Error('Network error');
      vi.mocked(api.aiCampaign.getAiStatus).mockRejectedValue(error);

      const { result } = renderHook(() =>
        useAiScanStatus(mockScanId, {
          maxRetries: 3,
          retryDelay: 1000,
        })
      );

      // Initial fetch fails
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // After first retry, error should show count
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(result.current.error).toContain('Retry');
    });

    it('should reset retry count on successful fetch', async () => {
      const mockStatus = createMockAiStatus('PENDING');

      // Fail first, then succeed
      vi.mocked(api.aiCampaign.getAiStatus)
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValue(mockStatus);

      const { result } = renderHook(() =>
        useAiScanStatus(mockScanId, {
          maxRetries: 3,
          retryDelay: 1000,
        })
      );

      // Initial fetch fails
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(result.current.error).toBeTruthy();

      // Retry succeeds
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });

      expect(result.current.aiStatus).toEqual(mockStatus);
    });
  });

  describe('scanId changes', () => {
    it('should reset state when scanId changes', async () => {
      const mockStatus1 = createMockAiStatus('COMPLETED', {
        scanId: 'scan_1',
        summary: 'First scan complete',
      });
      const mockStatus2 = createMockAiStatus('PENDING', {
        scanId: 'scan_2',
      });

      vi.mocked(api.aiCampaign.getAiStatus)
        .mockResolvedValueOnce(mockStatus1)
        .mockResolvedValueOnce(mockStatus2);

      const { result, rerender } = renderHook(
        ({ scanId }) => useAiScanStatus(scanId),
        { initialProps: { scanId: 'scan_1' } }
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await waitFor(() => {
        expect(result.current.aiStatus?.scanId).toBe('scan_1');
      });

      // Change scanId
      rerender({ scanId: 'scan_2' });

      // Should reset to loading state
      expect(result.current.isLoading).toBe(true);
      expect(result.current.aiStatus).toBeNull();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await waitFor(() => {
        expect(result.current.aiStatus?.scanId).toBe('scan_2');
      });
    });
  });

  describe('cleanup on unmount', () => {
    it('should stop polling on unmount', async () => {
      const mockStatus = createMockAiStatus('PENDING');
      vi.mocked(api.aiCampaign.getAiStatus).mockResolvedValue(mockStatus);

      const { unmount } = renderHook(() =>
        useAiScanStatus(mockScanId, { initialInterval: 1000 })
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(api.aiCampaign.getAiStatus).toHaveBeenCalledTimes(1);

      // Unmount
      unmount();

      // Wait - should not poll after unmount
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(api.aiCampaign.getAiStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe('return type', () => {
    it('should return all expected properties', async () => {
      const mockStatus = createMockAiStatus('PENDING');
      vi.mocked(api.aiCampaign.getAiStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useAiScanStatus(mockScanId));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // Verify all return properties exist
      expect(result.current).toHaveProperty('aiStatus');
      expect(result.current).toHaveProperty('aiData');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('isPolling');
      expect(result.current).toHaveProperty('stopPolling');
      expect(result.current).toHaveProperty('refetch');
      expect(typeof result.current.stopPolling).toBe('function');
      expect(typeof result.current.refetch).toBe('function');
    });
  });
});
