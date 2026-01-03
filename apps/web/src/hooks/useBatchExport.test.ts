/**
 * Unit tests for useBatchExport hook
 *
 * Tests:
 * - State management (idle, generating, completed, error)
 * - canExport derived from batch status
 * - Export batch functionality
 * - Reset and cancel operations
 * - Success confirmation with auto-dismiss
 *
 * @requirements 3.1, 4.1, 4.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBatchExport } from './useBatchExport';
import * as batchApiModule from '@/lib/batch-api';
import type { BatchExportResponse } from '@/lib/batch-api';

// Mock fetch globally
global.fetch = vi.fn();

describe('useBatchExport', () => {
  const mockBatchId = 'batch-123';
  let mockedRequestExport: ReturnType<typeof vi.fn>;
  let mockedGetStatus: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequestExport = vi.fn();
    mockedGetStatus = vi.fn();
    vi.spyOn(batchApiModule, 'requestBatchExport').mockImplementation(mockedRequestExport);
    vi.spyOn(batchApiModule, 'getBatchExportStatus').mockImplementation(mockedGetStatus);

    // Mock successful fetch for download
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['mock content'], { type: 'application/pdf' }),
    });

    // Mock DOM methods - use spyOn to preserve jsdom functionality
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const anchor = originalCreateElement('a');
        anchor.click = vi.fn();
        return anchor;
      }
      return originalCreateElement(tag);
    });

    vi.spyOn(document.body, 'appendChild').mockImplementation(() => document.body);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => document.body);
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Initial state', () => {
    it('should initialize with idle state', () => {
      const { result } = renderHook(() => useBatchExport('COMPLETED'));

      expect(result.current.state).toEqual({
        status: 'idle',
        format: null,
        error: null,
        reportId: null,
      });
      expect(result.current.isExporting).toBe(false);
      expect(result.current.showSuccessConfirmation).toBe(false);
    });

    it('should derive canExport from batch status', () => {
      const { result: completedResult } = renderHook(() => useBatchExport('COMPLETED'));
      expect(completedResult.current.canExport).toBe(true);

      const { result: runningResult } = renderHook(() => useBatchExport('RUNNING'));
      expect(runningResult.current.canExport).toBe(false);

      const { result: pendingResult } = renderHook(() => useBatchExport('PENDING'));
      expect(pendingResult.current.canExport).toBe(false);

      const { result: failedResult } = renderHook(() => useBatchExport('FAILED'));
      expect(failedResult.current.canExport).toBe(false);
    });
  });

  describe('Export batch - Ready response', () => {
    it('should handle ready PDF report', async () => {
      const mockResponse: BatchExportResponse = {
        status: 'ready',
        url: 'https://s3.example.com/batch-report.pdf',
        expiresAt: '2025-12-29T10:00:00Z',
        reportId: 'report_123',
      };
      mockedRequestExport.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useBatchExport('COMPLETED'));

      await act(async () => {
        await result.current.exportBatch(mockBatchId, 'pdf');
      });

      expect(result.current.state.status).toBe('completed');
      expect(result.current.state.format).toBe('pdf');
      expect(result.current.state.reportId).toBe('report_123');
      expect(result.current.state.error).toBeNull();
      expect(mockedRequestExport).toHaveBeenCalledWith(mockBatchId, 'pdf');
    });

    it('should handle ready JSON report', async () => {
      const mockResponse: BatchExportResponse = {
        status: 'ready',
        url: 'https://s3.example.com/batch-report.json',
        expiresAt: '2025-12-29T10:00:00Z',
        reportId: 'report_456',
      };
      mockedRequestExport.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useBatchExport('COMPLETED'));

      await act(async () => {
        await result.current.exportBatch(mockBatchId, 'json');
      });

      expect(result.current.state.format).toBe('json');
      expect(mockedRequestExport).toHaveBeenCalledWith(mockBatchId, 'json');
    });

    it('should trigger download when report is ready', async () => {
      const mockResponse: BatchExportResponse = {
        status: 'ready',
        url: 'https://s3.example.com/batch-report.pdf',
        expiresAt: '2025-12-29T10:00:00Z',
        reportId: 'report_123',
      };
      mockedRequestExport.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useBatchExport('COMPLETED'));

      await act(async () => {
        await result.current.exportBatch(mockBatchId, 'pdf');
      });

      expect(global.fetch).toHaveBeenCalledWith(mockResponse.url);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  describe('State transitions', () => {
    it('should be in generating state when export starts', async () => {
      let generatingStateObserved = false;
      const mockResponse: BatchExportResponse = {
        status: 'ready',
        url: 'https://s3.example.com/batch-report.pdf',
        expiresAt: '2025-12-29T10:00:00Z',
        reportId: 'report_123',
      };
      mockedRequestExport.mockImplementation(async () => {
        // Simulate a delay to observe the generating state
        await new Promise((resolve) => setTimeout(resolve, 10));
        return mockResponse;
      });

      const { result } = renderHook(() => useBatchExport('COMPLETED'));

      expect(result.current.state.status).toBe('idle');

      // Start export but don't await
      act(() => {
        result.current.exportBatch(mockBatchId, 'pdf');
      });

      // Should be in generating state immediately
      expect(result.current.state.status).toBe('generating');
      expect(result.current.state.format).toBe('pdf');
      generatingStateObserved = true;

      // Complete the export
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      expect(generatingStateObserved).toBe(true);
    });

    it('should transition to completed after successful export', async () => {
      const mockResponse: BatchExportResponse = {
        status: 'ready',
        url: 'https://s3.example.com/batch-report.pdf',
        expiresAt: '2025-12-29T10:00:00Z',
        reportId: 'report_123',
      };
      mockedRequestExport.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useBatchExport('COMPLETED'));

      await act(async () => {
        await result.current.exportBatch(mockBatchId, 'pdf');
      });

      expect(result.current.state.status).toBe('completed');
      expect(result.current.state.format).toBe('pdf');
      expect(result.current.state.error).toBeNull();
    });

    it('should transition to error on API failure', async () => {
      mockedRequestExport.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useBatchExport('COMPLETED'));

      await act(async () => {
        await result.current.exportBatch(mockBatchId, 'pdf');
      });

      expect(result.current.state.status).toBe('error');
      expect(result.current.state.format).toBe('pdf');
      expect(result.current.state.error).toBe('Network error');
    });
  });

  describe('Success confirmation', () => {
    it('should show success confirmation after completed export', async () => {
      const mockResponse: BatchExportResponse = {
        status: 'ready',
        url: 'https://s3.example.com/batch-report.pdf',
        expiresAt: '2025-12-29T10:00:00Z',
        reportId: 'report_123',
      };
      mockedRequestExport.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useBatchExport('COMPLETED'));

      await act(async () => {
        await result.current.exportBatch(mockBatchId, 'pdf');
      });

      expect(result.current.showSuccessConfirmation).toBe(true);
    });

    it('should auto-dismiss success confirmation after 2 seconds', async () => {
      const mockResponse: BatchExportResponse = {
        status: 'ready',
        url: 'https://s3.example.com/batch-report.pdf',
        expiresAt: '2025-12-29T10:00:00Z',
        reportId: 'report_123',
      };
      mockedRequestExport.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useBatchExport('COMPLETED'));

      await act(async () => {
        await result.current.exportBatch(mockBatchId, 'pdf');
      });

      expect(result.current.showSuccessConfirmation).toBe(true);

      // Fast-forward 2 seconds
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(result.current.showSuccessConfirmation).toBe(false);
      expect(result.current.state.status).toBe('idle');
    });

    it('should allow manual dismiss of success confirmation', async () => {
      const mockResponse: BatchExportResponse = {
        status: 'ready',
        url: 'https://s3.example.com/batch-report.pdf',
        expiresAt: '2025-12-29T10:00:00Z',
        reportId: 'report_123',
      };
      mockedRequestExport.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useBatchExport('COMPLETED'));

      await act(async () => {
        await result.current.exportBatch(mockBatchId, 'pdf');
      });

      expect(result.current.showSuccessConfirmation).toBe(true);

      act(() => {
        result.current.dismissSuccess();
      });

      expect(result.current.showSuccessConfirmation).toBe(false);
      expect(result.current.state.status).toBe('idle');
    });
  });

  describe('Reset functionality', () => {
    it('should reset state to idle when reset is called', async () => {
      const mockResponse: BatchExportResponse = {
        status: 'ready',
        url: 'https://s3.example.com/batch-report.pdf',
        expiresAt: '2025-12-29T10:00:00Z',
        reportId: 'report_123',
      };
      mockedRequestExport.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useBatchExport('COMPLETED'));

      // Complete an export
      await act(async () => {
        await result.current.exportBatch(mockBatchId, 'pdf');
      });

      expect(result.current.state.status).toBe('completed');
      expect(result.current.state.format).toBe('pdf');

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.state).toEqual({
        status: 'idle',
        format: null,
        error: null,
        reportId: null,
      });
      expect(result.current.showSuccessConfirmation).toBe(false);
    });

    it('should clear error state on reset', async () => {
      mockedRequestExport.mockRejectedValue(new Error('Test error'));

      const { result } = renderHook(() => useBatchExport('COMPLETED'));

      await act(async () => {
        await result.current.exportBatch(mockBatchId, 'pdf');
      });

      expect(result.current.state.error).toBe('Test error');

      act(() => {
        result.current.reset();
      });

      expect(result.current.state.error).toBeNull();
    });
  });

  describe('Cancel functionality', () => {
    it('should cancel ongoing export and reset state', async () => {
      const generatingResponse: BatchExportResponse = {
        status: 'generating',
        reportId: 'report_pending',
      };

      mockedRequestExport.mockResolvedValue(generatingResponse);
      mockedGetStatus.mockResolvedValue(generatingResponse);

      const { result } = renderHook(() => useBatchExport('COMPLETED'));

      // Start export
      act(() => {
        result.current.exportBatch(mockBatchId, 'pdf');
      });

      expect(result.current.state.status).toBe('generating');

      // Cancel
      act(() => {
        result.current.cancel();
      });

      expect(result.current.state.status).toBe('idle');
      expect(result.current.isExporting).toBe(false);
    });
  });

  describe('Format tracking', () => {
    it('should track PDF format during export', async () => {
      const mockResponse: BatchExportResponse = {
        status: 'ready',
        url: 'https://s3.example.com/batch-report.pdf',
        expiresAt: '2025-12-29T10:00:00Z',
        reportId: 'report_123',
      };
      mockedRequestExport.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useBatchExport('COMPLETED'));

      act(() => {
        result.current.exportBatch(mockBatchId, 'pdf');
      });

      expect(result.current.state.format).toBe('pdf');
    });

    it('should track JSON format during export', async () => {
      const mockResponse: BatchExportResponse = {
        status: 'ready',
        url: 'https://s3.example.com/batch-report.json',
        expiresAt: '2025-12-29T10:00:00Z',
        reportId: 'report_456',
      };
      mockedRequestExport.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useBatchExport('COMPLETED'));

      act(() => {
        result.current.exportBatch(mockBatchId, 'json');
      });

      expect(result.current.state.format).toBe('json');
    });
  });

  describe('Error handling', () => {
    it('should handle API errors', async () => {
      const errorMessage = 'API request failed';
      mockedRequestExport.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useBatchExport('COMPLETED'));

      await act(async () => {
        await result.current.exportBatch(mockBatchId, 'pdf');
      });

      expect(result.current.state.status).toBe('error');
      expect(result.current.state.error).toBe(errorMessage);
    });

    it('should handle non-Error rejections', async () => {
      mockedRequestExport.mockRejectedValue('String error');

      const { result } = renderHook(() => useBatchExport('COMPLETED'));

      await act(async () => {
        await result.current.exportBatch(mockBatchId, 'pdf');
      });

      expect(result.current.state.error).toBe('Failed to export batch report');
    });

    it('should handle failed response from initial request', async () => {
      const failedResponse: BatchExportResponse = {
        status: 'failed',
        errorMessage: 'Report generation failed',
      };
      mockedRequestExport.mockResolvedValue(failedResponse);

      const { result } = renderHook(() => useBatchExport('COMPLETED'));

      await act(async () => {
        await result.current.exportBatch(mockBatchId, 'pdf');
      });

      expect(result.current.state.status).toBe('error');
      expect(result.current.state.error).toBe('Report generation failed');
    });
  });

  describe('isExporting property', () => {
    it('should be true when generating', async () => {
      const generatingResponse: BatchExportResponse = {
        status: 'generating',
        reportId: 'report_pending',
      };
      mockedRequestExport.mockResolvedValue(generatingResponse);
      mockedGetStatus.mockResolvedValue(generatingResponse);

      const { result } = renderHook(() => useBatchExport('COMPLETED'));

      expect(result.current.isExporting).toBe(false);

      act(() => {
        result.current.exportBatch(mockBatchId, 'pdf');
      });

      expect(result.current.isExporting).toBe(true);
    });

    it('should be false after completion', async () => {
      const mockResponse: BatchExportResponse = {
        status: 'ready',
        url: 'https://s3.example.com/batch-report.pdf',
        expiresAt: '2025-12-29T10:00:00Z',
        reportId: 'report_123',
      };
      mockedRequestExport.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useBatchExport('COMPLETED'));

      await act(async () => {
        await result.current.exportBatch(mockBatchId, 'pdf');
      });

      expect(result.current.isExporting).toBe(false);
    });

    it('should be false after error', async () => {
      mockedRequestExport.mockRejectedValue(new Error('Error'));

      const { result } = renderHook(() => useBatchExport('COMPLETED'));

      await act(async () => {
        await result.current.exportBatch(mockBatchId, 'pdf');
      });

      expect(result.current.isExporting).toBe(false);
    });
  });

  describe('Download behavior', () => {
    it('should create blob URL and trigger download', async () => {
      const mockResponse: BatchExportResponse = {
        status: 'ready',
        url: 'https://s3.example.com/batch-report.pdf',
        expiresAt: '2025-12-29T10:00:00Z',
        reportId: 'report_123',
      };
      mockedRequestExport.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useBatchExport('COMPLETED'));

      await act(async () => {
        await result.current.exportBatch(mockBatchId, 'pdf');
      });

      expect(global.fetch).toHaveBeenCalledWith(mockResponse.url);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should cleanup blob URL after download', async () => {
      const mockResponse: BatchExportResponse = {
        status: 'ready',
        url: 'https://s3.example.com/batch-report.pdf',
        expiresAt: '2025-12-29T10:00:00Z',
        reportId: 'report_123',
      };
      mockedRequestExport.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useBatchExport('COMPLETED'));

      await act(async () => {
        await result.current.exportBatch(mockBatchId, 'pdf');
      });

      // Fast-forward to cleanup
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });
  });
});
