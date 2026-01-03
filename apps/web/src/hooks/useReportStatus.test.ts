/**
 * Unit tests for useReportStatus hook
 *
 * Tests:
 * - Fetch status on mount when enabled
 * - Loading, success, error states
 * - Refetch functionality
 * - Enabled flag behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useReportStatus } from './useReportStatus';
import * as apiModule from '@/lib/api';
import type { ReportStatusResponse, ReportInfo } from '@/lib/api';

describe('useReportStatus', () => {
  const mockScanId = 'scan-123';
  let mockedGetReportStatus: ReturnType<typeof vi.fn>;

  // Helper to create mock report info
  const createMockReportInfo = (format: 'pdf' | 'json'): ReportInfo => ({
    exists: true,
    url: `https://s3.example.com/reports/${mockScanId}.${format}`,
    createdAt: '2025-12-28T10:00:00Z',
    fileSizeBytes: format === 'pdf' ? 1024000 : 512000,
    expiresAt: '2025-12-29T10:00:00Z',
  });

  // Helper to create mock API response
  const createMockResponse = (
    pdf: ReportInfo | null = null,
    json: ReportInfo | null = null
  ): ReportStatusResponse => ({
    scanId: mockScanId,
    scanStatus: 'COMPLETED',
    reports: {
      pdf,
      json,
    },
  });

  beforeEach(() => {
    mockedGetReportStatus = vi.fn();
    vi.spyOn(apiModule.api.scans, 'getReportStatus').mockImplementation(
      mockedGetReportStatus
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial fetch', () => {
    it('should fetch status on mount when enabled', async () => {
      const mockResponse = createMockResponse(
        createMockReportInfo('pdf'),
        createMockReportInfo('json')
      );
      mockedGetReportStatus.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useReportStatus(mockScanId));

      // Should be loading initially
      expect(result.current.isLoading).toBe(true);
      expect(result.current.status).toBeNull();

      // Wait for the fetch to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.status).toEqual(mockResponse.reports);
      expect(result.current.error).toBeNull();
      expect(mockedGetReportStatus).toHaveBeenCalledWith(mockScanId);
      expect(mockedGetReportStatus).toHaveBeenCalledTimes(1);
    });

    it('should not fetch when enabled is false', async () => {
      const mockResponse = createMockResponse();
      mockedGetReportStatus.mockResolvedValue(mockResponse);

      const { result } = renderHook(() =>
        useReportStatus(mockScanId, { enabled: false })
      );

      // Should not be loading
      expect(result.current.isLoading).toBe(false);
      expect(result.current.status).toBeNull();

      // Should not have called the API
      expect(mockedGetReportStatus).not.toHaveBeenCalled();
    });

    it('should not fetch when scanId is empty', async () => {
      const mockResponse = createMockResponse();
      mockedGetReportStatus.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useReportStatus(''));

      // Should not be loading
      expect(result.current.isLoading).toBe(false);
      expect(result.current.status).toBeNull();

      // Should not have called the API
      expect(mockedGetReportStatus).not.toHaveBeenCalled();
    });
  });

  describe('Loading state', () => {
    it('should show loading state while fetching', async () => {
      const mockResponse = createMockResponse(createMockReportInfo('pdf'));
      mockedGetReportStatus.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(mockResponse), 100);
          })
      );

      const { result } = renderHook(() => useReportStatus(mockScanId));

      // Should be loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.status).toBeNull();
      expect(result.current.error).toBeNull();

      // Wait for completion
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.status).toBeTruthy();
    });

    it('should reset loading state after success', async () => {
      const mockResponse = createMockResponse(createMockReportInfo('pdf'));
      mockedGetReportStatus.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useReportStatus(mockScanId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.status).toEqual(mockResponse.reports);
    });

    it('should reset loading state after error', async () => {
      mockedGetReportStatus.mockRejectedValue(
        new Error('Network connection failed')
      );

      const { result } = renderHook(() => useReportStatus(mockScanId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('Network connection failed');
    });
  });

  describe('Success state', () => {
    it('should handle response with both reports', async () => {
      const mockResponse = createMockResponse(
        createMockReportInfo('pdf'),
        createMockReportInfo('json')
      );
      mockedGetReportStatus.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useReportStatus(mockScanId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.status).toEqual({
        pdf: expect.objectContaining({
          exists: true,
          url: expect.stringContaining('.pdf'),
        }),
        json: expect.objectContaining({
          exists: true,
          url: expect.stringContaining('.json'),
        }),
      });
      expect(result.current.error).toBeNull();
    });

    it('should handle response with only PDF report', async () => {
      const mockResponse = createMockResponse(
        createMockReportInfo('pdf'),
        null
      );
      mockedGetReportStatus.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useReportStatus(mockScanId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.status?.pdf).toBeTruthy();
      expect(result.current.status?.json).toBeNull();
    });

    it('should handle response with only JSON report', async () => {
      const mockResponse = createMockResponse(
        null,
        createMockReportInfo('json')
      );
      mockedGetReportStatus.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useReportStatus(mockScanId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.status?.pdf).toBeNull();
      expect(result.current.status?.json).toBeTruthy();
    });

    it('should handle response with no reports', async () => {
      const mockResponse = createMockResponse(null, null);
      mockedGetReportStatus.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useReportStatus(mockScanId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.status?.pdf).toBeNull();
      expect(result.current.status?.json).toBeNull();
    });
  });

  describe('Error state', () => {
    it('should handle API errors with Error object', async () => {
      const errorMessage = 'Network connection failed';
      mockedGetReportStatus.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useReportStatus(mockScanId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.status).toBeNull();
      expect(result.current.error).toBe(errorMessage);
    });

    it('should handle non-Error rejections', async () => {
      mockedGetReportStatus.mockRejectedValue('String error');

      const { result } = renderHook(() => useReportStatus(mockScanId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to fetch report status');
    });

    it('should handle 404 errors gracefully', async () => {
      mockedGetReportStatus.mockRejectedValue(new Error('API error: 404'));

      const { result } = renderHook(() => useReportStatus(mockScanId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('API error: 404');
      expect(result.current.status).toBeNull();
    });

    it('should preserve previous status on error', async () => {
      const mockResponse = createMockResponse(createMockReportInfo('pdf'));
      mockedGetReportStatus
        .mockResolvedValueOnce(mockResponse)
        .mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useReportStatus(mockScanId));

      // Wait for initial successful fetch
      await waitFor(() => {
        expect(result.current.status).toBeTruthy();
      });

      const previousStatus = result.current.status;

      // Trigger refetch which will fail
      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });

      // Status should be preserved (not cleared on error)
      expect(result.current.status).toEqual(previousStatus);
    });
  });

  describe('Refetch functionality', () => {
    it('should refetch when refetch is called', async () => {
      const mockResponse1 = createMockResponse(createMockReportInfo('pdf'));
      const mockResponse2 = createMockResponse(
        createMockReportInfo('pdf'),
        createMockReportInfo('json')
      );

      mockedGetReportStatus
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const { result } = renderHook(() => useReportStatus(mockScanId));

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.status?.pdf).toBeTruthy();
      expect(result.current.status?.json).toBeNull();
      expect(mockedGetReportStatus).toHaveBeenCalledTimes(1);

      // Manually refetch
      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.status?.json).toBeTruthy();
      });

      expect(result.current.status?.pdf).toBeTruthy();
      expect(mockedGetReportStatus).toHaveBeenCalledTimes(2);
    });

    it('should set loading state during refetch', async () => {
      const mockResponse = createMockResponse(createMockReportInfo('pdf'));
      let resolveFirst: (value: any) => void;
      const firstPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });

      mockedGetReportStatus
        .mockImplementationOnce(() => firstPromise)
        .mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useReportStatus(mockScanId));

      // Resolve first call
      resolveFirst!(mockResponse);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Start refetch - don't await immediately
      result.current.refetch();

      // Check loading state is set
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      // Wait for completion
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should clear previous error on refetch', async () => {
      const mockResponse = createMockResponse(createMockReportInfo('pdf'));
      mockedGetReportStatus
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useReportStatus(mockScanId));

      // Wait for initial error
      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });

      // Refetch successfully
      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });

      expect(result.current.status).toBeTruthy();
    });
  });

  describe('Enabled flag behavior', () => {
    it('should respect enabled flag changing from false to true', async () => {
      const mockResponse = createMockResponse(createMockReportInfo('pdf'));
      mockedGetReportStatus.mockResolvedValue(mockResponse);

      const { result, rerender } = renderHook(
        ({ enabled }) => useReportStatus(mockScanId, { enabled }),
        { initialProps: { enabled: false } }
      );

      // Should not fetch initially
      expect(mockedGetReportStatus).not.toHaveBeenCalled();

      // Enable fetching
      rerender({ enabled: true });

      await waitFor(() => {
        expect(mockedGetReportStatus).toHaveBeenCalledTimes(1);
      });

      expect(result.current.status).toBeTruthy();
    });

    it('should not refetch when enabled changes from true to false', async () => {
      const mockResponse = createMockResponse(createMockReportInfo('pdf'));
      mockedGetReportStatus.mockResolvedValue(mockResponse);

      const { rerender } = renderHook(
        ({ enabled }) => useReportStatus(mockScanId, { enabled }),
        { initialProps: { enabled: true } }
      );

      await waitFor(() => {
        expect(mockedGetReportStatus).toHaveBeenCalledTimes(1);
      });

      // Disable fetching
      rerender({ enabled: false });

      // Should not trigger another fetch
      expect(mockedGetReportStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cleanup and lifecycle', () => {
    it('should fetch new data when scanId changes', async () => {
      const mockResponse1 = createMockResponse(createMockReportInfo('pdf'), null);
      const mockResponse2 = createMockResponse(null, createMockReportInfo('json'));

      mockedGetReportStatus
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const { result, rerender } = renderHook(
        ({ scanId }) => useReportStatus(scanId),
        { initialProps: { scanId: 'scan-1' } }
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.status?.pdf).toBeTruthy();
        expect(result.current.status?.json).toBeNull();
      });

      // Change scanId
      rerender({ scanId: 'scan-2' });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have new status - both calls should have been made
      expect(mockedGetReportStatus).toHaveBeenCalledTimes(2);
      expect(mockedGetReportStatus).toHaveBeenLastCalledWith('scan-2');

      // New data should be loaded
      await waitFor(() => {
        expect(result.current.status?.json).toBeTruthy();
      });
    });

    it('should handle rapid scanId changes', async () => {
      const mockResponse = createMockResponse(createMockReportInfo('pdf'));
      mockedGetReportStatus.mockResolvedValue(mockResponse);

      const { rerender } = renderHook(
        ({ scanId }) => useReportStatus(scanId),
        { initialProps: { scanId: 'scan-1' } }
      );

      // Rapidly change scanId
      rerender({ scanId: 'scan-2' });
      rerender({ scanId: 'scan-3' });
      rerender({ scanId: 'scan-4' });

      await waitFor(() => {
        expect(mockedGetReportStatus).toHaveBeenCalled();
      });

      // Should have called with the final scanId
      expect(mockedGetReportStatus).toHaveBeenLastCalledWith('scan-4');
    });
  });
});
